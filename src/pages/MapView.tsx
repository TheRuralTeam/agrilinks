import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  MapPin, Filter, DollarSign, Calendar, Package, Search, X,
  Leaf, TrendingUp, Users, Phone, Mail, Star, Heart, Share2,
  ArrowRight, ArrowLeft, Droplet, Wind, Cloud, Navigation,
  ChevronDown, CheckCircle, AlertCircle, User, Briefcase,
  MessageSquare, Map, Zap, Eye, EyeOff, Sliders,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import axios from 'axios';

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
  danger:  '#DC2626',
  dangerBg:'#FEF2F2',
  blue:    '#1D4ED8',
  blueBg:  '#EFF6FF',
  shadow:  'rgba(10,35,16,0.08)',
  shadowMd:'rgba(10,35,16,0.14)',
  shadowLg:'rgba(10,35,16,0.20)',
}

const FONT = "'League Spartan', 'Helvetica Neue', Arial, sans-serif"

/* ─── Types ────────────────────────────────────────────────────────────────── */
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

interface MapboxSearchResult {
  center: [number, number]; place_name: string; text?: string; id?: string
}

interface FilterOptions {
  productType: string; priceRange: [number, number]; radius: number
  userType: 'all' | 'farmers' | 'buyers'
}

/* ─── Shared micro components ────────────────────────────────────────────────── */

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 9, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: FONT }}>
    {children}
  </span>
)

const Pill = ({ children, color = T.g700, bg = T.g50, border = T.gBorder }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, background: bg, color, border: `1px solid ${border}`, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
    {children}
  </span>
)

const IconBox = ({ icon, size = 30, bg = T.g700, iconColor = T.white }: { icon: React.ReactNode; size?: number; bg?: string; iconColor?: string }) => (
  <div style={{ width: size, height: size, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {React.cloneElement(icon as React.ReactElement, { size: size * 0.45, color: iconColor })}
  </div>
)

/* ─── Product Card (map popup) ────────────────────────────────────────────────── */
interface ProductCardProps {
  product: Product; onClose: () => void
  onContact: (p: Product) => void; onFavorite: (id: string) => void
  onTrack?: (p: Product) => void
  distanceLabel?: string
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClose, onContact, onFavorite, onTrack, distanceLabel }) => {
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
          {/* Grid texture */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: '20px 20px' }}/>
          {product.image_url && (
            <img src={product.image_url} alt={product.product_type} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, position: 'absolute', inset: 0 }}/>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,35,16,0.7) 0%, transparent 60%)' }}/>

          {/* Close */}
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

          {/* Status pill */}
          {product.status && (
            <div style={{ position: 'absolute', top: 10, left: 10 }}>
              <Pill bg="rgba(255,255,255,0.15)" color={T.white} border="rgba(255,255,255,0.20)">
                <Zap size={8}/> {product.status}
              </Pill>
            </div>
          )}

          {/* Title */}
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

        {/* Content */}
        <div style={{ padding: '14px 16px' }}>

          {/* Price block */}
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

          {/* Location + Date */}
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

          {/* Weather */}
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
              {product.weatherData.weather?.[0]?.description && (
                <div style={{ fontSize: 10, color: T.blue, marginTop: 7, fontFamily: FONT, fontWeight: 600, textTransform: 'capitalize' }}>
                  {product.weatherData.weather[0].description}
                </div>
              )}
            </div>
          )}

          {/* Contact */}
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

          {/* Distance + Track */}
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

          {/* Actions */}
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
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.gBorder }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.rule }}
            >
              <Share2 size={14} color={T.faint}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Stats Panel ────────────────────────────────────────────────────────────── */
