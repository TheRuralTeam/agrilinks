import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Search, LayoutDashboard, Bell, ChevronDown, CheckCircle2,
  Package, MapPin, TrendingUp, Zap, Menu, X, MessageSquare,
  ShoppingCart, Activity
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useNavigate } from 'react-router-dom'
import { ProductCard, Product } from '@/components/ProductCard'
import agriLinkLogo from '@/assets/agrilink-logo.png'

const MAPBOX_TOKEN = 'pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA'

/* ─── Design tokens — B2B / League Spartan (shared system) ─────────────────── */
const T = {
  g950:    '#061A09',
  g900:    '#0A2310',
  g800:    '#0F3318',
  g700:    '#165220',
  g600:    '#1E7A2E',
  g500:    '#28A745',
  g400:    '#3DBE5C',
  g200:    '#B6E8C0',
  g100:    '#E4F5E8',
  g50:     '#F0FAF2',
  gBorder: '#C4E2CA',
  accent:  '#0D7E6A',
  accentL: '#10A688',
  accentBg:'#E8F7F4',
  ink:     '#0C1311',
  slate:   '#243329',
  mid:     '#3A4D40',
  muted:   '#6B8070',
  faint:   '#9DB5A4',
  rule:    '#DDE8DF',
  canvas:  '#F4F7F5',
  surface: '#FAFCFA',
  white:   '#FFFFFF',
  gold:    '#92660A',
  goldL:   '#C78B12',
  goldBg:  '#FDF6E3',
  shadow:  'rgba(10,35,16,0.08)',
  shadowMd:'rgba(10,35,16,0.14)',
  shadowLg:'rgba(10,35,16,0.20)',
}

const FONT = "'League Spartan', 'Helvetica Neue', Arial, sans-serif"

/* ─── Countries ─────────────────────────────────────────────────────────────── */
const COUNTRIES = [
  { code: 'AO', name: 'Angola',              flag: '🇦🇴', currency: 'Kz'  },
  { code: 'BR', name: 'Brasil',              flag: '🇧🇷', currency: 'R$'  },
  { code: 'PT', name: 'Portugal',            flag: '🇵🇹', currency: '€'   },
  { code: 'MZ', name: 'Moçambique',          flag: '🇲🇿', currency: 'MT'  },
  { code: 'CV', name: 'Cabo Verde',          flag: '🇨🇻', currency: 'CVE' },
  { code: 'ST', name: 'São Tomé e Príncipe', flag: '🇸🇹', currency: 'Db'  },
  { code: 'GW', name: 'Guiné-Bissau',        flag: '🇬🇼', currency: 'CFA' },
]

