import { supabase } from '../../integrations/supabase/client'

export interface ProductFeedOptions {
  userId?: string
  ownerId?: string
  status?: string
  limit?: number
  province?: string
  search?: string
  category?: string
  page?: number
  signal?: AbortSignal
}

/**
 * Loads the marketplace feed in batches instead of making one request per
 * product/comment/reply. This keeps the number of database round-trips
 * approximately constant as the feed grows.
 */
export const fetchProductsFeed = async ({
  userId,
  ownerId,
  status = 'active',
  limit = 20,
  province,
  search,
  category,
  page = 0,
  signal,
}: ProductFeedOptions = {}) => {
  let query = supabase
    .from('products')
    .select('id,user_id,product_type,quantity,harvest_date,price,province_id,municipality_id,logistics_access,farmer_name,photos,status,created_at,updated_at,description,location_lat,location_lng,category,likes_count,sale_unit,min_order_quantity,package_weight_kg,product_variety,product_condition,packaging_type')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1)
  if (signal) query = query.abortSignal(signal)

  if (ownerId) query = query.eq('user_id', ownerId)
  if (province) query = query.eq('province_id', province)

  if (search?.trim()) {
    const term = search.trim().replace(/[%(),]/g, ' ')
    query = query.or(`product_type.ilike.%${term}%,description.ilike.%${term}%,farmer_name.ilike.%${term}%`)
  }

  if (category && category !== 'all') {
    query = query.ilike('category', `%${category}%`)
  }

  const { data: productsData, error: productsError } = await query
  if (productsError) throw productsError
  if (!productsData?.length) return []

  const productIds = productsData.map((p) => p.id)
  const userIds = [...new Set(productsData.map((product) => product.user_id).filter(Boolean))]
  let profilesQuery = supabase.from('public_user_profiles').select('id, verified').in('id', userIds)
  let likesQuery = supabase.from('product_likes').select('product_id').eq('user_id', userId || '').in('product_id', productIds)
  let commentsQuery = supabase.from('product_comments').select('product_id').in('product_id', productIds)
  if (signal) {
    profilesQuery = profilesQuery.abortSignal(signal)
    likesQuery = likesQuery.abortSignal(signal)
    commentsQuery = commentsQuery.abortSignal(signal)
  }
  const [
    { data: publicProfiles, error: profilesError },
    { data: myLikes, error: likesError },
    { data: commentRows, error: commentsError },
  ] = await Promise.all([
    userIds.length
      ? profilesQuery
      : Promise.resolve({ data: [] as { id: string; verified: boolean | null }[], error: null }),
    userId
      ? likesQuery
      : Promise.resolve({ data: [], error: null }),
    commentsQuery,
  ])

  if (profilesError) throw profilesError
  if (likesError) throw likesError
  if (commentsError) throw commentsError

  const verifiedByUserId = new Map<string, boolean>(
    (publicProfiles || []).map((profile): [string, boolean] => [profile.id, profile.verified === true]),
  )
  const likedProductIds = new Set((myLikes || []).map((like) => like.product_id))
  const commentCounts = new Map<string, number>()
  for (const comment of commentRows || []) {
    commentCounts.set(comment.product_id, (commentCounts.get(comment.product_id) || 0) + 1)
  }

  return productsData.map((product) => ({
    ...product,
    likes_count: Number(product.likes_count || 0),
    is_liked: likedProductIds.has(product.id),
    user_verified: verifiedByUserId.get(product.user_id) ?? false,
    comments_count: commentCounts.get(product.id) || 0,
    comments: [],
  }))
}

export const fetchActiveProducts = async (userId?: string, page = 0, limit = 20, signal?: AbortSignal) =>
  fetchProductsFeed({ userId, status: 'active', limit, page, signal })

export const fetchProductsByOwner = async (ownerId: string, userId?: string, limit = 20) =>
  fetchProductsFeed({ ownerId, userId, status: 'active', limit, page: 0 })


