import React, { useEffect, useState, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Button } from '@/components/ui/button'
import { MapPin, Filter, DollarSign, Calendar, Package, Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

interface Product {
  id: string
  product_type: string
  quantity: number
  harvest_date: string
  price: number
  province_id: string
  municipality_id: string
  farmer_name: string
  images?: string[]
  image_url?: string
  location_lat: number | null
  location_lng: number | null
}

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const userMarker = useRef<mapboxgl.Marker | null>(null)
  const [mapboxToken] = useState('pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const { user } = useAuth()

  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (user) fetchProducts()
  }, [user])

  // Inicialização do mapa
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return

    if (!mapboxgl.supported({ failIfMajorPerformanceCaveat: true } as any)) {
      setMapError('Seu dispositivo/navegador não suporta WebGL suficiente para o mapa.')
      return
    }

    try {
      mapboxgl.accessToken = mapboxToken
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.234444, -8.838333],
        zoom: 6,
        pitch: 0,
        bearing: 0,
      })

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Geolocalização do utilizador
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords
            const el = document.createElement('div')
            el.className = 'user-marker'
            el.style.width = '20px'
            el.style.height = '20px'
            el.style.backgroundColor = '#22c55e'
            el.style.border = '2px solid white'
            el.style.borderRadius = '50%'
            el.style.boxShadow = '0 0 10px rgba(34,197,94,0.8)'

            userMarker.current = new mapboxgl.Marker(el)
              .setLngLat([longitude, latitude])
              .addTo(map.current!)

            map.current!.flyTo({ center: [longitude, latitude], zoom: 12 })
          },
          (err) => console.warn('Geolocalização negada:', err)
        )
      }
    } catch (error) {
      console.error('Falha ao iniciar mapa:', error)
      setMapError('Não foi possível inicializar o mapa.')
    }

    return () => {
      markers.current.forEach((m) => m.remove())
      map.current?.remove()
    }
  }, [mapboxToken])

  // Renderizar marcadores REAIS
  useEffect(() => {
    if (!map.current) return
    markers.current.forEach((m) => m.remove())
    markers.current = []

    products.forEach((p) => {
      if (p.location_lat && p.location_lng) {
        const el = document.createElement('div')
        el.innerHTML = '🧺'
        el.style.fontSize = '24px'
        el.style.cursor = 'pointer'

        const marker = new mapboxgl.Marker(el)
          .setLngLat([p.location_lng, p.location_lat])
          .addTo(map.current!)

        el.addEventListener('click', () => {
          setSelectedProduct(p)
        })

        markers.current.push(marker)
      }
    })
  }, [products])

  // Buscar produtos com coordenadas reais
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('status', 'active')
      if (error) throw error

      const filtered = (data || []).filter(
        (p: any) => p.location_lat !== null && p.location_lng !== null
      )

      const withImages = filtered.map((p: any) => ({
        ...p,
        image_url:
          Array.isArray(p.images) && p.images.length > 0
            ? p.images[0]
            : p.image_url || 'https://via.placeholder.com/600x400?text=Produto',
      }))
      setProducts(withImages)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    }
  }

  const handleSearch = async (text: string) => {
    setSearchText(text)
    if (!text) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        text
      )}.json?access_token=${mapboxToken}&limit=5`
    )
    const data = await response.json()
    setSearchResults(data.features || [])
    setSearchLoading(false)
  }

  const selectSearchResult = (feature: any) => {
    const [lng, lat] = feature.center
    map.current?.flyTo({ center: [lng, lat], zoom: 12 })
    setSearchResults([])
    setSearchText(feature.place_name)
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* ✅ AppBar restaurado */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-green-600 text-white flex justify-between items-center px-5 py-3 shadow-md">
        <h1 className="text-lg font-semibold tracking-wide">MAPA AGRI LINK</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-green-700 rounded-full"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* 🔍 Barra de pesquisa elegante */}
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-30 w-11/12 max-w-lg">
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-gray-200 flex items-center px-3 py-2">
          <Search className="h-5 w-5 text-gray-500 mr-2" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Pesquisar localização..."
            className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-1 bg-white rounded-xl shadow-lg max-h-60 overflow-auto border border-gray-100">
            {searchResults.map((r) => (
              <div
                key={r.id}
                className="p-2 hover:bg-green-50 cursor-pointer text-gray-700"
                onClick={() => selectSearchResult(r)}
              >
                {r.place_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🗺️ Mapa */}
      <div ref={mapContainer} className="absolute inset-0 rounded-none" />

      {/* 🧺 Modal com produto */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-center items-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="relative">
              <img
                src={selectedProduct.image_url}
                alt={selectedProduct.product_type}
                className="w-full h-56 object-cover"
              />
              <button
                className="absolute top-3 right-3 bg-black/40 text-white p-1 rounded-full hover:bg-black/60"
                onClick={() => setSelectedProduct(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              <h2 className="text-xl font-semibold text-gray-800 mb-1">
                {selectedProduct.product_type}
              </h2>
              <p className="text-gray-500 mb-4 text-sm">por {selectedProduct.farmer_name}</p>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-500" /> Quantidade:{' '}
                  {selectedProduct.quantity}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-yellow-500" /> Preço:{' '}
                  {selectedProduct.price} Kz
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" /> Colheita:{' '}
                  {selectedProduct.harvest_date}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500" /> Localização:{' '}
                  {selectedProduct.location_lat?.toFixed(4)}, {selectedProduct.location_lng?.toFixed(4)}
                </div>
              </div>

              <Button
                onClick={() => setSelectedProduct(null)}
                className="w-full mt-5 bg-green-600 hover:bg-green-700 text-white"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapView