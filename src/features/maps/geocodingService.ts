import { supabase } from '../../integrations/supabase/client'

export interface GeocodingResult {
  lat: string
  lon: string
  display_name: string
}

/**
 * Best-effort geocoding. External providers may be temporarily unavailable;
 * location selection must remain usable through local suggestions or device GPS.
 * Never let a provider's HTTP 4xx/5xx message break the form that requested it.
 */
export async function geocodeAngolaLocation(query: string): Promise<GeocodingResult | null> {
  const clean = query.trim()
  if (clean.length < 3 || !navigator.onLine) return null

  try {
    const { data, error } = await supabase.functions.invoke('geocoding-search', {
      body: { query: clean },
    })

    if (error) {
      console.warn('[AgriLink] Serviço de geocodificação indisponível; será necessário confirmar a localização por GPS ou no mapa.')
      return null
    }

    const results = Array.isArray(data?.results) ? data.results : []
    const first = results.find(
      (item: any) => {
        const lat = Number(item?.lat)
        const lon = Number(item?.lon)
        return Number.isFinite(lat) && Number.isFinite(lon) &&
          lat >= -18.5 && lat <= -4.2 && lon >= 11.4 && lon <= 24.2
      },
    )

    return first ?? null
  } catch (error) {
    console.warn('[AgriLink] Falha de rede na geocodificação; mantém-se a localização textual até confirmação.', error)
    return null
  }
}
