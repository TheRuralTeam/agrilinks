import { supabase } from '../../integrations/supabase/client'

export interface GeocodingResult {
  lat: string
  lon: string
  display_name: string
}

export async function geocodeAngolaLocation(query: string): Promise<GeocodingResult | null> {
  const clean = query.trim()
  if (clean.length < 3) return null

  const { data, error } = await supabase.functions.invoke('geocoding-search', {
    body: { query: clean },
  })

  if (error) throw error
  const results = Array.isArray(data?.results) ? data.results : []
  const first = results.find(
    (item: any) =>
      typeof item?.lat === 'string' &&
      typeof item?.lon === 'string' &&
      Number.isFinite(Number(item.lat)) &&
      Number.isFinite(Number(item.lon)),
  )

  return first ?? null
}