const StatsPanel: React.FC<{ count: number; avgPrice: number; totalQuantity: number }> = ({ count, avgPrice, totalQuantity }) => (
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

/* ─── Header icon button ─────────────────────────────────────────────────────── */
const HdrBtn = ({ icon, onClick, title, active = false }: { icon: React.ReactNode; onClick?: () => void; title: string; active?: boolean }) => (
  <button
    title={title} onClick={onClick}
    style={{
      width: 34, height: 34, borderRadius: 8,
      background: active ? T.g50 : 'transparent',
      border: `1.5px solid ${active ? T.gBorder : T.rule}`,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: active ? T.g700 : T.muted, transition: 'all 0.15s',
    }}
    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = T.g50; (e.currentTarget as HTMLElement).style.borderColor = T.gBorder; (e.currentTarget as HTMLElement).style.color = T.g700 } }}
    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = T.rule; (e.currentTarget as HTMLElement).style.color = T.muted } }}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 15 })}
  </button>
)

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const userMarker = useRef<mapboxgl.Marker | null>(null)

  const [mapboxToken] = useState('pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<MapboxSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showProductsList, setShowProductsList] = useState(true)

  const [filters, setFilters] = useState<FilterOptions>({
    productType: '', priceRange: [0, 10000], radius: 50, userType: 'all',
  })

  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'terrain'>('streets')
  const [trackedProduct, setTrackedProduct] = useState<Product | null>(null)
  const routeAnimRef = useRef<number | null>(null)

  const { user } = useAuth()

  // Haversine distance in km
  const distanceKm = useCallback((a: [number, number], b: [number, number]) => {
    const R = 6371
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b[1] - a[1])
    const dLng = toRad(b[0] - a[0])
    const lat1 = toRad(a[1]); const lat2 = toRad(b[1])
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
    const matchesType = !filters.productType || p.product_type.toLowerCase().includes(filters.productType.toLowerCase())
    const matchesPrice = p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    return matchesType && matchesPrice
  }), [products, filters])

  const statsData = useMemo(() => {
    if (!filteredProducts.length) return { count: 0, avgPrice: 0, totalQuantity: 0 }
    return {
      count: filteredProducts.length,
      avgPrice: Math.round(filteredProducts.reduce((s, p) => s + p.price, 0) / filteredProducts.length),
      totalQuantity: filteredProducts.reduce((s, p) => s + p.quantity, 0),
    }
  }, [filteredProducts])

  const handleSearch = useCallback(async (value: string) => {
    setSearchText(value)
    if (!value.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const r = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${value}.json`, { params: { access_token: mapboxToken, limit: 5 } })
      setSearchResults((r.data.features || []) as MapboxSearchResult[])
    } catch { /* silent */ }
    finally { setSearchLoading(false) }
  }, [mapboxToken])

  const selectSearchResult = useCallback((result: MapboxSearchResult) => {
    if (result.center) { map.current?.flyTo({ center: result.center, zoom: 12 }); setSearchText(''); setSearchResults([]) }
  }, [])

  const handleFavorite = useCallback((productId: string) => {
    setFavorites(prev => { const n = new Set(prev); n.has(productId) ? n.delete(productId) : n.add(productId); return n })
  }, [])

  const handleContact = useCallback((product: Product) => { console.log('Contactar:', product.farmer_name) }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  /* Init map */
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return
    if (!mapboxgl.supported()) { setMapError('O seu browser não suporta o mapa.'); return }
    try {
      mapboxgl.accessToken = mapboxToken
      const styleUrl =
        mapStyle === 'satellite' ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : mapStyle === 'terrain' ? 'mapbox://styles/mapbox/outdoors-v12'
        : 'mapbox://styles/mapbox/light-v11'
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [13.234444, -8.838333],
        zoom: 6,
      })
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          setUserLocation([lng, lat])
          const el = document.createElement('div')
          el.className = 'al-user-pin'
          el.style.cssText = `width:20px;height:20px;background:${T.blue};border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(29,78,216,0.18);animation:userPulse 2s infinite ease-out;`
          userMarker.current = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current!)
        }, () => {})
      }
    } catch { setMapError('Erro ao inicializar mapa') }
    return () => { map.current?.remove(); map.current = null }
  }, [mapboxToken, mapStyle])

  /* Add markers */
  useEffect(() => {
    if (!map.current) return
    markers.current.forEach(m => m.remove()); markers.current = []
    filteredProducts.forEach(product => {
      if (product.location_lat && product.location_lng) {
        const el = document.createElement('div')
        el.style.cssText = `width:40px;height:40px;cursor:pointer;background:linear-gradient(135deg,${T.g600},${T.g800});border:2.5px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(22,82,32,0.4);transition:transform 0.18s;`
        el.innerHTML = `<div style="transform:rotate(45deg);font-size:18px;line-height:1;">🌿</div>`
        el.title = product.product_type
        el.addEventListener('mouseenter', () => { el.style.transform = 'rotate(-45deg) scale(1.15)' })
        el.addEventListener('mouseleave', () => { el.style.transform = 'rotate(-45deg) scale(1)' })
        const marker = new mapboxgl.Marker(el, { anchor: 'bottom' }).setLngLat([product.location_lng, product.location_lat]).addTo(map.current!)
        el.addEventListener('click', () => setSelectedProduct(product))
        markers.current.push(marker)
      }
    })
  }, [filteredProducts])

  /* Animated traceability route: producer → agent → distribution → user */
  useEffect(() => {
    const m = map.current
    if (!m) return
    const cleanup = () => {
      try {
        if (m.getLayer('al-route-moving')) m.removeLayer('al-route-moving')
        if (m.getLayer('al-route-dash')) m.removeLayer('al-route-dash')
        if (m.getLayer('al-route-base')) m.removeLayer('al-route-base')
        if (m.getSource('al-route')) m.removeSource('al-route')
        if (m.getSource('al-route-point')) m.removeSource('al-route-point')
        if (m.getLayer('al-route-point')) m.removeLayer('al-route-point')
      } catch {}
      if (routeAnimRef.current) { cancelAnimationFrame(routeAnimRef.current); routeAnimRef.current = null }
    }
    if (!trackedProduct || !trackedProduct.location_lat || !trackedProduct.location_lng) { cleanup(); return }

    const draw = () => {
      cleanup()
      const origin: [number, number] = [trackedProduct.location_lng!, trackedProduct.location_lat!]
      const destination: [number, number] = userLocation || [13.234444, -8.838333]
      // synthetic intermediates (agent + distribution centre)
      const midA: [number, number] = [origin[0] + (destination[0]-origin[0])*0.33 + 0.05, origin[1] + (destination[1]-origin[1])*0.33 - 0.05]
      const midB: [number, number] = [origin[0] + (destination[0]-origin[0])*0.66 - 0.04, origin[1] + (destination[1]-origin[1])*0.66 + 0.04]
      const coords = [origin, midA, midB, destination]
      m.addSource('al-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } as any })
      m.addLayer({ id: 'al-route-base', type: 'line', source: 'al-route', paint: { 'line-color': T.g400, 'line-width': 5, 'line-opacity': 0.35 } })
      m.addLayer({ id: 'al-route-dash', type: 'line', source: 'al-route', paint: { 'line-color': T.g700, 'line-width': 3, 'line-dasharray': [0, 4, 3] } })
      // moving dot
      m.addSource('al-route-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: origin } }] } as any })
      m.addLayer({ id: 'al-route-point', type: 'circle', source: 'al-route-point', paint: { 'circle-radius': 8, 'circle-color': T.accentL, 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } })

      // bounds
      const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any))
      m.fitBounds(bounds, { padding: 120, duration: 1200 })

      // animation
      let t = 0
      let dashStep = 0
      const animate = () => {
        t = (t + 0.0035) % 1
        // interpolate along polyline segments
        const segs = coords.length - 1
        const segIdx = Math.min(segs - 1, Math.floor(t * segs))
        const localT = (t * segs) - segIdx
        const a = coords[segIdx]; const b = coords[segIdx + 1]
        const pt: [number, number] = [a[0] + (b[0]-a[0])*localT, a[1] + (b[1]-a[1])*localT]
        const src = m.getSource('al-route-point') as mapboxgl.GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pt } }] } as any)
        // dash flow
        dashStep = (dashStep + 0.18)
        const dashSeq: any = [0, 4, dashStep % 7]
        try { m.setPaintProperty('al-route-dash', 'line-dasharray', dashSeq) } catch {}
        routeAnimRef.current = requestAnimationFrame(animate)
      }
      animate()
    }

    if (!m.isStyleLoaded()) { m.once('load', draw) } else { draw() }
    return cleanup
  }, [trackedProduct, userLocation, mapStyle])

  /* Error state */
  if (mapError) return (
    <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ background: T.white, borderRadius: 16, border: `1px solid ${T.rule}`, padding: '40px 36px', maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: `0 16px 48px ${T.shadowLg}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: T.dangerBg, border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertCircle size={24} color={T.danger}/>
        </div>
        <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.ink, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Erro ao Carregar Mapa</h3>
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 20, fontFamily: FONT }}>{mapError}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: T.g700, color: T.white, cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: T.white, overflow: 'hidden', fontFamily: FONT }}>
      {/* Map */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }}/>

      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        background: T.g900,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: `0 2px 20px ${T.shadowMd}`,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          {/* Left */}
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
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>AgriLink · Explore</p>
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              }}
                onMouseEnter={e => { if (!btn.active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)' }}
                onMouseLeave={e => { if (!btn.active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ SEARCH BAR ═════════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: '90%', maxWidth: 600 }}>
        <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.rule}`, boxShadow: `0 8px 32px ${T.shadowMd}`, overflow: 'hidden' }}>
          {/* Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Search size={13} color={T.white}/>
            </div>
            <input
              type="text"
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Pesquisar localização, produto..."
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

          {/* Quick filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px 10px', overflowX: 'auto' }}>
            {['Milho', 'Feijão', 'Banana', 'Mandioca'].map(item => (
              <button
                key={item}
                onClick={() => setFilters({ ...filters, productType: filters.productType === item ? '' : item })}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: filters.productType === item ? T.g700 : T.canvas,
                  color: filters.productType === item ? T.white : T.muted,
                  fontSize: 10, fontWeight: 800, fontFamily: FONT,
                  letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
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

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: T.white, borderRadius: 12, boxShadow: `0 16px 48px ${T.shadowLg}`, border: `1px solid ${T.rule}`, overflow: 'hidden', zIndex: 50 }}>
            {searchResults.map((r, i) => (
              <button
                key={r.id || i}
                onClick={() => selectSearchResult(r)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px',
                  borderBottom: i < searchResults.length - 1 ? `1px solid ${T.rule}` : 'none',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.13s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.g50 }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={13} color={T.g600}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text || r.place_name?.split(',')[0]}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.place_name}</div>
                </div>
                <ArrowRight size={13} color={T.faint}/>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══ FILTERS PANEL ══════════════════════════════════════════════════════ */}
      {showFilters && (
        <div style={{
          position: 'absolute', top: 70, left: 20, zIndex: 40,
          background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`,
          boxShadow: `0 16px 48px ${T.shadowLg}`,
          width: 340, overflow: 'hidden',
          animation: 'slideInLeft 0.2s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* Panel header */}
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

          {/* Panel body */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 440, overflowY: 'auto' }}>

            {/* Product type */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Leaf size={11} color={T.g600}/>
                <Label>Tipo de Produto</Label>
              </div>
              <input
                type="text"
                placeholder="Ex: Milho, Feijão..."
                value={filters.productType}
                onChange={e => setFilters({ ...filters, productType: e.target.value })}
                style={{ width: '100%', height: 38, borderRadius: 8, border: `1.5px solid ${T.rule}`, padding: '0 12px', fontSize: 12, outline: 'none', background: T.surface, color: T.ink, fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(30,122,46,0.10)` }}
                onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Price range */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <DollarSign size={11} color={T.g600}/>
                <Label>Preço Máximo</Label>
              </div>
              <div style={{ padding: '12px', borderRadius: 9, background: T.surface, border: `1px solid ${T.rule}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: FONT, fontWeight: 600 }}>0 Kz</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.g700, fontFamily: FONT }}>{filters.priceRange[1].toLocaleString()} Kz</span>
                </div>
                <input type="range" min="0" max="10000" step="100" value={filters.priceRange[1]} onChange={e => setFilters({ ...filters, priceRange: [filters.priceRange[0], parseInt(e.target.value)] })} style={{ width: '100%', accentColor: T.g600 }}/>
              </div>
            </div>

            {/* Radius */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Navigation size={11} color={T.g600}/>
                <Label>Raio de Busca</Label>
              </div>
              <div style={{ padding: '12px', borderRadius: 9, background: T.surface, border: `1px solid ${T.rule}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: FONT, fontWeight: 600 }}>5 km</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.g700, fontFamily: FONT }}>{filters.radius} km</span>
                </div>
                <input type="range" min="5" max="200" step="5" value={filters.radius} onChange={e => setFilters({ ...filters, radius: parseInt(e.target.value) })} style={{ width: '100%', accentColor: T.g600 }}/>
              </div>
            </div>

            {/* User type */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={11} color={T.g600}/>
                <Label>Mostrar</Label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
                {[
                  { value: 'all', label: 'Todos', Icon: Users },
                  { value: 'farmers', label: 'Agricultores', Icon: Leaf },
                  { value: 'buyers', label: 'Compradores', Icon: Briefcase },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters({ ...filters, userType: opt.value as FilterOptions['userType'] })}
                    style={{
                      padding: '10px 6px', borderRadius: 9, textAlign: 'center',
                      border: `1.5px solid ${filters.userType === opt.value ? T.g700 : T.rule}`,
                      background: filters.userType === opt.value ? T.g900 : T.surface,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <opt.Icon size={14} color={filters.userType === opt.value ? T.g200 : T.faint} style={{ display: 'block', margin: '0 auto 5px' }}/>
                    <span style={{ fontSize: 9, fontWeight: 800, color: filters.userType === opt.value ? T.g200 : T.muted, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowFilters(false)}
              style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: T.g700, color: T.white, cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: `0 3px 10px rgba(22,82,32,0.28)` }}
            >
              <CheckCircle size={13}/> Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* ══ PRODUCTS LIST PANEL ════════════════════════════════════════════════ */}
      {showProductsList && (
        <div style={{
          position: 'absolute', bottom: 24, left: 20, zIndex: 30,
          width: 340, maxHeight: 400,
          animation: 'slideInBottom 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, boxShadow: `0 16px 48px ${T.shadowLg}`, overflow: 'hidden' }}>
            {/* Panel header */}
            <div style={{ padding: '12px 16px', background: T.g900, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={13} color={T.g200}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.white, fontFamily: FONT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Produtos Encontrados</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: T.g200, fontFamily: FONT }}>{filteredProducts.length}</span>
            </div>

            {/* Stats */}
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.rule}`, background: T.surface }}>
              <StatsPanel count={statsData.count} avgPrice={statsData.avgPrice} totalQuantity={statsData.totalQuantity}/>
            </div>

            {/* List */}
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filteredProducts.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <Package size={28} color={T.rule} style={{ display: 'block', margin: '0 auto 10px' }}/>
                  <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.ink, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Sem resultados</p>
                  <p style={{ fontSize: 11, color: T.faint, fontFamily: FONT }}>Ajuste os filtros e tente novamente</p>
                </div>
              ) : filteredProducts.slice(0, 8).map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p)
                    if (p.location_lat && p.location_lng) map.current?.flyTo({ center: [p.location_lng, p.location_lat], zoom: 14 })
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 14px',
                    borderBottom: i < Math.min(filteredProducts.length, 8) - 1 ? `1px solid ${T.rule}` : 'none',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 11, transition: 'background 0.13s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.g50 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Thumb */}
                  <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: T.g50, border: `1px solid ${T.gBorder}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.product_type} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <span style={{ fontSize: 22 }}>🌾</span>
                    }
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

      {/* Product card popup */}
      {selectedProduct && (
        <ProductCard
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onContact={handleContact}
          onFavorite={handleFavorite}
          onTrack={(p) => setTrackedProduct(p)}
          distanceLabel={(() => {
            if (!userLocation || !selectedProduct.location_lat || !selectedProduct.location_lng) return undefined
            const km = distanceKm(userLocation, [selectedProduct.location_lng, selectedProduct.location_lat])
            return `A ${km} km de si`
          })()}
        />
      )}

      {/* ══ MAP STYLE SWITCHER ════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', top: 140, right: 20, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 4, background: T.white, padding: 4, borderRadius: 10, border: `1px solid ${T.rule}`, boxShadow: `0 6px 18px ${T.shadow}` }}>
        {([
          { id: 'streets', label: 'Mapa', icon: <Map size={13}/> },
          { id: 'satellite', label: 'Satélite', icon: <Eye size={13}/> },
          { id: 'terrain', label: 'Terreno', icon: <Leaf size={13}/> },
        ] as const).map(opt => (
          <button key={opt.id} onClick={() => setMapStyle(opt.id)} title={opt.label}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: mapStyle === opt.id ? T.g700 : 'transparent', color: mapStyle === opt.id ? T.white : T.muted, fontSize: 10, fontWeight: 800, fontFamily: FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {opt.icon}{opt.label}
          </button>
        ))}
      </div>

      {/* ══ TRACEABILITY SIDEBAR ══════════════════════════════════════════════ */}
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
          <div style={{ padding: '16px' }}>
            {(() => {
              const steps = [
                { state: 'done', icon: <Leaf size={13}/>, color: T.g600, title: 'Colhido', date: new Date(trackedProduct.harvest_date).toLocaleDateString('pt-AO'), sub: `Machamba · ${trackedProduct.farmer_name}` },
                { state: 'done', icon: <User size={13}/>, color: T.g600, title: 'Recolhido pelo Agente', date: '—', sub: 'Local de recolha confirmado' },
                { state: 'active', icon: <Package size={13}/>, color: T.goldL, title: 'Em Trânsito', date: 'Tempo estimado: 4–8h', sub: userLocation ? `A caminho · ${distanceKm(userLocation, [trackedProduct.location_lng!, trackedProduct.location_lat!])} km` : 'A caminho do destino' },
                { state: 'pending', icon: <CheckCircle size={13}/>, color: T.faint, title: 'Entrega Prevista', date: 'Próximas 24h', sub: 'Destino final' },
              ]
              return steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < steps.length - 1 ? 18 : 0 }}>
                  {i < steps.length - 1 && <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: s.state === 'done' ? T.g400 : T.rule }}/>}
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.state === 'done' ? T.g50 : s.state === 'active' ? T.goldBg : T.canvas, border: `2px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0, animation: s.state === 'active' ? 'userPulse 1.8s infinite' : 'none' }}>
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
                  <Label>Progresso</Label>
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

      {/* ══ REALTIME STATS FOOTER ═════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 25, background: 'linear-gradient(180deg, transparent, rgba(10,35,16,0.85))', pointerEvents: 'none', padding: '40px 20px 12px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', background: 'rgba(255,255,255,0.96)', borderRadius: 12, border: `1px solid ${T.rule}`, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, boxShadow: `0 8px 24px ${T.shadowMd}`, pointerEvents: 'auto' }}>
          {[
            { label: 'Produtores', value: new Set(filteredProducts.map(p => p.farmer_id || p.farmer_name)).size, color: T.g700, icon: <Leaf size={12}/> },
            { label: 'Produtos', value: filteredProducts.length, color: T.accent, icon: <Package size={12}/> },
            { label: 'Em Trânsito', value: Math.max(1, Math.floor(filteredProducts.length * 0.2)), color: T.goldL, icon: <TrendingUp size={12}/> },
            { label: 'Mais Próximo', value: (() => {
                if (!userLocation) return '—'
                const dists = filteredProducts.filter(p => p.location_lat && p.location_lng).map(p => distanceKm(userLocation, [p.location_lng!, p.location_lat!]))
                return dists.length ? `${Math.min(...dists)} km` : '—'
              })(), color: T.blue, icon: <Navigation size={12}/> },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: s.color, marginBottom: 2 }}>{s.icon}<span style={{ fontSize: 8, fontWeight: 800, color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>{s.label}</span></div>
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

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin          { to { transform: rotate(360deg) } }
        @keyframes slideInRight  { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInLeft   { from { opacity:0; transform:translateX(-24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInBottom { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius: 2px; }
        .mapboxgl-ctrl-group { border-radius: 10px !important; overflow: hidden; border: 1px solid ${T.rule} !important; box-shadow: 0 2px 8px ${T.shadow} !important; }
        .mapboxgl-ctrl-group button { background: ${T.white} !important; border-bottom: 1px solid ${T.rule} !important; }
        .mapboxgl-ctrl-group button:last-child { border-bottom: none !important; }
      `}</style>
    </div>
  )
}

export default MapView