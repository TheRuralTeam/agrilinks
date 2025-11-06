import React, { useState } from 'react'
import Slider from 'react-slick'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Heart, MessageCircle, Calendar, Map, Send, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import "slick-carousel/slick/slick.css"
import "slick-carousel/slick/slick-theme.css"

interface Comment {
  id: string
  user_id: string
  comment_text: string
  created_at: string
  user_name: string
  user_type: string
}

export interface Product {
  id: string
  product_type: string
  description?: string
  quantity: number
  harvest_date: string
  price: number
  province_id: string
  municipality_id: string
  farmer_name: string
  contact: string
  photos: string[] | null
  status: 'active' | 'inactive' | 'removed'
  created_at: string
  user_id: string
  location_lat?: number
  location_lng?: number
  likes_count?: number
  is_liked?: boolean
  comments?: Comment[]
}

interface ProductCardProps {
  product: Product
  onProductUpdate?: (product: Product) => void
  onOpenMap?: (product: Product) => void
  onOpenPreOrder?: (product: Product) => void
}

const CustomPrevArrow = ({ onClick }: { onClick?: () => void }) => (
  <button onClick={onClick} className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-10">
    <ChevronLeft className="h-5 w-5" />
  </button>
)

const CustomNextArrow = ({ onClick }: { onClick?: () => void }) => (
  <button onClick={onClick} className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-10">
    <ChevronRight className="h-5 w-5" />
  </button>
)

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onProductUpdate,
  onOpenMap,
  onOpenPreOrder
}) => {
  const { user } = useAuth()
  const [commentVisible, setCommentVisible] = useState(false)
  const [comment, setComment] = useState('')

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const formatPrice = (p: number) => `${p.toLocaleString()} Kz`

  const toggleLike = async () => {
    if (!user) return toast.error('Faça login para dar like')
    if (!onProductUpdate) return

    try {
      if (product.is_liked) {
        await supabase.from('product_likes').delete().eq('product_id', product.id).eq('user_id', user.id)
        onProductUpdate({ 
          ...product, 
          is_liked: false, 
          likes_count: (product.likes_count || 1) - 1 
        })
        toast.success('Like removido')
      } else {
        await supabase.from('product_likes').insert({ product_id: product.id, user_id: user.id })
        onProductUpdate({ 
          ...product, 
          is_liked: true, 
          likes_count: (product.likes_count || 0) + 1 
        })
        toast.success('Produto curtido!')
      }
    } catch {
      toast.error('Erro ao processar like')
    }
  }

  const addComment = async () => {
    if (!user || !comment.trim()) return toast.error('Faça login ou escreva um comentário')
    if (!onProductUpdate) return

    try {
      const { data: newComment } = await supabase
        .from('product_comments')
        .insert({ product_id: product.id, user_id: user.id, comment_text: comment.trim() })
        .select()
        .single()

      const { data: userData } = await supabase
        .from('users')
        .select('full_name, user_type')
        .eq('id', user.id)
        .single()

      const commentWithUserInfo = { 
        ...newComment, 
        user_name: userData?.full_name || 'Usuário', 
        user_type: userData?.user_type || 'agricultor' 
      }

      onProductUpdate({ 
        ...product, 
        comments: [commentWithUserInfo, ...(product.comments || [])] 
      })
      setComment('')
      toast.success('Comentário adicionado!')
    } catch {
      toast.error('Erro ao adicionar comentário')
    }
  }

  const sliderSettings = {
    dots: true,
    infinite: true,
    fade: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: true,
    nextArrow: <CustomNextArrow />,
    prevArrow: <CustomPrevArrow />
  }

  return (
    <Card className="shadow-soft border-card-border overflow-hidden">
      <div className="p-4 pb-2 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{product.farmer_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{product.farmer_name}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {product.province_id}
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">{product.product_type}</Badge>
      </div>

      <div className="mx-4 mb-3 rounded-lg overflow-hidden bg-muted relative">
        <Slider {...sliderSettings}>
          {product.photos?.map((photo, i) => (
            <img key={i} src={photo} className="w-full h-72 object-cover" alt={product.product_type} />
          ))}
        </Slider>
      </div>

      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-semibold text-lg">{product.product_type}</h4>
            <p className="text-sm text-muted-foreground">{product.quantity.toLocaleString()} kg</p>
          </div>
          <span className="text-2xl font-bold text-primary">{formatPrice(product.price)}</span>
        </div>

        <p className="text-sm text-muted-foreground">{product.description}</p>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" /> Colheita: {formatDate(product.harvest_date)}
        </div>

        {/* BOTÕES */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLike}
              className={`flex items-center gap-1 transition-all ${
                product.is_liked ? 'text-red-500 hover:text-red-600' : 'hover:text-red-500'
              }`}
            >
              <Heart className={`h-5 w-5 ${product.is_liked ? 'fill-current' : ''}`} />
              {product.likes_count ? <span className="text-xs">{product.likes_count}</span> : null}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCommentVisible(!commentVisible)}
              className="flex items-center gap-1"
            >
              <MessageCircle className="h-5 w-5" />
              {product.comments?.length ? <span className="text-xs">{product.comments.length}</span> : null}
            </Button>

            {product.location_lat && product.location_lng && onOpenMap && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenMap(product)}
                className="flex items-center gap-1"
              >
                <Map className="h-5 w-5" />
              </Button>
            )}
          </div>

          {onOpenPreOrder && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
              onClick={() => onOpenPreOrder(product)}
            >
              Pré-Compra
            </Button>
          )}
        </div>

        {/* COMENTÁRIOS */}
        {commentVisible && (
          <div className="pt-3 space-y-3">
            <div className="relative">
              <Input
                type="text"
                placeholder="Escreva um comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') addComment() }}
                className="pr-12"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={addComment}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:bg-primary/10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {product.comments?.length ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {product.comments.map(c => (
                  <div key={c.id} className="bg-muted/50 p-3 rounded-lg border">
                    <div className="flex items-start gap-2">
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="text-xs">{c.user_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{c.user_name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{c.user_type}</Badge>
                        </div>
                        <p className="text-sm">{c.comment_text}</p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {formatDate(c.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
