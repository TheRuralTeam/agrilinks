import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (query.length < 3) return respond({ results: [] });
    if (query.length > 180) return respond({ error: "QUERY_TOO_LONG" }, 400);

    // Contextualizar a pesquisa em Angola sem inventar coordenadas.
    const searchQuery = /\bAngola\b/i.test(query) ? query : `${query}, Angola`;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "ao");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "pt");

    const upstream = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "AgriLink/1.0 (Angola agricultural marketplace)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      console.error("[geocoding-search] Provedor respondeu com estado", upstream.status);
      return respond({ error: "GEOCODING_PROVIDER_UNAVAILABLE" }, 502);
    }

    const payload = await upstream.json();
    if (!Array.isArray(payload)) return respond({ results: [] });

    const results = payload.flatMap((item: any) => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      if (lat < -18.5 || lat > -4.2 || lon < 11.4 || lon > 24.2) return [];
      return [{
        lat: String(lat),
        lon: String(lon),
        display_name: String(item?.display_name ?? ""),
      }];
    });

    return respond({ results });
  } catch (error) {
    console.error("[geocoding-search] Falha na pesquisa geográfica:", error);
    return respond({ error: "GEOCODING_REQUEST_FAILED" }, 502);
  }
});
