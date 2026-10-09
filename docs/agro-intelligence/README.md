# AgriLink AgroInteligência — foundation plan

Status: isolated foundation branch; **not enabled in production and not merged**.

## Scope of this vertical slice

1. Add an authenticated Supabase Edge Function, `agro-weather`, for a seven-day forecast through the licensed Open-Meteo customer API.
2. Add an authenticated `agro-satellite-catalog` function to discover Sentinel-2 Level-2A scenes through the Copernicus STAC catalog.
3. Add `/agro-inteligencia` weather and `/agro-satelite` map-based catalog pages; link them from Market Data.
4. Restrict coordinates to Angola's approximate geographic bounding box, validate input, bound upstream latency and return safe errors.
5. Document satellite processing, commercial API credentials and the risks in the existing `SatelliteMonitor` without changing that component.

## Why weather first

A reliable weather forecast is useful before adding satellite analytics, and can be implemented without storing sensitive farm records or running a geospatial pipeline. Weather forecasts are model outputs; they must not be described as satellite-only predictions.

## Architecture

- Web/mobile client calls Supabase Edge Functions using the authenticated Supabase session.
- Weather uses `https://customer-api.open-meteo.com/v1/forecast` and requires the Supabase secret `OPEN_METEO_API_KEY`. The free public endpoint is not appropriate to assume for a commercial marketplace. Do not enable the weather feature in a commercial environment until the correct plan, key and terms are confirmed.
- Satellite catalog search uses the public Copernicus Data Space STAC endpoint; it returns scene metadata and available preview assets, not computed NDVI.
- Both functions validate coordinates, use fixed upstream URLs and never accept an arbitrary URL from clients.
- Client displays source, timezone, forecast period and last retrieval time.
- A later iteration may add server-side caching, quota/rate limiting, alert preferences and persisted user-owned farm parcels. These require separate schema/security review and should not be mixed into this first slice.
- Satellite imagery must be served from a server-side integration when credentials or processing APIs are involved. Do not put Copernicus client secrets in the browser.

## Deployment prerequisites

1. Confirm the appropriate Open-Meteo commercial subscription and API key.
2. Configure `OPEN_METEO_API_KEY` as a Supabase Edge Function secret in the target development/preview project, not in frontend code or Git.
3. Deploy only the two new Edge Functions to a non-production Supabase environment and test authenticated calls, CORS, timeouts and provider errors.
4. Confirm the Copernicus STAC endpoint, returned asset URLs and commercial reuse/attribution conditions before exposing previews broadly.
5. Do not run database migrations for this slice; it does not persist farm polygons or satellite assets.

## Satellite roadmap

1. **Discovery prototype:** Copernicus Data Space Ecosystem STAC catalog; query Sentinel-2 Level-2A by parcel polygon and date window, and filter cloudy scenes.
2. **Processing:** calculate NDVI from red/NIR bands using cloud/shadow masks; retain acquisition date, scene ID, processing version, cloud cover and quality flags.
3. **Storage:** persist parcel geometry and analysis metadata under strict RLS; store generated raster/thumbnail assets separately with controlled access.
4. **Interpretation:** show vegetation-change trends only when enough valid observations exist. NDVI is a vegetation-vigor indicator, not a direct diagnosis of pests, disease, yield or irrigation need.
5. **Validation:** compare satellite indicators with field observations before creating farmer-facing recommendations.

Official sources:
- Open-Meteo forecast API and commercial access: https://open-meteo.com/en/docs
- Open-Meteo API terms: https://open-meteo.com/en/features#terms
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
