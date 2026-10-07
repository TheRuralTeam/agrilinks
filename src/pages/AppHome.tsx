import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'
import {
  Search, LayoutDashboard, ShoppingCart, Bell,
  ChevronDown, CheckCircle2, Package, Activity,
  MapPin, TrendingUp, Menu, X, WifiOff
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { useCanAct } from '../hooks/useCanAct'
import { useNavigate } from 'react-router-dom'
import { ProductCard, Product } from '../components/ProductCard'
import { ProductLocationMap } from '../components/ProductLocationMap'
import IdentityActionDialog from '../components/IdentityActionDialog'
import { geocodeAngolaLocation } from '../features/maps/geocodingService'
import agrilinkLogo from '../assets/agrilink-logo.png'
import { fetchActiveProducts } from '../features/products/productsService'
import { validatePreOrderSubmission } from '../features/products/businessRules'
import { isNeutralPublicView, sanitizePublicProduct } from '../lib/publicData'
import Loader from '../components/ui/Loader'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faAppleWhole, faCarrot, faSeedling, faWheatAwn, faLemon,
  faPepperHot, faFish, faDrumstickBite, faEgg, faBreadSlice,
  faCheese, faMugHot, faLayerGroup
} from '@fortawesome/free-solid-svg-icons'

const CATEGORIES = [
  { id: 'all',     label: 'Todos',      icon: faLayerGroup,    color: T.green },
  { id: 'frutas',  label: 'Frutas',     icon: faAppleWhole,    color: T.green },
  { id: 'citrus',  label: 'Cítricos',   icon: faLemon,         color: T.green },
  { id: 'legumes', label: 'Legumes',    icon: faCarrot,        color: T.green },
  { id: 'verduras',label: 'Verduras',   icon: faSeedling,      color: T.green },
  { id: 'cereais', label: 'Cereais',    icon: faWheatAwn,      color: T.green },
  { id: 'tempero', label: 'Temperos',   icon: faPepperHot,     color: T.green },
  { id: 'pescado', label: 'Pescado',    icon: faFish,          color: T.green },
  { id: 'carnes',  label: 'Carnes',     icon: faDrumstickBite, color: T.green },
  { id: 'ovos',    label: 'Ovos',       icon: faEgg,           color: T.green },
  { id: 'paes',    label: 'Pães',       icon: faBreadSlice,    color: T.green },
  { id: 'lacteos', label: 'Lácteos',    icon: faCheese,        color: T.green },
  { id: 'bebidas', label: 'Bebidas',    icon: faMugHot,         color: T.green },
]

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
import { T } from '../lib/brand';

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
  <div className="overflow-hidden rounded-[20px] border" style={{ borderColor: 'rgba(0,0,0,0.05)', background: T.white }}>
    <div style={{ aspectRatio:'4/3', background: `linear-gradient(135deg, ${T.g50}, ${T.g100})`, animation:'shimmer 1.8s ease-in-out infinite' }}/>
    <div className="p-4 flex flex-col gap-2.5">
      <div style={{ height: 13, background: T.g50, borderRadius: 6, width:'65%', animation:'shimmer 1.8s ease-in-out infinite' }}/>
      <div style={{ height: 10, background: '#f0f4f0', borderRadius: 6, width:'40%', animation:'shimmer 1.8s ease-in-out infinite' }}/>
      <div style={{ height: 40, background: T.g50, borderRadius: 12, animation:'shimmer 1.8s ease-in-out infinite' }}/>
    </div>
  </div>
)

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const AppHome = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, userProfile, isAdmin } = useAuth()
  const { requireAct } = useCanAct()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderData, setOrderData] = useState({ quantity: 1, location: '' })
  const [geocodingLocation, setGeocodingLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [feedPage, setFeedPage] = useState(0)
  const [hasMoreProducts, setHasMoreProducts] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false)

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products
    return products.filter(p => {
      if ((p as any).category) return (p as any).category === activeCategory
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

  /* Network status */
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  /* Fetch products — corre sempre, mesmo sem sessão (modo convidado),
     para o spinner nunca ficar preso à espera de um `user` que pode nunca existir. */
  const applyPublicSafety = useCallback((items: Product[]) =>
    isNeutralPublicView(user)
      ? items.map((product) => sanitizePublicProduct(product) as Product)
      : items, [user])

  const fetchProducts = useCallback(async (page = 0, append = false) => {
    if (page === 0) {
      let hasCachedFeed = false
      try { hasCachedFeed = Boolean(JSON.parse(sessionStorage.getItem('agrilink:marketplace:feed') || 'null')?.products?.length) } catch {}
      if (!hasCachedFeed) setLoading(true)
    }
    else setLoadingMore(true)

    try {
      const fetchedProducts = await fetchActiveProducts(user?.id, page, 20)
      const safeFeed = applyPublicSafety((fetchedProducts || []) as Product[])
      setProducts(prev => append ? [...prev, ...safeFeed] : safeFeed)
      setFeedPage(page)
      setHasMoreProducts(safeFeed.length === 20)

      if (page === 0) {
        try {
          sessionStorage.setItem('agrilink:marketplace:feed', JSON.stringify({
            expiresAt: Date.now() + 5 * 60_000,
            products: safeFeed,
          }))
        } catch {}
      }
    } catch (err) {
      console.error('[AgriLink] Erro ao carregar Marketplace:', err)
      if (page === 0) {
        try {
          const cached = JSON.parse(sessionStorage.getItem('agrilink:marketplace:feed') || 'null')
          if (Array.isArray(cached.products)) {
            setProducts(cached.products)
            setHasMoreProducts(false)
          } else {
            setProducts([])
          }
        } catch {
          setProducts([])
        }
      }
    } finally {
      if (page === 0) setLoading(false)
      else setLoadingMore(false)
    }
  }, [user, applyPublicSafety])

  useEffect(() => {
    let cancelled = false
    setFeedPage(0)
    setHasMoreProducts(true)
    try {
      const cached = JSON.parse(sessionStorage.getItem('agrilink:marketplace:feed') || 'null')
      if (!cancelled && cached?.expiresAt > Date.now() && Array.isArray(cached.products)) {
        setProducts(cached.products)
        setLoading(false)
      }
    } catch {}
    void fetchProducts(0, false)
    return () => { cancelled = true }
  }, [activeCategory, fetchProducts])

  const handleProductUpdate = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x))
  const handleLoadMore = () => { if (!loadingMore && hasMoreProducts) fetchProducts(feedPage + 1, true) }
  const handleOpenMap = (p: Product) => { setSelectedProduct(p); setMapModalOpen(true) }
  const handleOpenPreOrder = (p: Product) => {
    if (!requireAct('fazer uma pré-compra')) return
    setSelectedProduct(p); setOrderData({ quantity:1, location:'' }); setModalOpen(true)
  }

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !user) return toast.error('Inicie sessão para continuar')
    if (!userProfile?.identity_document?.trim()) {
      setIdentityDialogOpen(true)
      return
    }

    setIsSubmitting(true)
    try {
      const quantity = Number(orderData.quantity || 0)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade válida.')
      setGeocodingLocation(true)
      let destination: { lat: string; lon: string } | null = null
      try {
        destination = await geocodeAngolaLocation(orderData.location)
      } catch (geocodeError) {
        console.warn('[AgriLink] Geocoding da entrega falhou.', geocodeError)
        throw new Error('Não foi possível localizar o ponto de entrega. Informe uma localização mais específica (ex.: município e zona) e tente novamente.')
      } finally {
        setGeocodingLocation(false)
      }

      if (!destination) {
        throw new Error('O ponto de entrega precisa de coordenadas válidas para concluir a pré-compra.')
      }

      const idempotencyKey = crypto.randomUUID()
      const { data, error } = await supabase.rpc('create_marketplace_pre_order', {
        p_product_id: selectedProduct.id,
        p_quantity: quantity,
        p_location: orderData.location,
        p_delivery_lat: destination ? Number(destination.lat) : null,
        p_delivery_lng: destination ? Number(destination.lon) : null,
        p_idempotency_key: idempotencyKey,
      })

      if (error) {
        const raw = [error.message, (error as any).details, (error as any).hint].filter(Boolean).join(' ')
        console.error('[AgriLink] create_marketplace_pre_order failed', {
          code: (error as any).code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
        })
        if (raw.includes('AUTH_REQUIRED') || (error as any).code === '42501') throw new Error('A sua sessão expirou. Inicie sessão novamente.')
        if (raw.includes('INVALID_QUANTITY')) throw new Error('A quantidade indicada é inválida.')
        if (raw.includes('DELIVERY_LOCATION_REQUIRED')) throw new Error('Informe o local de entrega.')
        if (raw.includes('DELIVERY_COORDINATES_PAIR_REQUIRED') || raw.includes('DELIVERY_COORDINATES_INVALID')) throw new Error('O local de entrega foi informado de forma inválida. Tente novamente.')
        const stockMatch = raw.match(/INSUFFICIENT_STOCK:([0-9]+(?:\\.[0-9]+)?)/)
        if (stockMatch) {
          const available = Number(stockMatch[1])
          setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, quantity: available, status: available > 0 ? p.status : 'removed' } : p).filter(p => Number(p.quantity) > 0 && p.status === 'active'))
          throw new Error(available > 0
            ? `A quantidade solicitada não está disponível. Neste momento existem apenas ${available.toLocaleString('pt-AO')} kg disponíveis.`
            : 'Este produto já não tem stock disponível e foi removido do Marketplace.')
        }
        if (raw.includes('STOCK_UNAVAILABLE:0')) {
          setProducts(prev => prev.filter(p => p.id !== selectedProduct.id))
          throw new Error('Este produto já não tem stock disponível e foi removido do Marketplace.')
        }
        if (raw.includes('PRODUCT_NOT_AVAILABLE')) throw new Error('Este produto já não está disponível.')
        if (raw.includes('PRODUCT_NOT_FOUND')) throw new Error('Este produto já não existe.')
        if (raw.includes('SELLER_CANNOT_BUY_OWN_PRODUCT')) throw new Error('Não pode comprar o seu próprio produto.')
        if (raw.includes('duplicate key') || raw.includes('23505')) throw new Error('Esta pré-compra já foi registada. Verifique os seus pedidos.')
        throw new Error(error.message || 'O sistema não conseguiu criar a pré-compra. Tente novamente.') 
      }

      const reservation = Array.isArray(data) ? data[0] : data
      if (!reservation) throw new Error('Não foi possível criar a reserva.')

      toast.success('Pré-compra registada. O fornecedor será notificado e a reserva fica activa por 15 minutos.')
      // O preço final, frete e pagamento são calculados pelo servidor após a aceitação do fornecedor.
      setModalOpen(false)
      setSelectedProduct(null)
    } catch (error: any) {
      console.error('[AgriLink] Erro ao criar pré-compra:', error)
      toast.error(error?.message || 'Não foi possível concluir a reserva.')
    } finally {
      setGeocodingLocation(false)
      setIsSubmitting(false)
    }
  }


  const productSubtotal = useMemo(() => selectedProduct ? orderData.quantity * selectedProduct.price : 0, [selectedProduct, orderData.quantity])
  const fmt = (p: number) => `${p.toLocaleString('pt-AO')} ${selectedCountry.currency}`

  /* ── Loading ── */
  if (loading) return <Loader />

  /* ── Main render ── */
  return (
    <div className="min-h-screen" style={{ background: T.canvas, fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {!isOnline && (
        <div style={{ padding:'8px 16px', textAlign:'center', fontSize:12, fontWeight:600, background:T.g50, color:T.g700 }}>
          Modo offline: a mostrar os últimos produtos disponíveis neste dispositivo.
        </div>
      )}

      {/* ═══ HEADER ════════════════════════════════════════════════════════ */}
      <header style={{
        position:'sticky', top:0, zIndex:30,
        background:'rgba(255,255,255,0.8)', backdropFilter:'saturate(180%) blur(20px)',
        WebkitBackdropFilter:'saturate(180%) blur(20px)',
        borderBottom:`1px solid rgba(0,0,0,0.06)`,
      }}>
        <div style={{ maxWidth:1320, margin:'0 auto', padding:'0 16px', height:56, display:'flex', alignItems:'center', gap:10 }}>

          {/* Logo */}
          <div
            style={{ display:'flex', alignItems:'center', cursor:'pointer', flexShrink: 0 }}
            onClick={() => navigate('/')}
          >
            <img
              src={agrilinkLogo}
              alt="AgriLink"
              style={{ height: 26, width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Pesquisa — pílula leve, sempre visível, encolhe em mobile sem sair da navbar */}
          <div
            onClick={() => navigate('/search')}
            style={{
              flex: '1 1 auto', minWidth: 0, maxWidth: 480,
              display:'flex', alignItems:'center', gap:8,
              padding:'8px 14px', borderRadius: 980,
              background: 'rgba(118,118,128,0.08)',
              cursor:'pointer', transition:'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(118,118,128,0.13)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(118,118,128,0.08)' }}
          >
            <Search size={14} color={T.faint} style={{ flexShrink: 0 }}/>
            <span style={{
              fontSize:13, color: T.faint, fontWeight:500,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>
              Pesquisar
            </span>
          </div>

          {/* Right actions */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink: 0 }}>
            <div className="hidden sm:flex">
              <CountrySelector selectedCountry={selectedCountry} onCountryChange={(c) => { setSelectedCountry(c); toast.success(`${c.flag} ${c.name}`) }}/>
            </div>

            {isAdmin && (
              <button
                style={{
                  padding:'7px 13px', borderRadius: 980, border:'none', background: 'rgba(118,118,128,0.08)',
                  cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13,
                  fontWeight:600, color: T.ink, transition:'background 0.15s',
                }}
                onClick={() => navigate('/admindashboard')}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(118,118,128,0.13)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(118,118,128,0.08)' }}
                className="hidden sm:flex"
              >
                <LayoutDashboard size={14} color={T.g500}/>
                <span>Dashboard</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              style={{
                width: 32, height: 32, borderRadius: '50%', border:'none', background: 'rgba(118,118,128,0.08)',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                color: T.mid, transition:'background 0.15s',
              }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden"
            >
              {mobileMenuOpen ? <X size={17}/> : <Menu size={17}/>}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div style={{
            position: 'absolute', top: 62, left: 0, right: 0,
            background: 'rgba(255,255,255,0.92)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
            borderBottom: `1px solid rgba(0,0,0,0.06)`,
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: `0 8px 24px rgba(0,0,0,0.06)`,
            animation: 'cardEnter 0.3s ease-out'
          }} className="sm:hidden">
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
        borderBottom: `1px solid rgba(0,0,0,0.05)`,
        padding: '12px 0',
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto', padding: '0 20px',
          display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
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
                  display: 'flex', alignItems: 'center',
                  gap: 7, padding: '8px 14px 8px 10px',
                  borderRadius: 980,
                  border: 'none',
                  background: active ? cat.color : 'rgba(118,118,128,0.08)',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'rgba(255,255,255,0.25)' : `${cat.color}18`,
                  transition: 'all 0.18s', flexShrink: 0,
                }}>
                  <FontAwesomeIcon
                    icon={cat.icon}
                    style={{ fontSize: 11, color: active ? T.white : cat.color }}
                  />
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: active ? T.white : T.mid,
                  letterSpacing: '0.01em', whiteSpace: 'nowrap',
                }}>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </section>


      {/* ═══ PRODUCT GRID ═══════════════════════════════════════════════════ */}
      <main id="products-grid" style={{ maxWidth:1320, margin:'0 auto', padding:'clamp(24px, 4vw, 48px) 20px clamp(80px, 12vw, 140px)' }}>

        {/* Section header */}
        <div style={{ marginBottom:24 }}>
          <h2 style={{
            fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize:'clamp(20px, 2.5vw, 26px)', fontWeight:700, color: T.ink, margin:0, letterSpacing:'-0.02em'
          }}>
            Produtos disponíveis
          </h2>
          <p style={{ fontSize:13, color: T.faint, marginTop:4, fontWeight:500 }}>
            {filteredProducts.length} listings · ordenados por relevância
          </p>
        </div>


        {/* Grid */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 288px), 1fr))',
          gap:'clamp(14px, 2vw, 22px)',
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i}/>)
            : filteredProducts.map((product, i) => (
              <div
                key={product.id}
                
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

        {!loading && filteredProducts.length > 0 && hasMoreProducts && (
          <div style={{ display:'flex', justifyContent:'center', paddingTop:28 }}>
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                minWidth:180, height:44, padding:'0 20px', borderRadius:999,
                border:`1px solid ${T.rule}`, background:T.white, color:T.ink,
                fontSize:13, fontWeight:700, cursor:loadingMore ? 'wait' : 'pointer',
                boxShadow:'0 4px 18px rgba(0,0,0,0.05)',
              }}
            >
              {loadingMore ? 'A carregar…' : 'Ver mais produtos'}
            </button>
          </div>
        )}

        {/* Empty / offline state */}
        {!loading && filteredProducts.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'100px 20px', textAlign:'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${T.rule}`, background: T.g50, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Package size={18} color={T.g500} /></div>
            <h3 style={{ fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif", fontSize:22, color: T.ink, margin:'0 0 10px', fontWeight:700 }}>
              {isOnline ? 'Sem produtos disponíveis' : 'Sem ligação à internet'}
            </h3>
            <p style={{ fontSize:13, color: T.faint, maxWidth:320, lineHeight:1.65 }}>
              {isOnline
                ? 'Ainda não existem produtos disponíveis nesta categoria.'
                : 'Verifique a sua ligação e tente novamente. Se já tiver produtos em cache, eles serão apresentados quando disponíveis.'}
            </p>
            {!isOnline && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:14, padding:'6px 12px', borderRadius:980, background: T.g50, color: T.g600, fontSize:12, fontWeight:700 }}>
                <WifiOff size={13}/> Offline
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ PRE-ORDER MODAL ═════════════════════════════════════════════════ */}
      <IdentityActionDialog
        open={identityDialogOpen}
        actionLabel="a pré-compra"
        onOpenChange={setIdentityDialogOpen}
        onCompleted={async () => {
          await refreshProfile()
        }}
      />

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
                <DialogTitle style={{ fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif", fontSize:18, fontWeight:700, color: T.ink, margin:0 }}>
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
                A reserva bloqueia o stock por 15 minutos. O fornecedor confirma o pedido e, depois, o sistema calcula o frete e abre o pagamento.
              </p>
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
                { label: 'Subtotal', val: fmt(productSubtotal) },
                { label: 'Frete', val: 'Calculado após confirmação' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: T.muted, marginBottom:8 }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight:600, color: T.ink }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:`1px solid ${T.rule}`, alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color: T.ink }}>Total</span>
                <span style={{ fontSize:18, fontWeight:900, color: T.g600, letterSpacing:'-0.02em' }}>A confirmar</span>
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
              disabled={isSubmitting || geocodingLocation || !orderData.location.trim() || orderData.quantity < 1}
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
              {isSubmitting || geocodingLocation ? (
                <>
                  <span style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
                  A localizar entrega...
                </>
              ) : (
                <><ShoppingCart size={15}/> Enviar pré-compra</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processing overlay */}
      {isSubmitting && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(13,43,18,0.75)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background: T.white, padding:'36px 44px', borderRadius:20, display:'flex', flexDirection:'column', alignItems:'center', gap:18, border:`1px solid ${T.rule}`, boxShadow:`0 24px 80px rgba(0,0,0,0.2)` }}>
            <Loader compact />
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
              <DialogTitle style={{ fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif", fontSize:16, fontWeight:700, color: T.ink, margin:0 }}>
                Localização do Fornecedor
              </DialogTitle>
              <DialogDescription style={{ fontSize:11, color: T.faint, marginTop:2 }}>
                {selectedProduct?.product_type} · {selectedProduct?.farmer_name}
              </DialogDescription>
            </div>
          </div>
          <ProductLocationMap
            latitude={selectedProduct?.location_lat}
            longitude={selectedProduct?.location_lng}
            className="h-[440px] rounded-none border-0"
          />
        </DialogContent>
      </Dialog>

      {/* ── Global keyframes & utility styles ── */}
      <style>{`
        

        @keyframes shimmer     { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes breathe     { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.4; transform:scale(0.7) } }
        @keyframes tickerScroll { 0% { transform:translateX(0) } 100% { transform:translateX(-50%) } }
        @keyframes fruitJump   { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-22px) scale(1.05) } }

        * { box-sizing: border-box; }

        @media (max-width: 640px) {
          #products-grid { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>
    </div>
  )
}

export default AppHome