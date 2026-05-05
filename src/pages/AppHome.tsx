import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Search, LayoutDashboard, ShoppingCart, Bell,
  ChevronDown, CheckCircle2, Package, Activity,
  MapPin, TrendingUp, Globe2, Zap, Menu, X
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useNavigate } from 'react-router-dom'
import { ProductCard, Product } from '@/components/ProductCard'
import orbisLinkLogo from '@/assets/orbislink-logo.png'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faAppleWhole, faCarrot, faSeedling, faWheatAwn, faLemon,
  faPepperHot, faFish, faDrumstickBite, faEgg, faBreadSlice,
  faCheese, faMugHot, faLayerGroup
} from '@fortawesome/free-solid-svg-icons'

const CATEGORIES = [
  { id: 'all',     label: 'Todos',      icon: faLayerGroup,    color: '#1A5C24' },
  { id: 'frutas',  label: 'Frutas',     icon: faAppleWhole,    color: '#E63946' },
  { id: 'citrus',  label: 'Cítricos',   icon: faLemon,         color: '#F4A100' },
  { id: 'legumes', label: 'Legumes',    icon: faCarrot,        color: '#E07A12' },
  { id: 'verduras',label: 'Verduras',   icon: faSeedling,      color: '#3D9A48' },
  { id: 'cereais', label: 'Cereais',    icon: faWheatAwn,      color: '#B07D0A' },
  { id: 'tempero', label: 'Temperos',   icon: faPepperHot,     color: '#C53030' },
  { id: 'pescado', label: 'Pescado',    icon: faFish,          color: '#2563B0' },
  { id: 'carnes',  label: 'Carnes',     icon: faDrumstickBite, color: '#8B2E2E' },
  { id: 'ovos',    label: 'Ovos',       icon: faEgg,           color: '#D4A24C' },
  { id: 'paes',    label: 'Pães',       icon: faBreadSlice,    color: '#A0522D' },
  { id: 'lacteos', label: 'Lácteos',    icon: faCheese,        color: '#E5A020' },
  { id: 'bebidas', label: 'Bebidas',    icon: faMugHot,        color: '#5C3317' },
]

