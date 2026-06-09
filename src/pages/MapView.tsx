
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Filter, DollarSign, Calendar, Package, Search, X,
  Leaf, TrendingUp, Users, Phone, Mail, Star, Heart, Share2,
  ArrowRight, ArrowLeft, Droplet, Wind, Cloud, Navigation,
  ChevronDown, CheckCircle, AlertCircle, User, Briefcase,
  MessageSquare, Map, Zap, Eye, EyeOff, Sliders, Car, Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SatelliteMonitor from '@/components/SatelliteMonitor';
import { supabase } from '@/integrations/supabase/client';
import axios from 'axios';

/* ─── Design tokens (theme-aware via CSS variables) ────────────────────────── */
const T = {
  g950:    'var(--map-g950)',
  g900:    'var(--map-g900)',
  g800:    'var(--map-g800)',
  g700:    'var(--map-g700)',
  g600:    'var(--map-g600)',
  g500:    'var(--map-g500)',
  g400:    'var(--map-g400)',
  g200:    'var(--map-g200)',
  g100:    'var(--map-g100)',
  g50:     'var(--map-g50)',
  gBorder: 'var(--map-gborder)',
  accent:  'var(--map-accent)',
  accentL: 'var(--map-accent-l)',
  accentBg:'var(--map-accent-bg)',
  ink:     'var(--map-ink)',
  slate:   'var(--map-slate)',
  mid:     'var(--map-mid)',
  muted:   'var(--map-muted)',
  faint:   'var(--map-faint)',
  rule:    'var(--map-rule)',
  canvas:  'var(--map-canvas)',
  surface: 'var(--map-surface)',
  white:   'var(--map-white)',
  gold:    'var(--map-gold)',
  goldL:   'var(--map-gold-l)',
  goldBg:  'var(--map-gold-bg)',
  danger:  'var(--map-danger)',
  dangerBg:'var(--map-danger-bg)',
  blue:    'var(--map-blue)',
  blueBg:  'var(--map-blue-bg)',
  shadow:  'var(--map-shadow)',
  shadowMd:'var(--map-shadow-md)',
  shadowLg:'var(--map-shadow-lg)',
}

const FONT = "'League Spartan', 'Helvetica Neue', Arial, sans-serif"

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Product {
  id: string; product_type: string; quantity: number; harvest_date: string
  price: number; province_id: string; municipality_id: string
  farmer_name: string; farmer_id: string; farmer_phone?: string
  farmer_email?: string; farmer_rating?: number; images?: string[]
  image_url?: string; location_lat: number | null; location_lng: number | null
  weatherData?: {
    main?: { temp?: number; humidity?: number }
    wind?: { speed?: number }
    weather?: Array<{ description?: string }>
  }
  roadCondition?: string; status?: string; created_at?: string
}

interface NominatimResult {
  lat: string; lon: string; display_name: string; name?: string; place_id?: number
}

interface FilterOptions {
  productType: string; priceRange: [number, number]; radius: number
  userType: 'all' | 'farmers' | 'buyers'
}

/* ─── OSRM helper — rota real pelas estradas ────────────────────────────────── */
/**
 * Busca rota real via OSRM público (sem token).
 * from / to no formato [lat, lng] (Leaflet style).
 * Devolve array de [lat, lng] seguindo as estradas.
 * Em caso de falha, devolve linha direta como fallback.
 */
async function fetchRoadRoute(
  from: [number, number],
  to: [number, number]
): Promise<[number, number][]> {
  const r = await fetchRoadRouteFull(from, to)
  return r.coords
}

/**
 * Igual a fetchRoadRoute, mas devolve também distância (metros) e duração (segundos).
 */
