import { supabase } from '../../integrations/supabase/client'

export interface ProductFeedOptions {
  userId?: string
  status?: string
  limit?: number
  province?: string
  search?: string
  category?: string
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
}: ProductFeedOptions = {}) => {
  let query = supabase
    .from('products')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit)

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
  const userIds = [...new Set(productsData.map((p) => p.user_id).filter(Boolean))]

  const [{ data: users, error: usersError }, { data: likes, error: likesError }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, full_name, user_type, avatar_url, verified').in('id', userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase.from('product_likes').select('id, product_id, user_id').in('product_id', productIds),
  ])

  if (usersError) throw usersError
  if (likesError) throw likesError

  const userById = new Map((users || []).map((u) => [u.id, u]))
  const productLikesById = new Map<string, number>()
  const likedProductIds = new Set<string>()

  for (const like of likes || []) {
    productLikesById.set(like.product_id, (productLikesById.get(like.product_id) || 0) + 1)
    if (userId && like.user_id === userId) likedProductIds.add(like.product_id)
  }

  return productsData.map((product) => ({
    ...product,
    likes_count: productLikesById.get(product.id) || 0,
    is_liked: likedProductIds.has(product.id),
    user_verified: userById.get(product.user_id)?.verified || false,
    comments: [],
  }))
}

export const fetchActiveProducts = async (userId?: string) => {
  try {
    const products = await fetchProductsFeed({ userId, status: 'active', limit: 100 })

    const ranked = [...products].sort((a, b) => {
      const now = Date.now()
      const day = 864e5
      const score = (product: typeof products[number]) =>
        Math.max(0, 7 - (now - new Date(product.created_at).getTime()) / day) * 0.4 +
        (product.likes_count || 0) * 0.3 +
        (product.comments?.length || 0) * 0.3

      return score(b) - score(a)
    })

    return ranked.slice(0, 20)
  } catch (error) {
    console.warn('[AgriLink] Product feed unavailable; returning empty result set.', error)
    return []
  }
}


export const fetchProductById = async (productId: string, userId?: string) => {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  if (!product) return null

  const [userResult, likesResult] = await Promise.all([
    supabase.from('users').select('id, full_name, user_type, avatar_url, verified').eq('id', product.user_id).maybeSingle(),
    supabase.from('product_likes').select('id, user_id').eq('product_id', productId),
  ])

  if (userResult.error) throw userResult.error
  if (likesResult.error) throw likesResult.error

  return {
    ...product,
    farmer_name: product.farmer_name || userResult.data?.full_name || 'Fornecedor',
    user_verified: userResult.data?.verified || false,
    likes_count: likesResult.data?.length || 0,
    is_liked: Boolean(userId && likesResult.data?.some((like) => like.user_id === userId)),
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
