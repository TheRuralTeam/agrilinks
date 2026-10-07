import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../integrations/supabase/client'
import { Button } from '../components/ui/button'
import { ArrowLeft, MapPin } from 'lucide-react'
import SimpleLeafletMap from '../components/SimpleLeafletMap'

const PublicProductLocation = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('products')
      .select('id, product_type, farmer_name, location_lat, location_lng, province_id, municipality_id, status')
      .eq('id', id).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setError('Produto não encontrado'); return }
        if (
          data.location_lat == null ||
          data.location_lng == null ||
          !Number.isFinite(Number(data.location_lat)) ||
          !Number.isFinite(Number(data.location_lng))
        ) {
          setError('Este produto não possui localização');
          return;
        }
        setProduct(data)
      })
  }, [id])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-[#E5EDE6] bg-white">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#2c863b]" />
          <div>
            <h1 className="font-semibold text-[#111714]">
              {product ? `Zona de origem: ${product.product_type}` : 'Localização do produto'}
            </h1>
            {product && (
              <p className="text-xs text-muted-foreground">
                A localização exacta da origem não é exposta publicamente.
              </p>
            )}
          </div>
        </div>
      </header>
      {error ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">{error}</div>
      ) : product ? (
        <SimpleLeafletMap
          center={{
            lat: Math.round(Number(product.location_lat) * 100) / 100,
            lng: Math.round(Number(product.location_lng) * 100) / 100,
          }}
          zoom={9}
          markers={[{
            lat: Math.round(Number(product.location_lat) * 100) / 100,
            lng: Math.round(Number(product.location_lng) * 100) / 100,
            color: '#1A5C24',
            popupHtml: `<strong>${product.product_type}</strong><br/>${product.municipality_id || ''} · ${product.province_id || ''}`,
          }]}
          height="70vh"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Loader compact />
        </div>
      )}
    </div>
  )
}

export default PublicProductLocation
