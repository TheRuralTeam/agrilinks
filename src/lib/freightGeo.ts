export type FreightCoordinate = [latitude: number, longitude: number];

export interface FreightRoute {
  coordinates: FreightCoordinate[];
  distanceKm: number;
  durationMinutes: number;
}

export interface DestinationWeather {
  date: string;
  description: string;
  maximumTemperature: number | null;
  minimumTemperature: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
}

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
  }>;
}

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

export async function calculateFreightRoute(
  origin: FreightCoordinate,
  destination: FreightCoordinate,
  signal?: AbortSignal
): Promise<FreightRoute> {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}`
  );
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const response = await fetch(url, { signal: signal ?? AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Não foi possível calcular a rota neste momento.');

  const payload = (await response.json()) as OsrmResponse;
  const route = payload.routes?.[0];
  const geometry = route?.geometry?.coordinates;
  if (payload.code !== 'Ok' || !route || !geometry?.length) {
    throw new Error('Não foi encontrada uma rota por estrada para estes pontos.');
  }

  return {
    coordinates: geometry.map(([longitude, latitude]) => [latitude, longitude]),
    distanceKm: (route.distance ?? 0) / 1000,
    durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
  };
}

export function describeWeatherCode(code: number | undefined): string {
  if (code == null) return 'Condição indisponível';
  if (code === 0) return 'Céu limpo';
  if (code <= 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Nevoeiro';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Chuvisco';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Chuva';
  if ([71, 73, 75, 77].includes(code)) return 'Neve';
  if ([80, 81, 82].includes(code)) return 'Aguaceiros';
  if ([85, 86].includes(code)) return 'Aguaceiros de neve';
  if ([95, 96, 99].includes(code)) return 'Trovoada';
  return 'Condição indisponível';
}

export async function fetchDestinationWeather(
  [latitude, longitude]: FreightCoordinate,
  pickupDate?: string | null,
  signal?: AbortSignal
): Promise<DestinationWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max'
  );
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'Africa/Luanda');

  const response = await fetch(url, { signal: signal ?? AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Não foi possível carregar a previsão do destino.');

  const payload = (await response.json()) as OpenMeteoResponse;
  const dates = payload.daily?.time ?? [];
  const dayIndex = pickupDate ? dates.indexOf(pickupDate) : 0;

  if (dayIndex < 0) throw new Error('Previsão disponível apenas para os próximos 7 dias.');
  if (!dates[dayIndex]) throw new Error('Previsão do destino indisponível.');

  return {
    date: dates[dayIndex],
    description: describeWeatherCode(payload.daily?.weather_code?.[dayIndex]),
    maximumTemperature: payload.daily?.temperature_2m_max?.[dayIndex] ?? null,
    minimumTemperature: payload.daily?.temperature_2m_min?.[dayIndex] ?? null,
    precipitationProbability: payload.daily?.precipitation_probability_max?.[dayIndex] ?? null,
    precipitation: payload.daily?.precipitation_sum?.[dayIndex] ?? null,
    windSpeed: payload.daily?.wind_speed_10m_max?.[dayIndex] ?? null,
  };
}
