# AgriLink AgroInteligência — foundation plan

Status: isolated foundation branch; **not enabled in production and not merged**.

## Scope of this vertical slice

1. Add an authenticated Supabase Edge Function, `agro-weather`, for a seven-day forecast through the licensed Open-Meteo customer API.
2. Add an authenticated `agro-satellite-catalog` function to discover Sentinel-2 Level-2A optical scenes and Sentinel-1 GRD radar scenes through the Copernicus STAC catalog.
3. Add `/agro-inteligencia` weather and `/agro-satelite` map-based catalog pages; link them from Market Data.
4. Restrict coordinates to Angola's approximate geographic bounding box, validate input, bound upstream latency and return safe errors.
5. Document satellite processing, commercial API credentials and the risks in the existing `SatelliteMonitor` without changing that component.

## Why weather first

A reliable weather forecast is useful before adding satellite analytics, and can be implemented without storing sensitive farm records or running a geospatial pipeline. Weather forecasts are model outputs; they must not be described as satellite-only predictions.

## Architecture

- Web/mobile client calls Supabase Edge Functions using the authenticated Supabase session. Both new endpoints additionally inspect the gateway-verified JWT claims and reject the Supabase anon role; the pages are protected routes.
- Weather uses `https://customer-api.open-meteo.com/v1/forecast` and requires the Supabase secret `OPEN_METEO_API_KEY`. The free public endpoint is not appropriate to assume for a commercial marketplace. Do not enable the weather feature in a commercial environment until the correct plan, key and terms are confirmed.
- Satellite catalog search uses the public Copernicus Data Space STAC endpoint; it returns Sentinel-2 optical or Sentinel-1 radar scene metadata and available preview assets, not computed NDVI.
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

## Multi-source roadmap (incremental, with source-specific licensing)

| Capability | Candidate source | Purpose | Guardrail |
|---|---|---|---|
| Short-term weather | Open-Meteo customer API (licensed) | Temperature, rainfall probability, wind, ET₀ | Commercial key and quota controls required |
| Optical crop observations | Copernicus Sentinel-2 Level-2A | NDVI/NDMI time series and crop vigor indicators | Pixel-level cloud/shadow masking; no diagnosis from NDVI alone |
| Radar observations | Copernicus Sentinel-1 GRD | Flooding and surface-change signals through clouds | Calibrated processing; radar backscatter is not a direct soil-moisture reading |
| Historical climate | NASA POWER | Long-term temperature and climate normals | Clearly label historical/reanalysis data, not forecast |
| Rainfall anomalies | NASA GPM IMERG or CHIRPS | Regional rainfall and drought context | Verify temporal resolution, latency, coverage and reuse terms |
| Elevation and terrain | Copernicus DEM | Slope, drainage context and terrain | Validate resolution and local accuracy |
| Soil context | ISRIC SoilGrids / FAO resources | Broad soil-property context | Modelled/global layers are not a substitute for soil tests |
| Base maps and parcel boundaries | OpenStreetMap plus user-drawn parcel polygons | Navigation and farm boundaries | Attribute providers; verify tile/API terms and protect private parcel geometry |

Do not enable every source at once. Implement source adapters with common metadata fields (provider, acquisition/forecast time, resolution, units, quality flags, license and processing version), then add sources after a focused test and licensing review. Esri imagery services are not assumed free for a revenue-generating marketplace; obtain the appropriate license before using them as a production basemap.

## Satellite roadmap

1. **Discovery prototype:** Copernicus Data Space Ecosystem STAC catalog; query Sentinel-2 Level-2A optical and Sentinel-1 GRD radar scenes by area and date window. The current pilot uses a small bounding box around a selected point; parcel polygons are a later phase.
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
