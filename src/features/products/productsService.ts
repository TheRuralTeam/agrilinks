import { supabase } from '../../integrations/supabase/client'

export interface ProductFeedOptions {
  userId?: string
  status?: string
  limit?: number
  province?: string
  search?: string
  category?: string
  page?: number
}

/**
 * Loads the marketplace feed in batches instead of making one request per
 * product/comment/reply. This keeps the number of database round-trips
 * approximately constant as the feed grows.
 */
export const fetchProductsFeed = async ({
  userId,
  status = 'active',
  limit = 20,
  province,
  search,
  category,
  page = 0,
}: ProductFeedOptions = {}) => {
  let query = supabase
    .from('products')
    .select('id,user_id,product_type,quantity,harvest_date,price,province_id,municipality_id,logistics_access,farmer_name,photos,status,created_at,updated_at,description,location_lat,location_lng,category,likes_count')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1)

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
  const [{ data: publicProfiles, error: profilesError }, { data: myLikes, error: likesError }] = await Promise.all([
    userIds.length
      ? supabase.from('public_user_profiles').select('id, verified').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; verified: boolean | null }[], error: null }),
    userId
      ? supabase.from('product_likes').select('product_id').eq('user_id', userId).in('product_id', productIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profilesError) throw profilesError
  if (likesError) throw likesError

  const verifiedByUserId = new Map((publicProfiles || []).map((profile) => [profile.id, Boolean(profile.verified)]))
  const likedProductIds = new Set((myLikes || []).map((like) => like.product_id))

  return productsData.map((product) => ({
    ...product,
    likes_count: Number(product.likes_count || 0),
    is_liked: likedProductIds.has(product.id),
    user_verified: verifiedByUserId.get(product.user_id) ?? false,
    comments: [],
  }))
}

export const fetchActiveProducts = async (userId?: string, page = 0, limit = 20) => {
  try {
    return await fetchProductsFeed({ userId, status: 'active', limit, page })
  } catch (error) {
    console.warn('[AgriLink] Product feed unavailable:', error)
    return []
  }
}


export const fetchProductById = async (productId: string, userId?: string) => {
  const { data: product, error } = await supabase
    .from('products')
     .select('id,user_id,product_type,quantity,harvest_date,price,province_id,municipality_id,logistics_access,farmer_name,contact,photos,status,created_at,updated_at,description,location_lat,location_lng,category,likes_count')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  if (!product) return null

  const [{ data: publicProfile, error: profileError }, likesResult] = await Promise.all([
    supabase.from('public_user_profiles').select('verified').eq('id', product.user_id).maybeSingle(),
    userId
      ? supabase.from('product_likes').select('id').eq('product_id', productId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (profileError) throw profileError
  if (likesResult.error) throw likesResult.error

  return {
    ...product,
    farmer_name: product.farmer_name || 'Fornecedor',
    user_verified: Boolean(publicProfile?.verified),
    likes_count: Number(product.likes_count || 0),
    is_liked: Boolean(likesResult.data),
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

  const [{ data: likes }, { data: replies }, { data: users }] = await Promise.all([
    supabase.from('comment_likes').select('id, comment_id, user_id').in('comment_id', commentIds),
    supabase.from('comment_replies').select('id, comment_id, user_id, reply_text, created_at').in('comment_id', commentIds).order('created_at', { ascending: true }),
    userIds.length
      ? supabase.from('users').select('id, full_name, user_type, avatar_url').in('id', userIds)
      : Promise.resolve({ data: [] }),
  ])

  const replyRows = replies || []
  const replyUserIds = [...new Set(replyRows.map((reply) => reply.user_id).filter(Boolean))]
  const { data: replyUsers } = replyUserIds.length
    ? await supabase.from('users').select('id, full_name, user_type').in('id', replyUserIds)
    : { data: [] }

  const userById = new Map((users || []).map((u) => [u.id, u]))
  const replyUserById = new Map((replyUsers || []).map((u) => [u.id, u]))
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
    user_name: userById.get(comment.user_id)?.full_name || 'Utilizador',
    user_type: userById.get(comment.user_id)?.user_type || 'agricultor',
    user_avatar: userById.get(comment.user_id)?.avatar_url,
    likes_count: likesByComment.get(comment.id) || 0,
    is_liked: likedComments.has(comment.id),
    replies: (repliesByComment.get(comment.id) || []).map((reply) => ({
      ...reply,
      user_name: replyUserById.get(reply.user_id)?.full_name || 'Utilizador',
      user_type: replyUserById.get(reply.user_id)?.user_type || 'agricultor',
    })),
  }))
}
