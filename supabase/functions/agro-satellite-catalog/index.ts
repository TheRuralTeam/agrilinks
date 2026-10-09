import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonResponse, handleCors } from "../_shared/http.ts";

const STAC_SEARCH_URL = "https://stac.dataspace.copernicus.eu/v1/search";
const BOUNDS = {
  minLatitude: -18.05,
  maxLatitude: -4.2,
  minLongitude: 11.5,
  maxLongitude: 24.1,
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inAngola(latitude: number, longitude: number): boolean {
  return latitude >= BOUNDS.minLatitude && latitude <= BOUNDS.maxLatitude
    && longitude >= BOUNDS.minLongitude && longitude <= BOUNDS.maxLongitude;
}

function hasAuthenticatedUser(req: Request): boolean {
  // Supabase verifies the JWT at the gateway (verify_jwt = true). The anon key
  // is also a valid JWT, so explicitly require a user token with role=authenticated.
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "="))) as {
      role?: unknown;
      sub?: unknown;
    };
    return payload.role === "authenticated" && typeof payload.sub === "string" && payload.sub.length > 0;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (!hasAuthenticatedUser(req)) {
    return jsonResponse({ error: "Inicie sessão na AgriLink para utilizar este serviço." }, 401);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "O corpo do pedido deve ser um objeto JSON." }, 400);
    }

    const payload = body as Record<string, unknown>;
    const { latitude, longitude } = payload;
    const cloudCoverMax = payload.cloudCoverMax === undefined ? 35 : payload.cloudCoverMax;
    const daysBack = payload.daysBack === undefined ? 90 : payload.daysBack;
    const collection = payload.collection === undefined ? "sentinel-2-l2a" : payload.collection;

    if (!isNumber(latitude) || !isNumber(longitude)) {
      return jsonResponse({ error: "Latitude e longitude numéricas são obrigatórias." }, 400);
    }
    if (!inAngola(latitude, longitude)) {
      return jsonResponse({ error: "Esta versão piloto aceita coordenadas dentro dos limites geográficos aproximados de Angola." }, 422);
    }
    if (collection !== "sentinel-2-l2a" && collection !== "sentinel-1-grd") {
      return jsonResponse({ error: "A coleção deve ser sentinel-2-l2a ou sentinel-1-grd." }, 400);
    }
    if (!isNumber(cloudCoverMax) || cloudCoverMax < 0 || cloudCoverMax > 80) {
      return jsonResponse({ error: "O limite de cobertura de nuvens deve estar entre 0 e 80%." }, 400);
    }
    if (!isNumber(daysBack) || !Number.isInteger(daysBack) || daysBack < 1 || daysBack > 180) {
      return jsonResponse({ error: "O período de pesquisa deve estar entre 1 e 180 dias." }, 400);
    }

    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const datetime = `${start.toISOString().slice(0, 10)}/${now.toISOString().slice(0, 10)}`;
    const radius = 0.05;
    const bbox = [
      Math.max(BOUNDS.minLongitude, longitude - radius),
      Math.max(BOUNDS.minLatitude, latitude - radius),
      Math.min(BOUNDS.maxLongitude, longitude + radius),
      Math.min(BOUNDS.maxLatitude, latitude + radius),
    ];

    const upstream = await fetch(STAC_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/geo+json, application/json" },
      body: JSON.stringify({
        collections: [collection],
        bbox,
        datetime,
        limit: 10,
        sortby: [{ field: "properties.datetime", direction: "desc" }],
        ...(collection === "sentinel-2-l2a" ? { query: { "eo:cloud_cover": { lte: cloudCoverMax } } } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok) {
      console.error("Copernicus STAC search failed with status", upstream.status);
      return jsonResponse({ error: "O catálogo de imagens de satélite está temporariamente indisponível.", provider: "Copernicus Data Space" }, 502);
    }

    const raw: unknown = await upstream.json();
    if (!raw || typeof raw !== "object" || !("features" in raw) || !Array.isArray((raw as { features: unknown }).features)) {
      console.error("Copernicus STAC returned an unexpected response shape");
      return jsonResponse({ error: "Resposta inválida do catálogo de satélites." }, 502);
    }

    const features = (raw as { features: Array<Record<string, unknown>> }).features;
    const scenes = features.slice(0, 10).map((feature) => {
      const properties = (feature.properties && typeof feature.properties === "object")
        ? feature.properties as Record<string, unknown> : {};
      const assets = (feature.assets && typeof feature.assets === "object")
        ? feature.assets as Record<string, { href?: unknown; type?: unknown; title?: unknown }> : {};
      const thumb = assets.thumbnail?.href ?? assets.preview?.href ?? assets.rendered_preview?.href;
      const visual = assets.visual?.href ?? assets.B04?.href;
      return {
        id: typeof feature.id === "string" ? feature.id : null,
        acquiredAt: typeof properties.datetime === "string" ? properties.datetime : null,
        cloudCover: typeof properties["eo:cloud_cover"] === "number" ? properties["eo:cloud_cover"] : null,
        platform: typeof properties.platform === "string" ? properties.platform : "Sentinel-2",
        processingLevel: typeof properties["processing:level"] === "string" ? properties["processing:level"] : "Level-2A",
        thumbnailUrl: typeof thumb === "string" && thumb.startsWith("https://") ? thumb : null,
        previewUrl: typeof visual === "string" && visual.startsWith("https://") ? visual : null,
      };
    });

    return jsonResponse({
      provider: "Copernicus Data Space Ecosystem",
      collection,
      catalogUrl: "https://browser.stac.dataspace.copernicus.eu",
      searchedAt: now.toISOString(),
      location: { latitude, longitude },
      search: { bbox, datetime, cloudCoverMax, daysBack },
      scenes,
      count: scenes.length,
      advisory: scenes.length === 0
        ? "Não foram encontradas cenas que correspondam aos filtros. Tente aumentar o período ou a cobertura de nuvens."
        : "A cobertura de nuvens é uma métrica da cena e não garante que a parcela esteja livre de nuvens. O catálogo fornece metadados; o cálculo NDVI e a máscara de nuvens ao nível do pixel ainda são necessários para avaliar a vegetação.",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("agro-satellite-catalog failed", timedOut ? "upstream timeout" : "unexpected error");
    return jsonResponse({
      error: timedOut
        ? "A pesquisa de imagens demorou demasiado tempo. Tente novamente."
        : "Não foi possível pesquisar imagens de satélite neste momento.",
    }, timedOut ? 504 : 500);
  }
});
