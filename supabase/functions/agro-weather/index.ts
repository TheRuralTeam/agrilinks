import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { jsonResponse, handleCors } from "../_shared/http.ts";

const OPEN_METEO_URL = "https://customer-api.open-meteo.com/v1/forecast";

// Approximate mainland Angola bounding box. This is input validation, not a
// claim that every point inside the rectangle is land or agricultural land.
const ANGOLA_BOUNDS = {
  minLatitude: -18.05,
  maxLatitude: -4.2,
  minLongitude: 11.5,
  maxLongitude: 24.1,
};

const CURRENT_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
].join(",");

const HOURLY_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "wind_speed_10m",
].join(",");

const DAILY_VARIABLES = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "et0_fao_evapotranspiration",
].join(",");

function validCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWithinAngola(latitude: number, longitude: number): boolean {
  return latitude >= ANGOLA_BOUNDS.minLatitude
    && latitude <= ANGOLA_BOUNDS.maxLatitude
    && longitude >= ANGOLA_BOUNDS.minLongitude
    && longitude <= ANGOLA_BOUNDS.maxLongitude;
}


serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Validate the session against Supabase Auth rather than trusting decoded JWT claims.
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!token) {
    return jsonResponse({ error: "Inicie sessão na AgriLink para utilizar este serviço." }, 401);
  }
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("Supabase environment is not configured for agro-weather.");
    return jsonResponse({ error: "O serviço meteorológico está temporariamente indisponível." }, 503);
  }

  try {
    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Inicie sessão na AgriLink para utilizar este serviço." }, 401);
    }

    // Shared, atomic database rate limiter. The RPC is granted only to service_role.
    // Fail closed so a database/rate-limit outage cannot become unlimited provider usage.
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error: rateLimitError } = await serviceClient.rpc("consume_api_rate_limit", {
      p_bucket_key: `agro-weather:user:${authData.user.id}`,
      p_window_seconds: 900,
      p_max_requests: 30,
    });
    if (rateLimitError || typeof allowed !== "boolean") {
      console.error("Could not consume agro-weather rate limit:", rateLimitError?.message ?? "invalid response");
      return jsonResponse({ error: "Não foi possível validar o limite de pedidos meteorológicos. Tente novamente mais tarde." }, 503);
    }
    if (!allowed) {
      return jsonResponse({ error: "Atingiu o limite de consultas meteorológicas. Tente novamente dentro de 15 minutos." }, 429);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "O corpo do pedido deve ser um objeto JSON." }, 400);
    }

    const { latitude, longitude } = body as Record<string, unknown>;
    if (!validCoordinate(latitude) || !validCoordinate(longitude)) {
      return jsonResponse({ error: "Latitude e longitude numéricas são obrigatórias." }, 400);
    }
    if (!isWithinAngola(latitude, longitude)) {
      return jsonResponse({
        error: "Esta versão piloto aceita coordenadas dentro da área geográfica de Angola.",
        bounds: ANGOLA_BOUNDS,
      }, 422);
    }

    const apiKey = Deno.env.get("OPEN_METEO_API_KEY");
    if (!apiKey) {
      return jsonResponse({
        error: "O serviço meteorológico ainda não está configurado para utilização comercial.",
        setupRequired: "Configure o segredo OPEN_METEO_API_KEY no ambiente Supabase antes de ativar esta função.",
      }, 503);
    }

    const url = new URL(OPEN_METEO_URL);
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      apikey: apiKey,
      current: CURRENT_VARIABLES,
      hourly: HOURLY_VARIABLES,
      daily: DAILY_VARIABLES,
      forecast_days: "7",
      timezone: "Africa/Luanda",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
    }).toString();

    const upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      // Do not relay upstream bodies or internal details to clients.
      console.error("Open-Meteo request failed with status", upstream.status);
      return jsonResponse({
        error: "O serviço meteorológico está temporariamente indisponível.",
        provider: "Open-Meteo",
      }, 502);
    }

    const forecast: unknown = await upstream.json();
    if (
      !forecast || typeof forecast !== "object"
      || !("current" in forecast) || !("hourly" in forecast) || !("daily" in forecast)
    ) {
      console.error("Open-Meteo returned an unexpected response shape");
      return jsonResponse({ error: "Resposta meteorológica inválida." }, 502);
    }

    return jsonResponse({
      provider: "Open-Meteo",
      attribution: "Weather data by Open-Meteo (https://open-meteo.com/)",
      fetchedAt: new Date().toISOString(),
      location: { latitude, longitude },
      forecast,
      advisory: "Previsões são estimativas de modelos meteorológicos; confirme alertas críticos com fontes oficiais locais.",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("agro-weather request failed", timedOut ? "upstream timeout" : "unexpected error");
    return jsonResponse({
      error: timedOut
        ? "O serviço meteorológico demorou demasiado tempo a responder."
        : "Não foi possível obter a previsão meteorológica neste momento.",
    }, timedOut ? 504 : 500);
  }
});
