import { supabase } from '../../integrations/supabase/client'

export const fetchActiveProducts = async (userId?: string) => {
  try {
    const { data: productsData, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .limit(100)

    if (error) throw error

    if (!productsData || productsData.length === 0) {
      return []
    }

    const productsWithData = await Promise.all(
      (productsData || []).map(async (product) => {
        const { data: productUser } = await supabase
          .from('users')
          .select('verified')
          .eq('id', product.user_id)
          .maybeSingle()

        const { count: likesCount } = await supabase
          .from('product_likes')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)

        const { data: userLike } = userId
          ? await supabase
              .from('product_likes')
              .select('id')
              .eq('product_id', product.id)
              .eq('user_id', userId)
              .maybeSingle()
          : { data: null }

        const { data: comments } = await supabase
          .from('product_comments')
          .select('id, user_id, comment_text, created_at')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false })

        const commentsWithUserInfo = await Promise.all(
          (comments || []).map(async (comment) => {
            const { data: userData } = await supabase
              .from('users')
              .select('full_name, user_type, avatar_url')
              .eq('id', comment.user_id)
              .maybeSingle()

            const { count: cLikes } = await supabase
              .from('comment_likes')
              .select('*', { count: 'exact', head: true })
              .eq('comment_id', comment.id)

            const { data: userCLike } = userId
              ? await supabase
                  .from('comment_likes')
                  .select('id')
                  .eq('comment_id', comment.id)
                  .eq('user_id', userId)
                  .maybeSingle()
              : { data: null }

            const { data: replies } = await supabase
              .from('comment_replies')
              .select('id, user_id, reply_text, created_at')
              .eq('comment_id', comment.id)
              .order('created_at', { ascending: true })

            const repliesWithUser = await Promise.all(
              (replies || []).map(async (reply) => {
                const { data: ru } = await supabase
                  .from('users')
                  .select('full_name, user_type')
                  .eq('id', reply.user_id)
                  .maybeSingle()

                return {
                  ...reply,
                  user_name: ru?.full_name || 'Utilizador',
                  user_type: ru?.user_type || 'agricultor',
                }
              })
            )

            return {
              ...comment,
              user_name: userData?.full_name || 'Utilizador',
              user_type: userData?.user_type || 'agricultor',
              user_avatar: userData?.avatar_url,
              likes_count: cLikes || 0,
              is_liked: !!userCLike,
              replies: repliesWithUser,
            }
          })
        )

        return {
          ...product,
          likes_count: likesCount || 0,
          is_liked: !!userLike,
          comments: commentsWithUserInfo,
          user_verified: productUser?.verified || false,
        }
      })
    )

    const ranked = productsWithData.sort((a, b) => {
      const now = Date.now()
      const day = 864e5
      const scoreA =
        Math.max(0, 7 - (now - new Date(a.created_at).getTime()) / day) * 0.4 +
        (a.likes_count || 0) * 0.3 +
        (a.comments?.length || 0) * 0.3

      const scoreB =
        Math.max(0, 7 - (now - new Date(b.created_at).getTime()) / day) * 0.4 +
        (b.likes_count || 0) * 0.3 +
        (b.comments?.length || 0) * 0.3

      return scoreB - scoreA
    })

    return ranked.slice(0, 20)
  } catch (error) {
    console.warn('[AgriLink] Product feed unavailable; returning empty result set because no real data should be fabricated.', error)
    return []
  }
}
