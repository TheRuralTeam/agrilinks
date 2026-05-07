import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MapPin } from 'lucide-react'

const MAPBOX_TOKEN = 'pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA'

const PublicProductLocation = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const [product, setProduct] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('products')
      .select('id, product_type, farmer_name, location_lat, location_lng, province_id, municipality_id, status')
      .eq('id', id).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setError('Produto não encontrado'); return }
        if (!data.location_lat || !data.location_lng) { setError('Este produto não possui localização'); return }
        setProduct(data)
      })
  }, [id])

  useEffect(() => {
    if (!product || !mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [product.location_lng, product.location_lat],
      zoom: 12,
    })
    new mapboxgl.Marker({ color: '#1A5C24' })
      .setLngLat([product.location_lng, product.location_lat])
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>${product.product_type}</strong><br/>${product.farmer_name || ''}`))
      .addTo(map)
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    return () => map.remove()
  }, [product])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-[#E5EDE6] bg-white">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#1A5C24]" />
          <h1 className="font-semibold text-[#0a1628]">
            {product ? `Localização: ${product.product_type}` : 'Localização do produto'}
          </h1>
        </div>
      </header>
      {error ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">{error}</div>
      ) : (
        <div ref={mapRef} className="flex-1 w-full" style={{ minHeight: '70vh' }} />
      )}
    </div>
  )
}

export default PublicProductLocation
