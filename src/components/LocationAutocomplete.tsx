import React, { useEffect, useMemo, useState } from 'react'
import { Crosshair, History, LoaderCircle, MapPin, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getPreferredDeliveryLocation } from '../features/products/deliveryLocationPreference'
import { getProvincesForCountry } from '../data/country-locations'
import { geocodeAngolaLocation } from '../features/maps/geocodingService'

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

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-AO').trim()

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
        const { data, error } = await supabase.functions.invoke('geocoding-search', {
          body: { query },
        })
        if (error) throw error
        const results = Array.isArray(data?.results) ? data.results : []
        const valid = results.flatMap((item: any) => {
          const latitude = Number(item?.lat)
          const longitude = Number(item?.lon)
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              latitude < -18.5 || latitude > -4.2 || longitude < 11.4 || longitude > 24.2) return []
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
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -18.5 || latitude > -4.2 || longitude < 11.4 || longitude > 24.2) {
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
          latitude < -18.5 || latitude > -4.2 || longitude < 11.4 || longitude > 24.2) return
      onSelectLocation({ label: result.display_name || label, latitude, longitude })
    }).catch((error) => {
      console.warn('[AgriLink] Não foi possível localizar as coordenadas deste texto.', error)
    })
  }

  const showList = focused && (geocodedSuggestions.length > 0 || localSuggestions.length > 0 || Boolean(savedLocation) || searchingPlaces)

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#758A79] pointer-events-none"
        />
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
          className={`w-full pl-10 pr-20 ${inputClassName}`}
          style={inputStyle}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchingPlaces && <LoaderCircle aria-label="A pesquisar locais" className="h-4 w-4 animate-spin text-[#2c863b]" />}
          <button type="button" disabled={disabled || locatingGps} onClick={useCurrentGps} aria-label="Usar a minha localização GPS" title="Usar a minha localização GPS" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#2c863b] hover:bg-[#F2FAF3] disabled:opacity-50">
            {locatingGps ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {gpsMessage && <p role="status" className="mt-1 text-[11px] leading-4 text-[#9A5B00]">{gpsMessage}</p>}
      {showList && (
        <div
          role="listbox"
          aria-label="Sugestões de localização em Angola"
          className="absolute z-[80] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[#DCE8DD] bg-white py-1 shadow-xl"
        >
          {savedLocation && normalize(savedLocation) !== normalize(value) && (
            <button
              key="saved-delivery-location"
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseTextLocation(savedLocation)}
              className="flex w-full items-start gap-2 border-b border-[#E5EDE6] px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]"
            >
              <History aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#2c863b]" />
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#2c863b]">Usar localização anterior</span>
                <span className="block break-words">{savedLocation}</span>
              </span>
            </button>
          )}
          {geocodedSuggestions.map((item) => (
            <button
              key={`geo-${item.label}`}
              type="button"
              role="option"
              aria-selected={normalize(value) === normalize(item.label)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseGeocoded(item)}
              className="flex w-full items-start gap-2 border-b border-[#E5EDE6] px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]"
            >
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#2c863b]" />
              <span className="min-w-0">
                <span className="block break-words">{item.label}</span>
                <span className="mt-0.5 block text-[10px] text-[#2c863b]">Localização identificada · GPS disponível</span>
              </span>
            </button>
          ))}
          {localSuggestions.map((item) => (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseTextLocation(item.label)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]"
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#2c863b]" />
              <span>{item.label}</span>
            </button>
          ))}
          {geocodingUnavailable && (
            <p className="m-0 px-3 py-2 text-[11px] text-[#758A79]">
              Pesquisa GPS indisponível neste momento. Pode manter o endereço escrito e confirmar as coordenadas no mapa antes da logística.
            </p>
          )}
        </div>
      )}
      <p className="mt-1.5 text-[11px] leading-4 text-[#758A79]">
        Pesquise um endereço para obter coordenadas reais. Se não houver resultado, pode manter o texto; a rota terá de ser confirmada no mapa antes do transporte.
      </p>
    </div>
  )
}
