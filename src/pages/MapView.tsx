import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Filter, Calendar, Package, Search, X,
  Leaf, TrendingUp, Phone, Mail, Star, Heart,
  ArrowRight, ArrowLeft, Navigation, ChevronDown, CheckCircle,
  AlertCircle, User, MessageSquare, Map, Eye, EyeOff, Sliders,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SatelliteMonitor from '../components/SatelliteMonitor';
import { supabase } from '../integrations/supabase/client';
import axios from 'axios';

/* ─── Design tokens — modo claro único, estilo Apple ────────────────────────── */
const T = {
  g700:   '#2c863b',
  g600:   '#2c863b',
  g500:   '#3D9A48',
  g400:   '#81C784',
  g100:   '#E8F5E9',
  g50:    '#F2FAF3',
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F7F9F7',
  white:  '#FFFFFF',
  rule:   'rgba(0,0,0,0.06)',
  soft:   'rgba(118,118,128,0.08)',
  softHv: 'rgba(118,118,128,0.13)',
  gold:   '#B07D0A',
  goldL:  '#E5A020',
  goldBg: 'rgba(229,160,32,0.10)',
  danger: '#DC2626',
  dangerBg:'rgba(220,38,38,0.08)',
  blue:   '#2563EB',
  blueBg: 'rgba(37,99,235,0.08)',
  shadow:  'rgba(0,0,0,0.06)',
  shadowMd:'rgba(0,0,0,0.10)',
  shadowLg:'rgba(0,0,0,0.16)',
}

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Product {
  id: string; product_type: string; quantity: number; harvest_date: string
  price: number; province_id: string; municipality_id: string
  farmer_name: string; farmer_id: string; farmer_phone?: string
  farmer_email?: string; farmer_rating?: number; images?: string[]
  image_url?: string; location_lat: number | null; location_lng: number | null
  status?: string; created_at?: string
}

interface NominatimResult {
  lat: string; lon: string; display_name: string; name?: string; place_id?: number
}

interface FilterOptions {
  productType: string; priceRange: [number, number]; radius: number
}

/* ─── OSRM helper — rota real pelas estradas ────────────────────────────────── */
async function fetchRoadRoute(
  from: [number, number],
  to: [number, number]
): Promise<[number, number][]> {
  const r = await fetchRoadRouteFull(from, to)
  return r.coords
}

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

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '—'
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60); const m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

/* ─── Micro components ──────────────────────────────────────────────────────── */
const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>
    {children}
  </span>
)

