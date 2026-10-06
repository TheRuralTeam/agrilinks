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

  const [{ data: users }, { data: likes }, { data: comments }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, full_name, user_type, avatar_url, verified').in('id', userIds)
      : Promise.resolve({ data: [] }),
    supabase.from('product_likes').select('id, product_id, user_id').in('product_id', productIds),
    supabase
      .from('product_comments')
      .select('id, product_id, user_id, comment_text, created_at')
      .in('product_id', productIds)
      .order('created_at', { ascending: false }),
  ])

  const commentRows = comments || []
  const commentIds = commentRows.map((comment) => comment.id)
  const commentUserIds = [...new Set(commentRows.map((comment) => comment.user_id).filter(Boolean))]

  const [{ data: commentLikes }, { data: replies }, { data: commentUsers }] = await Promise.all([
    commentIds.length
      ? supabase.from('comment_likes').select('id, comment_id, user_id').in('comment_id', commentIds)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase
          .from('comment_replies')
          .select('id, comment_id, user_id, reply_text, created_at')
          .in('comment_id', commentIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    commentUserIds.length
      ? supabase.from('users').select('id, full_name, user_type, avatar_url').in('id', commentUserIds)
      : Promise.resolve({ data: [] }),
  ])

  const replyRows = replies || []
  const replyUserIds = [...new Set(replyRows.map((reply) => reply.user_id).filter(Boolean))]
  const { data: replyUsers } = replyUserIds.length
    ? await supabase.from('users').select('id, full_name, user_type').in('id', replyUserIds)
    : { data: [] }

  const userById = new Map((users || []).map((u) => [u.id, u]))
  const commentUserById = new Map((commentUsers || []).map((u) => [u.id, u]))
  const replyUserById = new Map((replyUsers || []).map((u) => [u.id, u]))

  const productLikesById = new Map<string, number>()
  const likedProductIds = new Set<string>()
  for (const like of likes || []) {
    productLikesById.set(like.product_id, (productLikesById.get(like.product_id) || 0) + 1)
    if (userId && like.user_id === userId) likedProductIds.add(like.product_id)
  }

  const commentLikesById = new Map<string, number>()
  const likedCommentIds = new Set<string>()
  for (const like of commentLikes || []) {
    commentLikesById.set(like.comment_id, (commentLikesById.get(like.comment_id) || 0) + 1)
    if (userId && like.user_id === userId) likedCommentIds.add(like.comment_id)
  }

  const repliesByCommentId = new Map<string, typeof replyRows>()
  for (const reply of replyRows) {
    const list = repliesByCommentId.get(reply.comment_id) || []
    list.push(reply)
    repliesByCommentId.set(reply.comment_id, list)
  }

  const commentsByProductId = new Map<string, typeof commentRows>()
  for (const comment of commentRows) {
    const list = commentsByProductId.get(comment.product_id) || []
    list.push(comment)
    commentsByProductId.set(comment.product_id, list)
  }

  return productsData.map((product) => ({
    ...product,
    likes_count: productLikesById.get(product.id) || 0,
    is_liked: likedProductIds.has(product.id),
    user_verified: userById.get(product.user_id)?.verified || false,
    comments: (commentsByProductId.get(product.id) || []).map((comment) => ({
      ...comment,
      user_name: commentUserById.get(comment.user_id)?.full_name || 'Utilizador',
      user_type: commentUserById.get(comment.user_id)?.user_type || 'agricultor',
      user_avatar: commentUserById.get(comment.user_id)?.avatar_url,
      likes_count: commentLikesById.get(comment.id) || 0,
      is_liked: likedCommentIds.has(comment.id),
      replies: (repliesByCommentId.get(comment.id) || []).map((reply) => ({
        ...reply,
        user_name: replyUserById.get(reply.user_id)?.full_name || 'Utilizador',
        user_type: replyUserById.get(reply.user_id)?.user_type || 'agricultor',
      })),
    })),
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
