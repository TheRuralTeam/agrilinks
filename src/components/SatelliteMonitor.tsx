import React, { useEffect, useMemo, useState } from 'react';
import { Satellite, X, Cloud, Leaf, Sprout, AlertTriangle, Thermometer } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const GREEN = '#1A5C24';
const GREEN_DARK = '#0F3318';
const GOLD = '#B07D0A';

type Tab = 'clima' | 'ndvi' | 'fazendas';

interface ClimaPoint {
  date: string;
  rain: number;
  tmax: number;
  tmin: number;
  tmean: number;
}

const SENTINEL_INSTANCE = 'sh-2e73cbb3-63af-4ff3-9334-c724d84c3fb5';

const fazendas = [
  { nome: 'Fazenda Cassanje', prov: 'Malanje', cultura: 'Milho', area: 45, ndvi: 'Saudável', cor: '#16A34A' },
  { nome: 'Fazenda Huambo', prov: 'Huambo', cultura: 'Feijão', area: 30, ndvi: 'Fraca', cor: '#EAB308' },
  { nome: 'Fazenda Uíge', prov: 'Uíge', cultura: 'Banana', area: 22, ndvi: 'Saudável', cor: '#16A34A' },
  { nome: 'Fazenda Bié', prov: 'Bié', cultura: 'Mandioca', area: 18, ndvi: 'Crítica', cor: '#DC2626' },
  { nome: 'Fazenda Cunene', prov: 'Cunene', cultura: 'Milho', area: 60, ndvi: 'Fraca', cor: '#EAB308' },
];