const MAPBOX_TOKEN = 'pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA'

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const T = {
  /* Greens */
  g900:   '#2c863b',
  g700:   '#1A5C24',
  g600:   '#2D7D3A',
  g500:   '#3D9A48',
  g400:   '#4CAF50',
  g100:   '#E8F5E9',
  g50:    '#F2FAF3',
  gBorder:'#C8E6CA',

  /* Earth */
  e700:   '#5C3317',
  e500:   '#7B4F2E',
  e300:   '#A0522D',
  ePale:  '#FDF5EE',
  eBorder:'#EDD9C6',

  /* Neutrals */
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F7F9F7',
  white:  '#FFFFFF',
  rule:   '#E5EDE6',

  /* Accents */
  gold:   '#B07D0A',
  goldL:  '#E5A020',

  /* Shadow */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

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
    background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`,
    overflow: 'hidden', boxShadow: `0 1px 6px ${T.shadow}`
  }}>
    <div style={{ aspectRatio:'4/3', background: `linear-gradient(135deg, ${T.g50}, ${T.g100})`, animation:'shimmer 1.8s ease-in-out infinite' }}/>
    <div style={{ padding: 18, display:'flex', flexDirection:'column', gap: 10 }}>
      <div style={{ height: 13, background: T.g50, borderRadius: 6, width:'65%', animation:'shimmer 1.8s ease-in-out infinite' }}/>
      <div style={{ height: 10, background: '#f0f4f0', borderRadius: 6, width:'40%', animation:'shimmer 1.8s ease-in-out infinite' }}/>
      <div style={{ height: 40, background: T.g50, borderRadius: 12, animation:'shimmer 1.8s ease-in-out infinite' }}/>
    </div>
  </div>
)

/* ─── Country selector ──────────────────────────────────────────────────────── */
const CountrySelector = ({
  selectedCountry, onCountryChange
}: {
  selectedCountry: typeof COUNTRIES[0]
  onCountryChange: (c: typeof COUNTRIES[0]) => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button style={{
        display:'flex', alignItems:'center', gap: 6, padding:'7px 12px',
        borderRadius: 10, border: `1px solid ${T.rule}`,
        background: T.white, cursor:'pointer', transition:'all 0.18s',
        color: T.ink, fontSize: 13, fontWeight: 600,
        boxShadow: `0 1px 3px ${T.shadow}`,
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.g600 }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.rule }}
      >
        <Globe2 size={13} color={T.g600}/>
        <span style={{ fontSize: 15 }}>{selectedCountry.flag}</span>
        <ChevronDown size={11} color={T.muted}/>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" style={{
      width: 230, borderRadius: 16, border: `1px solid ${T.rule}`,
      boxShadow: `0 16px 48px ${T.shadowMd}`, background: T.white, padding: '6px',
    }}>
      <div style={{ padding:'8px 12px 6px', fontSize:10, fontWeight:800, color: T.g600, textTransform:'uppercase', letterSpacing:'0.1em', borderBottom:`1px solid ${T.rule}`, marginBottom: 4 }}>
        Região de Operação
      </div>
      {COUNTRIES.map(c => (
        <DropdownMenuItem key={c.code} onClick={() => onCountryChange(c)} style={{
          display:'flex', alignItems:'center', gap: 10, padding:'8px 10px', cursor:'pointer',
          borderRadius: 10, margin:'1px 0',
          background: selectedCountry.code === c.code ? T.g50 : 'transparent',
          color: selectedCountry.code === c.code ? T.g600 : T.ink,
          fontWeight: selectedCountry.code === c.code ? 700 : 400,
          transition: 'background 0.15s',
        }}>
          <span style={{ fontSize: 18 }}>{c.flag}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 10, color: T.faint }}>{c.currency}</div>
          </div>
          {selectedCountry.code === c.code && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.g500 }}/>
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

/* ─── Live Ticker ────────────────────────────────────────────────────────────── */
const LiveTicker = ({ products }: { products: Product[] }) => {
  const total = products.reduce((s, p) => s + (p.quantity || 0), 0)
  const engagement = products.reduce((s, p) => s + (p.likes_count || 0), 0)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: T.g900, overflow: 'hidden',
      borderBottom: `1px solid rgba(255,255,255,0.06)`,
    }}>
      {/* Live badge */}
      <div style={{
        flexShrink: 0, padding: '8px 18px',
        display: 'flex', alignItems: 'center', gap: 7,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'block', animation: 'breathe 2s ease-in-out infinite' }}/>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ao vivo</span>
      </div>
      {/* Scrolling items */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 20px' }}>
        <div style={{ display: 'flex', gap: 32, animation: 'tickerScroll 18s linear infinite' }}>
          {[
            `${products.length} produtos activos`,
            `${total.toLocaleString('pt-AO')} kg disponíveis`,
            `${engagement} interacções`,
            '7 países cobertos',
            'Verificação em tempo real',
            'B2B · Directo · Rastreável',
          ].concat([
            `${products.length} produtos activos`,
            `${total.toLocaleString('pt-AO')} kg disponíveis`,
            `${engagement} interacções`,
            '7 países cobertos',
            'Verificação em tempo real',
            'B2B · Directo · Rastreável',
          ]).map((item, i) => (
            <span key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', fontWeight: 500, letterSpacing: '0.02em' }}>
              {item}
              {i < 11 && <span style={{ marginLeft: 32, color: 'rgba(255,255,255,0.18)' }}>◆</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

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
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products
    return products.filter(p => {
      const t = (p.product_type || '').toLowerCase()
      const map: Record<string, string[]> = {
        frutas:   ['fruta','manga','banana','abacate','maçã','maca','ananás','ananas','papaia','mamão','mamao','pera','uva','melancia','melao','melão'],
        citrus:   ['laranja','limão','limao','tangerina','lima','citrino'],
        legumes:  ['cenoura','batata','beterraba','mandioca','inhame','abóbora','abobora','tomate','cebola','alho'],
        verduras: ['alface','couve','espinafre','folha','rúcula','rucula','agrião','agriao','verdura'],
        cereais:  ['milho','arroz','trigo','feijão','feijao','soja','aveia','cereal'],
        tempero:  ['pimenta','jindungo','gengibre','tempero','salsa','coentro','manjericão','manjericao'],
        pescado:  ['peixe','pescado','camarão','camarao','marisco','bacalhau'],
        carnes:   ['carne','frango','vaca','porco','cabrito'],
        ovos:     ['ovo'],
        paes:     ['pão','pao','padaria','biscoito'],
        lacteos:  ['leite','queijo','iogurte','manteiga','lácteo','lacteo'],
        bebidas:  ['suco','sumo','bebida','café','cafe','chá','cha'],
      }
      return (map[activeCategory] || []).some(k => t.includes(k))
    })
  }, [products, activeCategory])

  /* Country auto-detect */
  useEffect(() => {
    const detect = async () => {
      try {
        const r = await fetch('https://ipapi.co/json/')
        const d = await r.json()
        const found = COUNTRIES.find(c => c.code === d.country_code)
        if (found) { setSelectedCountry(found); toast.success(`Região: ${found.name}`, { duration: 2000 }) }
      } catch {}
    }
    detect()
  }, [])

  /* Fetch products */
  useEffect(() => { if (user) fetchProducts() }, [user])

  const fetchProducts = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products').select('*').eq('status', 'active').limit(100)
      if (error) throw error

      const productsWithData = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: productUser } = await supabase.from('users').select('verified').eq('id', product.user_id).maybeSingle()
          const { count: likesCount } = await supabase.from('product_likes').select('*', { count:'exact', head:true }).eq('product_id', product.id)
          const { data: userLike } = await supabase.from('product_likes').select('id').eq('product_id', product.id).eq('user_id', user?.id||'').maybeSingle()
          const { data: comments } = await supabase.from('product_comments').select('id, user_id, comment_text, created_at').eq('product_id', product.id).order('created_at', { ascending: false })

          const commentsWithUserInfo = await Promise.all(
            (comments || []).map(async (c) => {
              const { data: userData } = await supabase.from('users').select('full_name, user_type, avatar_url').eq('id', c.user_id).maybeSingle()
              const { count: cLikes } = await supabase.from('comment_likes').select('*', { count:'exact', head:true }).eq('comment_id', c.id)
              const { data: userCLike } = await supabase.from('comment_likes').select('id').eq('comment_id', c.id).eq('user_id', user?.id||'').maybeSingle()
              const { data: replies } = await supabase.from('comment_replies').select('id, user_id, reply_text, created_at').eq('comment_id', c.id).order('created_at', { ascending: true })
              const repliesWithUser = await Promise.all(
                (replies || []).map(async (r) => {
                  const { data: ru } = await supabase.from('users').select('full_name, user_type').eq('id', r.user_id).maybeSingle()
                  return { ...r, user_name: ru?.full_name || 'Utilizador', user_type: ru?.user_type || 'agricultor' }
                })
              )
              return { ...c, user_name: userData?.full_name || 'Utilizador', user_type: userData?.user_type || 'agricultor', user_avatar: userData?.avatar_url, likes_count: cLikes||0, is_liked: !!userCLike, replies: repliesWithUser }
            })
          )
          return { ...product, likes_count: likesCount||0, is_liked: !!userLike, comments: commentsWithUserInfo, user_verified: productUser?.verified||false } as Product
        })
      )

      const ranked = productsWithData.sort((a, b) => {
        const now = Date.now(), day = 864e5
        const sA = Math.max(0, 7 - (now - new Date(a.created_at).getTime()) / day) * 0.4 + (a.likes_count||0) * 0.3 + (a.comments?.length||0) * 0.3
        const sB = Math.max(0, 7 - (now - new Date(b.created_at).getTime()) / day) * 0.4 + (b.likes_count||0) * 0.3 + (b.comments?.length||0) * 0.3
        return sB - sA
      })
      setProducts(ranked.slice(0, 20))
    } catch { setProducts([]) }
    finally { setLoading(false) }
  }

  const handleProductUpdate = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x))
  const handleOpenMap = (p: Product) => { setSelectedProduct(p); setMapModalOpen(true) }
  const handleOpenPreOrder = (p: Product) => { setSelectedProduct(p); setOrderData({ quantity:1, location:'' }); setModalOpen(true) }

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !user) return toast.error('Erro ao processar pré-compra')
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
      setModalOpen(false)
      setSelectedProduct(null)
    } catch { toast.error('Erro ao processar pré-compra') }
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

  /* ── Loading ── */
  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'100vh', background: T.canvas,
    }}>
      <div style={{ position:'relative', width: 64, height: 64 }}>
        {/* Spinning ring */}
        <div style={{
          position:'absolute', inset: 0,
          borderRadius:'50%',
          border: `2px solid ${T.rule}`,
          borderTopColor: T.g500,
          animation:'spin 1s linear infinite',
        }}/>
        {/* Logo centred */}
        <div style={{
          position:'absolute', inset: 0,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <img
            src={orbisLinkLogo}
            alt="OrbisLink"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
        </div>
      </div>
    </div>
  )

  /* ── Main render ── */
  return (
    <div style={{ minHeight:'100vh', background: T.canvas, fontFamily:"'DM Sans', system-ui, sans-serif" }}>

      {/* ═══ LIVE TICKER ═══════════════════════════════════════════════════ */}
      <LiveTicker products={products}/>

      {/* ═══ HEADER ════════════════════════════════════════════════════════ */}
      <header style={{
        position:'sticky', top:0, zIndex:30,
        background:'rgba(247,249,247,0.97)', backdropFilter:'blur(20px)',
        borderBottom:`1px solid ${T.rule}`,
        boxShadow: `0 1px 0 ${T.rule}, 0 4px 24px rgba(13,43,18,0.04)`,
      }}>
        <div style={{ maxWidth:1320, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>

          {/* Logo */}
          <div
            style={{ display:'flex', alignItems:'center', cursor:'pointer', flexShrink: 0 }}
            onClick={() => navigate('/')}
          >
            <img
              src={orbisLinkLogo}
              alt="OrbisLink"
              style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Search bar — visible only sm and above (≥ 640px) */}
          <div
            style={{
              flex:1, maxWidth:460, display:'flex', alignItems:'center', gap:10,
              padding:'9px 16px', borderRadius:12,
              border:`1px solid ${T.rule}`, background: T.white,
              cursor:'pointer', transition:'all 0.18s',
              boxShadow: `0 1px 4px ${T.shadow}`,
            }}
            onClick={() => navigate('/search')}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.g600; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 8px ${T.shadowMd}` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.rule; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 4px ${T.shadow}` }}
            className="hidden sm:flex"
          >
            <Search size={14} color={T.g500}/>
            <span style={{ fontSize:13, color: T.faint }}>Pesquisar produtos, fornecedores...</span>
            <span style={{ marginLeft:'auto', fontSize:10, color: T.faint, padding:'2px 7px', borderRadius:6, border:`1px solid ${T.rule}`, fontWeight:600 }}>⌘K</span>
          </div>

          {/* Search icon — visible only below sm (< 640px) */}
          <button
            style={{
              padding:'8px', borderRadius:10, border:`1px solid ${T.rule}`, background: T.white,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              color: T.mid, transition:'all 0.18s',
              boxShadow: `0 1px 3px ${T.shadow}`,
            }}
            onClick={() => navigate('/search')}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.g600 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.rule }}
            className="sm:hidden"
          >
            <Search size={16}/>
          </button>

          {/* Right actions */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="hidden sm:flex">
              <CountrySelector selectedCountry={selectedCountry} onCountryChange={(c) => { setSelectedCountry(c); toast.success(`${c.flag} ${c.name}`) }}/>
            </div>

            {isAdmin && (
              <button
                style={{
                  padding:'7px 14px', borderRadius:10, border:`1px solid ${T.rule}`, background: T.white,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13,
                  fontWeight:600, color: T.ink, transition:'all 0.18s',
                  boxShadow: `0 1px 3px ${T.shadow}`,
                }}
                onClick={() => navigate('/admindashboard')}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.g600; (e.currentTarget as HTMLElement).style.color = T.g600 }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.rule; (e.currentTarget as HTMLElement).style.color = T.ink }}
                className="hidden sm:flex"
              >
                <LayoutDashboard size={14} color={T.g500}/>
                <span>Dashboard</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              style={{
                padding:'8px', borderRadius:10, border:`1px solid ${T.rule}`, background: T.white,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                color: T.mid, transition:'all 0.18s',
                boxShadow: `0 1px 3px ${T.shadow}`,
              }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden"
            >
              {mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div style={{
            position: 'absolute', top: 62, left: 0, right: 0,
            background: T.white, borderBottom: `1px solid ${T.rule}`,
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: `0 10px 20px ${T.shadow}`,
            animation: 'cardEnter 0.3s ease-out'
          }} className="sm:hidden">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Região</span>
              <CountrySelector selectedCountry={selectedCountry} onCountryChange={(c) => { setSelectedCountry(c); toast.success(`${c.flag} ${c.name}`) }}/>
            </div>
            {isAdmin && (
              <button
                style={{
                  padding:'10px', borderRadius:10, border:`1px solid ${T.rule}`, background: T.g50,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:14,
                  fontWeight:600, color: T.g600, width: '100%'
                }}
                onClick={() => { navigate('/admindashboard'); setMobileMenuOpen(false) }}
              >
                <LayoutDashboard size={16}/>
                Dashboard Administrativo
              </button>
            )}
          </div>
        )}
      </header>

      {/* ═══ CATEGORY FILTERS ════════════════════════════════════════════════ */}
      <section style={{
        background: T.white,
        borderBottom: `1px solid ${T.rule}`,
        padding: '14px 0',
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto', padding: '0 20px',
          display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none',
        }} className="hide-scrollbar">
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.label}
                style={{
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 6, padding: '10px 14px', minWidth: 76,
                  borderRadius: 14,
                  border: `1.5px solid ${active ? cat.color : T.rule}`,
                  background: active ? `${cat.color}10` : T.white,
                  cursor: 'pointer', transition: 'all 0.18s',
                  boxShadow: active ? `0 2px 8px ${cat.color}25` : `0 1px 3px ${T.shadow}`,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? cat.color : `${cat.color}15`,
                  transition: 'all 0.18s',
                }}>
                  <FontAwesomeIcon
                    icon={cat.icon}
                    style={{ fontSize: 16, color: active ? T.white : cat.color }}
                  />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: active ? cat.color : T.mid,
                  letterSpacing: '0.01em',
                }}>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </section>


      {/* ═══ PRODUCT GRID ═══════════════════════════════════════════════════ */}
      <main id="products-grid" style={{ maxWidth:1320, margin:'0 auto', padding:'clamp(24px, 4vw, 48px) 20px clamp(80px, 12vw, 140px)' }}>

        {/* Section header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
          <div>
            <h2 style={{
              fontFamily:"'Cormorant Garamond', Georgia, serif",
              fontSize:'clamp(18px, 2.5vw, 24px)', fontWeight:700, color: T.ink, margin:0, letterSpacing:'-0.01em'
            }}>
              Produtos disponíveis
            </h2>
            <p style={{ fontSize:12, color: T.faint, marginTop:4, fontWeight:500 }}>
              {products.length} listings · ordenados por relevância
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:10, background: T.white, border:`1px solid ${T.rule}`, boxShadow:`0 1px 3px ${T.shadow}` }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ADE80', display:'block', animation:'breathe 2s ease-in-out infinite' }}/>
              <span style={{ fontSize:11, fontWeight:700, color: T.mid, letterSpacing:'0.03em' }}>Ao vivo</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1, background: T.rule, marginBottom:28 }}/>

        {/* Grid */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 288px), 1fr))',
          gap:'clamp(14px, 2vw, 22px)',
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i}/>)
            : products.map((product, i) => (
              <div
                key={product.id}
                style={{ animation:`cardEnter 0.5s cubic-bezier(0.22,1,0.36,1) both`, animationDelay:`${Math.min(i * 0.05, 0.35)}s` }}
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
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'100px 20px', textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background: T.g50, border:`1px solid ${T.gBorder}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
              <Package size={24} color={T.g500}/>
            </div>
            <h3 style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:22, color: T.ink, margin:'0 0 10px', fontWeight:700 }}>
              Sem produtos disponíveis
            </h3>
            <p style={{ fontSize:13, color: T.faint, maxWidth:320, lineHeight:1.65 }}>
              Os primeiros fornecedores estão a ser integrados. Volte em breve.
            </p>
          </div>
        )}
      </main>

      {/* ═══ PRE-ORDER MODAL ═════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{
          maxWidth:500, padding:0, overflow:'hidden', borderRadius:20,
          border:`1px solid ${T.rule}`, boxShadow:`0 24px 80px rgba(13,43,18,0.22)`,
        }}>
          {/* Header */}
          <div style={{ padding:'20px 24px 16px', background: T.white, borderBottom:`1px solid ${T.rule}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:11, background: T.g50, border:`1px solid ${T.gBorder}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ShoppingCart size={17} color={T.g600}/>
              </div>
              <div>
                <DialogTitle style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:18, fontWeight:700, color: T.ink, margin:0 }}>
                  Pré-Compra
                </DialogTitle>
                <p style={{ fontSize:12, color: T.faint, margin:0, marginTop:1 }}>
                  {selectedProduct?.product_type} · {selectedProduct?.farmer_name}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding:'20px 24px', background: T.canvas, maxHeight:'60vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>

            {/* Info notice */}
            <div style={{ display:'flex', gap:11, padding:'11px 14px', borderRadius:12, background: T.white, border:`1px solid ${T.rule}` }}>
              <Bell size={15} color={T.g500} style={{ flexShrink:0, marginTop:1 }}/>
              <p style={{ fontSize:12, color: T.muted, lineHeight:1.6, margin:0 }}>
                Esta é uma demonstração de interesse. O fornecedor confirmará disponibilidade de volume.
              </p>
            </div>

            {/* Contact */}
            <div style={{ padding:'12px 14px', borderRadius:12, background: T.ePale, border:`1px solid ${T.eBorder}` }}>
              <p style={{ fontSize:11, fontWeight:700, color: T.e500, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Contacto Directo</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {['934 745 871','935 358 417','922 717 574'].map(n => (
                  <a key={n} href={`tel:${n.replace(/ /g,'')}`} style={{
                    padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700,
                    background: T.white, color: T.e500, border:`1px solid ${T.eBorder}`,
                    textDecoration:'none', transition:'all 0.18s',
                    display:'flex', alignItems:'center', gap:5,
                  }}>
                    {n}
                  </a>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:700, color: T.ink, display:'flex', alignItems:'center', gap:8 }}>
                Quantidade (kg)
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background: T.g50, color: T.g600, border:`1px solid ${T.gBorder}` }}>Obrigatório</span>
              </label>
              <input
                type="number"
                value={orderData.quantity || ''}
                onChange={e => setOrderData({ ...orderData, quantity: Number(e.target.value) })}
                min={1} max={selectedProduct?.quantity}
                placeholder="Ex: 500"
                style={{
                  height:42, borderRadius:10, border:`1px solid ${T.rule}`, padding:'0 14px',
                  fontSize:14, outline:'none', background: T.white, color: T.ink,
                  transition:'border-color 0.18s, box-shadow 0.18s', width:'100%', boxSizing:'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(61,154,72,0.1)` }}
                onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
              />
              <p style={{ fontSize:11, color: T.faint, display:'flex', alignItems:'center', gap:5 }}>
                <CheckCircle2 size={11} color={T.g400}/>
                Disponível: <strong style={{ color: T.g600 }}>{selectedProduct?.quantity.toLocaleString()} kg</strong>
              </p>
            </div>

            {/* Location */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:700, color: T.ink, display:'flex', alignItems:'center', gap:8 }}>
                Local de Entrega
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background: T.g50, color: T.g600, border:`1px solid ${T.gBorder}` }}>Obrigatório</span>
              </label>
              <input
                placeholder="Ex: Luanda, Viana, Cacuaco"
                value={orderData.location}
                onChange={e => setOrderData({ ...orderData, location: e.target.value })}
                style={{
                  height:42, borderRadius:10, border:`1px solid ${T.rule}`, padding:'0 14px',
                  fontSize:14, outline:'none', background: T.white, color: T.ink,
                  transition:'border-color 0.18s, box-shadow 0.18s', width:'100%', boxSizing:'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(61,154,72,0.1)` }}
                onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Summary */}
            <div style={{ padding:'14px 16px', borderRadius:12, background: T.white, border:`1px solid ${T.rule}` }}>
              <p style={{ fontSize:10, fontWeight:800, color: T.g600, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Resumo</p>
              {[
                { label: 'Subtotal', val: fmt(orderData.quantity * (selectedProduct?.price||0)) },
                { label: 'Logística (7.8%)', val: fmt(orderData.quantity * (selectedProduct?.price||0) * TAX) },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: T.muted, marginBottom:8 }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight:600, color: T.ink }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:`1px solid ${T.rule}`, alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color: T.ink }}>Total</span>
                <span style={{ fontSize:22, fontWeight:900, color: T.g600, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{fmt(totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding:'14px 24px', display:'flex', gap:10, background: T.white, borderTop:`1px solid ${T.rule}` }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{ flex:1, height:42, borderRadius:10, border:`1px solid ${T.rule}`, background:'transparent', cursor:'pointer', fontSize:13, fontWeight:700, color: T.mid, transition:'all 0.18s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.canvas }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              Cancelar
            </button>
            <button
              onClick={handlePreOrderSubmit}
              disabled={isSubmitting || !orderData.location.trim() || orderData.quantity < 1}
              style={{
                flex:2, height:42, borderRadius:10, border:'none',
                background:`linear-gradient(135deg, ${T.g500}, ${T.g700})`,
                cursor:'pointer', fontSize:13, fontWeight:800, color: T.white,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:`0 4px 16px rgba(45,125,58,0.3)`,
                opacity: (isSubmitting || !orderData.location.trim() || orderData.quantity < 1) ? 0.5 : 1,
                transition:'all 0.2s',
              }}
              onMouseEnter={e => { if (!(isSubmitting || !orderData.location.trim() || orderData.quantity < 1)) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px rgba(45,125,58,0.4)` } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(45,125,58,0.3)` }}
            >
              {isSubmitting ? (
                <>
                  <span style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
                  A processar...
                </>
              ) : (
                <><ShoppingCart size={15}/> Confirmar Encomenda</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processing overlay */}
      {isSubmitting && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(13,43,18,0.75)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background: T.white, padding:'36px 44px', borderRadius:20, display:'flex', flexDirection:'column', alignItems:'center', gap:18, border:`1px solid ${T.rule}`, boxShadow:`0 24px 80px rgba(0,0,0,0.2)` }}>
            <div style={{ position:'relative', width:52, height:52 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`2px solid ${T.gBorder}`, borderTopColor: T.g500, animation:'spin 0.9s linear infinite' }}/>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={orbisLinkLogo} alt="" style={{ width:24, height:24, objectFit:'contain' }}/>
              </div>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:16, fontWeight:700, color: T.ink }}>A processar</p>
              <p style={{ fontSize:12, color: T.faint, marginTop:4 }}>Registando encomenda...</p>
            </div>
            <div style={{ width:200, height:2, borderRadius:99, background: T.g50, overflow:'hidden' }}>
              <div style={{ height:'100%', background:`linear-gradient(90deg, ${T.g500}, ${T.g400})`, animation:'progressBar 2s ease-in-out infinite', borderRadius:99 }}/>
            </div>
          </div>
        </div>
      )}

      {/* Map modal */}
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent style={{ maxWidth:780, padding:0, overflow:'hidden', borderRadius:20, border:`1px solid ${T.rule}`, boxShadow:`0 24px 80px rgba(13,43,18,0.2)` }}>
          <div style={{ padding:'16px 22px', background: T.white, borderBottom:`1px solid ${T.rule}`, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:34, height:34, borderRadius:9, background: T.g50, border:`1px solid ${T.gBorder}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <MapPin size={15} color={T.g600}/>
            </div>
            <div>
              <DialogTitle style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:16, fontWeight:700, color: T.ink, margin:0 }}>
                Localização do Fornecedor
              </DialogTitle>
              <DialogDescription style={{ fontSize:11, color: T.faint, marginTop:2 }}>
                {selectedProduct?.product_type} · {selectedProduct?.farmer_name}
              </DialogDescription>
            </div>
          </div>
          <div ref={mapContainerRef} style={{ width:'100%', height:440 }}/>
        </DialogContent>
      </Dialog>

      {/* ── Global keyframes & utility styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        @keyframes spin        { to { transform: rotate(360deg) } }
        @keyframes shimmer     { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes breathe     { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.4; transform:scale(0.7) } }
        @keyframes cardEnter   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes progressBar { 0% { width:0%; margin-left:0 } 60% { width:100%; margin-left:0 } 100% { width:0%; margin-left:100% } }
        @keyframes tickerScroll { 0% { transform:translateX(0) } 100% { transform:translateX(-50%) } }

        * { box-sizing: border-box; }

        @media (max-width: 640px) {
          #products-grid { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>
    </div>
  )
}

export default AppHome