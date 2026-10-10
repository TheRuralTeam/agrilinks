import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudRain, Droplets, RefreshCw, Thermometer, Wind, AlertTriangle, CloudSun } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

type Coordinates = { latitude: number; longitude: number } | null;

type WeatherResponse = {
  provider?: string;
  attribution?: string;
  fetchedAt?: string;
  advisory?: string;
  forecast?: {
    current?: {
      time?: string;
      temperature_2m?: number | null;
      relative_humidity_2m?: number | null;
      precipitation?: number | null;
      rain?: number | null;
      wind_speed_10m?: number | null;
      cloud_cover?: number | null;
    };
    daily?: {
      time?: string[];
      precipitation_sum?: (number | null)[];
      precipitation_probability_max?: (number | null)[];
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      wind_speed_10m_max?: (number | null)[];
    };
  };
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(20,35,25,0.10)',
  borderRadius: 16,
  boxShadow: '0 10px 32px rgba(0,0,0,0.14)',
  color: '#17221a',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const metricStyle: React.CSSProperties = {
  background: 'rgba(45,125,58,0.07)',
  borderRadius: 10,
  padding: '9px 10px',
  minWidth: 0,
};

function display(value: number | null | undefined, suffix: string, decimals = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(decimals)}${suffix}` : '—';
}

function localDate(value?: string) {
  if (!value) return 'hora não indicada';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-AO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function MapWeatherPanel({
  coordinates,
  locationLabel,
  isOnline,
}: {
  coordinates: Coordinates;
  locationLabel: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRequestedAt, setLastRequestedAt] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  const loadWeather = useCallback(async () => {
    if (latitude == null || longitude == null || !isOnline) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('agro-weather', {
        body: { latitude, longitude },
      });
      // Ignore a response for an older location or a request superseded by a refresh.
      if (requestId !== requestSequence.current) return;
      if (invokeError) throw invokeError;
      if (result?.error) throw new Error(String(result.error));
      if (!result?.forecast?.current || !result?.forecast?.daily) {
        throw new Error('A fonte não devolveu dados meteorológicos completos.');
      }
      setData(result as WeatherResponse);
      setLastRequestedAt(new Date().toISOString());
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a meteorologia.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [latitude, longitude, isOnline]);

  useEffect(() => {
    // Invalidate in-flight requests when the location changes or this panel unmounts.
    requestSequence.current += 1;
    setData(null);
    setError('');
    setLoading(false);
    setLastRequestedAt(null);
    if (!coordinates || !isOnline) return;
    void loadWeather();
    const refresh = window.setInterval(() => void loadWeather(), 15 * 60 * 1000);
    return () => {
      window.clearInterval(refresh);
      requestSequence.current += 1;
    };
  }, [coordinates?.latitude, coordinates?.longitude, isOnline, loadWeather]);

  const current = data?.forecast?.current;
  const daily = data?.forecast?.daily;
  const dayIndexes = [0, 1, 2].filter((index) => Boolean(daily?.time?.[index]));

  return (
    <section
      aria-label="Condições meteorológicas da localização seleccionada"
      style={{ ...cardStyle, position: 'absolute', zIndex: 35, top: 76, right: 16, width: 292, maxWidth: 'calc(100vw - 24px)', overflow: 'hidden' }}
    >
      <header style={{ padding: '13px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid rgba(20,35,25,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: '#eaf5eb', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CloudSun size={19} color="#28763a" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Clima no mapa</div>
            <div style={{ fontSize: 10, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locationLabel}</div>
          </div>
        </div>
        <button type="button" onClick={() => void loadWeather()} disabled={!coordinates || !isOnline || loading} aria-label="Actualizar meteorologia" title="Actualizar dados" style={{ border: 0, background: 'transparent', padding: 5, cursor: coordinates && isOnline && !loading ? 'pointer' : 'default', opacity: coordinates && isOnline ? 1 : 0.4 }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div style={{ padding: 13 }}>
        {!coordinates ? (
          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.72 }}>Activa a localização ou selecciona um produto agrícola com coordenadas para consultar as condições da zona.</div>
        ) : !isOnline ? (
          <div style={{ fontSize: 12, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}><AlertTriangle size={16} /> Sem ligação à Internet. Os dados meteorológicos não podem ser actualizados agora.</div>
        ) : error && !data ? (
          <div style={{ fontSize: 11, lineHeight: 1.5, color: '#9a3412' }}>
            {error}
            <div style={{ marginTop: 7, color: '#6b625a' }}>A previsão só fica disponível quando a função meteorológica e a chave do fornecedor estiverem configuradas.</div>
            <button type="button" onClick={() => void loadWeather()} style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #ded8cf', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
          </div>
        ) : loading && !data ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>A consultar a fonte meteorológica…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ ...metricStyle, gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Thermometer size={19} color="#c45a25" /><span style={{ fontSize: 12, fontWeight: 700 }}>Temperatura</span></div>
                <strong style={{ fontSize: 23 }}>{display(current?.temperature_2m, '°C')}</strong>
              </div>
              <div style={metricStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, opacity: 0.7 }}><Droplets size={13} /> Humidade</div><strong style={{ fontSize: 17 }}>{display(current?.relative_humidity_2m, '%')}</strong></div>
              <div style={metricStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, opacity: 0.7 }}><Wind size={13} /> Vento</div><strong style={{ fontSize: 17 }}>{display(current?.wind_speed_10m, ' km/h')}</strong></div>
              <div style={metricStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, opacity: 0.7 }}><CloudRain size={13} /> Chuva actual</div><strong style={{ fontSize: 17 }}>{display(current?.precipitation, ' mm', 1)}</strong></div>
              <div style={metricStyle}><div style={{ fontSize: 10, opacity: 0.7 }}>Nebulosidade</div><strong style={{ fontSize: 17 }}>{display(current?.cloud_cover, '%')}</strong></div>
            </div>

            <div style={{ marginTop: 13, fontSize: 11, fontWeight: 800 }}>Próximos 3 dias</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 7 }}>
              {dayIndexes.map((index) => (
                <div key={daily?.time?.[index]} style={{ border: '1px solid rgba(20,35,25,0.09)', borderRadius: 9, padding: '7px 6px' }}>
                  <div style={{ fontSize: 10, opacity: 0.65 }}>{daily?.time?.[index] ? new Date(`${daily.time[index]}T12:00:00`).toLocaleDateString('pt-AO', { weekday: 'short' }) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3 }}>{display(daily?.temperature_2m_max?.[index], '°')} / {display(daily?.temperature_2m_min?.[index], '°')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 10 }}><CloudRain size={11} /> {display(daily?.precipitation_sum?.[index], ' mm', 1)}</div>
                  <div style={{ fontSize: 9, opacity: 0.65, marginTop: 2 }}>Prob. chuva {display(daily?.precipitation_probability_max?.[index], '%')}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, opacity: 0.58, marginTop: 10, lineHeight: 1.45 }}>
              Fonte: {data?.provider || 'fonte meteorológica'} · Modelo de previsão, não medição por sensor.
              <br />Dados consultados: {localDate(data?.fetchedAt || lastRequestedAt || undefined)}
            </div>
            {error ? <div role="status" style={{ fontSize: 10, color: '#9a3412', marginTop: 5 }}>A última actualização falhou; a mostrar os dados anteriores.</div> : null}
          </>
        )}
      </div>
    </section>
  );
}
