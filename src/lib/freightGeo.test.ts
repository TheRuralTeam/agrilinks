import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateFreightRoute, fetchDestinationWeather } from './freightGeo';

afterEach(() => vi.unstubAllGlobals());

describe('freightGeo', () => {
  it('converts OSRM coordinates into Leaflet latitude-longitude pairs', async () => {
    let requestedUrl = '';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              distance: 14_970,
              duration: 1_336,
              geometry: {
                coordinates: [
                  [13.24, -8.81],
                  [13.22, -8.89],
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    const route = await calculateFreightRoute(
      [-8.81, 13.24],
      [-8.89, 13.22],
      new AbortController().signal
    );

    expect(requestedUrl).toContain('/13.24,-8.81;13.22,-8.89?');
    expect(route.coordinates).toEqual([
      [-8.81, 13.24],
      [-8.89, 13.22],
    ]);
    expect(route.distanceKm).toBe(14.97);
    expect(route.durationMinutes).toBe(22);
  });

  it('returns the forecast for the requested pickup date', async () => {
    let requestedUrl = '';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return {
        ok: true,
        json: async () => ({
          daily: {
            time: ['2026-10-03', '2026-10-04'],
            weather_code: [1, 63],
            temperature_2m_max: [29, 27],
            temperature_2m_min: [19, 18],
            precipitation_probability_max: [5, 85],
            precipitation_sum: [0, 12.4],
            wind_speed_10m_max: [13, 20],
          },
        }),
      } as Response;
    });

    const weather = await fetchDestinationWeather(
      [-8.89, 13.22],
      '2026-10-04',
      new AbortController().signal
    );

    expect(new URL(requestedUrl).searchParams.get('daily')).toContain('weather_code');
    expect(weather).toEqual({
      date: '2026-10-04',
      description: 'Chuva',
      maximumTemperature: 27,
      minimumTemperature: 18,
      precipitationProbability: 85,
      precipitation: 12.4,
      windSpeed: 20,
    });
  });

  it('does not silently show another day when the pickup date is outside the forecast', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        ({
          ok: true,
          json: async () => ({ daily: { time: ['2026-10-03'] } }),
        }) as Response
    );

    await expect(
      fetchDestinationWeather([-8.89, 13.22], '2026-10-20', new AbortController().signal)
    ).rejects.toThrow('Previsão disponível apenas para os próximos 7 dias.');
  });
});
