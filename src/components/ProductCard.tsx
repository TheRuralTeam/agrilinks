import React, { useState, useEffect, useRef, memo } from 'react'
import Slider from 'react-slick'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Heart, MessageCircle, Calendar, MapPin, Send, ChevronLeft, ChevronRight,
  ShoppingCart, Reply, ThumbsUp, BadgeCheck, TrendingUp, Clock, Eye, Share2, Leaf
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCanAct } from '@/hooks/useCanAct'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import "slick-carousel/slick/slick.css"
import "slick-carousel/slick/slick-theme.css"

/* ─── Brand tokens (AgriLink) ──────────────────────────────────────────────── */
const brand = {
  green:       '#2D7D3A',   // deep forest green — logo primary
  greenLight:  '#4CAF50',   // fresh mid-green
  greenPale:   '#E8F5E9',   // mint tint background
  earth:       '#7B4F2E',   // warm brown / castanho
  earthLight:  '#A0522D',
  earthPale:   '#FDF3EC',   // pale terracotta
  cream:       '#FAFAF7',   // off-white base
  charcoal:    '#1C2B1E',   // near-black text
  muted:       '#6B7C6E',   // muted sage-grey
  border:      '#D4E8D1',   // soft green border
  gold:        '#C8860A',   // harvest gold accent
  goldLight:   '#F5A623',
}

/* ─── Inline styles (CSS vars not available via Tailwind here) ─────────────── */
const styles: Record<string, React.CSSProperties> = {
  card: {
    background: brand.cream,
    border: `1.5px solid ${brand.border}`,
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(45,125,58,0.08)',
    transition: 'box-shadow 0.4s ease, transform 0.4s ease',
    position: 'relative',
    fontFamily: "'Lato', 'Nunito', sans-serif",
  },
  cardHover: {
    boxShadow: '0 12px 40px rgba(45,125,58,0.18)',
    transform: 'translateY(-3px)',
  },
  imageBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  badgeNew: {
    background: `linear-gradient(135deg, ${brand.greenLight}, ${brand.green})`,
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: 20,
    letterSpacing: '0.05em',
    boxShadow: '0 2px 8px rgba(45,125,58,0.35)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  badgeDiscount: {
    background: `linear-gradient(135deg, ${brand.goldLight}, ${brand.gold})`,
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(200,134,10,0.35)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  shareBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    transition: 'transform 0.2s',
  },
  imageWrap: {
    position: 'relative',
    background: `linear-gradient(135deg, ${brand.greenPale}, #d4edda)`,
    aspectRatio: '4/3',
    overflow: 'hidden',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    background: 'linear-gradient(to top, rgba(28,43,30,0.45), transparent)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  content: {
    padding: '20px 20px 16px',
    background: brand.cream,
  },
  farmerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: `2.5px solid ${brand.green}`,
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${brand.green}, ${brand.greenLight})`,
    color: '#fff',
    fontWeight: 800,
    fontSize: 18,
    transition: 'transform 0.2s',
  },
  farmerName: {
    fontWeight: 800,
    fontSize: 15,
    color: brand.charcoal,
    cursor: 'pointer',
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 12,
    color: brand.muted,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  typeBadge: {
    marginLeft: 'auto',
    background: brand.greenPale,
    color: brand.green,
    border: `1px solid ${brand.border}`,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    whiteSpace: 'nowrap' as const,
  },
  productTitle: {
    fontWeight: 900,
    fontSize: 22,
    color: brand.green,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    marginBottom: 10,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  price: {
    fontSize: 28,
    fontWeight: 900,
    color: brand.earth,
    letterSpacing: '-0.03em',
  },
  priceOld: {
    fontSize: 13,
    color: brand.muted,
    textDecoration: 'line-through',
    fontWeight: 500,
  },
  stockRow: {
    fontSize: 12,
    color: brand.muted,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 600,
    marginBottom: 14,
  },
  buyBtn: {
    width: '100%',
    background: `linear-gradient(135deg, ${brand.green} 0%, ${brand.greenLight} 100%)`,
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    height: 48,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.25s ease',
    boxShadow: `0 4px 16px rgba(45,125,58,0.3)`,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  description: {
    fontSize: 13,
    color: brand.muted,
    lineHeight: 1.6,
    marginTop: 12,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
    paddingTop: 14,
    borderTop: `1px solid ${brand.border}`,
    fontSize: 12,
    color: brand.muted,
    fontWeight: 600,
    marginTop: 14,
  },
  locationBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: brand.earth,
    fontWeight: 700,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: 0,
    transition: 'opacity 0.2s',
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTop: `1px solid ${brand.border}`,
    marginTop: 14,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 12,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.2s',
  },
  commentBox: {
    paddingTop: 16,
    borderTop: `1px solid ${brand.border}`,
    marginTop: 14,
  },
  commentInputRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 14,
  },
  commentInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    border: `1.5px solid ${brand.border}`,
    padding: '0 14px',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.2s',
    background: '#fff',
    color: brand.charcoal,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: brand.green,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  commentItem: {
    background: brand.greenPale,
    borderRadius: 16,
    padding: '12px 14px',
    border: `1px solid ${brand.border}`,
    marginBottom: 10,
  },
  replyItem: {
    background: brand.earthPale,
    borderRadius: 10,
    padding: '8px 12px',
    border: `1px solid #e8d5c4`,
    fontSize: 12,
    marginBottom: 6,
  },
  emptyComments: {
    textAlign: 'center' as const,
    padding: '28px 0',
    color: brand.muted,
    fontSize: 13,
  },
  noPhoto: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: brand.muted,
    fontSize: 13,
    fontWeight: 600,
  },
}

