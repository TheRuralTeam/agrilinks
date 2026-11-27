import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_TILE_LAYERS } from '../lib/mapTiles'

interface ProductLocationMapProps {
  latitude: number | null | undefined
  longitude: number | null | undefined
  className?: string
}

const productMarker = L.divIcon({
  className: 'agrilink-product-marker',
  html: '<span style="display:block;width:18px;height:18px;border:4px solid #ffffff;border-radius:50%;background:#2c863b;box-shadow:0 1px 6px rgba(0,0,0,.35)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function ResizeMapWhenVisible() {
  const map = useMap()

  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize())
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => map.invalidateSize())

    if (observer) observer.observe(map.getContainer())
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [map])

  return null
}

export function ProductLocationMap({ latitude, longitude, className = '' }: ProductLocationMapProps) {
  const hasValidCoordinates = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude! >= -90
    && latitude! <= 90
    && longitude! >= -180
    && longitude! <= 180

  if (!hasValidCoordinates) {
    return (
      <div className={`grid min-h-64 place-items-center rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground ${className}`}>
        Localização indisponível para este produto.
      </div>
    )
  }

  const position: [number, number] = [latitude!, longitude!]

  return (
    <div className={`overflow-hidden rounded-lg border border-border ${className}`}>
      <MapContainer
        center={position}
        zoom={10}
        scrollWheelZoom
        style={{ width: '100%', height: '100%', minHeight: 320 }}
      >
        <ResizeMapWhenVisible />
        <TileLayer
          url={MAP_TILE_LAYERS.light.url}
          attribution={MAP_TILE_LAYERS.light.attribution}
          subdomains={MAP_TILE_LAYERS.subdomains}
          maxZoom={MAP_TILE_LAYERS.maxZoom}
        />
        <Marker position={position} icon={productMarker} />
      </MapContainer>
    </div>
  )
}
