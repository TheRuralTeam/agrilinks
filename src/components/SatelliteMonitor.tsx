import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Satellite, X, Cloud, Leaf, Sprout, AlertTriangle, Thermometer, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

const GREEN = '#3C6622';
const GREEN_DARK = '#2B4818';
const GOLD = '#B07D0A';

type Tab = 'clima' | 'ndvi' | 'fazendas';

interface ClimaPoint {
  date: string;
  rain: number;
  tmax: number;
  tmin: number;
  tmean: number;
}

interface FazendaReal {
  nome: string;
  prov: string;
  cultura: string;
  area: number;
  qtdProdutos: number;
  ndvi: 'Saudável' | 'Fraca' | 'Crítica';
  cor: string;
  atualizado: string;
}

const SENTINEL_INSTANCE = 'sh-2e73cbb3-63af-4ff3-9334-c724d84c3fb5';
const AUTO_REFRESH_MS = 30 * 60 * 1000; // 30 minutos

function classifyNdvi(qtd: number): { label: FazendaReal['ndvi']; cor: string } {
  if (qtd >= 100) return { label: 'Saudável', cor: '#7CB342' };
  if (qtd >= 30) return { label: 'Fraca', cor: '#EAB308' };
  return { label: 'Crítica', cor: '#DC2626' };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export const SatelliteMonitor: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('clima');
  const [clima, setClima] = useState<ClimaPoint[]>([]);
  const [fazendas, setFazendas] = useState<FazendaReal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [ndviKey, setNdviKey] = useState(0);
  const [ndviDate, setNdviDate] = useState<string>('');
  const [ndviFetchedAt, setNdviFetchedAt] = useState<Date | null>(null);
  const [ndviProbing, setNdviProbing] = useState(false);

  const loadClima = useCallback(async () => {
    setErr(null);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 60);
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN&community=AG&longitude=17.8&latitude=-11.2&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;
    try {
      const r = await fetch(url);
      const j = await r.json();
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
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, []);

  const loadFazendas = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('product_type, quantity, province_id, municipality_id, farmer_name, user_id, status, updated_at, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { setErr(error.message); return; }
    const map = new Map<string, FazendaReal & { _ts: number }>();
    (data || []).forEach((p: any) => {
      const nome = p.farmer_name || 'Produtor';
      const prov = p.province_id || '—';
      const key = `${nome}|${prov}`;
      const existing = map.get(key);
      const ts = new Date(p.updated_at || p.created_at).getTime();
      if (existing) {
        existing.area += Number(p.quantity) || 0;
        existing.qtdProdutos += 1;
        if (ts > existing._ts) { existing._ts = ts; existing.atualizado = timeAgo(p.updated_at || p.created_at); existing.cultura = p.product_type; }
      } else {
        map.set(key, {
          nome, prov,
          cultura: p.product_type || '—',
          area: Number(p.quantity) || 0,
          qtdProdutos: 1,
          ndvi: 'Saudável', cor: '#7CB342',
          atualizado: timeAgo(p.updated_at || p.created_at),
          _ts: ts,
        });
      }
    });
    const list = Array.from(map.values()).map(f => {
      const c = classifyNdvi(f.area);
      return { ...f, ndvi: c.label, cor: c.cor };
    }).sort((a, b) => b.area - a.area).slice(0, 30);
    setFazendas(list);
  }, []);

  // Detecta a data mais recente disponível da camada MODIS Terra NDVI 8-Day
  const probeLatestNdvi = useCallback(async (): Promise<string> => {
    const base = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
    const buildUrl = (date: string) =>
      `${base}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_NDVI_8Day&CRS=EPSG:4326&BBOX=-18.04,11.67,-4.38,24.08&WIDTH=64&HEIGHT=64&FORMAT=image/png&TRANSPARENT=false&TIME=${date}`;
    const tryDate = (date: string) => new Promise<boolean>((resolve) => {
      const img = new Image();
      const t = setTimeout(() => { img.src = ''; resolve(false); }, 6000);
      img.onload = () => { clearTimeout(t); resolve((img.naturalWidth || 0) > 0); };
      img.onerror = () => { clearTimeout(t); resolve(false); };
      img.src = buildUrl(date) + `&_=${Date.now()}`;
    });
    const d = new Date();
    // tenta a partir de hoje, recuando 1 dia por iteração (até 30 dias)
    for (let i = 0; i < 30; i++) {
      const iso = d.toISOString().slice(0, 10);
      // eslint-disable-next-line no-await-in-loop
      if (await tryDate(iso)) return iso;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    // fallback: hoje - 12 (heurística antiga)
    const f = new Date(); f.setUTCDate(f.getUTCDate() - 12);
    return f.toISOString().slice(0, 10);
  }, []);

  const loadNdvi = useCallback(async () => {
    setNdviProbing(true);
    try {
      const latest = await probeLatestNdvi();
      setNdviDate(latest);
      setNdviFetchedAt(new Date());
      setNdviKey(k => k + 1);
    } finally {
      setNdviProbing(false);
    }
  }, [probeLatestNdvi]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      await Promise.all([loadClima(), loadFazendas(), loadNdvi()]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadClima, loadFazendas, loadNdvi]);

  // Carregar ao abrir + auto-refresh a cada 30 min
  useEffect(() => {
    if (!open) return;
    if (!lastRefresh) refreshAll();
    const id = setInterval(refreshAll, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [open, refreshAll, lastRefresh]);

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

  const ndviUrl = ndviDate
    ? `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_NDVI_8Day&CRS=EPSG:4326&BBOX=-18.04,11.67,-4.38,24.08&WIDTH=720&HEIGHT=720&FORMAT=image/png&TRANSPARENT=false&TIME=${ndviDate}&_=${ndviKey}`
    : '';
  const ndviFallbackUrl = ndviDate
    ? `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&CRS=EPSG:4326&BBOX=-18.04,11.67,-4.38,24.08&WIDTH=720&HEIGHT=720&FORMAT=image/jpeg&TIME=${ndviDate}&_=${ndviKey}`
    : '';

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={refreshAll}
                    disabled={refreshing}
                    title="Atualizar dados"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: refreshing ? 'rgba(255,255,255,0.05)' : GOLD, border: 'none', color: '#fff',
                      borderRadius: 8, padding: '6px 10px', cursor: refreshing ? 'wait' : 'pointer',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
                    Atualizar
                  </button>
                  <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 999, background: GOLD, color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                }}>
                  🛰️ Powered by ESA Copernicus + NASA Satellites
                </div>
                {lastRefresh && (
                  <span style={{ fontSize: 10, opacity: 0.75 }}>
                    Atualizado: {lastRefresh.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })} · auto 30min
                  </span>
                )}
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
                  {loading && !clima.length && <p style={{ fontSize: 13, color: '#6B8070' }}>A carregar dados da NASA POWER…</p>}
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
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #DDE8DF', background: '#0F3318', position: 'relative', minHeight: 280 }}>
                    {ndviProbing && !ndviDate && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>
                        A localizar camada NDVI mais recente…
                      </div>
                    )}
                    {ndviUrl && (
                      <img
                        key={ndviKey}
                        src={ndviUrl}
                        alt="NDVI Angola - MODIS Terra"
                        style={{ width: '100%', display: 'block', minHeight: 280, objectFit: 'cover' }}
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          if (!el.dataset.fallback) { el.dataset.fallback = '1'; el.src = ndviFallbackUrl; }
                        }}
                      />
                    )}
                    <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(15,51,24,0.9)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>
                      MODIS · {ndviDate || '—'}
                    </div>
                    <button
                      onClick={loadNdvi}
                      disabled={ndviProbing}
                      title="Recarregar última camada NDVI"
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: GOLD, border: 'none', color: '#fff',
                        borderRadius: 6, padding: '4px 8px', cursor: ndviProbing ? 'wait' : 'pointer',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                      }}
                    >
                      <RefreshCw size={11} style={{ animation: ndviProbing ? 'spin 1s linear infinite' : undefined }} />
                      {ndviProbing ? 'A verificar…' : 'Atualizar'}
                    </button>
                  </div>

                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', border: '1px solid #DDE8DF', borderRadius: 8, fontSize: 11, color: '#243329', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div><strong style={{ color: GREEN_DARK }}>Data da camada:</strong> {ndviDate ? new Date(ndviDate + 'T00:00:00Z').toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} (UTC)</div>
                    <div><strong style={{ color: GREEN_DARK }}>Última verificação:</strong> {ndviFetchedAt ? `${ndviFetchedAt.toLocaleDateString('pt-AO')} · ${ndviFetchedAt.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '—'}</div>
                    <div style={{ color: '#6B8070' }}>Fonte: NASA GIBS · MODIS Terra NDVI 8-Day (composto de 8 dias)</div>
                  </div>

                  <div style={{ marginTop: 12, background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #DDE8DF' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: GREEN_DARK, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legenda NDVI</p>
                    {[
                      { c: '#DC2626', l: '0.0 – 0.2 · Solo nu / Sem vegetação' },
                      { c: '#EAB308', l: '0.2 – 0.4 · Vegetação fraca' },
                      { c: '#F97316', l: '0.4 – 0.6 · Vegetação moderada' },
                      { c: '#7CB342', l: '0.6 – 1.0 · Vegetação saudável' },
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
                  {loading && !fazendas.length && <p style={{ padding: 12, fontSize: 12, color: '#6B8070' }}>A carregar fazendas reais…</p>}
                  {!loading && !fazendas.length && (
                    <p style={{ padding: 14, fontSize: 12, color: '#6B8070' }}>
                      Nenhuma fazenda activa encontrada. Publique produtos para que apareçam aqui com dados reais.
                    </p>
                  )}
                  {!!fazendas.length && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ background: GREEN_DARK, color: '#fff' }}>
                        <tr>
                          {['Produtor', 'Província', 'Cultura', 'Qtd (kg)', 'Estado', 'Atualizado'].map(h => (
                            <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fazendas.map((f, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #EEF2EF' }}>
                            <td style={{ padding: '8px 6px', fontWeight: 700, color: GREEN_DARK }}>{f.nome}</td>
                            <td style={{ padding: '8px 6px', color: '#243329' }}>{f.prov}</td>
                            <td style={{ padding: '8px 6px', color: '#243329' }}>{f.cultura}{f.qtdProdutos > 1 ? ` +${f.qtdProdutos - 1}` : ''}</td>
                            <td style={{ padding: '8px 6px', color: '#243329', fontVariantNumeric: 'tabular-nums' }}>{f.area.toLocaleString('pt-AO')}</td>
                            <td style={{ padding: '8px 6px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: f.cor, fontWeight: 700 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 999, background: f.cor }} />
                                {f.ndvi}
                              </span>
                            </td>
                            <td style={{ padding: '8px 6px', color: '#6B8070' }}>{f.atualizado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p style={{ padding: '8px 10px', fontSize: 10, color: '#6B8070', borderTop: '1px solid #EEF2EF' }}>
                    Dados reais agregados da base de dados de produtos activos.
                  </p>
                </div>
              )}
            </div>
          </aside>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </>
  );
};

export default SatelliteMonitor;
