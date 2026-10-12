import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type GeoResult = { lat: string; lon: string; display_name: string };

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function inAngola(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -18.5 && lat <= -4.2 && lon >= 11.4 && lon <= 24.2;
}

function normalizeResults(items: any[], provider: "photon" | "nominatim"): GeoResult[] {
  return items.flatMap((item: any) => {
    const lat = provider === "photon" ? Number(item?.geometry?.coordinates?.[1]) : Number(item?.lat);
    const lon = provider === "photon" ? Number(item?.geometry?.coordinates?.[0]) : Number(item?.lon);
    if (!inAngola(lat, lon)) return [];

    if (provider === "photon") {
      const p = item?.properties ?? {};
      const country = String(p.country ?? "").toLowerCase();
      if (country && country !== "angola") return [];
      const label = [p.name, p.district, p.city, p.state, p.country]
        .filter((part, index, all) => typeof part === "string" && part.trim() && all.indexOf(part) === index)
        .join(", ");
      return [{ lat: String(lat), lon: String(lon), display_name: label || "Localização em Angola" }];
    }

    return [{ lat: String(lat), lon: String(lon), display_name: String(item?.display_name ?? "") }];
  });
}

async function searchPhoton(query: string): Promise<GeoResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "pt");
  url.searchParams.set("limit", "8");
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "AgriLink/1.0" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
  const payload = await response.json();
  return normalizeResults(Array.isArray(payload?.features) ? payload.features : [], "photon");
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
    headers: { "Accept": "application/json", "User-Agent": "AgriLink/1.0 (Angola agricultural marketplace)" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const payload = await response.json();
  return normalizeResults(Array.isArray(payload) ? payload : [], "nominatim");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const raw = typeof body?.query === "string" ? body.query.trim() : "";
    if (raw.length < 3) return respond({ results: [] });
    if (raw.length > 180) return respond({ error: "QUERY_TOO_LONG" }, 400);

    const query = /\bAngola\b/i.test(raw) ? raw : `${raw}, Angola`;

    // Photon is primary because Nominatim is returning HTTP 403 from Supabase Edge.
    try {
      const results = await searchPhoton(query);
      if (results.length) return respond({ results, provider: "photon" });
    } catch (error) {
      console.warn("[geocoding-search] Photon indisponível:", error);
    }

    try {
      const results = await searchNominatim(query);
      return respond({ results, provider: "nominatim" });
    } catch (error) {
      console.error("[geocoding-search] Os provedores geográficos falharam:", error);
      return respond({ error: "GEOCODING_PROVIDER_UNAVAILABLE", results: [] }, 502);
    }
  } catch (error) {
    console.error("[geocoding-search] Pedido inválido:", error);
    return respond({ error: "GEOCODING_REQUEST_FAILED" }, 400);
  }
});