import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonResponse, handleCors } from "../_shared/http.ts";

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATS_URL = "https://sh.dataspace.copernicus.eu/statistics/v1";
const BOUNDS = { minLat: -18.05, maxLat: -4.2, minLon: 11.5, maxLon: 24.1 };
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [{ id: "ndvi", bands: 1, sampleType: "FLOAT32" }, { id: "dataMask", bands: 1 }]
  };
}
function evaluatePixel(s) {
  var denominator = s.B08 + s.B04;
  var cls = s.SCL;
  var invalid = cls === 1 || cls === 2 || cls === 3 || cls === 6 || cls === 7 ||
    cls === 8 || cls === 9 || cls === 10 || cls === 11;
  var valid = s.dataMask === 1 && denominator > 0 && !invalid;
  var ndvi = denominator > 0 ? (s.B08 - s.B04) / denominator : 0;
  return { ndvi: [ndvi], dataMask: [valid ? 1 : 0] };
}`;

let tokenCache: { token: string; expiresAt: number } | null = null;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function authenticated(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, "=")));
    return payload.role === "authenticated" && typeof payload.sub === "string" && payload.sub.length > 0;
  } catch { return false; }
}
async function accessToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("PROVIDER_AUTH_FAILED");
  const data = await response.json();
  if (typeof data?.access_token !== "string") throw new Error("PROVIDER_AUTH_INVALID");
  tokenCache = { token: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000 };
  return tokenCache.token;
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (!authenticated(req)) return jsonResponse({ error: "Inicie sessão na AgriLink para analisar a vegetação." }, 401);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonResponse({ error: "O corpo deve ser um objeto JSON." }, 400);
    const { latitude, longitude } = body as Record<string, unknown>;
    const daysBack = (body as Record<string, unknown>).daysBack ?? 90;
    if (!isNum(latitude) || !isNum(longitude)) return jsonResponse({ error: "Latitude e longitude numéricas são obrigatórias." }, 400);
    if (latitude < BOUNDS.minLat || latitude > BOUNDS.maxLat || longitude < BOUNDS.minLon || longitude > BOUNDS.maxLon) {
      return jsonResponse({ error: "Esta versão piloto aceita coordenadas dentro dos limites geográficos aproximados de Angola." }, 422);
    }
    if (!isNum(daysBack) || !Number.isInteger(daysBack) || daysBack < 30 || daysBack > 180) {
      return jsonResponse({ error: "O período de análise deve estar entre 30 e 180 dias." }, 400);
    }

    const clientId = Deno.env.get("CDSE_CLIENT_ID");
    const clientSecret = Deno.env.get("CDSE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return jsonResponse({
      error: "A análise NDVI ainda não está configurada neste ambiente.",
      setupRequired: "Configure CDSE_CLIENT_ID e CDSE_CLIENT_SECRET como segredos da função Supabase.",
    }, 503);

    const now = new Date();
    const from = new Date(now.getTime() - daysBack * 86_400_000).toISOString();
    const to = now.toISOString();
    const radius = 0.005;
    const bbox = [
      Math.max(BOUNDS.minLon, longitude - radius),
      Math.max(BOUNDS.minLat, latitude - radius),
      Math.min(BOUNDS.maxLon, longitude + radius),
      Math.min(BOUNDS.maxLat, latitude + radius),
    ];
    const bearer = await accessToken(clientId, clientSecret);
    const upstream = await fetch(STATS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        input: {
          bounds: { bbox, properties: { crs: CRS84 } },
          data: [{ type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC" } }],
        },
        aggregation: {
          timeRange: { from, to },
          aggregationInterval: { of: "P10D" },
          lastIntervalBehavior: "SHORTEN",
          evalscript: EVALSCRIPT,
          resx: 10,
          resy: 10,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!upstream.ok) {
      console.error("Copernicus NDVI statistics failed with status", upstream.status);
      if ([401, 403].includes(upstream.status)) tokenCache = null;
      return jsonResponse({
        error: upstream.status === 429
          ? "O serviço de satélite atingiu temporariamente o limite de pedidos. Aguarde e tente novamente."
          : "O serviço de análise de satélite está temporariamente indisponível.",
      }, upstream.status === 429 ? 429 : 502);
    }

    const raw = await upstream.json();
    if (!raw || !Array.isArray(raw.data)) return jsonResponse({ error: "Resposta inválida do serviço de análise." }, 502);
    const intervals = raw.data.map((item: Record<string, any>) => {
      const stats = item?.outputs?.ndvi?.bands?.B0?.stats ?? {};
      const valid = isNum(stats.sampleCount) ? stats.sampleCount : 0;
      const masked = isNum(stats.noDataCount) ? stats.noDataCount : 0;
      const total = valid + masked;
      return {
        from: typeof item?.interval?.from === "string" ? item.interval.from : null,
        to: typeof item?.interval?.to === "string" ? item.interval.to : null,
        mean: isNum(stats.mean) ? stats.mean : null,
        min: isNum(stats.min) ? stats.min : null,
        max: isNum(stats.max) ? stats.max : null,
        standardDeviation: isNum(stats.stDev) ? stats.stDev : null,
        validPixelCount: valid,
        maskedOrNoDataPixelCount: masked,
        validPixelPercent: total > 0 ? Math.round(valid / total * 1000) / 10 : null,
      };
    });
    const validIntervals = intervals.filter((x: Record<string, unknown>) => x.mean !== null && Number(x.validPixelCount) > 0);
    return jsonResponse({
      provider: "Copernicus Sentinel Hub Statistical API",
      collection: "Sentinel-2 Level-2A",
      index: "NDVI",
      resolutionMeters: 10,
      aggregationDays: 10,
      period: { from, to, daysBack },
      area: {
        type: "point-centred bounding box",
        bbox,
        approximateWidthMeters: Math.round(radius * 2 * 111_000),
        note: "Área aproximada à volta do ponto escolhido; não representa o limite cadastral da exploração.",
      },
      fetchedAt: now.toISOString(),
      quality: { validIntervals: validIntervals.length, returnedIntervals: intervals.length },
      intervals,
      advisory: validIntervals.length === 0
        ? "Não há observações válidas suficientes. Tente ampliar o período ou selecionar outra localização."
        : "NDVI é um indicador espectral, não um diagnóstico de doença, pragas, produtividade ou necessidade de rega. A área é centrada no ponto e pode incluir terrenos vizinhos. Confirme alterações importantes no terreno.",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    if (error instanceof Error && error.message.startsWith("PROVIDER_AUTH")) {
      return jsonResponse({ error: "Não foi possível autenticar no serviço Copernicus. Verifique as credenciais no Supabase." }, 502);
    }
    console.error("agro-ndvi failed", timedOut ? "upstream timeout" : "unexpected error");
    return jsonResponse({ error: timedOut ? "A análise demorou demasiado tempo. Tente novamente." : "Não foi possível calcular o NDVI neste momento." }, timedOut ? 504 : 500);
  }
});
