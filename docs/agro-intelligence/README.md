# AgriLink AgroInteligência — foundation plan

Status: isolated foundation branch; **not enabled in production and not merged**.

## Scope of this vertical slice

1. Add an authenticated Supabase Edge Function, `agro-weather`, for a seven-day forecast from Open-Meteo.
2. Restrict coordinates to Angola's approximate geographic bounding box, validate all input and bound upstream latency.
3. Return provider attribution, units, timezone, generation time and forecast fields needed for an agricultural UI.
4. Document the satellite-processing design and the risks in the existing `SatelliteMonitor` without changing current UI or marketplace flows.

## Why weather first

A reliable weather forecast is useful before adding satellite analytics, and can be implemented without storing sensitive farm records or running a geospatial pipeline. Weather forecasts are model outputs; they must not be described as satellite-only predictions.

## Architecture

- Web/mobile client calls Supabase Edge Function using the authenticated Supabase session.
- Edge Function validates coordinates and calls Open-Meteo; it never accepts an arbitrary upstream URL.
- Client displays source, timezone, forecast period and last retrieval time.
- A later iteration may add server-side caching, quota/rate limiting, alert preferences and persisted user-owned farm parcels. These require separate schema/security review and should not be mixed into this first slice.
- Satellite imagery must be served from a server-side integration when credentials or processing APIs are involved. Do not put Copernicus client secrets in the browser.

## Satellite roadmap

1. **Discovery prototype:** Copernicus Data Space Ecosystem STAC catalog; query Sentinel-2 Level-2A by parcel polygon and date window, and filter cloudy scenes.
2. **Processing:** calculate NDVI from red/NIR bands using cloud/shadow masks; retain acquisition date, scene ID, processing version, cloud cover and quality flags.
3. **Storage:** persist parcel geometry and analysis metadata under strict RLS; store generated raster/thumbnail assets separately with controlled access.
4. **Interpretation:** show vegetation-change trends only when enough valid observations exist. NDVI is a vegetation-vigor indicator, not a direct diagnosis of pests, disease, yield or irrigation need.
5. **Validation:** compare satellite indicators with field observations before creating farmer-facing recommendations.

Official sources:
- Open-Meteo forecast API: https://open-meteo.com/en/docs
- Copernicus Data Space API documentation: https://documentation.dataspace.copernicus.eu/APIs.html
- Copernicus Sentinel Hub beginner guide: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/UserGuides/BeginnersGuide.html

## Existing implementation risks found during repository inspection

`src/components/SatelliteMonitor.tsx` currently:
- calls NASA POWER historical daily data, not a short-term forecast;
- hard-codes one coordinate in Angola rather than using a farm's location;
- infers a drought alert from a short streak of low precipitation and labels it "detected by satellite", which is not supported by that data alone;
- classifies farm health using product quantity and labels it NDVI, although no NDVI raster analysis is performed for those records;
- probes image dates client-side and falls back to a heuristic date.

This branch intentionally does not edit that existing component. Replace those claims only in a separately reviewed UI integration after the data contract and UX are agreed.

## Acceptance criteria for this foundation

- Non-POST requests are rejected; CORS preflight is supported.
- Coordinates must be finite and inside the configured Angola bounding box.
- The upstream URL is fixed in code; no user-controlled URL or API key is accepted.
- Upstream timeout, HTTP failure and malformed responses return safe error messages.
- The function uses Supabase JWT verification (default) and introduces no schema migration.
- No frontend route, production environment, existing security branch or existing database object is changed.
