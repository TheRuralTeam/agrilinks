import React, { useEffect, useState, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Filter, DollarSign, Calendar, Package, Search, Move } from 'lucide-react'
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
  image_url?: string
  location_lat: number | null
  location_lng: number | null
}

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const truckRef = useRef<mapboxgl.Marker | null>(null)
  const [mapboxToken] = useState('pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [tempLocation, setTempLocation] = useState<{lat: number, lng: number} | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const { user } = useAuth()

  // Search
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Card drag state
  const [cardY, setCardY] = useState<number>(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)

  useEffect(() => { if (user) fetchProducts() }, [user])

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return
    // Check WebGL support early to avoid runtime crash
    // Prefer Mapbox's supported() which accounts for performance caveats
    if (!mapboxgl.supported({ failIfMajorPerformanceCaveat: true } as any)) {
      setMapError('Seu dispositivo/navegador não suporta WebGL suficiente para o mapa.')
      return
    }
    try {
      mapboxgl.accessToken = mapboxToken
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [13.234444, -8.838333],
        zoom: 6.2,
        pitch: 50,
        bearing: -20
      })
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.current.on('load', () => startTruckSimulation())
      map.current.on('error', (e) => { console.error('Mapbox error:', e); setMapError('Erro ao carregar o mapa.') })
      setMapError(null)
    } catch (error) { console.error('Failed to initialize map:', error); setMapError('Não foi possível inicializar o mapa.') }

    return () => { markers.current.forEach(m => m.remove()); markers.current = []; truckRef.current?.remove(); map.current?.remove() }
  }, [mapboxToken])

  const randomCoords = () => {
    const lat = -8.5 + (Math.random() - 0.5) * 4
    const lng = 13.2 + (Math.random() - 0.5) * 5
    return { lat, lng }
  }

  useEffect(() => {
    if (!map.current) return
    markers.current.forEach(m => m.remove())
    markers.current = []

    const farmerIcon = '🧑‍🌾'
    const productIcon = '🌾'

    for (let i = 0; i < 5; i++) {
      const { lat, lng } = randomCoords()
      const el = document.createElement('div')
      el.className = 'marker-3d'
      el.innerHTML = `<div style="font-size:28px; transform:translate(-50%,-50%) scale(1.1);">${farmerIcon}</div>`
      const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current!)
      markers.current.push(marker)
    }

    products.forEach((p) => {
      if (p.location_lat && p.location_lng) {
        const el = document.createElement('div')
        el.className = 'marker-3d'
        el.innerHTML = `<div style="font-size:28px; transform:translate(-50%,-50%) scale(1.1);">${productIcon}</div>`
        const marker = new mapboxgl.Marker(el).setLngLat([p.location_lng, p.location_lat]).addTo(map.current!)
        marker.getElement().addEventListener('click', () => {
          setSelectedProduct(p)
          setTempLocation({ lat: p.location_lat!, lng: p.location_lng! })
          map.current?.flyTo({ center: [p.location_lng!, p.location_lat!], zoom: 12 })
        })
        markers.current.push(marker)
      }
    })
  }, [products])

  useEffect(() => {
    if (!map.current) return
    const handleMapClick = (e: any) => {
      if (!selectedProduct) return
      const { lng, lat } = e.lngLat
      setTempLocation({ lat, lng })
    }
    map.current.on('click', handleMapClick)
    return () => { map.current?.off('click', handleMapClick) }
  }, [selectedProduct])

  const startTruckSimulation = () => {
    if (!map.current) return
    const truckEl = document.createElement('div')
    truckEl.innerHTML = `<div style="font-size:30px; transform:translate(-50%,-50%) rotate(0deg);">🚛</div>`
    const truckMarker = new mapboxgl.Marker(truckEl).setLngLat([13.23, -8.83]).addTo(map.current)
    truckRef.current = truckMarker

    let angle = 0, t = 0
    const path = [[13.0, -9.0],[13.5, -8.5],[13.8, -8.2],[13.4, -8.6],[13.0, -9.0]]

    const animateTruck = () => {
      const next = (t + 1) % path.length
      const [lng1, lat1] = path[t], [lng2, lat2] = path[next]
      let progress = 0
      const step = () => {
        progress += 0.005
        if (progress >= 1) { t = next; requestAnimationFrame(animateTruck); return }
        const lng = lng1 + (lng2 - lng1) * progress
        const lat = lat1 + (lat2 - lat1) * progress
        angle += 2
        truckEl.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`
        truckMarker.setLngLat([lng, lat])
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    animateTruck()
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('status', 'active')
      if (error) throw error
      const productsWithCoords = (data || []).map((p: any) => ({
        ...p,
        image_url: p.image_url ?? 'https://via.placeholder.com/150',
        location_lat: p.location_lat ?? randomCoords().lat,
        location_lng: p.location_lng ?? randomCoords().lng
      }))
      setProducts(productsWithCoords)
    } catch (error) { console.error('Error fetching products:', error) }
  }

  const confirmLocation = () => {
    if (!selectedProduct || !tempLocation) return
    setProducts(prev =>
      prev.map(prod => prod.id === selectedProduct.id
        ? { ...prod, location_lat: tempLocation.lat, location_lng: tempLocation.lng }
        : prod
      )
    )
    supabase.from('products').update({
      location_lat: tempLocation.lat,
      location_lng: tempLocation.lng
    }).eq('id', selectedProduct.id).then(({ error }) => {
      if (error) console.error('Erro ao atualizar localização:', error)
    })
    setSelectedProduct({ ...selectedProduct, ...tempLocation })
    setTempLocation(null)
  }

  const handleSearch = async (text: string) => {
    setSearchText(text)
    if (!text) { setSearchResults([]); return }
    setSearchLoading(true)
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${mapboxToken}&limit=5`)
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

  // Card drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY
    currentYRef.current = cardY
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    const dy = e.clientY - startYRef.current
    const newY = Math.min(Math.max(currentYRef.current + dy, 0), window.innerHeight - 150)
    setCardY(newY)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  return (
    <div className="pb-20 bg-background min-h-screen relative">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary">🌍 Mapa de Conexões Agrícolas</h1>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Search Custom */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 w-11/12 max-w-md md:w-80">
        <div className="relative">
          <input
            type="text"
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Pesquisar localização..."
            className="w-full px-4 py-2 rounded-xl shadow-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600" />
        </div>
        {searchResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg mt-1 max-h-64 overflow-auto">
            {searchResults.map((r) => (
              <div
                key={r.id}
                className="p-2 hover:bg-green-100 cursor-pointer"
                onClick={() => selectSearchResult(r)}
              >
                {r.place_name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative h-[calc(100vh-100px)]">
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Card className="max-w-md mx-4">
              <CardContent className="p-6 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Mapa Indisponível</h3>
                <p className="text-sm text-muted-foreground mb-4">{mapError}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div ref={mapContainer} className="absolute inset-0 rounded-lg shadow-lg" />
        )}

        {/* Draggable Product Card */}
        {selectedProduct && (
          <div
            ref={cardRef}
            style={{ top: `${cardY || window.innerHeight - 250}px` }}
            onMouseDown={onMouseDown}
            className="absolute left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-200 to-green-100 rounded-2xl shadow-2xl p-5 z-20 w-11/12 max-w-md transition-all duration-300 border border-green-300 cursor-grab"
          >
            <Move className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <img src={selectedProduct.image_url} className="w-full h-36 object-cover rounded-xl mb-3 shadow-inner" />
            <h2 className="text-lg font-bold mb-2">{selectedProduct.product_type}</h2>
            <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-green-600" /> Quantidade: {selectedProduct.quantity}</div>
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-yellow-600" /> Preço: {selectedProduct.price} Kz</div>
            <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-blue-600" /> Colheita: {selectedProduct.harvest_date}</div>
            <div className="flex items-center gap-2 mb-3"><MapPin className="w-4 h-4 text-red-600" /> Local: {selectedProduct.location_lat?.toFixed(4)}, {selectedProduct.location_lng?.toFixed(4)}</div>
            {tempLocation && <div className="text-sm text-gray-700 mb-2">Local temporário: {tempLocation.lat.toFixed(4)}, {tempLocation.lng.toFixed(4)}</div>}
            {tempLocation && <Button className="w-full" onClick={confirmLocation}>Confirmar Posição 📌</Button>}
          </div>
        )}

        <style>{`
          .marker-3d {
            perspective: 800px;
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
          }
          .marker-3d:hover {
            transform: scale(1.3) rotateY(15deg) rotateX(10deg);
          }
        `}</style>
      </div>
    </div>
  )
}

export default MapView