export const fetchProductById = async (productId: string, userId?: string) => {
  const { data: product, error } = await supabase
    .from('products')
     .select('id,user_id,product_type,quantity,harvest_date,price,province_id,municipality_id,logistics_access,farmer_name,contact,photos,status,created_at,updated_at,description,location_lat,location_lng,category,likes_count,sale_unit,min_order_quantity,package_weight_kg,product_variety,product_condition,packaging_type')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  if (!product) return null

  const [{ data: publicProfile, error: profileError }, likesResult, commentsCountResult] = await Promise.all([
    supabase.from('public_user_profiles').select('verified').eq('id', product.user_id).maybeSingle(),
    userId
      ? supabase.from('product_likes').select('id').eq('product_id', productId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('product_comments').select('id', { count: 'exact', head: true }).eq('product_id', productId),
  ])

  if (profileError) throw profileError
  if (likesResult.error) throw likesResult.error
  if (commentsCountResult.error) throw commentsCountResult.error

  return {
    ...product,
    farmer_name: product.farmer_name || 'Fornecedor',
    user_verified: Boolean(publicProfile?.verified),
    likes_count: Number(product.likes_count || 0),
    is_liked: Boolean(likesResult.data),
    comments_count: commentsCountResult.count || 0,
    comments: [],
  }
}

export const fetchProductComments = async (productId: string, userId?: string) => {
  const { data: comments, error } = await supabase
    .from('product_comments')
    .select('id, product_id, user_id, comment_text, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!comments?.length) return []

  const commentIds = comments.map((comment) => comment.id)
  const userIds = [...new Set(comments.map((comment) => comment.user_id).filter(Boolean))]

  const [likesResult, repliesResult, usersResult] = await Promise.all([
    supabase.from('comment_likes').select('id, comment_id, user_id').in('comment_id', commentIds),
    supabase.from('comment_replies').select('id, comment_id, user_id, reply_text, created_at').in('comment_id', commentIds).order('created_at', { ascending: true }),
    userIds.length
      ? supabase.from('public_user_profiles').select('id, full_name, user_type, avatar_url').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; user_type: string | null; avatar_url: string | null }[], error: null }),
  ])

  if (likesResult.error) throw likesResult.error
  if (repliesResult.error) throw repliesResult.error
  if (usersResult.error) throw usersResult.error

  const likes = likesResult.data || []
  const replyRows = repliesResult.data || []
  const replyUserIds = [...new Set(replyRows.map((reply) => reply.user_id).filter(Boolean))]
  const replyUsersResult = replyUserIds.length
    ? await supabase.from('public_user_profiles').select('id, full_name, user_type').in('id', replyUserIds)
    : { data: [] as { id: string; full_name: string | null; user_type: string | null }[], error: null }

  if (replyUsersResult.error) throw replyUsersResult.error

  const users = usersResult.data || []
  const replyUsers = replyUsersResult.data || []
  const userById = new Map(users.map((u): [string, (typeof users)[number]] => [u.id, u]))
  const replyUserById = new Map(replyUsers.map((u): [string, (typeof replyUsers)[number]] => [u.id, u]))
  const repliesByComment = new Map<string, typeof replyRows>()
  for (const reply of replyRows) {
    const list = repliesByComment.get(reply.comment_id) || []
    list.push(reply)
    repliesByComment.set(reply.comment_id, list)
  }

  const likesByComment = new Map<string, number>()
  const likedComments = new Set<string>()
  for (const like of likes || []) {
    likesByComment.set(like.comment_id, (likesByComment.get(like.comment_id) || 0) + 1)
    if (userId && like.user_id === userId) likedComments.add(like.comment_id)
  }

  return comments.map((comment) => ({
    ...comment,
    user_name: userById.get(comment.user_id)?.full_name || 'Utilizador AgriLink',
    user_type: userById.get(comment.user_id)?.user_type || 'utilizador',
    user_avatar: userById.get(comment.user_id)?.avatar_url,
    likes_count: likesByComment.get(comment.id) || 0,
    is_liked: likedComments.has(comment.id),
    replies: (repliesByComment.get(comment.id) || []).map((reply) => ({
      ...reply,
      user_name: replyUserById.get(reply.user_id)?.full_name || 'Utilizador AgriLink',
      user_type: replyUserById.get(reply.user_id)?.user_type || 'utilizador',
    })),
  }))
}