/* ─── Product Card (popup) ──────────────────────────────────────────────────── */
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
    <div className="al-product-card" style={{
      position: 'absolute', bottom: 24, right: 24, zIndex: 40,
      width: 340, fontFamily: FONT,
      animation: 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)',
    }}>
      <div style={{
        background: T.white, borderRadius: 22,
        boxShadow: `0 20px 48px ${T.shadowMd}`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', padding: '16px 16px 0' }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: T.soft, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.softHv }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.soft }}
          >
            <X size={13} color={T.mid}/>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
              🌿
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.02em' }}>{product.product_type}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={10} color={T.faint}/>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, fontFamily: FONT }}>{product.farmer_name}</span>
                {product.farmer_rating && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                    <Star size={10} color={T.goldL} fill={T.goldL}/>
                    <span style={{ fontSize: 10, color: T.muted, fontFamily: FONT, fontWeight: 700 }}>{product.farmer_rating.toFixed(1)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: T.g50, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <Label>Preço Total</Label>
                <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 800, color: T.g700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {product.price.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>Kz</span>
                </div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, marginTop: 2 }}>{pricePerKg} Kz/kg</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Label>Quantidade</Label>
                <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 800, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{product.quantity}</div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: FONT, marginTop: 2 }}>kg</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { icon: <MapPin size={12}/>, label: 'Localização', value: product.municipality_id },
              { icon: <Calendar size={12}/>, label: 'Colheita', value: new Date(product.harvest_date).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' }) },
            ].map(item => (
              <div key={item.label} style={{ padding: '9px 11px', borderRadius: 12, background: T.canvas }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  {React.cloneElement(item.icon, { color: T.g600 })}
                  <Label>{item.label}</Label>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {(product.farmer_phone || product.farmer_email) && (
            <div style={{ padding: '10px 12px', borderRadius: 12, background: T.canvas, marginBottom: 10 }}>
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
                <div style={{ flex: 1, padding: '8px 11px', borderRadius: 10, background: T.blueBg, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={12} color={T.blue}/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.blue, fontFamily: FONT }}>{distanceLabel}</span>
                </div>
              )}
              {onTrack && (
                <button onClick={() => onTrack(product)} style={{ height: 34, padding: '0 14px', borderRadius: 980, border: 'none', background: T.soft, color: T.g700, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={12}/> Rastrear
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onContact(product)}
              style={{
                flex: 1, height: 42, borderRadius: 980, border: 'none',
                background: T.g700, color: T.white, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              <MessageSquare size={14}/> Contactar
            </button>
            <button
              onClick={() => { setIsFavorited(!isFavorited); onFavorite(product.id) }}
              style={{
                width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
                background: isFavorited ? T.dangerBg : T.soft,
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <Heart size={15} color={isFavorited ? T.danger : T.mid} fill={isFavorited ? T.danger : 'none'}/>
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
      { label: 'Preço Médio', value: `${avgPrice.toLocaleString()}`, color: T.blue },
      { label: 'Total (kg)', value: totalQuantity.toLocaleString(), color: T.gold },
    ].map(s => (
      <div key={s.label} style={{ padding: '10px 9px', borderRadius: 12, background: T.canvas, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT, marginBottom: 4 }}>{s.label}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: FONT, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
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
    productType: '', priceRange: [0, 10000], radius: 200,
  })

  const [favorites, setFavorites]         = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(true)
  const [userLocation, setUserLocation]   = useState<[number, number] | null>(null)
  const [trackedProduct, setTrackedProduct] = useState<Product | null>(null)
  const [routeMetrics, setRouteMetrics]     = useState<Record<string, { km: number; mins: number }>>({})

  const { user } = useAuth()

  // Mapa "normal" estilo Google Maps/OSM — CartoDB Voyager: ruas, estradas e
  // rótulos bem legíveis, mantendo uma paleta suave e consistente com o resto da UI
  const STREET_TILE = {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
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

  // Raio de busca agora é funcional: filtra por distância real quando há localização do utilizador
  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesType  = !filters.productType || p.product_type.toLowerCase().includes(filters.productType.toLowerCase())
    const matchesPrice = p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    const matchesRadius = !userLocation || !p.location_lat || !p.location_lng
      ? true
      : distanceKm(userLocation, [p.location_lng, p.location_lat]) <= filters.radius
    return matchesType && matchesPrice && matchesRadius
  }), [products, filters, userLocation, distanceKm])

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

  /* ── Inicializar mapa ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!leafletReady || !mapContainer.current || mapRef.current) return
    const L = (window as any).L
    try {
      const m = L.map(mapContainer.current, { center: [-10.5, 15.0], zoom: 5, zoomControl: false })
      L.control.zoom({ position: 'topright' }).addTo(m)
      L.tileLayer(STREET_TILE.url, { attribution: STREET_TILE.attribution, maxZoom: 20, subdomains: 'abcd' }).addTo(m)
      mapRef.current        = m
      leafletLoadedRef.current = true

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          setUserLocation([lng, lat])
          const el = document.createElement('div')
          el.style.cssText = `width:18px;height:18px;background:${T.blue};border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(37,99,235,0.16);`
          const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
          userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(m)
        }, () => {})
      }
    } catch { setMapError('Erro ao inicializar mapa') }

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; leafletLoadedRef.current = false }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady])

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
          width:36px;height:36px;cursor:pointer;
          background:${T.g600};
          border:2.5px solid white;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);display:flex;align-items:center;
          justify-content:center;box-shadow:0 4px 12px rgba(44,134,59,0.35);
          transition:transform 0.18s;
        `
        el.innerHTML = `<div style="transform:rotate(45deg);font-size:16px;line-height:1;">🌿</div>`
        const icon   = L.divIcon({ html: el.outerHTML, className: '', iconSize: [36, 36], iconAnchor: [18, 36] })
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
        const mins = duration != null ? Math.max(1, Math.round(duration / 60)) : 0
        if (p.id) acc[p.id] = { km: Math.round(km * 10) / 10, mins }

        const line = L.polyline(coords, {
          color: T.g600, weight: 2, opacity: 0.45, dashArray: '4 6',
        }).addTo(m)

        const kmTxt   = `${(Math.round(km * 10) / 10).toFixed(1)} km`
        const timeTxt = mins ? formatDuration(mins * 60) : '—'
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
  }, [filteredProducts, userLocation, leafletLoadedRef.current])

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

    const userLatLng: [number, number]    = [userLocation[1], userLocation[0]]
    const productLatLng: [number, number] = [selectedProduct.location_lat, selectedProduct.location_lng]

    ;(async () => {
      const coords = await fetchRoadRoute(userLatLng, productLatLng)

      const glow = L.polyline(coords, { color: T.blue, weight: 8, opacity: 0.10 }).addTo(m)
      const line = L.polyline(coords, {
        color: T.blue, weight: 2.5, opacity: 0.75, dashArray: '7 5',
      }).addTo(m)

      const destIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:${T.blue};border:2.5px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(37,99,235,0.18);"></div>`,
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

      const glow = L.polyline(coords, { color: T.g400, weight: 8, opacity: 0.18 }).addTo(m)
      extraLayers.push(glow)

      routePolylineRef.current = L.polyline(coords, {
        color: T.g700, weight: 3, opacity: 0.85, dashArray: '10 6',
      }).addTo(m)

      const movingDot = L.circleMarker(coords[0], {
        radius: 8, fillColor: T.goldL, fillOpacity: 1, color: T.white, weight: 3,
      }).addTo(m)
      extraLayers.push(movingDot)

      const destIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:${T.blue};border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(37,99,235,0.18);"></div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      })
      const destMarker = L.marker(destination, { icon: destIcon }).addTo(m)
      extraLayers.push(destMarker)

      const bounds = L.latLngBounds(coords)
      m.fitBounds(bounds, { padding: [80, 80], duration: 1.2 })

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
      <div style={{ background: T.white, borderRadius: 20, padding: '40px 36px', maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: `0 20px 48px ${T.shadowMd}` }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertCircle size={24} color={T.danger}/>
        </div>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: T.ink, margin: '0 0 8px' }}>Erro ao Carregar Mapa</h3>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 20, fontFamily: FONT }}>{mapError}</p>
        <button onClick={() => window.location.reload()} style={{ width: '100%', height: 44, borderRadius: 980, border: 'none', background: T.g700, color: T.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
          Tentar Novamente
        </button>
      </div>
    </div>
  )

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: T.white, fontFamily: FONT }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full z-0" />

      {/* ══ HEADER — leve, translúcido, estilo Apple ══════════════════════════ */}
      <header className="al-header absolute top-0 left-0 right-0 z-30" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderBottom: `1px solid ${T.rule}` }}>
        <div className="mx-auto px-4" style={{ maxWidth: 1320, height: 56 }}>
          <div className="h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.history.back()}
              style={{ width: 32, height: 32, borderRadius: '50%', background: T.soft, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s', color: T.mid, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.softHv }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.soft }}
            >
              <ArrowLeft size={15}/>
            </button>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: '-0.01em', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Mapa de Produtos</p>
              <p style={{ fontSize: 10, color: T.faint, margin: 0, fontWeight: 600, fontFamily: FONT }}>AgriLink</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {[
              { icon: showProductsList ? <EyeOff size={15}/> : <Eye size={15}/>, onClick: () => setShowProductsList(!showProductsList), title: showProductsList ? 'Ocultar lista' : 'Mostrar lista', active: false },
              { icon: <Sliders size={15}/>, onClick: () => setShowFilters(!showFilters), title: 'Filtros', active: showFilters },
            ].map((btn, i) => (
              <button key={i} title={btn.title} onClick={btn.onClick} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: btn.active ? T.g700 : T.soft, color: btn.active ? T.white : T.mid }}>
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ SEARCH BAR — pílula leve ═══════════════════════════════════════════ */}
      <div className="al-search absolute left-1/2 transform -translate-x-1/2 z-30 w-[92%] max-w-[560px] top-16">
        <div className="bg-white rounded-[20px] shadow-md overflow-hidden" style={{ boxShadow: `0 10px 32px ${T.shadowMd}` }}>
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <Search size={15} color={T.faint} className="flex-shrink-0" />
            <input
              type="text" value={searchText}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Pesquisar localização em Angola..."
              className="flex-1 bg-transparent border-none outline-none text-sm" 
              style={{ color: T.ink, fontFamily: FONT, fontWeight: 500, padding: '10px 0' }}
            />
            {searchLoading && (
              <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${T.g100}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite' }} className="flex-shrink-0" />
            )}
            {searchText && (
              <button onClick={() => { setSearchText(''); setSearchResults([]) }} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: T.soft }}>
                <X size={12} color={T.muted}/>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 px-3 pb-2 overflow-x-auto hide-scrollbar">
            {['Milho', 'Feijão', 'Banana', 'Mandioca'].map(item => (
              <button
                key={item}
                onClick={() => setFilters({ ...filters, productType: filters.productType === item ? '' : item })}
                className="px-3 py-1.5 rounded-full whitespace-nowrap font-semibold text-sm"
                style={{ background: filters.productType === item ? T.g700 : T.soft, color: filters.productType === item ? T.white : T.mid }}
              >
                {item}
              </button>
            ))}
            {filters.productType && !['Milho', 'Feijão', 'Banana', 'Mandioca'].includes(filters.productType) && (
              <button onClick={() => setFilters({ ...filters, productType: '' })} className="px-3 py-1.5 rounded-full flex items-center gap-1 font-bold text-sm" style={{ background: T.dangerBg, color: T.danger }}>
                <X size={10}/> Limpar
              </button>
            )}
          </div>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: T.white, borderRadius: 18, boxShadow: `0 16px 48px ${T.shadowLg}`, overflow: 'hidden', zIndex: 50 }}>
            {searchResults.map((r, i) => (
              <button key={r.place_id || i} onClick={() => selectSearchResult(r)}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderBottom: i < searchResults.length - 1 ? `1px solid ${T.rule}` : 'none', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.13s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.g50 }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={13} color={T.g600}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name.split(',')[0]}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name}</div>
                </div>
                <ArrowRight size={13} color={T.faint}/>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══ FILTERS PANEL — simplificado: só o essencial ═══════════════════════ */}
      {showFilters && (
        <div className="al-filters-panel absolute z-40" style={{ top: 68, left: 16, background: T.white, borderRadius: 22, boxShadow: `0 20px 48px ${T.shadowLg}`, width: 320, overflow: 'hidden', animation: 'slideInLeft 0.2s cubic-bezier(0.22,1,0.36,1)' }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Filter size={15} color={T.g600}/>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: FONT }}>Filtros</span>
            </div>
            <button onClick={() => setShowFilters(false)} style={{ width: 26, height: 26, borderRadius: '50%', background: T.soft, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} color={T.mid}/>
            </button>
          </div>
          <div className="px-4 pb-4 flex flex-col gap-4">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Leaf size={12} color={T.g600}/><Label>Tipo de produto</Label>
              </div>
              <input type="text" placeholder="Ex: Milho, Feijão..." value={filters.productType} onChange={e => setFilters({ ...filters, productType: e.target.value })}
                className="w-full h-10 rounded-full px-4 text-sm outline-none" style={{ background: T.soft, color: T.ink, fontFamily: FONT }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Navigation size={12} color={T.g600}/><Label>Raio de busca</Label>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 14, background: T.canvas }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.faint, fontFamily: FONT, fontWeight: 600 }}>5 km</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.g700, fontFamily: FONT }}>{filters.radius} km</span>
                </div>
                <input type="range" min="5" max="500" step="5" value={filters.radius} onChange={e => setFilters({ ...filters, radius: parseInt(e.target.value) })} style={{ width: '100%', accentColor: T.g600 }} />
                {!userLocation && (
                  <p style={{ fontSize: 10, color: T.faint, fontFamily: FONT, marginTop: 8 }}>Ativa a localização para usar o raio.</p>
                )}
              </div>
            </div>
            <button onClick={() => setShowFilters(false)} style={{ width: '100%', height: 44, borderRadius: 980, border: 'none', background: T.g700, color: T.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <CheckCircle size={14}/> Aplicar
            </button>
          </div>
        </div>
      )}

      {/* ══ PRODUCTS LIST ════════════════════════════════════════════════════ */}
      {showProductsList && (
        <div className="al-products-list absolute bottom-4 left-4 z-30 w-[320px] max-h-[400px]" style={{ animation: 'slideInBottom 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
          <div className="bg-white rounded-[22px] overflow-hidden" style={{ boxShadow: `0 20px 48px ${T.shadowLg}` }}>
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Package size={15} color={T.g600}/>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: FONT }}>Produtos</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.g700, fontFamily: FONT }}>{filteredProducts.length}</span>
            </div>
            <div style={{ padding: '0 14px 12px' }}>
              <StatsPanel count={statsData.count} avgPrice={statsData.avgPrice} totalQuantity={statsData.totalQuantity}/>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: `1px solid ${T.rule}` }}>
              {filteredProducts.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <Package size={26} color={T.faint} style={{ display: 'block', margin: '0 auto 10px' }}/>
                  <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.ink, margin: '0 0 4px' }}>Sem resultados</p>
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
                  <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: T.g50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.image_url ? <img src={p.image_url} alt={p.product_type} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: 20 }}>🌾</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: FONT, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{p.product_type}</div>
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
              <div style={{ padding: '10px 14px', background: T.canvas, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: T.muted, fontFamily: FONT, fontWeight: 600 }}>+{filteredProducts.length - 8} outros produtos</span>
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

      {/* ══ TRACEABILITY SIDEBAR ═════════════════════════════════════════════ */}
      {trackedProduct && (
        <aside className="al-sidebar-track" style={{ position: 'absolute', top: 68, right: 16, zIndex: 45, width: 300, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', background: T.white, borderRadius: 22, boxShadow: `0 20px 48px ${T.shadowLg}`, animation: 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Navigation size={15} color={T.g600}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: FONT }}>Rastreabilidade</div>
                <div style={{ fontSize: 10, color: T.faint, fontFamily: FONT, fontWeight: 600 }}>{trackedProduct.product_type}</div>
              </div>
            </div>
            <button onClick={() => setTrackedProduct(null)} style={{ width: 26, height: 26, borderRadius: '50%', background: T.soft, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} color={T.mid}/>
            </button>
          </div>

          <div style={{ padding: '14px 18px' }}>
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
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: FONT }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: FONT, marginTop: 3 }}>{s.date}</div>
                    <div style={{ fontSize: 10, color: T.faint, fontFamily: FONT, marginTop: 2 }}>{s.sub}</div>
                  </div>
                </div>
              ))
            })()}

            {userLocation && trackedProduct.location_lat && trackedProduct.location_lng && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: T.g50 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Label>Progresso da rota</Label>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.g700, fontFamily: FONT }}>60%</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: T.g100, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: T.g600, borderRadius: 4 }}/>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ══ FOOTER STATS — pílula flutuante leve ════════════════════════════ */}
      <div className="al-footer-stats absolute left-1/2 transform -translate-x-1/2 bottom-4 z-25 w-[92%] max-w-[620px]">
        <div className="rounded-[20px] p-3 grid grid-cols-4 gap-2.5" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)', boxShadow: `0 10px 32px ${T.shadowMd}` }}>
          {[
            { label: 'Produtores',   value: new Set(filteredProducts.map(p => p.farmer_id || p.farmer_name)).size, color: T.g700,  icon: <Leaf size={12}/> },
            { label: 'Produtos',     value: filteredProducts.length,                                                color: T.blue, icon: <Package size={12}/> },
            { label: 'Em Trânsito',  value: Math.max(1, Math.floor(filteredProducts.length * 0.2)),                color: T.goldL,  icon: <TrendingUp size={12}/> },
            { label: 'Mais Próximo', value: (() => {
                if (!userLocation) return '—'
                const dists = filteredProducts.filter(p => p.location_lat && p.location_lng)
                  .map(p => distanceKm(userLocation, [p.location_lng!, p.location_lat!]))
                return dists.length ? `${Math.min(...dists)} km` : '—'
              })(), color: T.g600, icon: <Navigation size={12}/> },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: FONT }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: FONT, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-[22px] flex flex-col items-center gap-3 p-7" style={{ boxShadow: `0 24px 60px ${T.shadowLg}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${T.g100}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite' }} />
            <div className="text-center">
              <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>A carregar mapa</p>
              <p style={{ fontSize: 11, color: T.faint, marginTop: 4, fontFamily: FONT }}>Aguarde um momento...</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin          { to { transform: rotate(360deg) } }
        @keyframes slideInRight  { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInLeft   { from { opacity:0; transform:translateX(-24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInBottom { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius: 2px; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .leaflet-top, .leaflet-bottom { z-index: 20 !important; }
        .leaflet-control-zoom { margin-top: 60px !important; border: none !important; box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important; }
        .leaflet-control-zoom a { border-radius: 10px !important; }
        .leaflet-container { font-family: ${FONT} !important; }
        .al-route-tip { background:${T.ink} !important; color:#fff !important; border:none !important; font-weight:700 !important; font-size:11px !important; padding:5px 9px !important; border-radius:8px !important; box-shadow:0 4px 12px rgba(0,0,0,0.2) !important; }
        .al-route-tip::before { border-top-color:${T.ink} !important; }

        /* ── Responsivo: painéis flutuantes viram folhas de largura total em mobile ── */
        @media (max-width: 680px) {
          .al-filters-panel {
            left: 12px !important; right: 12px !important; width: auto !important; top: auto !important; bottom: 90px !important;
            max-height: 60vh !important;
          }
          .al-products-list {
            left: 12px !important; right: 12px !important; width: auto !important; bottom: 12px !important;
          }
          .al-product-card {
            left: 12px !important; right: 12px !important; width: auto !important; bottom: 12px !important;
          }
          .al-sidebar-track {
            left: 12px !important; right: 12px !important; width: auto !important; top: auto !important; bottom: 12px !important;
            max-height: 65vh !important;
          }
          .al-footer-stats { display: none; }
          .al-search { top: 64px !important; }
        }
      `}</style>
      <SatelliteMonitor />
    </div>
  )
}

export default MapView