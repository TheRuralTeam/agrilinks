import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type GeoResult = { lat: string; lon: string; display_name: string };
type GeoProvider = "photon" | "nominatim";

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function inAngola(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -18.5 && lat <= -4.2 && lon >= 11.4 && lon <= 24.2;
}

function normalizeResults(items: any[], provider: GeoProvider): GeoResult[] {
  return items.flatMap((item: any) => {
    const lat = provider === "photon" ? Number(item?.geometry?.coordinates?.[1]) : Number(item?.lat);
    const lon = provider === "photon" ? Number(item?.geometry?.coordinates?.[0]) : Number(item?.lon);
    if (!inAngola(lat, lon)) return [];

    if (provider === "photon") {
      const p = item?.properties ?? {};
      const country = String(p.country ?? "").trim().toLowerCase();
      if (country && country !== "angola") return [];
      const label = [p.name, p.district, p.city, p.state, p.country]
        .filter((part, index, all) => typeof part === "string" && part.trim() && all.indexOf(part) === index)
        .join(", ");
      return [{ lat: String(lat), lon: String(lon), display_name: label || "Localização em Angola" }];
    }

    return [{ lat: String(lat), lon: String(lon), display_name: String(item?.display_name ?? "") }];
  });
}

async function fetchPhoton(query: string, includeLanguage: boolean): Promise<GeoResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  if (includeLanguage) url.searchParams.set("lang", "pt");

  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "AgriLink/1.0 (agrilink.ao)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 180);
    throw new Error(`Photon HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const payload = await response.json();
  return normalizeResults(Array.isArray(payload?.features) ? payload.features : [], "photon");
}

async function searchPhoton(raw: string, queryWithCountry: string): Promise<GeoResult[]> {
  // Try the localized, country-qualified query first, then simpler variants if a provider rejects it.
  const attempts: Array<{ query: string; language: boolean }> = [
    { query: queryWithCountry, language: true },
    { query: raw, language: true },
    { query: raw, language: false },
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const results = await fetchPhoton(attempt.query, attempt.language);
      if (results.length) return results;
    } catch (error) {
      lastError = error;
      console.warn("[geocoding-search] Tentativa Photon falhou:", error);
    }
  }
  if (lastError) throw lastError;
  return [];
}

async function searchNominatim(query: string): Promise<GeoResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "ao");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt");
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "AgriLink/1.0 (agrilink.ao; support@agrilink.ao)" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 180);
    throw new Error(`Nominatim HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const payload = await response.json();
  return normalizeResults(Array.isArray(payload) ? payload : [], "nominatim");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const raw = typeof body?.query === "string" ? body.query.trim().replace(/\s+/g, " ") : "";
    if (raw.length < 3) return respond({ results: [], provider: "none" });
    if (raw.length > 180) return respond({ error: "QUERY_TOO_LONG" }, 400);

    const query = /\bAngola\b/i.test(raw) ? raw : `${raw}, Angola`;

    try {
      const results = await searchPhoton(raw, query);
      if (results.length) return respond({ results, provider: "photon" });
    } catch (error) {
      console.warn("[geocoding-search] Photon indisponível após tentativas:", error);
    }

    try {
      const results = await searchNominatim(query);
      if (results.length) return respond({ results, provider: "nominatim" });
    } catch (error) {
      console.error("[geocoding-search] Nominatim indisponível:", error);
    }

    // A third-party outage should not surface as an Edge Function 502 in the app.
    // An empty result is explicit and lets the UI ask for a more precise address or GPS point.
    return respond({ results: [], provider: "unavailable", degraded: true });
  } catch (error) {
    console.error("[geocoding-search] Pedido inválido:", error);
    return respond({ error: "GEOCODING_REQUEST_FAILED" }, 400);
  }
});