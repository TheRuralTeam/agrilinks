import React, { useEffect, useMemo, useState } from 'react'
import { Crosshair, History, LoaderCircle, MapPin, Search, X, Check, ExternalLink } from 'lucide-react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../contexts/AuthContext'
import { getPreferredDeliveryLocation } from '../features/products/deliveryLocationPreference'
import { getProvincesForCountry } from '../data/country-locations'
import { geocodeAngolaLocation } from '../features/maps/geocodingService'
import { MAP_TILE_LAYERS } from '../lib/mapTiles'

export type SelectedGeocodedLocation = {
  label: string
  latitude: number
  longitude: number
}

type LocationAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onSelectLocation?: (location: SelectedGeocodedLocation | null) => void
  placeholder?: string
  disabled?: boolean
  inputClassName?: string
  inputStyle?: React.CSSProperties
  onBlur?: () => void
  onFocus?: () => void
}

const ANGOLA_BOUNDS = { minLat: -18.5, maxLat: -4.2, minLng: 11.4, maxLng: 24.2 }
const ANGOLA_CENTER: [number, number] = [-8.8389, 13.2894]
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-AO').trim()

const deliveryMarker = L.divIcon({
  className: 'agrilink-delivery-picker-marker',
  html: '<span style="display:block;width:22px;height:22px;border:4px solid white;border-radius:50% 50% 50% 0;background:#2c863b;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.4)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

function MapClickSelector({ onSelect }: { onSelect: (point: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelectLocation,
  placeholder = 'Município, bairro ou zona',
  disabled = false,
  inputClassName = '',
  inputStyle,
  onBlur,
  onFocus,
}: LocationAutocompleteProps) {
  const [focused, setFocused] = useState(false)
  const [savedLocation, setSavedLocation] = useState<string | null>(null)
  const [geocodedSuggestions, setGeocodedSuggestions] = useState<SelectedGeocodedLocation[]>([])
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [geocodingUnavailable, setGeocodingUnavailable] = useState(false)
  const [locatingGps, setLocatingGps] = useState(false)
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [mapPoint, setMapPoint] = useState<[number, number]>(ANGOLA_CENTER)
  const [mapLayer, setMapLayer] = useState<'street' | 'voyager'>('street')
  const { user } = useAuth()

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setSavedLocation(null)
      return () => { active = false }
    }
    void getPreferredDeliveryLocation(user.id).then((location) => {
      if (active) setSavedLocation(location)
    })
    const handleSavedLocation = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; location: string }>).detail
      if (detail?.userId === user.id && typeof detail.location === 'string') {
        setSavedLocation(detail.location)
      }
    }
    window.addEventListener('agrilink:delivery-location-saved', handleSavedLocation)
    return () => {
      active = false
      window.removeEventListener('agrilink:delivery-location-saved', handleSavedLocation)
    }
  }, [user?.id])

  useEffect(() => {
    const query = value.trim()
    if (query.length < 3 || !focused || !navigator.onLine) {
      setGeocodedSuggestions([])
      setSearchingPlaces(false)
      setGeocodingUnavailable(query.length >= 3 && !navigator.onLine)
      return
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setSearchingPlaces(true)
      setGeocodingUnavailable(false)
      try {
        const { supabase } = await import('../integrations/supabase/client')
        const { data, error } = await supabase.functions.invoke('geocoding-search', { body: { query } })
        if (error) throw error
        const results = Array.isArray(data?.results) ? data.results : []
        const valid = results.flatMap((item: any) => {
          const latitude = Number(item?.lat)
          const longitude = Number(item?.lon)
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              latitude < ANGOLA_BOUNDS.minLat || latitude > ANGOLA_BOUNDS.maxLat ||
              longitude < ANGOLA_BOUNDS.minLng || longitude > ANGOLA_BOUNDS.maxLng) return []
          const label = typeof item?.display_name === 'string' ? item.display_name.trim() : ''
          return label ? [{ label, latitude, longitude }] : []
        })
        if (active) {
          setGeocodedSuggestions(valid.filter((item, index, all) =>
            all.findIndex((candidate) => normalize(candidate.label) === normalize(item.label)) === index
          ).slice(0, 8))
        }
      } catch (error) {
        console.warn('[AgriLink] Pesquisa geográfica indisponível; mantém-se a pesquisa local.', error)
        if (active) {
          setGeocodedSuggestions([])
          setGeocodingUnavailable(true)
        }
      } finally {
        if (active) setSearchingPlaces(false)
      }
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [value, focused])

  const localSuggestions = useMemo(() => {
    const provinces = getProvincesForCountry('AO')
    const all = provinces.flatMap((province) => [
      { label: `${province.name}, Angola`, search: province.name },
      ...province.municipalities.map((municipality) => ({
        label: `${municipality.name}, ${province.name}, Angola`,
        search: `${municipality.name} ${province.name}`,
      })),
    ])
    const query = normalize(value)
    if (!query) {
      return all.filter((item) => /Luanda|Viana|Cacuaco|Benguela|Huambo|Lubango|Malanje/i.test(item.label)).slice(0, 7)
    }
    return all
      .filter((item) => normalize(item.label).includes(query) || normalize(item.search).includes(query))
      .filter((item, index, list) => list.findIndex((candidate) => candidate.label === item.label) === index)
      .slice(0, 7)
  }, [value])

  const useCurrentGps = () => {
    setGpsMessage(null)
    if (!navigator.geolocation) {
      setGpsMessage('Este dispositivo não disponibiliza geolocalização.')
      return
    }
    setLocatingGps(true)
    navigator.geolocation.getCurrentPosition((position) => {
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      setLocatingGps(false)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < ANGOLA_BOUNDS.minLat || latitude > ANGOLA_BOUNDS.maxLat ||
          longitude < ANGOLA_BOUNDS.minLng || longitude > ANGOLA_BOUNDS.maxLng) {
        setGpsMessage('A posição GPS está fora da área operacional da AgriLink em Angola.')
        return
      }
      const label = `GPS confirmado: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      onChange(label)
      onSelectLocation?.({ label, latitude, longitude })
      setFocused(false)
    }, (error) => {
      setLocatingGps(false)
      setGpsMessage(error.code === error.PERMISSION_DENIED
        ? 'Permita o acesso à localização nas definições do navegador.'
        : error.code === error.TIMEOUT
          ? 'A leitura GPS demorou demasiado. Tente novamente num local com melhor sinal.'
          : 'Não foi possível obter GPS. Verifique o sinal e tente novamente.')
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
  }

  const chooseGeocoded = (location: SelectedGeocodedLocation) => {
    onChange(location.label)
    onSelectLocation?.(location)
    setFocused(false)
  }

  const chooseTextLocation = (label: string) => {
    onChange(label)
    setFocused(false)
    if (!onSelectLocation || label.trim().length < 3 || !navigator.onLine) return
    void geocodeAngolaLocation(label).then((result) => {
      if (!result) return
      const latitude = Number(result.lat)
      const longitude = Number(result.lon)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < ANGOLA_BOUNDS.minLat || latitude > ANGOLA_BOUNDS.maxLat ||
          longitude < ANGOLA_BOUNDS.minLng || longitude > ANGOLA_BOUNDS.maxLng) return
      onSelectLocation({ label: result.display_name || label, latitude, longitude })
    }).catch((error) => {
      console.warn('[AgriLink] Não foi possível localizar as coordenadas deste texto.', error)
    })
  }

  const openMapPicker = () => {
    setFocused(false)
    setGpsMessage(null)
    setMapPickerOpen(true)
  }

  const confirmMapPoint = () => {
    const [latitude, longitude] = mapPoint
    if (latitude < ANGOLA_BOUNDS.minLat || latitude > ANGOLA_BOUNDS.maxLat ||
        longitude < ANGOLA_BOUNDS.minLng || longitude > ANGOLA_BOUNDS.maxLng) {
      setGpsMessage('Selecione um ponto dentro de Angola para continuar.')
      setMapPickerOpen(false)
      return
    }
    const label = `Ponto no mapa: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    onChange(label)
    onSelectLocation?.({ label, latitude, longitude })
    setMapPickerOpen(false)
    setFocused(false)
  }

  const showList = focused && (geocodedSuggestions.length > 0 || localSuggestions.length > 0 || Boolean(savedLocation) || searchingPlaces)

  return (
    <div className="relative w-full">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openMapPicker}
          aria-label="Escolher ponto de entrega no mapa"
          title="Escolher ponto de entrega no mapa"
          className="absolute left-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#2c863b] transition-colors hover:bg-[#E6F4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c863b] disabled:opacity-50"
        >
          <MapPin aria-hidden="true" className="h-5 w-5" />
        </button>
        <input
          type="text"
          autoComplete="off"
          maxLength={180}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Local de entrega"
          aria-autocomplete="list"
          aria-expanded={showList}
          onFocus={() => { setFocused(true); onFocus?.() }}
          onBlur={() => { window.setTimeout(() => setFocused(false), 120); onBlur?.() }}
          onChange={(event) => {
            onChange(event.target.value)
            onSelectLocation?.(null)
          }}
          className={`w-full pl-12 pr-20 ${inputClassName}`}
          style={inputStyle}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchingPlaces && <LoaderCircle aria-label="A pesquisar locais" className="h-4 w-4 animate-spin text-[#2c863b]" />}
          <button
            type="button"
            disabled={disabled || locatingGps}
            onClick={useCurrentGps}
            aria-label="Selecionar localização do dispositivo"
            title={locatingGps ? 'A obter localização do dispositivo…' : 'Selecionar localização do dispositivo'}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6F4E8] text-[#246B31] ring-1 ring-inset ring-[#B8D9BD] transition-colors hover:bg-[#D5EBD9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c863b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locatingGps ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Crosshair aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {gpsMessage && <p role="status" className="mt-1 text-[11px] leading-4 text-[#9A5B00]">{gpsMessage}</p>}
      {showList && (
        <div role="listbox" aria-label="Sugestões de localização em Angola" className="absolute z-[80] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[#DCE8DD] bg-white py-1 shadow-xl">
          {savedLocation && normalize(savedLocation) !== normalize(value) && (
            <button key="saved-delivery-location" type="button" role="option" aria-selected={false}
              onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTextLocation(savedLocation)}
              className="flex w-full items-start gap-2 border-b border-[#E5EDE6] px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]">
              <History aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#2c863b]" />
              <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#2c863b]">Usar localização anterior</span><span className="block break-words">{savedLocation}</span></span>
            </button>
          )}
          {geocodedSuggestions.map((item) => (
            <button key={`geo-${item.label}`} type="button" role="option" aria-selected={normalize(value) === normalize(item.label)}
              onMouseDown={(event) => event.preventDefault()} onClick={() => chooseGeocoded(item)}
              className="flex w-full items-start gap-2 border-b border-[#E5EDE6] px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#2c863b]" />
              <span className="min-w-0"><span className="block break-words">{item.label}</span><span className="mt-0.5 block text-[10px] text-[#2c863b]">Localização identificada · coordenadas disponíveis</span></span>
            </button>
          ))}
          {localSuggestions.map((item) => (
            <button key={item.label} type="button" role="option" aria-selected={false}
              onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTextLocation(item.label)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]">
              <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#2c863b]" /><span>{item.label}</span>
            </button>
          ))}
          {geocodingUnavailable && <p className="m-0 px-3 py-2 text-[11px] text-[#758A79]">Pesquisa geográfica indisponível neste momento. Pode escrever o endereço ou selecionar o ponto no mapa.</p>}
        </div>
      )}
      <p className="mt-1.5 text-[11px] leading-4 text-[#758A79]">Escreva um endereço, use o GPS do dispositivo ou clique no ícone do mapa para escolher o ponto exato de entrega.</p>

      {mapPickerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="delivery-map-title">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E1EAE2] px-4 py-3 sm:px-5">
              <div>
                <h2 id="delivery-map-title" className="m-0 text-base font-semibold text-[#203B27]">Escolher ponto de entrega</h2>
                <p className="mt-1 text-xs text-[#647568]">Clique no mapa para colocar o marcador exatamente onde a encomenda deve ser entregue.</p>
              </div>
              <button type="button" onClick={() => setMapPickerOpen(false)} aria-label="Fechar mapa" className="rounded-lg p-2 text-[#526456] hover:bg-[#F1F6F1]"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <div className="flex gap-2">
                <button type="button" onClick={() => setMapLayer('street')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mapLayer === 'street' ? 'bg-[#2c863b] text-white' : 'bg-[#F0F4F0] text-[#38533D]'}`}>OpenStreetMap</button>
                <button type="button" onClick={() => setMapLayer('voyager')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mapLayer === 'voyager' ? 'bg-[#2c863b] text-white' : 'bg-[#F0F4F0] text-[#38533D]'}`}>Mapa detalhado</button>
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapPoint[0]},${mapPoint[1]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#2c863b] underline">
                Ver ponto no Google Maps <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="min-h-[280px] flex-1 px-3 sm:px-5">
              <div className="h-[42vh] min-h-[280px] overflow-hidden rounded-xl border border-[#DCE8DD]">
                <MapContainer center={mapPoint} zoom={13} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
                  <TileLayer url={mapLayer === 'street' ? MAP_TILE_LAYERS.light.url : MAP_TILE_LAYERS.voyager.url}
                    attribution={mapLayer === 'street' ? MAP_TILE_LAYERS.light.attribution : MAP_TILE_LAYERS.voyager.attribution}
                    subdomains={MAP_TILE_LAYERS.subdomains} maxZoom={MAP_TILE_LAYERS.maxZoom} />
                  <MapClickSelector onSelect={setMapPoint} />
                  <Marker position={mapPoint} icon={deliveryMarker} />
                </MapContainer>
              </div>
            </div>
            <div className="border-t border-[#E1EAE2] px-4 py-3 sm:px-5">
              <p className="mb-3 text-xs text-[#526456]">Coordenadas selecionadas: <strong className="font-mono text-[#203B27]">{mapPoint[0].toFixed(6)}, {mapPoint[1].toFixed(6)}</strong></p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setMapPickerOpen(false)} className="rounded-lg border border-[#D6E1D7] px-4 py-2.5 text-sm font-medium text-[#38533D] hover:bg-[#F6F9F6]">Cancelar</button>
                <button type="button" onClick={confirmMapPoint} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2c863b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#236D30]"><Check className="h-4 w-4" /> Confirmar ponto de entrega</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
