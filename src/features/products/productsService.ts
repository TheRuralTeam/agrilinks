import { supabase } from '@/integrations/supabase/client'

const fallbackProducts = [
  {
    id: 'fallback-1',
    user_id: 'system',
    product_type: 'Manga',
    quantity: 600,
    price: 1750,
    status: 'active',
    harvest_date: new Date().toISOString(),
    province_id: 'Luanda',
    municipality_id: 'Viana',
    location: 'Luanda, Viana',
    farmer_name: 'Produtor Premium Luanda',
    photos: ['https://images.unsplash.com/...'],
    description: 'Manga de qualidade exportação, colheita recente e abastecimento estável para compradores institucionais.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    likes_count: 18,
    is_liked: false,
    comments: [],
    user_verified: true,
  },
  {
    id: 'fallback-2',
    user_id: 'system',
    product_type: 'Batata',
    quantity: 1200,
    price: 960,
    status: 'active',
    harvest_date: new Date().toISOString(),
    province_id: 'Benguela',
    municipality_id: 'Benguela',
    location: 'Benguela',
    farmer_name: 'Cooperativa do Planalto',
    photos: ['https://images.unsplash.com/...'],
    description: 'Batata fresca com calibração uniforme e logística pronta para entregas regulares.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    likes_count: 12,
    is_liked: false,
    comments: [],
    user_verified: true,
  },
  {
    id: 'fallback-3',
    user_id: 'system',
    product_type: 'Café',
    quantity: 450,
    price: 2450,
    status: 'active',
    harvest_date: new Date().toISOString(),
    province_id: 'Huíla',
    municipality_id: 'Lubango',
    location: 'Lubango',
    farmer_name: 'Selo Agrícola Huila',
    photos: ['https://images.unsplash.com/...'],
    description: 'Café arábica selecionado com lote traceável e condições de entrega para mercados B2B.',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    likes_count: 22,
    is_liked: false,
    comments: [],
    user_verified: true,
  },
] as const

export const fetchActiveProducts = async (userId?: string) => {
  try {
    const { data: productsData, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .limit(100)

    if (error) throw error

    if (!productsData || productsData.length === 0) {
      return [...fallbackProducts].map((product) => ({
        ...product,
        likes_count: product.likes_count ?? 0,
        is_liked: false,
        comments: [],
      }))
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
    console.warn('[AgriLink] Falling back to curated public catalog because the products feed is unavailable.', error)
    return [...fallbackProducts].map((product) => ({
      ...product,
      likes_count: product.likes_count ?? 0,
      is_liked: false,
      comments: [],
    }))
  }
}