export const SatelliteMonitor: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('clima');
  const [clima, setClima] = useState<ClimaPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || tab !== 'clima' || clima.length) return;
    setLoading(true);
    setErr(null);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 60);
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN&community=AG&longitude=17.8&latitude=-11.2&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;
    fetch(url)
      .then(r => r.json())
      .then(j => {
        const p = j?.properties?.parameter || {};
        const dates = Object.keys(p.PRECTOTCORR || {});
        const data: ClimaPoint[] = dates.map(d => ({
          date: `${d.slice(4, 6)}/${d.slice(6, 8)}`,
          rain: Math.max(0, p.PRECTOTCORR?.[d] ?? 0),
          tmax: p.T2M_MAX?.[d] ?? 0,
          tmin: p.T2M_MIN?.[d] ?? 0,
          tmean: p.T2M?.[d] ?? 0,
        })).filter(x => x.rain > -100 && x.tmax > -100);
        setClima(data);
      })
      .catch(e => setErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [open, tab, clima.length]);

  const alerts = useMemo(() => {
    const a: { type: 'drought' | 'heat'; msg: string }[] = [];
    let streak = 0;
    for (const p of clima) {
      if (p.rain < 2) { streak++; if (streak >= 7) { a.push({ type: 'drought', msg: '⚠️ Risco de Seca Detectado por Satélite NASA' }); break; } }
      else streak = 0;
    }
    if (clima.some(p => p.tmax > 35)) a.push({ type: 'heat', msg: '🌡️ Temperatura Crítica' });
    return a;
  }, [clima]);

  const ndviUrl = `https://services.sentinel-hub.com/ogc/wms/${SENTINEL_INSTANCE}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=NDVI&MAXCC=20&WIDTH=512&HEIGHT=512&CRS=EPSG:4326&BBOX=-18.04,11.67,-4.38,24.08&FORMAT=image/png`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Monitor Satelital"
        style={{
          position: 'fixed', right: 16, bottom: 120, zIndex: 50,
          width: 52, height: 52, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: GREEN, color: '#fff', boxShadow: '0 6px 24px rgba(10,35,16,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Satellite size={22} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,26,9,0.55)', zIndex: 60 }}
        >
          <aside
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: 'min(460px, 100vw)', background: '#F4F7F5',
              display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
              fontFamily: "'League Spartan', system-ui, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ background: GREEN_DARK, color: '#fff', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Satellite size={20} />
                  <strong style={{ letterSpacing: '-0.01em' }}>Monitor Satelital</strong>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{
                marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999, background: GOLD, color: '#fff',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              }}>
                🛰️ Powered by ESA Copernicus + NASA Satellites
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #DDE8DF', background: '#fff' }}>
              {[
                { id: 'clima', label: 'Clima', icon: <Cloud size={14} /> },
                { id: 'ndvi', label: 'NDVI', icon: <Leaf size={14} /> },
                { id: 'fazendas', label: 'Fazendas', icon: <Sprout size={14} /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as Tab)}
                  style={{
                    flex: 1, padding: '12px 8px', background: 'transparent',
                    border: 'none', borderBottom: `2px solid ${tab === t.id ? GREEN : 'transparent'}`,
                    color: tab === t.id ? GREEN : '#6B8070', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {tab === 'clima' && (
                <div>
                  {loading && <p style={{ fontSize: 13, color: '#6B8070' }}>A carregar dados da NASA POWER…</p>}
                  {err && <p style={{ fontSize: 12, color: '#DC2626' }}>Erro: {err}</p>}
                  {alerts.map((a, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                      background: a.type === 'drought' ? '#FEF2F2' : '#FFF7ED',
                      color: a.type === 'drought' ? '#B91C1C' : '#C2410C',
                      border: `1px solid ${a.type === 'drought' ? '#FECACA' : '#FED7AA'}`,
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {a.type === 'drought' ? <AlertTriangle size={14} /> : <Thermometer size={14} />}
                      {a.msg}
                    </div>
                  ))}

                  {!!clima.length && (
                    <>
                      <h4 style={{ margin: '8px 0', fontSize: 12, color: GREEN_DARK, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Precipitação diária (mm)</h4>
                      <div style={{ width: '100%', height: 180, background: '#fff', borderRadius: 10, padding: 8, border: '1px solid #DDE8DF' }}>
                        <ResponsiveContainer>
                          <LineChart data={clima}>
                            <CartesianGrid stroke="#EEF2EF" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="rain" stroke="#1D4ED8" strokeWidth={2} dot={false} name="Chuva" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <h4 style={{ margin: '16px 0 8px', fontSize: 12, color: GREEN_DARK, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Temperatura (°C)</h4>
                      <div style={{ width: '100%', height: 180, background: '#fff', borderRadius: 10, padding: 8, border: '1px solid #DDE8DF' }}>
                        <ResponsiveContainer>
                          <LineChart data={clima}>
                            <CartesianGrid stroke="#EEF2EF" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="tmax" stroke="#DC2626" strokeWidth={2} dot={false} name="Máx" />
                            <Line type="monotone" dataKey="tmin" stroke="#0D7E6A" strokeWidth={2} dot={false} name="Mín" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p style={{ fontSize: 10, color: '#6B8070', marginTop: 8 }}>Fonte: NASA POWER · Ponto Angola (-11.2, 17.8)</p>
                    </>
                  )}
                </div>
              )}

              {tab === 'ndvi' && (
                <div>
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #DDE8DF', background: '#fff' }}>
                    <img
                      src={ndviUrl}
                      alt="NDVI Angola - Sentinel-2"
                      style={{ width: '100%', display: 'block', minHeight: 240, background: '#0F3318' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: '#6B8070', marginTop: 8, fontWeight: 600 }}>Dados via ESA Copernicus Sentinel-2</p>

                  <div style={{ marginTop: 12, background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #DDE8DF' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: GREEN_DARK, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legenda NDVI</p>
                    {[
                      { c: '#DC2626', l: '0.0 – 0.2 · Solo nu / Sem vegetação' },
                      { c: '#EAB308', l: '0.2 – 0.4 · Vegetação fraca' },
                      { c: '#F97316', l: '0.4 – 0.6 · Vegetação moderada' },
                      { c: '#16A34A', l: '0.6 – 1.0 · Vegetação saudável' },
                    ].map((x, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 12, color: '#243329' }}>
                        <span style={{ width: 18, height: 12, borderRadius: 3, background: x.c }} /> {x.l}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'fazendas' && (
                <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #DDE8DF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: GREEN_DARK, color: '#fff' }}>
                      <tr>
                        {['Fazenda', 'Província', 'Cultura', 'Área (ha)', 'NDVI', 'Atualizado'].map(h => (
                          <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fazendas.map((f, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #EEF2EF' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 700, color: GREEN_DARK }}>{f.nome}</td>
                          <td style={{ padding: '8px 6px', color: '#243329' }}>{f.prov}</td>
                          <td style={{ padding: '8px 6px', color: '#243329' }}>{f.cultura}</td>
                          <td style={{ padding: '8px 6px', color: '#243329' }}>{f.area}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: f.cor, fontWeight: 700 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: f.cor }} />
                              {f.ndvi}
                            </span>
                          </td>
                          <td style={{ padding: '8px 6px', color: '#6B8070' }}>hoje</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default SatelliteMonitor;