/* ─── Skeleton ──────────────────────────────────────────────────────────────── */
const ProductSkeleton = () => (
  <div style={{
    background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`,
    overflow: 'hidden', boxShadow: `0 1px 4px ${T.shadow}`,
  }}>
    <div style={{ aspectRatio: '16/10', background: T.g50, animation: 'shimmer 1.6s ease-in-out infinite' }}/>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.g100, animation: 'shimmer 1.6s ease-in-out infinite' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, background: T.g50, borderRadius: 5, width: '60%', animation: 'shimmer 1.6s ease-in-out infinite', marginBottom: 6 }}/>
          <div style={{ height: 10, background: T.canvas, borderRadius: 5, width: '40%', animation: 'shimmer 1.6s ease-in-out infinite' }}/>
        </div>
      </div>
      <div style={{ height: 1, background: T.rule }}/>
      <div style={{ height: 28, background: T.g50, borderRadius: 7, animation: 'shimmer 1.6s ease-in-out infinite' }}/>
      <div style={{ height: 40, background: T.g900, borderRadius: 9, animation: 'shimmer 1.6s ease-in-out infinite', opacity: 0.08 }}/>
    </div>
  </div>
)

/* ─── Live Ticker ────────────────────────────────────────────────────────────── */
const LiveTicker = ({ products }: { products: Product[] }) => {
  const total = products.reduce((s, p) => s + (p.quantity || 0), 0)
  const engagement = products.reduce((s, p) => s + (p.likes_count || 0), 0)
  const items = [
    `${products.length} produtos activos`,
    `${total.toLocaleString('pt-AO')} kg disponíveis`,
    `${engagement} interacções`,
    '7 países cobertos',
    'Verificação em tempo real',
    'B2B · Directo · Rastreável',
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: T.g800, overflow: 'hidden',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Label */}
      <div style={{
        flexShrink: 0, padding: '6px 16px',
        display: 'flex', alignItems: 'center', gap: 7,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.15)',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ADE80', display: 'block', animation: 'breathe 2s ease-in-out infinite' }}/>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT }}>Ao vivo</span>
      </div>
      {/* Scroll */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '6px 20px' }}>
        <div style={{ display: 'flex', gap: 32, animation: 'tickerScroll 18s linear infinite' }}>
          {[...items, ...items].map((item, i) => (
            <span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.04em', fontFamily: FONT }}>
              {item}
              {i < items.length * 2 - 1 && <span style={{ marginLeft: 32, color: 'rgba(255,255,255,0.12)' }}>◆</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Header icon button ─────────────────────────────────────────────────────── */
const HeaderIconBtn = ({ icon, onClick, title, badge }: { icon: React.ReactNode; onClick?: () => void; title: string; badge?: boolean; className?: string }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      position: 'relative', width: 36, height: 36, borderRadius: 9,
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.10)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.65)', transition: 'background 0.15s, border-color 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)' }}
  >
    {icon}
    {badge && (
      <span style={{ position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: '50%', background: '#EF4444', border: `1.5px solid ${T.g900}` }}/>
    )}
  </button>
)

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const AppHome = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, isAdmin } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderData, setOrderData] = useState({ quantity: 1, location: '' })
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  /* Country auto-detect */
  useEffect(() => {
    const detect = async () => {
      try {
        const r = await fetch('https://ipapi.co/json/')
        const d = await r.json()
        const found = COUNTRIES.find(c => c.code === d.country_code)
        if (found) setSelectedCountry(found)
      } catch {}
    }
    detect()
  }, [])

  useEffect(() => { if (user) fetchProducts() }, [user])

  const fetchProducts = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products').select('*').eq('status', 'active').limit(100)
      if (error) throw error

      const productsWithData = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: productUser } = await supabase.from('users').select('verified').eq('id', product.user_id).maybeSingle()
          const { count: likesCount } = await supabase.from('product_likes').select('*', { count: 'exact', head: true }).eq('product_id', product.id)
          const { data: userLike } = await supabase.from('product_likes').select('id').eq('product_id', product.id).eq('user_id', user?.id || '').maybeSingle()
          const { data: comments } = await supabase.from('product_comments').select('id, user_id, comment_text, created_at').eq('product_id', product.id).order('created_at', { ascending: false })

          const commentsWithUserInfo = await Promise.all(
            (comments || []).map(async (c) => {
              const { data: userData } = await supabase.from('users').select('full_name, user_type, avatar_url').eq('id', c.user_id).maybeSingle()
              const { count: cLikes } = await supabase.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', c.id)
              const { data: userCLike } = await supabase.from('comment_likes').select('id').eq('comment_id', c.id).eq('user_id', user?.id || '').maybeSingle()
              const { data: replies } = await supabase.from('comment_replies').select('id, user_id, reply_text, created_at').eq('comment_id', c.id).order('created_at', { ascending: true })
              const repliesWithUser = await Promise.all(
                (replies || []).map(async (r) => {
                  const { data: ru } = await supabase.from('users').select('full_name, user_type').eq('id', r.user_id).maybeSingle()
                  return { ...r, user_name: ru?.full_name || 'Utilizador', user_type: ru?.user_type || 'agricultor' }
                })
              )
              return { ...c, user_name: userData?.full_name || 'Utilizador', user_type: userData?.user_type || 'agricultor', user_avatar: userData?.avatar_url, likes_count: cLikes || 0, is_liked: !!userCLike, replies: repliesWithUser }
            })
          )
          return { ...product, likes_count: likesCount || 0, is_liked: !!userLike, comments: commentsWithUserInfo, user_verified: productUser?.verified || false } as Product
        })
      )

      const ranked = productsWithData.sort((a, b) => {
        const now = Date.now(), day = 864e5
        const sA = Math.max(0, 7 - (now - new Date(a.created_at).getTime()) / day) * 0.4 + (a.likes_count || 0) * 0.3 + (a.comments?.length || 0) * 0.3
        const sB = Math.max(0, 7 - (now - new Date(b.created_at).getTime()) / day) * 0.4 + (b.likes_count || 0) * 0.3 + (b.comments?.length || 0) * 0.3
        return sB - sA
      })
      setProducts(ranked.slice(0, 20))
    } catch { setProducts([]) }
    finally { setLoading(false) }
  }

  const handleProductUpdate = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x))
  const handleOpenMap = (p: Product) => { setSelectedProduct(p); setMapModalOpen(true) }
  const handleOpenPreOrder = (p: Product) => { setSelectedProduct(p); setOrderData({ quantity: 1, location: '' }); setModalOpen(true) }

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !user) return toast.error('Erro ao processar')
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('pre_orders').insert({
        product_id: selectedProduct.id, user_id: user.id,
        quantity: orderData.quantity, location: orderData.location, status: 'pending',
      })
      if (error) throw error
      await supabase.rpc('create_notification', {
        p_user_id: selectedProduct.user_id, p_type: 'pre_order', p_title: 'Nova Pré-Compra',
        p_message: `${user.email} quer comprar ${orderData.quantity}kg do seu ${selectedProduct.product_type}`,
        p_metadata: { product_id: selectedProduct.id, buyer_id: user.id, quantity: orderData.quantity },
      })
      toast.success('Pré-compra registada com sucesso.')
      setModalOpen(false); setSelectedProduct(null)
    } catch { toast.error('Erro ao processar') }
    finally { setIsSubmitting(false) }
  }

  /* Map modal */
  useEffect(() => {
    if (!mapModalOpen || !selectedProduct?.location_lat || !selectedProduct?.location_lng || !mapContainerRef.current) return
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [selectedProduct.location_lng, selectedProduct.location_lat],
        zoom: 9, attributionControl: false,
      })
      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      new mapboxgl.Marker({ color: T.g600 })
        .setLngLat([selectedProduct.location_lng, selectedProduct.location_lat])
        .addTo(mapRef.current)
      return () => { mapRef.current?.remove(); mapRef.current = null }
    } catch {}
  }, [mapModalOpen, selectedProduct])

  const TAX = 0.078
  const totalPrice = useMemo(() => selectedProduct ? orderData.quantity * selectedProduct.price * (1 + TAX) : 0, [selectedProduct, orderData.quantity])
  const fmt = (p: number) => `${p.toLocaleString('pt-AO')} ${selectedCountry.currency}`

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Equipe'
  const avatarLetter = displayName[0]?.toUpperCase() ?? 'U'

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.canvas, fontFamily: FONT }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${T.rule}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite' }}/>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={agriLinkLogo} alt="AgriLink" style={{ width: 28, height: 28, objectFit: 'contain' }}/>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT }}>

      {/* ═══ LIVE TICKER ═══════════════════════════════════════════════════ */}
      <LiveTicker products={products}/>

      {/* ═══ HEADER ════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: T.g900,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: `0 2px 20px ${T.shadowMd}`,
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto', padding: '0 20px',
          height: 56, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 14,
        }}>

          {/* Left: Brand + greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {/* Brand mark */}
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.g700, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color={T.g200}/>
            </div>
            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }} className="hidden sm:flex">
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: T.white, fontFamily: FONT, userSelect: 'none',
              }}>
                {avatarLetter}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: T.white, margin: 0, letterSpacing: '-0.01em', fontFamily: FONT }}>
                  {greeting()}, {displayName}
                </p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
                  AgriLink · Marketplace
                </p>
              </div>
            </div>
          </div>

          {/* Centre: Search */}
          <div
            style={{
              flex: 1, maxWidth: 600,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderRadius: 9,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.11)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onClick={() => navigate('/search')}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.12)'; el.style.borderColor = 'rgba(255,255,255,0.20)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.borderColor = 'rgba(255,255,255,0.11)' }}
          >
            <Search size={13} color="rgba(255,255,255,0.35)"/>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', fontWeight: 600, fontFamily: FONT }}>
              Pesquisar produtos, fornecedores...
            </span>
          </div>

          {/* Right: Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <HeaderIconBtn icon={<Bell size={15}/>} onClick={() => navigate('/notificacoes')} title="Notificações" badge/>
            <HeaderIconBtn icon={<MessageSquare size={15}/>} title="Mensagens"/>
            <div className="hidden sm:block">
              <HeaderIconBtn
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>}
                onClick={() => isAdmin ? navigate('/admindashboard') : navigate('/')}
                title="Dashboard"
              />
            </div>
            {/* Mobile menu */}
            <div className="sm:hidden">
              <HeaderIconBtn
                icon={mobileMenuOpen ? <X size={16}/> : <Menu size={16}/>}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                title="Menu"
              />
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div style={{
            position: 'absolute', top: 56, left: 0, right: 0,
            background: T.g900,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '14px 20px',
            display: 'flex', flexDirection: 'column', gap: 8,
            boxShadow: `0 16px 40px ${T.shadowLg}`,
            animation: 'fadeDown 0.2s ease-out', zIndex: 20,
          }} className="sm:hidden">
            {[
              { icon: <Search size={14}/>, label: 'Pesquisar', action: () => { navigate('/search'); setMobileMenuOpen(false) } },
              { icon: <Bell size={14}/>, label: 'Notificações', action: () => { navigate('/notificacoes'); setMobileMenuOpen(false) } },
              ...(isAdmin ? [{ icon: <LayoutDashboard size={14}/>, label: 'Dashboard Admin', action: () => { navigate('/admindashboard'); setMobileMenuOpen(false) } }] : []),
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  padding: '10px 14px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
                  width: '100%', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT,
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ═══ PRODUCT GRID ════════════════════════════════════════════════════ */}
      <main id="products-grid" style={{ maxWidth: 1320, margin: '0 auto', padding: 'clamp(24px, 4vw, 40px) 20px clamp(80px, 10vw, 120px)' }}>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: FONT, fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
              Produtos Disponíveis
            </h2>
            <p style={{ fontSize: 11, color: T.faint, marginTop: 3, fontWeight: 600, fontFamily: FONT }}>
              {products.length} listings · ordenados por relevância
            </p>
          </div>
          {/* Live pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, background: T.white, border: `1px solid ${T.rule}`, boxShadow: `0 1px 4px ${T.shadow}` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'block', animation: 'breathe 2s ease-in-out infinite' }}/>
            <span style={{ fontSize: 10, fontWeight: 800, color: T.mid, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: FONT }}>Ao vivo</span>
          </div>
        </div>

        <div style={{ height: 1, background: T.rule, marginBottom: 24 }}/>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 'clamp(12px, 2vw, 20px)',
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i}/>)
            : products.map((product, i) => (
              <div
                key={product.id}
                style={{ animation: 'cardEnter 0.45s cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${Math.min(i * 0.05, 0.35)}s` }}
              >
                <ProductCard
                  product={product}
                  onProductUpdate={handleProductUpdate}
                  onOpenMap={handleOpenMap}
                  onOpenPreOrder={handleOpenPreOrder}
                />
              </div>
            ))
          }
        </div>

        {/* Empty state */}
        {!loading && products.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <Package size={24} color={T.faint}/>
            </div>
            <h3 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: T.ink, margin: '0 0 8px', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
              Sem produtos disponíveis
            </h3>
            <p style={{ fontSize: 12, color: T.faint, maxWidth: 300, lineHeight: 1.65, fontFamily: FONT }}>
              Os primeiros fornecedores estão a ser integrados. Volte em breve.
            </p>
          </div>
        )}
      </main>

      {/* ═══ PRE-ORDER MODAL ═════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{
          maxWidth: 480, padding: 0, overflow: 'hidden', borderRadius: 16,
          border: `1px solid ${T.rule}`, boxShadow: `0 24px 80px ${T.shadowLg}`,
        }}>
          {/* Modal header */}
          <div style={{ padding: '16px 20px', background: T.g900, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: T.g700, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={15} color={T.g200}/>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: T.white, margin: 0, fontFamily: FONT, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>Pré-Compra</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0, fontFamily: FONT, fontWeight: 600 }}>
                  {selectedProduct?.product_type} · {selectedProduct?.farmer_name}
                </p>
              </div>
            </div>
          </div>

          {/* Modal body */}
          <div style={{ padding: '18px 20px', background: T.canvas, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Info notice */}
            <div style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 10, background: T.white, border: `1px solid ${T.rule}` }}>
              <Activity size={14} color={T.g500} style={{ flexShrink: 0, marginTop: 1 }}/>
              <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, margin: 0, fontFamily: FONT }}>
                Demonstração de interesse. O fornecedor confirmará disponibilidade de volume.
              </p>
            </div>

            {/* Contact */}
            <div style={{ padding: '12px 13px', borderRadius: 10, background: T.g50, border: `1px solid ${T.gBorder}` }}>
              <p style={{ fontSize: 9, fontWeight: 800, color: T.g700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: FONT }}>Contacto Directo</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['934 745 871', '935 358 417', '922 717 574'].map(n => (
                  <a key={n} href={`tel:${n.replace(/ /g, '')}`} style={{
                    padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                    background: T.white, color: T.g700, border: `1px solid ${T.gBorder}`,
                    textDecoration: 'none', fontFamily: FONT, transition: 'all 0.15s',
                  }}>
                    {n}
                  </a>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: T.mid, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: FONT }}>
                Quantidade (kg)
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: T.g50, color: T.g600, border: `1px solid ${T.gBorder}`, fontFamily: FONT }}>Obrigatório</span>
              </label>
              <input
                type="number"
                value={orderData.quantity || ''}
                onChange={e => setOrderData({ ...orderData, quantity: Number(e.target.value) })}
                min={1} max={selectedProduct?.quantity}
                placeholder="Ex: 500"
                style={{
                  height: 40, borderRadius: 8, border: `1.5px solid ${T.rule}`, padding: '0 12px',
                  fontSize: 13, outline: 'none', background: T.white, color: T.ink,
                  fontFamily: FONT, fontWeight: 600, transition: 'border-color 0.15s, box-shadow 0.15s',
                  width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(30,122,46,0.10)` }}
                onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
              />
              <p style={{ fontSize: 10, color: T.faint, display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT, fontWeight: 600 }}>
                <CheckCircle2 size={10} color={T.g400}/>
                Disponível: <strong style={{ color: T.g600 }}>{selectedProduct?.quantity.toLocaleString()} kg</strong>
              </p>
            </div>

            {/* Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: T.mid, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: FONT }}>
                Local de Entrega
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: T.g50, color: T.g600, border: `1px solid ${T.gBorder}`, fontFamily: FONT }}>Obrigatório</span>
              </label>
              <input
                placeholder="Ex: Luanda, Viana, Cacuaco"
                value={orderData.location}
                onChange={e => setOrderData({ ...orderData, location: e.target.value })}
                style={{
                  height: 40, borderRadius: 8, border: `1.5px solid ${T.rule}`, padding: '0 12px',
                  fontSize: 13, outline: 'none', background: T.white, color: T.ink,
                  fontFamily: FONT, fontWeight: 600, transition: 'border-color 0.15s, box-shadow 0.15s',
                  width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(30,122,46,0.10)` }}
                onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Summary */}
            <div style={{ padding: '14px', borderRadius: 10, background: T.white, border: `1px solid ${T.rule}` }}>
              <p style={{ fontSize: 9, fontWeight: 800, color: T.g700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontFamily: FONT }}>Resumo</p>
              {[
                { label: 'Subtotal', val: fmt(orderData.quantity * (selectedProduct?.price || 0)) },
                { label: 'Logística (7.8%)', val: fmt(orderData.quantity * (selectedProduct?.price || 0) * TAX) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted, marginBottom: 8, fontFamily: FONT }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 700, color: T.ink }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${T.rule}`, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: T.g700, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>{fmt(totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Modal footer */}
          <div style={{ padding: '13px 20px', display: 'flex', gap: 9, background: T.white, borderTop: `1px solid ${T.rule}` }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{ flex: 1, height: 40, borderRadius: 8, border: `1.5px solid ${T.rule}`, background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: T.mid, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.canvas; (e.currentTarget as HTMLElement).style.borderColor = T.faint }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = T.rule }}
            >
              Cancelar
            </button>
            <button
              onClick={handlePreOrderSubmit}
              disabled={isSubmitting || !orderData.location.trim() || orderData.quantity < 1}
              style={{
                flex: 2, height: 40, borderRadius: 8, border: 'none',
                background: T.g700, cursor: 'pointer',
                fontSize: 11, fontWeight: 800, color: T.white, fontFamily: FONT,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: `0 3px 12px rgba(22,82,32,0.28)`,
                opacity: (isSubmitting || !orderData.location.trim() || orderData.quantity < 1) ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!(isSubmitting || !orderData.location.trim() || orderData.quantity < 1)) { (e.currentTarget as HTMLElement).style.background = T.g600; (e.currentTarget as HTMLElement).style.boxShadow = `0 5px 20px rgba(22,82,32,0.38)` } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.g700; (e.currentTarget as HTMLElement).style.boxShadow = `0 3px 12px rgba(22,82,32,0.28)` }}
            >
              {isSubmitting ? (
                <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: T.white, animation: 'spin 0.8s linear infinite' }}/> A processar...</>
              ) : (
                <><ShoppingCart size={13}/> Confirmar Encomenda</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processing overlay */}
      {isSubmitting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,35,16,0.80)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: T.white, padding: '32px 40px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, border: `1px solid ${T.rule}`, boxShadow: `0 24px 80px ${T.shadowLg}` }}>
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${T.gBorder}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite' }}/>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={agriLinkLogo} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }}/>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>A processar</p>
              <p style={{ fontSize: 11, color: T.faint, marginTop: 4, fontFamily: FONT }}>Registando encomenda...</p>
            </div>
            <div style={{ width: 180, height: 2, borderRadius: 99, background: T.g50, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: `linear-gradient(90deg, ${T.g600}, ${T.g400})`, animation: 'progressBar 2s ease-in-out infinite', borderRadius: 99 }}/>
            </div>
          </div>
        </div>
      )}

      {/* Map modal */}
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent style={{ maxWidth: 760, padding: 0, overflow: 'hidden', borderRadius: 16, border: `1px solid ${T.rule}`, boxShadow: `0 24px 80px ${T.shadowLg}` }}>
          <div style={{ padding: '14px 20px', background: T.g900, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={13} color={T.g200}/>
            </div>
            <div>
              <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: T.white, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Localização do Fornecedor</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0, fontFamily: FONT }}>{selectedProduct?.product_type} · {selectedProduct?.farmer_name}</p>
            </div>
          </div>
          <div ref={mapContainerRef} style={{ width: '100%', height: 440 }}/>
        </DialogContent>
      </Dialog>

      {/* ── Global keyframes ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin          { to { transform: rotate(360deg) } }
        @keyframes shimmer       { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes breathe       { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.4; transform:scale(0.7) } }
        @keyframes cardEnter     { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeDown      { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes progressBar   { 0% { width:0%; margin-left:0 } 60% { width:100%; margin-left:0 } 100% { width:0%; margin-left:100% } }
        @keyframes tickerScroll  { 0% { transform:translateX(0) } 100% { transform:translateX(-50%) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius: 2px; }
        @media (max-width: 640px) {
          #products-grid { padding-left: 14px !important; padding-right: 14px !important; }
          .hidden { display: none !important; }
        }
        @media (min-width: 640px) {
          .sm\\:flex { display: flex !important; }
          .sm\\:block { display: block !important; }
          .sm\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default AppHome