async function fetchRoadRouteFull(
  from: [number, number],
  to: [number, number]
): Promise<{ coords: [number, number][]; distance: number | null; duration: number | null }> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson`
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const route = data?.routes?.[0]
    if (data.code === 'Ok' && route?.geometry?.coordinates?.length) {
      const coords = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
      )
      return { coords, distance: route.distance ?? null, duration: route.duration ?? null }
    }
  } catch {}
  return { coords: [from, to], distance: null, duration: null }
}

/** Formata duração (segundos) em texto curto: 1h 20min / 45 min / 3 min */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '—'
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60); const m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

/* ─── Micro components ──────────────────────────────────────────────────────── */
const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 9, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: FONT }}>
    {children}
  </span>
)

const Pill = ({
  children, color = T.g700, bg = T.g50, border = T.gBorder,
}: { children: React.ReactNode; color?: string; bg?: string; border?: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, background: bg, color, border: `1px solid ${border}`, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
    {children}
  </span>
)

/* ─── Product Card ──────────────────────────────────────────────────────────── */
interface ProductCardProps {
  product: Product; onClose: () => void
  onContact: (p: Product) => void; onFavorite: (id: string) => void
  onTrack?: (p: Product) => void
  distanceLabel?: string
}

const ProductCard: React.FC<ProductCardProps> = ({
  product, onClose, onContact, onFavorite, onTrack, distanceLabel,
}) => {
  const [isFavorited, setIsFavorited] = useState(false)
  const pricePerKg = (product.price / Math.max(product.quantity, 1)).toFixed(0)

  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24, zIndex: 40,
      width: 340, fontFamily: FONT,
      animation: 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)',
    }}>
      <div style={{
        background: T.white, borderRadius: 14,
        border: `1px solid ${T.rule}`,
        boxShadow: `0 16px 48px ${T.shadowLg}`,
        overflow: 'hidden',
      }}>
        {/* Image header */}
        <div style={{ position: 'relative', height: 130, background: `linear-gradient(135deg, ${T.g800}, ${T.g700})`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: '20px 20px' }}/>
          {product.image_url && (
            <img src={product.image_url} alt={product.product_type} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, position: 'absolute', inset: 0 }}/>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,35,16,0.7) 0%, transparent 60%)' }}/>
          <button onClick={onClose} style={{
            position: 'absolute', top: 10, right: 10,
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)' }}
          >
            <X size={13} color={T.white}/>
          </button>
          {product.status && (
            <div style={{ position: 'absolute', top: 10, left: 10 }}>
              <Pill bg="rgba(255,255,255,0.15)" color={T.white} border="rgba(255,255,255,0.20)">
                <Zap size={8}/> {product.status}
              </Pill>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
            <h3 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 900, color: T.white, margin: '0 0 5px', letterSpacing: '-0.03em' }}>{product.product_type}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={11} color={T.white}/>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontFamily: FONT }}>{product.farmer_name}</span>
              {product.farmer_rating && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={10} color={T.goldL} fill={T.goldL}/>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: FONT, fontWeight: 700 }}>{product.farmer_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: T.g50, border: `1px solid ${T.gBorder}`, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <Label>Preço Total</Label>
                <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 900, color: T.g700, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                  {product.price.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>Kz</span>
                </div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, marginTop: 2 }}>{pricePerKg} Kz/kg</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Label>Quantidade</Label>
                <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 900, color: T.ink, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{product.quantity}</div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, marginTop: 2 }}>kg</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { icon: <MapPin size={11}/>, label: 'Localização', value: product.municipality_id },
              { icon: <Calendar size={11}/>, label: 'Colheita', value: new Date(product.harvest_date).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' }) },
            ].map(item => (
              <div key={item.label} style={{ padding: '9px 11px', borderRadius: 9, background: T.surface, border: `1px solid ${T.rule}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  {React.cloneElement(item.icon, { color: T.g600 })}
                  <Label>{item.label}</Label>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {product.weatherData && (
            <div style={{ padding: '11px 13px', borderRadius: 10, background: T.blueBg, border: `1px solid #BFDBFE`, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                <Cloud size={13} color={T.blue}/>
                <Label>Condições Meteorológicas</Label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Temp.', value: `${Math.round(product.weatherData.main?.temp || 0)}°C` },
                  { label: 'Humid.', value: `${product.weatherData.main?.humidity}%` },
                  { label: 'Vento', value: `${Math.round(product.weatherData.wind?.speed || 0)} m/s` },
                ].map(w => (
                  <div key={w.label} style={{ textAlign: 'center', padding: '7px 5px', background: 'rgba(255,255,255,0.65)', borderRadius: 7 }}>
                    <div style={{ fontSize: 9, color: T.muted, fontFamily: FONT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{w.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.blue, fontFamily: FONT }}>{w.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(product.farmer_phone || product.farmer_email) && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: T.surface, border: `1px solid ${T.rule}`, marginBottom: 12 }}>
              <Label>Contacto</Label>
              <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {product.farmer_phone && (
                  <a href={`tel:${product.farmer_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: T.g700, fontFamily: FONT, textDecoration: 'none' }}>
                    <Phone size={11} color={T.faint}/> {product.farmer_phone}
                  </a>
                )}
                {product.farmer_email && (
                  <a href={`mailto:${product.farmer_email}`} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: T.g700, fontFamily: FONT, textDecoration: 'none' }}>
                    <Mail size={11} color={T.faint}/> {product.farmer_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {(distanceLabel || onTrack) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {distanceLabel && (
                <div style={{ flex: 1, padding: '8px 11px', borderRadius: 8, background: T.accentBg, border: `1px solid #BDE3DC`, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={12} color={T.accent}/>
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.accent, fontFamily: FONT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{distanceLabel}</span>
                </div>
              )}
              {onTrack && (
                <button onClick={() => onTrack(product)} style={{ height: 34, padding: '0 12px', borderRadius: 8, border: `1.5px solid ${T.gBorder}`, background: T.g50, color: T.g700, cursor: 'pointer', fontSize: 10, fontWeight: 900, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={11}/> Rastrear
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onContact(product)}
              style={{
                flex: 1, height: 38, borderRadius: 8, border: 'none',
                background: T.g700, color: T.white, cursor: 'pointer',
                fontSize: 11, fontWeight: 800, fontFamily: FONT,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: `0 3px 10px rgba(22,82,32,0.28)`, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.g600 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.g700 }}
            >
              <MessageSquare size={13}/> Contactar
            </button>
            <button
              onClick={() => { setIsFavorited(!isFavorited); onFavorite(product.id) }}
              style={{
                width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                background: isFavorited ? T.dangerBg : T.surface,
                border: `1.5px solid ${isFavorited ? '#FECACA' : T.rule}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <Heart size={14} color={isFavorited ? T.danger : T.faint} fill={isFavorited ? T.danger : 'none'}/>
            </button>
            <button
              style={{ width: 38, height: 38, borderRadius: 8, cursor: 'pointer', background: T.surface, border: `1.5px solid ${T.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            >
              <Share2 size={14} color={T.faint}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Stats Panel ───────────────────────────────────────────────────────────── */
const StatsPanel: React.FC<{ count: number; avgPrice: number; totalQuantity: number }> = ({
  count, avgPrice, totalQuantity,
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
    {[
      { label: 'Produtos', value: count, color: T.g700 },
      { label: 'Preço Médio', value: `${avgPrice.toLocaleString()}`, color: T.accent },
      { label: 'Total (kg)', value: totalQuantity.toLocaleString(), color: T.gold },
    ].map(s => (
      <div key={s.label} style={{ padding: '10px 9px', borderRadius: 9, background: T.white, border: `1px solid ${T.rule}`, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT, marginBottom: 4 }}>{s.label}</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: s.color, fontFamily: FONT, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
      </div>
    ))}
  </div>
)

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef                 = useRef<any>(null)
  const markersRef             = useRef<any[]>([])
  const userMarkerRef          = useRef<any>(null)
  const routePolylineRef       = useRef<any>(null)
  const routeAnimFrameRef      = useRef<number | null>(null)
  const pipelineLayerGroupRef  = useRef<any>(null)
  const productRouteLayers     = useRef<any[]>([])   // linha produto→utilizador (seleccionado)
  const allProductRoutesRef    = useRef<any[]>([])   // linhas user→todos os produtos
  const leafletLoadedRef       = useRef(false)

  const [products, setProducts]               = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [mapError, setMapError]               = useState<string | null>(null)
  const [leafletReady, setLeafletReady]       = useState(false)

  const [searchText, setSearchText]         = useState('')
  const [searchResults, setSearchResults]   = useState<NominatimResult[]>([])
  const [searchLoading, setSearchLoading]   = useState(false)
  const [showFilters, setShowFilters]       = useState(false)
  const [showProductsList, setShowProductsList] = useState(true)

  const [filters, setFilters] = useState<FilterOptions>({
    productType: '', priceRange: [0, 10000], radius: 50, userType: 'all',
  })

  const [favorites, setFavorites]         = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(true)
  const [userLocation, setUserLocation]   = useState<[number, number] | null>(null)
  const [mapStyle, setMapStyle]           = useState<'streets' | 'satellite' | 'terrain'>('streets')
  const [trackedProduct, setTrackedProduct] = useState<Product | null>(null)
  const [routeMetrics, setRouteMetrics]     = useState<Record<string, { km: number; mins: number }>>({})
  const [transportMode, setTransportMode]   = useState<'car' | 'truck'>('car')

  const { user } = useAuth()

  const TILE_LAYERS = {
    streets:   { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',   attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
    terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',     attribution: '© OpenTopoMap' },
  }

  const distanceKm = useCallback((a: [number, number], b: [number, number]) => {
    const R = 6371
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b[1] - a[1]); const dLng = toRad(b[0] - a[0])
    const lat1 = toRad(a[1]);        const lat2  = toRad(b[1])
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)))
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('products').select('*').limit(100)
      if (error) throw error
      setProducts((data || []) as any)
    } catch { setMapError('Erro ao carregar produtos') }
    finally { setLoading(false) }
  }, [])

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesType  = !filters.productType || p.product_type.toLowerCase().includes(filters.productType.toLowerCase())
    const matchesPrice = p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    return matchesType && matchesPrice
  }), [products, filters])

  const statsData = useMemo(() => {
    if (!filteredProducts.length) return { count: 0, avgPrice: 0, totalQuantity: 0 }
    return {
      count:         filteredProducts.length,
      avgPrice:      Math.round(filteredProducts.reduce((s, p) => s + p.price, 0) / filteredProducts.length),
      totalQuantity: filteredProducts.reduce((s, p) => s + p.quantity, 0),
    }
  }, [filteredProducts])

  /* ── Geocoding ──────────────────────────────────────────────────────────── */
  const handleSearch = useCallback(async (value: string) => {
    setSearchText(value)
    if (!value.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const r = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: value, format: 'json', limit: 5, countrycodes: 'ao' },
        headers: { 'Accept-Language': 'pt' },
      })
      setSearchResults(r.data as NominatimResult[])
    } catch {}
    finally { setSearchLoading(false) }
  }, [])

  const selectSearchResult = useCallback((result: NominatimResult) => {
    if (mapRef.current) {
      mapRef.current.flyTo([parseFloat(result.lat), parseFloat(result.lon)], 12, { duration: 1.2 })
    }
    setSearchText(''); setSearchResults([])
  }, [])

  const handleFavorite = useCallback((productId: string) => {
    setFavorites(prev => { const n = new Set(prev); n.has(productId) ? n.delete(productId) : n.add(productId); return n })
  }, [])

  const handleContact = useCallback((product: Product) => { console.log('Contactar:', product.farmer_name) }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  /* ── Carregar Leaflet ───────────────────────────────────────────────────── */
  useEffect(() => {
    if ((window as any).L) { setLeafletReady(true); return }
    const link = document.createElement('link')
    link.rel   = 'stylesheet'
    link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script     = document.createElement('script')
    script.src       = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async     = true
    script.onload    = () => setLeafletReady(true)
    script.onerror   = () => setMapError('Erro ao carregar biblioteca de mapa')
    document.head.appendChild(script)
    return () => { document.head.removeChild(link); document.head.removeChild(script) }
  }, [])

  /* ══ PIPELINES — rotas reais pelas estradas via OSRM ════════════════════ */
  const drawPipelines = useCallback(async (m: any) => {
    if (!m || !(window as any).L) return
    const L = (window as any).L

    if (pipelineLayerGroupRef.current) {
      pipelineLayerGroupRef.current.clearLayers()
    } else {
      pipelineLayerGroupRef.current = L.layerGroup().addTo(m)
    }

    // Hubs provinciais [lat, lng]
    const HUBS: Record<string, [number, number]> = {
      luanda:   [-8.838,  13.234],
      huambo:   [-12.775, 15.739],
      benguela: [-12.578, 13.408],
      lubango:  [-14.917, 13.492],
      malanje:  [-9.540,  16.341],
      uige:     [-7.609,  15.045],
      cabinda:  [-5.550,  12.189],
      kuito:    [-12.383, 16.936],
      saurimo:  [-9.660,  20.390],
      menongue: [-14.660, 17.690],
    }

    const PIPELINES: Array<[string, string, 'primary' | 'secondary' | 'tertiary']> = [
      ['luanda',   'huambo',   'primary'],
      ['luanda',   'benguela', 'primary'],
      ['luanda',   'malanje',  'primary'],
      ['luanda',   'uige',     'secondary'],
      ['luanda',   'cabinda',  'secondary'],
      ['huambo',   'benguela', 'secondary'],
      ['huambo',   'lubango',  'secondary'],
      ['huambo',   'kuito',    'secondary'],
      ['benguela', 'lubango',  'tertiary'],
      ['malanje',  'kuito',    'tertiary'],
      ['kuito',    'menongue', 'tertiary'],
      ['kuito',    'saurimo',  'tertiary'],
      ['lubango',  'menongue', 'tertiary'],
    ]

    const tierConfig = {
      primary:   { color: T.g500,   weight: 3,   opacity: 0.85, dashArray: '8 4' },
      secondary: { color: T.accentL, weight: 2,   opacity: 0.65, dashArray: '6 4' },
      tertiary:  { color: T.g400,   weight: 1.5, opacity: 0.45, dashArray: '4 4' },
    }

    // Desenhar nós dos hubs imediatamente (não dependem do OSRM)
    Object.entries(HUBS).forEach(([name, coords]) => {
      L.circleMarker(coords, { radius: 10, fillColor: T.g500, fillOpacity: 0.12, color: 'transparent', weight: 0 })
       .addTo(pipelineLayerGroupRef.current)

      L.circleMarker(coords, { radius: 6, fillColor: T.g700, fillOpacity: 0.9, color: T.white, weight: 2.5 })
       .addTo(pipelineLayerGroupRef.current)

      L.marker(coords, {
        icon: L.divIcon({
          html: `<div style="font-family:${FONT};font-size:9px;font-weight:800;color:${T.g800};text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;text-shadow:0 1px 3px rgba(255,255,255,0.9),0 0 6px rgba(255,255,255,0.8);margin-top:12px;">${name.charAt(0).toUpperCase() + name.slice(1)}</div>`,
          className: '', iconAnchor: [0, 0],
        }),
      }).addTo(pipelineLayerGroupRef.current)
    })

    // Desenhar cada corredor com rota real pelas estradas
    const drawCorridor = async (
      from: string, to: string, tier: 'primary' | 'secondary' | 'tertiary'
    ) => {
      const cfg    = tierConfig[tier]
      const coords = await fetchRoadRoute(HUBS[from], HUBS[to])

      // Camada de brilho (glow) abaixo da linha
      L.polyline(coords, {
        color: cfg.color, weight: cfg.weight + 6, opacity: 0.10,
      }).addTo(pipelineLayerGroupRef.current)

      // Linha principal tracejada
      L.polyline(coords, {
        color: cfg.color, weight: cfg.weight, opacity: cfg.opacity,
        dashArray: cfg.dashArray,
      }).addTo(pipelineLayerGroupRef.current)
    }

    // Primárias em paralelo — aparecem primeiro
    const primaries  = PIPELINES.filter(([,, t]) => t === 'primary')
    const secondaries = PIPELINES.filter(([,, t]) => t === 'secondary')
    const tertiaries  = PIPELINES.filter(([,, t]) => t === 'tertiary')

    await Promise.all(primaries.map(([f, t, tier]) => drawCorridor(f, t, tier)))
    await new Promise(r => setTimeout(r, 300))
    await Promise.all(secondaries.map(([f, t, tier]) => drawCorridor(f, t, tier)))
    await new Promise(r => setTimeout(r, 300))
    await Promise.all(tertiaries.map(([f, t, tier]) => drawCorridor(f, t, tier)))
  }, [])

  /* ── Inicializar mapa ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!leafletReady || !mapContainer.current || mapRef.current) return
    const L = (window as any).L
    try {
      const m = L.map(mapContainer.current, { center: [-10.5, 15.0], zoom: 5, zoomControl: false })
      L.control.zoom({ position: 'topright' }).addTo(m)
      L.tileLayer(TILE_LAYERS.streets.url, { attribution: TILE_LAYERS.streets.attribution, maxZoom: 19 }).addTo(m)
      mapRef.current        = m
      leafletLoadedRef.current = true

      drawPipelines(m)

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          setUserLocation([lng, lat])
          const el = document.createElement('div')
          el.style.cssText = `width:20px;height:20px;background:${T.blue};border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(29,78,216,0.18);`
          const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
          userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(m)
        }, () => {})
      }
    } catch { setMapError('Erro ao inicializar mapa') }

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; leafletLoadedRef.current = false }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady])

  /* ── Trocar estilo do mapa ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !(window as any).L || !leafletLoadedRef.current) return
    const L = (window as any).L; const m = mapRef.current
    m.eachLayer((layer: any) => { if (layer instanceof L.TileLayer) m.removeLayer(layer) })
    const cfg = TILE_LAYERS[mapStyle]
    L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(m)
    drawPipelines(m)
  }, [mapStyle, drawPipelines])

  /* ── Marcadores de produtos ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !(window as any).L || !leafletLoadedRef.current) return
    const L = (window as any).L; const m = mapRef.current
    markersRef.current.forEach(mk => m.removeLayer(mk))
    markersRef.current = []

    filteredProducts.forEach(product => {
      if (product.location_lat && product.location_lng) {
        const el = document.createElement('div')
        el.style.cssText = `
          width:40px;height:40px;cursor:pointer;
          background:linear-gradient(135deg,${T.g600},${T.g800});
          border:2.5px solid white;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);display:flex;align-items:center;
          justify-content:center;box-shadow:0 4px 14px rgba(22,82,32,0.4);
          transition:transform 0.18s;
        `
        el.innerHTML = `<div style="transform:rotate(45deg);font-size:18px;line-height:1;">🌿</div>`
        const icon   = L.divIcon({ html: el.outerHTML, className: '', iconSize: [40, 40], iconAnchor: [20, 40] })
        const marker = L.marker([product.location_lat, product.location_lng], { icon })
          .addTo(m)
          .on('click', () => setSelectedProduct(product))
        markersRef.current.push(marker)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, leafletLoadedRef.current])

  /* ══ LINHAS USER → TODOS OS PRODUTOS (rotas reais) ══════════════════════ */
  useEffect(() => {
    if (!mapRef.current || !(window as any).L || !leafletLoadedRef.current) return
    const L = (window as any).L; const m = mapRef.current

    const clearAll = () => {
      allProductRoutesRef.current.forEach(l => { try { m.removeLayer(l) } catch {} })
      allProductRoutesRef.current = []
    }
    clearAll()
    if (!userLocation) return

    const userLatLng: [number, number] = [userLocation[1], userLocation[0]]
    const targets = filteredProducts
      .filter(p => p.location_lat && p.location_lng)
      .map(p => ({
        p,
        d: distanceKm(userLocation, [p.location_lng!, p.location_lat!]),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8) // limitar para não saturar OSRM

    let cancelled = false
    ;(async () => {
      const acc: Record<string, { km: number; mins: number }> = {}
      for (const { p } of targets) {
        if (cancelled) return
        const { coords, distance, duration } = await fetchRoadRouteFull(
          userLatLng, [p.location_lat!, p.location_lng!]
        )
        if (cancelled) return
        const km   = distance != null ? distance / 1000 : distanceKm(userLocation, [p.location_lng!, p.location_lat!])
        const baseMins = duration != null ? Math.max(1, Math.round(duration / 60)) : 0
        // OSRM público só tem perfil 'driving'. Para camião aplicamos um factor (~1.35x mais lento).
        const factor = transportMode === 'truck' ? 1.35 : 1
        const mins = baseMins ? Math.max(1, Math.round(baseMins * factor)) : 0
        if (p.id) acc[p.id] = { km: Math.round(km * 10) / 10, mins }

        const line = L.polyline(coords, {
          color: T.g600, weight: 2, opacity: 0.55, dashArray: '4 6',
        }).addTo(m)

        const kmTxt   = `${(Math.round(km * 10) / 10).toFixed(1)} km`
        const timeTxt = mins ? formatDuration(mins * 60) : '—'
        const popupHtml = `
          <div style="font-family:${FONT};min-width:170px;">
            <div style="font-size:9px;font-weight:800;color:${T.muted};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Rota até ao produto</div>
            <div style="font-size:13px;font-weight:900;color:${T.ink};margin-bottom:6px;">${(p.product_type || 'Produto')}</div>
            <div style="display:flex;gap:10px;font-size:11px;color:${T.ink};font-weight:700;">
              <span>📏 ${kmTxt}</span>
              <span>⏱ ${timeTxt}</span>
            </div>
          </div>`
        line.bindPopup(popupHtml)
        line.bindTooltip(`${kmTxt} · ${timeTxt}`, {
          sticky: true, direction: 'top',
          className: 'al-route-tip',
        })
        line.on('click', () => setSelectedProduct(p))
        allProductRoutesRef.current.push(line)
      }
      if (!cancelled) setRouteMetrics(acc)
    })()

    return () => { cancelled = true; clearAll(); setRouteMetrics({}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, userLocation, leafletLoadedRef.current, transportMode])

  /* ══ LINHA PRODUTO → LOCALIZAÇÃO ATUAL (rota real pelas estradas) ═══════ */
  useEffect(() => {
    if (!mapRef.current || !(window as any).L || !leafletLoadedRef.current) return
    const L = (window as any).L; const m = mapRef.current

    const clearProductRoute = () => {
      productRouteLayers.current.forEach(l => { try { m.removeLayer(l) } catch {} })
      productRouteLayers.current = []
    }

    clearProductRoute()

    if (
      !selectedProduct ||
      !selectedProduct.location_lat ||
      !selectedProduct.location_lng ||
      !userLocation
    ) return

    // userLocation está em [lng, lat]; OSRM precisa [lat, lng]
    const userLatLng: [number, number]    = [userLocation[1], userLocation[0]]
    const productLatLng: [number, number] = [selectedProduct.location_lat, selectedProduct.location_lng]

    ;(async () => {
      const coords = await fetchRoadRoute(userLatLng, productLatLng)

      const glow = L.polyline(coords, { color: T.blue, weight: 10, opacity: 0.12 }).addTo(m)
      const line = L.polyline(coords, {
        color: T.blue, weight: 2.5, opacity: 0.80, dashArray: '7 5',
      }).addTo(m)

      // Ícone de destino (produto)
      const destIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:${T.blue};border:2.5px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(29,78,216,0.2);"></div>`,
        className: '', iconSize: [14, 14], iconAnchor: [7, 7],
      })
      const destMarker = L.marker(productLatLng, { icon: destIcon }).addTo(m)

      productRouteLayers.current = [glow, line, destMarker]
    })()

    return clearProductRoute
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, userLocation, leafletLoadedRef.current])

  /* ══ RASTREABILIDADE — rota animada pelas estradas reais ════════════════ */
  useEffect(() => {
    if (!mapRef.current || !(window as any).L || !leafletLoadedRef.current) return
    const L = (window as any).L; const m = mapRef.current
    const extraLayers: any[] = []

    const cleanup = () => {
      extraLayers.forEach(l => { try { m.removeLayer(l) } catch {} })
      if (routePolylineRef.current)  { try { m.removeLayer(routePolylineRef.current) } catch {}; routePolylineRef.current = null }
      if (routeAnimFrameRef.current) { cancelAnimationFrame(routeAnimFrameRef.current); routeAnimFrameRef.current = null }
    }

    if (!trackedProduct || !trackedProduct.location_lat || !trackedProduct.location_lng) { cleanup(); return }

    const origin: [number, number]      = [trackedProduct.location_lat, trackedProduct.location_lng]
    const destination: [number, number] = userLocation ? [userLocation[1], userLocation[0]] : [-8.838333, 13.234444]

    ;(async () => {
      cleanup()

      const coords = await fetchRoadRoute(origin, destination)

      // Glow layer
      const glow = L.polyline(coords, { color: T.g400, weight: 10, opacity: 0.20 }).addTo(m)
      extraLayers.push(glow)

      // Linha principal da rota de rastreio
      routePolylineRef.current = L.polyline(coords, {
        color: T.g700, weight: 3.5, opacity: 0.90, dashArray: '10 6',
      }).addTo(m)

      // Ponto animado que percorre a rota segmento a segmento
      const movingDot = L.circleMarker(coords[0], {
        radius: 9, fillColor: T.accentL, fillOpacity: 1, color: T.white, weight: 3,
      }).addTo(m)
      extraLayers.push(movingDot)

      // Marcador do destino (utilizador)
      const destIcon = L.divIcon({
        html: `<div style="width:18px;height:18px;background:${T.blue};border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(29,78,216,0.2);"></div>`,
        className: '', iconSize: [18, 18], iconAnchor: [9, 9],
      })
      const destMarker = L.marker(destination, { icon: destIcon }).addTo(m)
      extraLayers.push(destMarker)

      const bounds = L.latLngBounds(coords)
      m.fitBounds(bounds, { padding: [80, 80], duration: 1.2 })

      // Animar ponto ao longo dos segmentos reais da rota
      let segIdx = 0; let t = 0
      const animate = () => {
        if (segIdx >= coords.length - 1) segIdx = 0
        const from = coords[segIdx]; const to = coords[segIdx + 1]
        if (from && to) {
          t += 0.015
          if (t >= 1) { t = 0; segIdx++ }
          movingDot.setLatLng([
            from[0] + (to[0] - from[0]) * t,
            from[1] + (to[1] - from[1]) * t,
          ])
        }
        routeAnimFrameRef.current = requestAnimationFrame(animate)
      }
      animate()
    })()

    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedProduct, userLocation, leafletLoadedRef.current])

  /* ── Error screen ───────────────────────────────────────────────────────── */
  if (mapError) return (
    <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ background: T.white, borderRadius: 16, border: `1px solid ${T.rule}`, padding: '40px 36px', maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: `0 16px 48px ${T.shadowLg}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: T.dangerBg, border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertCircle size={24} color={T.danger}/>
        </div>
        <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.ink, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Erro ao Carregar Mapa</h3>
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 20, fontFamily: FONT }}>{mapError}</p>
        <button onClick={() => window.location.reload()} style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: T.g700, color: T.white, cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Tentar Novamente
        </button>
      </div>
    </div>
  )

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: T.white, overflow: 'hidden', fontFamily: FONT }}>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 0 }}/>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        background: T.g900, borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: `0 2px 20px ${T.shadowMd}`,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => window.history.back()}
              style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', color: 'rgba(255,255,255,0.65)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
            >
              <ArrowLeft size={15}/>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: T.g700, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Map size={14} color={T.g200}/>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: T.white, margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase', fontFamily: FONT }}>Mapa de Produtos</p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>AgriLink · OpenStreetMap</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, background: 'rgba(40,167,69,0.15)', border: '1px solid rgba(40,167,69,0.3)' }}>
              <div style={{ width: 20, height: 2, background: `linear-gradient(90deg, ${T.g400}, ${T.accentL})`, borderRadius: 1 }}/>
              <span style={{ fontSize: 9, fontWeight: 800, color: T.g200, fontFamily: FONT, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pipelines</span>
            </div>
            {[
              { icon: showProductsList ? <EyeOff size={15}/> : <Eye size={15}/>, onClick: () => setShowProductsList(!showProductsList), title: showProductsList ? 'Ocultar lista' : 'Mostrar lista', active: false },
              { icon: <Sliders size={15}/>, onClick: () => setShowFilters(!showFilters), title: 'Filtros', active: showFilters },
            ].map((btn, i) => (
              <button key={i} title={btn.title} onClick={btn.onClick} style={{
                width: 34, height: 34, borderRadius: 8,
                background: btn.active ? T.g700 : 'rgba(255,255,255,0.07)',
                border: `1px solid ${btn.active ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: btn.active ? T.white : 'rgba(255,255,255,0.65)', transition: 'all 0.15s',
              }}>
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ SEARCH BAR ══════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: '90%', maxWidth: 600 }}>
        <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.rule}`, boxShadow: `0 8px 32px ${T.shadowMd}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Search size={13} color={T.white}/>
            </div>
            <input
              type="text" value={searchText}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Pesquisar localização em Angola..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: T.ink, fontFamily: FONT, fontWeight: 500 }}
            />
            {searchLoading && (
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${T.gBorder}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite', flexShrink: 0 }}/>
            )}
            {searchText && (
              <button onClick={() => { setSearchText(''); setSearchResults([]) }} style={{ width: 24, height: 24, borderRadius: 6, background: T.canvas, border: `1px solid ${T.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <X size={11} color={T.muted}/>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px 10px', overflowX: 'auto' }}>
            {['Milho', 'Feijão', 'Banana', 'Mandioca'].map(item => (
              <button
                key={item}
                onClick={() => setFilters({ ...filters, productType: filters.productType === item ? '' : item })}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: filters.productType === item ? T.g700 : T.canvas,
                  color: filters.productType === item ? T.white : T.muted,
                  fontSize: 10, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {item}
              </button>
            ))}
            {filters.productType && (
              <button
                onClick={() => setFilters({ ...filters, productType: '' })}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid #FECACA`, cursor: 'pointer', background: T.dangerBg, color: T.danger, fontSize: 10, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <X size={9}/> Limpar
              </button>
            )}
          </div>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: T.white, borderRadius: 12, boxShadow: `0 16px 48px ${T.shadowLg}`, border: `1px solid ${T.rule}`, overflow: 'hidden', zIndex: 50 }}>
            {searchResults.map((r, i) => (
              <button key={r.place_id || i} onClick={() => selectSearchResult(r)}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderBottom: i < searchResults.length - 1 ? `1px solid ${T.rule}` : 'none', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.13s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.g50 }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={13} color={T.g600}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name.split(',')[0]}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name}</div>
                </div>
                <ArrowRight size={13} color={T.faint}/>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══ FILTERS PANEL ════════════════════════════════════════════════════ */}
      {showFilters && (
        <div style={{ position: 'absolute', top: 70, left: 20, zIndex: 40, background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, boxShadow: `0 16px 48px ${T.shadowLg}`, width: 340, overflow: 'hidden', animation: 'slideInLeft 0.2s cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ padding: '14px 16px', background: T.g900, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Filter size={13} color={T.g200}/>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.white, fontFamily: FONT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Filtros Avançados</span>
            </div>
            <button onClick={() => setShowFilters(false)} style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.10)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} color="rgba(255,255,255,0.7)"/>
            </button>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 440, overflowY: 'auto' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Leaf size={11} color={T.g600}/><Label>Tipo de Produto</Label>
              </div>
              <input type="text" placeholder="Ex: Milho, Feijão..." value={filters.productType} onChange={e => setFilters({ ...filters, productType: e.target.value })}
                style={{ width: '100%', height: 38, borderRadius: 8, border: `1.5px solid ${T.rule}`, padding: '0 12px', fontSize: 12, outline: 'none', background: T.surface, color: T.ink, fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <DollarSign size={11} color={T.g600}/><Label>Preço Máximo</Label>
              </div>
              <div style={{ padding: '12px', borderRadius: 9, background: T.surface, border: `1px solid ${T.rule}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: FONT, fontWeight: 600 }}>0 Kz</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.g700, fontFamily: FONT }}>{filters.priceRange[1].toLocaleString()} Kz</span>
                </div>
                <input type="range" min="0" max="10000" step="100" value={filters.priceRange[1]} onChange={e => setFilters({ ...filters, priceRange: [filters.priceRange[0], parseInt(e.target.value)] })} style={{ width: '100%', accentColor: T.g600 }}/>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Navigation size={11} color={T.g600}/><Label>Raio de Busca</Label>
              </div>
              <div style={{ padding: '12px', borderRadius: 9, background: T.surface, border: `1px solid ${T.rule}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: FONT, fontWeight: 600 }}>5 km</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.g700, fontFamily: FONT }}>{filters.radius} km</span>
                </div>
                <input type="range" min="5" max="200" step="5" value={filters.radius} onChange={e => setFilters({ ...filters, radius: parseInt(e.target.value) })} style={{ width: '100%', accentColor: T.g600 }}/>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={11} color={T.g600}/><Label>Mostrar</Label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
                {[
                  { value: 'all',     label: 'Todos',        Icon: Users },
                  { value: 'farmers', label: 'Agricultores', Icon: Leaf },
                  { value: 'buyers',  label: 'Compradores',  Icon: Briefcase },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setFilters({ ...filters, userType: opt.value as FilterOptions['userType'] })}
                    style={{ padding: '10px 6px', borderRadius: 9, textAlign: 'center', border: `1.5px solid ${filters.userType === opt.value ? T.g700 : T.rule}`, background: filters.userType === opt.value ? T.g900 : T.surface, cursor: 'pointer' }}>
                    <opt.Icon size={14} color={filters.userType === opt.value ? T.g200 : T.faint} style={{ display: 'block', margin: '0 auto 5px' }}/>
                    <span style={{ fontSize: 9, fontWeight: 800, color: filters.userType === opt.value ? T.g200 : T.muted, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setShowFilters(false)} style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: T.g700, color: T.white, cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: `0 3px 10px rgba(22,82,32,0.28)` }}>
              <CheckCircle size={13}/> Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* ══ PRODUCTS LIST ════════════════════════════════════════════════════ */}
      {showProductsList && (
        <div style={{ position: 'absolute', bottom: 80, left: 20, zIndex: 30, width: 340, maxHeight: 400, animation: 'slideInBottom 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, boxShadow: `0 16px 48px ${T.shadowLg}`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: T.g900, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={13} color={T.g200}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.white, fontFamily: FONT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Produtos Encontrados</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: T.g200, fontFamily: FONT }}>{filteredProducts.length}</span>
            </div>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.rule}`, background: T.surface }}>
              <StatsPanel count={statsData.count} avgPrice={statsData.avgPrice} totalQuantity={statsData.totalQuantity}/>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filteredProducts.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <Package size={28} color={T.rule} style={{ display: 'block', margin: '0 auto 10px' }}/>
                  <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.ink, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Sem resultados</p>
                  <p style={{ fontSize: 11, color: T.faint, fontFamily: FONT }}>Ajuste os filtros e tente novamente</p>
                </div>
              ) : filteredProducts.slice(0, 8).map((p, i) => (
                <button key={p.id} onClick={() => {
                  setSelectedProduct(p)
                  if (p.location_lat && p.location_lng && mapRef.current) {
                    mapRef.current.flyTo([p.location_lat, p.location_lng], 14, { duration: 1 })
                  }
                }}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 14px', borderBottom: i < Math.min(filteredProducts.length, 8) - 1 ? `1px solid ${T.rule}` : 'none', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, transition: 'background 0.13s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.g50 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: T.g50, border: `1px solid ${T.gBorder}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.image_url ? <img src={p.image_url} alt={p.product_type} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: 22 }}>🌾</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, fontFamily: FONT, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{p.product_type}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.g700, fontFamily: FONT }}>{p.price.toLocaleString()} Kz</span>
                      <span style={{ color: T.rule }}>·</span>
                      <span style={{ fontSize: 11, color: T.faint, fontFamily: FONT }}>{p.quantity} kg</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <User size={9} color={T.faint}/>
                      <span style={{ fontSize: 10, color: T.muted, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.farmer_name}</span>
                    </div>
                  </div>
                  <ChevronDown size={13} color={T.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}/>
                </button>
              ))}
            </div>
            {filteredProducts.length > 8 && (
              <div style={{ padding: '10px 14px', background: T.surface, borderTop: `1px solid ${T.rule}`, textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: T.muted, fontFamily: FONT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>+{filteredProducts.length - 8} outros produtos</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Product Card popup ───────────────────────────────────────────── */}
      {selectedProduct && (
        <ProductCard
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onContact={handleContact}
          onFavorite={handleFavorite}
          onTrack={p => setTrackedProduct(p)}
          distanceLabel={(() => {
            if (!userLocation || !selectedProduct.location_lat || !selectedProduct.location_lng) return undefined
            const m = selectedProduct.id ? routeMetrics[selectedProduct.id] : undefined
            const km = m?.km ?? distanceKm(userLocation, [selectedProduct.location_lng, selectedProduct.location_lat])
            const timeTxt = m?.mins ? ` · ${formatDuration(m.mins * 60)}` : ''
            return `A ${km} km de si${timeTxt}`
          })()}
        />
      )}

      {/* ══ MAP STYLE SWITCHER ═══════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', top: 140, right: 20, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 4, background: T.white, padding: 4, borderRadius: 10, border: `1px solid ${T.rule}`, boxShadow: `0 6px 18px ${T.shadow}` }}>
        {([
          { id: 'streets',   label: 'Mapa',     icon: <Map size={13}/> },
          { id: 'satellite', label: 'Satélite', icon: <Eye size={13}/> },
          { id: 'terrain',   label: 'Terreno',  icon: <Leaf size={13}/> },
        ] as const).map(opt => (
          <button key={opt.id} onClick={() => setMapStyle(opt.id)} title={opt.label}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: mapStyle === opt.id ? T.g700 : 'transparent', color: mapStyle === opt.id ? T.white : T.muted, fontSize: 10, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* ══ TRANSPORT MODE SWITCHER ══════════════════════════════════════════ */}
      <div title="Modo de transporte (recalcula tempo OSRM)" style={{ position: 'absolute', top: 270, right: 20, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 4, background: T.white, padding: 4, borderRadius: 10, border: `1px solid ${T.rule}`, boxShadow: `0 6px 18px ${T.shadow}` }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: FONT, padding: '2px 6px 0' }}>Transporte</div>
        {([
          { id: 'car',   label: 'Carro',  icon: <Car size={13}/> },
          { id: 'truck', label: 'Camião', icon: <Truck size={13}/> },
        ] as const).map(opt => (
          <button key={opt.id} onClick={() => setTransportMode(opt.id)} title={opt.label}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: transportMode === opt.id ? T.g700 : 'transparent', color: transportMode === opt.id ? T.white : T.muted, fontSize: 10, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* ══ PIPELINE LEGEND ══════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', bottom: 80, right: 20, zIndex: 30, background: 'rgba(255,255,255,0.95)', borderRadius: 10, border: `1px solid ${T.rule}`, padding: '10px 14px', boxShadow: `0 4px 16px ${T.shadow}`, backdropFilter: 'blur(8px)' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: FONT, marginBottom: 8 }}>Rede Logística</div>
        {[
          { color: T.g500,    width: 2.5, label: 'Corredor Principal' },
          { color: T.accentL, width: 1.8, label: 'Rota Secundária' },
          { color: T.g400,    width: 1.2, label: 'Ligação Local' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke={item.color} strokeWidth={item.width} strokeDasharray="4 2"/></svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, fontFamily: FONT }}>{item.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.rule}` }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.g700, border: '2px solid white', boxShadow: `0 0 0 2px ${T.g400}` }}/>
          <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, fontFamily: FONT }}>Hub Provincial</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.rule}` }}>
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke={T.blue} strokeWidth={1.5} strokeDasharray="5 3"/></svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, fontFamily: FONT }}>Rota até mim</span>
        </div>
      </div>

      {/* ══ TRACEABILITY SIDEBAR ═════════════════════════════════════════════ */}
      {trackedProduct && (
        <aside style={{ position: 'absolute', top: 70, right: 20, zIndex: 45, width: 320, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, boxShadow: `0 16px 48px ${T.shadowLg}`, animation: 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ padding: '14px 16px', background: T.g900, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Navigation size={13} color={T.g200}/>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: T.white, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rastreabilidade</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: FONT, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{trackedProduct.product_type}</div>
              </div>
            </div>
            <button onClick={() => setTrackedProduct(null)} style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.10)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} color="rgba(255,255,255,0.7)"/>
            </button>
          </div>

          {/* Indicador: "Rota pelas estradas" */}
          <div style={{ margin: '12px 16px 0', padding: '8px 12px', borderRadius: 8, background: T.accentBg, border: `1px solid #BDE3DC`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Navigation size={12} color={T.accent}/>
            <span style={{ fontSize: 10, fontWeight: 800, color: T.accent, fontFamily: FONT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rota pelas estradas activa</span>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {(() => {
              const steps = [
                { state: 'done',    icon: <Leaf size={13}/>,         color: T.g600,  title: 'Colhido',                date: new Date(trackedProduct.harvest_date).toLocaleDateString('pt-AO'), sub: `Machamba · ${trackedProduct.farmer_name}` },
                { state: 'done',    icon: <User size={13}/>,         color: T.g600,  title: 'Recolhido pelo Agente',  date: '—',                                                                sub: 'Local de recolha confirmado' },
                { state: 'active',  icon: <Package size={13}/>,      color: T.goldL, title: 'Em Trânsito',            date: 'Tempo estimado: 4–8h',                                             sub: userLocation ? `A caminho · ${distanceKm(userLocation, [trackedProduct.location_lng!, trackedProduct.location_lat!])} km` : 'A caminho do destino' },
                { state: 'pending', icon: <CheckCircle size={13}/>,  color: T.faint, title: 'Entrega Prevista',       date: 'Próximas 24h',                                                     sub: 'Destino final' },
              ]
              return steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < steps.length - 1 ? 18 : 0 }}>
                  {i < steps.length - 1 && <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: s.state === 'done' ? T.g400 : T.rule }}/>}
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.state === 'done' ? T.g50 : s.state === 'active' ? T.goldBg : T.canvas, border: `2px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: T.ink, fontFamily: FONT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: FONT, marginTop: 3 }}>{s.date}</div>
                    <div style={{ fontSize: 10, color: T.faint, fontFamily: FONT, marginTop: 2 }}>{s.sub}</div>
                  </div>
                </div>
              ))
            })()}

            {userLocation && trackedProduct.location_lat && trackedProduct.location_lng && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: T.g50, border: `1px solid ${T.gBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Label>Progresso da rota</Label>
                  <span style={{ fontSize: 11, fontWeight: 900, color: T.g700, fontFamily: FONT }}>60%</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: T.gBorder, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: `linear-gradient(90deg, ${T.g500}, ${T.accentL})`, borderRadius: 4 }}/>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ══ FOOTER STATS ═════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 25, background: 'linear-gradient(180deg, transparent, rgba(10,35,16,0.85))', pointerEvents: 'none', padding: '40px 20px 12px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', background: 'rgba(255,255,255,0.96)', borderRadius: 12, border: `1px solid ${T.rule}`, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, boxShadow: `0 8px 24px ${T.shadowMd}`, pointerEvents: 'auto' }}>
          {[
            { label: 'Produtores',   value: new Set(filteredProducts.map(p => p.farmer_id || p.farmer_name)).size, color: T.g700,  icon: <Leaf size={12}/> },
            { label: 'Produtos',     value: filteredProducts.length,                                                color: T.accent, icon: <Package size={12}/> },
            { label: 'Em Trânsito',  value: Math.max(1, Math.floor(filteredProducts.length * 0.2)),                color: T.goldL,  icon: <TrendingUp size={12}/> },
            { label: 'Mais Próximo', value: (() => {
                if (!userLocation) return '—'
                const dists = filteredProducts.filter(p => p.location_lat && p.location_lng)
                  .map(p => distanceKm(userLocation, [p.location_lng!, p.location_lat!]))
                return dists.length ? `${Math.min(...dists)} km` : '—'
              })(), color: T.blue, icon: <Navigation size={12}/> },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: s.color, marginBottom: 2 }}>
                {s.icon}
                <span style={{ fontSize: 8, fontWeight: 800, color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: s.color, fontFamily: FONT, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,35,16,0.55)', backdropFilter: 'blur(8px)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: T.white, padding: '28px 36px', borderRadius: 16, border: `1px solid ${T.rule}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxShadow: `0 24px 80px ${T.shadowLg}` }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${T.gBorder}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite' }}/>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>A carregar mapa</p>
              <p style={{ fontSize: 10, color: T.faint, marginTop: 4, fontFamily: FONT }}>Aguarde um momento...</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin          { to { transform: rotate(360deg) } }
        @keyframes slideInRight  { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInLeft   { from { opacity:0; transform:translateX(-24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInBottom { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius: 2px; }
        .leaflet-top, .leaflet-bottom { z-index: 20 !important; }
        .leaflet-control-zoom { margin-top: 60px !important; }
        .leaflet-container { font-family: ${FONT} !important; }
        .al-route-tip { background:${T.ink} !important; color:#fff !important; border:none !important; font-weight:800 !important; font-size:10px !important; padding:4px 8px !important; border-radius:6px !important; box-shadow:0 4px 12px rgba(0,0,0,0.25) !important; }
        .al-route-tip::before { border-top-color:${T.ink} !important; }
      `}</style>
      <SatelliteMonitor />
    </div>
  )
}

export default MapView