/* ─── Arrow components ─────────────────────────────────────────────────────── */
const CustomPrevArrow = memo(({ onClick }: { onClick?: () => void }) => (
  <button onClick={onClick} style={{
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
    border: 'none', borderRadius: '50%', width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s',
  }} aria-label="Imagem anterior">
    <ChevronLeft size={18} color={brand.green} />
  </button>
))

const CustomNextArrow = memo(({ onClick }: { onClick?: () => void }) => (
  <button onClick={onClick} style={{
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
    border: 'none', borderRadius: '50%', width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s',
  }} aria-label="Próxima imagem">
    <ChevronRight size={18} color={brand.green} />
  </button>
))
CustomPrevArrow.displayName = 'CustomPrevArrow'
CustomNextArrow.displayName = 'CustomNextArrow'

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface CommentReply {
  id: string; user_id: string; reply_text: string; created_at: string
  user_name?: string; user_type?: string
}
interface Comment {
  id: string; user_id: string; comment_text: string; created_at: string
  user_name: string; user_type: string; user_avatar?: string
  likes_count?: number; is_liked?: boolean; replies?: CommentReply[]
}
export interface Product {
  id: string; product_type: string; description?: string; quantity: number
  harvest_date: string; price: number; province_id: string; municipality_id: string
  farmer_name: string; contact: string; photos: string[] | null
  status: 'active' | 'inactive' | 'removed'; created_at: string; user_id: string
  location_lat?: number; location_lng?: number
  likes_count?: number; is_liked?: boolean; comments?: Comment[]
  user_verified?: boolean
}
interface ProductCardProps {
  product: Product
  onProductUpdate?: (product: Product) => void
  onOpenMap?: (product: Product) => void
  onOpenPreOrder?: (product: Product) => void
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export const ProductCard: React.FC<ProductCardProps> = memo(({
  product, onProductUpdate, onOpenMap, onOpenPreOrder
}) => {
  const { user } = useAuth()
  const { requireAct } = useCanAct()
  const navigate = useNavigate()
  const [commentVisible, setCommentVisible] = useState(false)
  const [comment, setComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const formatPrice = (p: number) =>
    p.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' }).replace('AOA', 'Kz')

  const discount = product.quantity > 100 ? 15 : product.quantity > 50 ? 10 : 0
  const originalPrice = discount > 0 ? product.price / (1 - discount / 100) : product.price
  const isNew = (new Date().getTime() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24) < 7

  useEffect(() => {
    if (mapModalOpen && mapContainerRef.current && product.location_lat && product.location_lng) {
      mapboxgl.accessToken = 'pk.eyJ1IjoiYWdyaWxpbmthbyIsImEiOiJjbWJyaWNjOW8wYm5jMnFxdHJjNTZkZGN0In0.gYkUQOzg2xHYeS4CCbU-cw'
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [product.location_lng, product.location_lat],
        zoom: 13,
      })
      new mapboxgl.Marker({ color: brand.green })
        .setLngLat([product.location_lng, product.location_lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${product.product_type}</strong><br/>${product.farmer_name}`))
        .addTo(mapRef.current)
      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [mapModalOpen, product])

  const toggleLike = async () => {
    if (!requireAct('dar like')) return
    if (!onProductUpdate) return
    const optimisticUpdate = {
      ...product,
      is_liked: !product.is_liked,
      likes_count: product.is_liked ? (product.likes_count || 1) - 1 : (product.likes_count || 0) + 1
    }
    onProductUpdate(optimisticUpdate)
    try {
      if (product.is_liked) {
        await supabase.from('product_likes').delete().eq('product_id', product.id).eq('user_id', user.id)
      } else {
        await supabase.from('product_likes').insert({ product_id: product.id, user_id: user.id })
      }
    } catch {
      onProductUpdate(product)
      toast.error('Erro ao processar like')
    }
  }

  const addComment = async () => {
    if (!comment.trim()) return toast.error('Escreva um comentário')
    if (!requireAct('comentar')) return
    if (!onProductUpdate) return
    try {
      const { data: newComment } = await supabase
        .from('product_comments')
        .insert({ product_id: product.id, user_id: user.id, comment_text: comment.trim() })
        .select().single()
      const { data: userData } = await supabase
        .from('users').select('full_name, user_type, avatar_url').eq('id', user.id).single()
      const commentWithUserInfo: Comment = {
        ...newComment,
        user_name: userData?.full_name || 'Usuário',
        user_type: userData?.user_type || 'agricultor',
        user_avatar: userData?.avatar_url,
        likes_count: 0, is_liked: false, replies: []
      }
      onProductUpdate({ ...product, comments: [commentWithUserInfo, ...(product.comments || [])] })
      setComment('')
      toast.success('Comentário adicionado!')
    } catch {
      toast.error('Erro ao adicionar comentário')
    }
  }

  const toggleCommentLike = async (commentId: string, isLiked: boolean) => {
    if (!user) return toast.error('Faça login para reagir')
    if (!onProductUpdate) return
    try {
      if (isLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id)
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
      }
      const updatedComments = product.comments?.map(c =>
        c.id === commentId ? {
          ...c, is_liked: !isLiked,
          likes_count: isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1
        } : c
      )
      onProductUpdate({ ...product, comments: updatedComments })
    } catch { toast.error('Erro ao processar reação') }
  }

  const addReply = async (commentId: string) => {
    if (!user || !replyText.trim()) return toast.error('Escreva uma resposta')
    if (!onProductUpdate) return
    try {
      const { data: newReply } = await supabase
        .from('comment_replies')
        .insert({ comment_id: commentId, user_id: user.id, reply_text: replyText.trim() })
        .select().single()
      const { data: userData } = await supabase
        .from('users').select('full_name, user_type').eq('id', user.id).single()
      const replyWithUser: CommentReply = {
        ...newReply, user_name: userData?.full_name || 'Usuário',
        user_type: userData?.user_type || 'agricultor'
      }
      const updatedComments = product.comments?.map(c =>
        c.id === commentId ? { ...c, replies: [...(c.replies || []), replyWithUser] } : c
      )
      onProductUpdate({ ...product, comments: updatedComments })
      setReplyText('')
      setReplyingTo(null)
      toast.success('Resposta adicionada!')
    } catch { toast.error('Erro ao adicionar resposta') }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.product_type,
          text: `Confira ${product.product_type} por ${formatPrice(product.price)}!`,
          url: window.location.href,
        })
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado!')
    }
  }

  const sliderSettings = {
    dots: true,
    infinite: product.photos && product.photos.length > 1,
    fade: true,
    speed: 600,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4500,
    arrows: product.photos && product.photos.length > 1,
    nextArrow: <CustomNextArrow />,
    prevArrow: <CustomPrevArrow />,
    lazyLoad: 'progressive' as const,
  }

  return (
    <>
      <div
        style={{ ...styles.card, ...(isHovered ? styles.cardHover : {}) }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* ── Image badges ── */}
        <div style={styles.imageBadge}>
          {isNew && (
            <span style={styles.badgeNew}>
              <Leaf size={10} />
              NOVO
            </span>
          )}
          {discount > 0 && (
            <span style={styles.badgeDiscount}>−{discount}% OFF</span>
          )}
        </div>

        {/* ── Share ── */}
        <button
          onClick={handleShare}
          style={styles.shareBtn}
          aria-label="Compartilhar"
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Share2 size={16} color={brand.green} />
        </button>

        {/* ── Photo carousel ── */}
        <div style={styles.imageWrap}>
          {product.photos && product.photos.length > 0 ? (
            <Slider {...sliderSettings}>
              {product.photos.map((photo, i) => (
                <div key={i}>
                  <img
                    src={photo}
                    style={{
                      width: '100%',
                      aspectRatio: '4/3',
                      objectFit: 'cover',
                      transition: 'transform 0.7s ease',
                      transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                    }}
                    alt={`${product.product_type} ${i + 1}`}
                    loading="lazy"
                  />
                </div>
              ))}
            </Slider>
          ) : (
            <div style={styles.noPhoto}>
              <Leaf size={40} color={brand.greenLight} />
              <span>Sem imagem</span>
            </div>
          )}
          <div style={styles.imageOverlay} />
        </div>

        {/* ── Content ── */}
        <div style={styles.content}>

          {/* Farmer row */}
          <div style={styles.farmerRow}>
            <div
              style={styles.avatarWrap}
              onClick={() => navigate(`/perfil/${product.user_id}`)}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {product.farmer_name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={styles.farmerName}
                onClick={() => navigate(`/perfil/${product.user_id}`)}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = brand.green)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = brand.charcoal)}
              >
                {product.farmer_name}
                {product.user_verified && <BadgeCheck size={15} color={brand.green} />}
              </div>
              <div style={styles.location}>
                <MapPin size={12} color={brand.earth} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product.province_id}, {product.municipality_id}
                </span>
              </div>
            </div>

            <span style={styles.typeBadge}>{product.product_type}</span>
          </div>

          {/* Product title */}
          <div style={styles.productTitle}>{product.product_type}</div>

          {/* Price + stock */}
          <div style={styles.priceRow}>
            <span style={styles.price}>{formatPrice(product.price)}</span>
            {discount > 0 && <span style={styles.priceOld}>{formatPrice(originalPrice)}</span>}
          </div>

          <div style={styles.stockRow}>
            <TrendingUp size={14} color={brand.goldLight} />
            {product.quantity.toLocaleString()} kg em estoque
          </div>

          {/* Buy button */}
          {onOpenPreOrder && (
            <button
              style={styles.buyBtn}
              onClick={() => onOpenPreOrder(product)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px rgba(45,125,58,0.45)`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(45,125,58,0.3)`
              }}
            >
              <ShoppingCart size={18} />
              COMPRAR AGORA
            </button>
          )}

          {/* Description */}
          {product.description && (
            <p style={styles.description}>{product.description}</p>
          )}

          {/* Meta row */}
          <div style={styles.metaRow}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={13} color={brand.goldLight} />
              Colheita: {formatDate(product.harvest_date)}
            </span>
            {product.location_lat && product.location_lng && (
              <button
                style={styles.locationBtn}
                onClick={() => setMapModalOpen(true)}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
              >
                <MapPin size={13} />
                Ver Localização
              </button>
            )}
          </div>

          {/* Social actions */}
          <div style={styles.actionsRow}>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Like */}
              <button
                style={{
                  ...styles.actionBtn,
                  color: product.is_liked ? '#e53e3e' : brand.muted,
                  background: product.is_liked ? '#fff5f5' : 'transparent',
                }}
                onClick={toggleLike}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#fff5f5')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = product.is_liked ? '#fff5f5' : 'transparent')}
              >
                <Heart size={18} fill={product.is_liked ? '#e53e3e' : 'none'} />
                {product.likes_count ? <span>{product.likes_count}</span> : null}
              </button>

              {/* Comment toggle */}
              <button
                style={{
                  ...styles.actionBtn,
                  color: commentVisible ? brand.earth : brand.muted,
                  background: commentVisible ? brand.earthPale : 'transparent',
                }}
                onClick={() => setCommentVisible(!commentVisible)}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = brand.earthPale)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = commentVisible ? brand.earthPale : 'transparent')}
              >
                <MessageCircle size={18} />
                {product.comments?.length ? <span>{product.comments.length}</span> : null}
              </button>
            </div>

            <span style={{ fontSize: 11, color: brand.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Eye size={12} />
              <Clock size={12} />
              {formatDate(product.created_at)}
            </span>
          </div>

          {/* Comments section */}
          {commentVisible && (
            <div style={{ ...styles.commentBox, animation: 'slideDown 0.25s ease' }}>
              <style>{`
                @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
              `}</style>

              {/* Input */}
              <div style={styles.commentInputRow}>
                <input
                  style={styles.commentInput}
                  placeholder="Adicione um comentário..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyPress={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                  onFocus={e => (e.currentTarget.style.borderColor = brand.green)}
                  onBlur={e => (e.currentTarget.style.borderColor = brand.border)}
                />
                <button
                  style={{ ...styles.sendBtn, opacity: comment.trim() ? 1 : 0.5 }}
                  onClick={addComment}
                  disabled={!comment.trim()}
                >
                  <Send size={16} color="#fff" />
                </button>
              </div>

              {/* Comment list */}
              {product.comments?.length ? (
                <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                  {product.comments.map(c => (
                    <div key={c.id} style={styles.commentItem}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, ${brand.green}, ${brand.greenLight})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 800, fontSize: 14,
                        }}>
                          {c.user_avatar
                            ? <img src={c.user_avatar} alt={c.user_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : c.user_name.charAt(0)
                          }
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: brand.charcoal }}>{c.user_name}</span>
                            <span style={{ fontSize: 10, color: brand.muted, background: '#fff', border: `1px solid ${brand.border}`, borderRadius: 8, padding: '2px 7px' }}>{c.user_type}</span>
                            <span style={{ fontSize: 11, color: brand.muted }}>{formatDate(c.created_at)}</span>
                          </div>
                          <p style={{ fontSize: 13, color: brand.charcoal, lineHeight: 1.55, margin: 0 }}>{c.comment_text}</p>

                          {/* Like + reply actions */}
                          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                            <button
                              onClick={() => toggleCommentLike(c.id, c.is_liked || false)}
                              style={{
                                ...styles.actionBtn, padding: '3px 0', fontSize: 12,
                                color: c.is_liked ? '#e53e3e' : brand.muted,
                              }}
                            >
                              <ThumbsUp size={13} fill={c.is_liked ? '#e53e3e' : 'none'} />
                              {c.likes_count || 'Curtir'}
                            </button>
                            <button
                              onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                              style={{ ...styles.actionBtn, padding: '3px 0', fontSize: 12, color: brand.earth }}
                            >
                              <Reply size={13} />
                              Responder
                            </button>
                          </div>

                          {/* Reply input */}
                          {replyingTo === c.id && (
                            <div style={{ ...styles.commentInputRow, marginTop: 10 }}>
                              <input
                                style={{ ...styles.commentInput, height: 36, fontSize: 12 }}
                                placeholder="Sua resposta..."
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                onKeyPress={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addReply(c.id) } }}
                                autoFocus
                              />
                              <button
                                style={{ ...styles.sendBtn, width: 36, height: 36, background: brand.earth }}
                                onClick={() => addReply(c.id)}
                              >
                                <Send size={14} color="#fff" />
                              </button>
                            </div>
                          )}

                          {/* Replies */}
                          {c.replies && c.replies.length > 0 && (
                            <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: `2.5px solid ${brand.border}` }}>
                              {c.replies.map(reply => (
                                <div key={reply.id} style={styles.replyItem}>
                                  <span style={{ fontWeight: 700, color: brand.charcoal }}>{reply.user_name}</span>
                                  <span style={{ color: brand.muted, margin: '0 6px' }}>·</span>
                                  <span style={{ color: brand.muted }}>{reply.reply_text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyComments}>
                  <Leaf size={36} color={brand.border} style={{ margin: '0 auto 8px', display: 'block' }} />
                  <p>Seja o primeiro a comentar!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Map modal ── */}
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent style={{
          maxWidth: 760, padding: 0, overflow: 'hidden', borderRadius: 24,
          border: `2px solid ${brand.border}`,
        }}>
          <DialogHeader style={{
            padding: '20px 24px 16px',
            background: `linear-gradient(135deg, ${brand.green}, ${brand.greenLight})`,
          }}>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 18, fontWeight: 800 }}>
              <MapPin size={20} color="#ffd700" />
              Localização do Produto
            </DialogTitle>
          </DialogHeader>

          <div ref={mapContainerRef} style={{ width: '100%', height: 420 }} />

          <div style={{
            padding: '16px 24px', background: brand.greenPale,
            borderTop: `1px solid ${brand.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontWeight: 800, color: brand.green, fontSize: 17, margin: 0 }}>{product.product_type}</p>
              <p style={{ fontSize: 13, color: brand.muted, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>{product.farmer_name}</span>
                {' · '}{product.province_id}, {product.municipality_id}
              </p>
            </div>
            <button
              onClick={() => setMapModalOpen(false)}
              style={{
                border: `1.5px solid ${brand.border}`, borderRadius: 12, background: '#fff',
                padding: '8px 18px', cursor: 'pointer', fontWeight: 700,
                color: brand.charcoal, fontSize: 13, transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = brand.earth
                ;(e.currentTarget as HTMLElement).style.color = brand.earth
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = brand.border
                ;(e.currentTarget as HTMLElement).style.color = brand.charcoal
              }}
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})

ProductCard.displayName = 'ProductCard'