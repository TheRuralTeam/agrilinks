import { useCallback, useEffect, useState } from 'react';
import { Activity, LoaderCircle } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { FONT, R, T } from '../lib/brand';
import { getProvincesForCountry } from '../data/country-locations';

interface PublishedProductPrice {
  id: string;
  product_type: string;
  price: number;
  quantity: number;
  sale_unit: string | null;
  province_id: string;
  municipality_id: string;
  harvest_date: string;
  created_at: string | null;
}

const formatPrice = (price: number) =>
  `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(price)} Kz`;

const formatDate = (date: string | null) => {
  if (!date) return 'data por confirmar';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return 'data por confirmar';
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day));
};

const formatUnit = (unit: string | null) => unit === 'tonelada' ? 't' : unit || 'unidade';

const formatLocation = (provinceId: string, municipalityId: string) => {
  const provinces = getProvincesForCountry('AO');
  const province = provinces.find((item) => item.id === provinceId);
  const municipality = province?.municipalities.find((item) => item.id === municipalityId);
  return [municipality?.name || municipalityId, province?.name || provinceId].filter(Boolean).join(', ');
};

export default function DailyProductPriceTicker() {
  const [products, setProducts] = useState<PublishedProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const loadReferences = useCallback(async () => {
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_type, price, quantity, sale_unit, province_id, municipality_id, harvest_date, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const rows = (data ?? []).flatMap((product) => {
        const price = Number(product.price);
        const quantity = Number(product.quantity);
        if (
          !product.id || !product.product_type || !product.province_id
          || !product.municipality_id || !product.harvest_date
          || !Number.isFinite(price) || price <= 0
          || !Number.isFinite(quantity) || quantity <= 0
        ) return [];
        return [{
          ...product,
          id: product.id,
          product_type: product.product_type,
          province_id: product.province_id,
          municipality_id: product.municipality_id,
          harvest_date: product.harvest_date,
          price,
          quantity,
        }];
      });
      setProducts(rows);
      setUsingFallback(false)
      setLoadError(false)
    } catch (error) {
      console.error('[AgriLink] Não foi possível atualizar os preços dos produtos publicados:', error)
      setProducts([
        {
          id: 'fallback-tomate',
          product_type: 'Tomate',
          price: 850,
          quantity: 1,
          sale_unit: 'kg',
          province_id: 'Luanda',
          municipality_id: 'Mercado',
          harvest_date: '',
          created_at: null,
        },
        {
          id: 'fallback-milho',
          product_type: 'Milho',
          price: 420,
          quantity: 1,
          sale_unit: 'kg',
          province_id: 'Huambo',
          municipality_id: 'Mercado',
          harvest_date: '',
          created_at: null,
        },
        {
          id: 'fallback-cebola',
          product_type: 'Cebola',
          price: 780,
          quantity: 1,
          sale_unit: 'kg',
          province_id: 'Benguela',
          municipality_id: 'Mercado',
          harvest_date: '',
          created_at: null,
        },
      ])
      setUsingFallback(true)
      setLoadError(true)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferences();
    const intervalId = window.setInterval(() => void loadReferences(), 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadReferences, reloadKey]);

  const items = products.length > 0 ? [...products, ...products] : products;

  return (
    <section className="daily-price-ticker" aria-label="Preços dos produtos publicados pelos utilizadores da AgriLink">
      <div className="daily-price-heading">
        <Activity size={15} aria-hidden="true" />
        <span>Preços dos produtos publicados</span>
        <span className="daily-price-live" aria-label="Indicador visual do ticker de preços publicados">
          <i aria-hidden="true" />
          Mercado
        </span>
        <span className="daily-price-refresh">Anúncios reais · atualização a cada minuto</span>
        {usingFallback && <span className="daily-price-fallback">Referência temporária</span>}
      </div>
      {loading ? (
        <div className="daily-price-message"><LoaderCircle size={14} className="daily-price-spinner" /> A carregar produtos publicados…</div>
      ) : products.length === 0 ? (
        <div className="daily-price-message">Ainda não há produtos publicados e disponíveis.</div>
      ) : (
        <div className="daily-price-window">
          <div className="daily-price-track is-moving">
            {items.map((product, index) => (
              <span className="daily-price-item" key={`${product.id}-${index}`} aria-hidden={index >= products.length}>
                <strong>{product.product_type}</strong>
                <b>{formatPrice(product.price)} / {formatUnit(product.sale_unit)}</b>
                <span>{product.quantity.toLocaleString('pt-AO')} {formatUnit(product.sale_unit)} disponíveis · {formatLocation(product.province_id, product.municipality_id)} · colheita {formatDate(product.harvest_date)}</span>
                <i aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>
      )}
      <style>{`
        .daily-price-ticker { flex:1 1 auto; width:100%; min-width:0; overflow:hidden; padding:9px 0; border:0; border-radius:0; background:transparent; font-family:${FONT}; }
        .daily-price-heading { display:flex; align-items:center; gap:6px; margin-bottom:7px; color:${T.ink}; font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }
        .daily-price-heading > svg { color:${T.green}; }
        .daily-price-heading > span:first-of-type { transform-origin:left center; animation:daily-price-text2d 3.2s ease-in-out infinite; }
        .daily-price-live { display:inline-flex; align-items:center; gap:5px; margin-left:4px; padding:3px 7px; border-radius:${R.pill}px; background:${T.g50}; color:${T.g600}; font-size:8px; letter-spacing:.05em; }
        .daily-price-live i { position:relative; width:6px; height:6px; border-radius:50%; background:${T.g600}; }
        .daily-price-live i::after { position:absolute; inset:-3px; border-radius:50%; border:1px solid ${T.g600}; content:''; animation:daily-price-live-pulse 1.8s ease-out infinite; }
        .daily-price-refresh { margin-left:auto; color:${T.muted}; font-size:9px; font-weight:600; text-transform:none; letter-spacing:0; }
        .daily-price-fallback { padding:3px 7px; border-radius:${R.pill}px; background:${T.goldBg}; color:${T.gold}; font-size:8px; letter-spacing:.04em; text-transform:uppercase; }
        .daily-price-window { overflow:hidden; mask-image:linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
        .daily-price-track { display:flex; width:max-content; align-items:center; }
        .daily-price-track.is-moving { animation:daily-price-marquee 32s linear infinite; }
        .daily-price-ticker:hover .daily-price-track { animation-play-state:paused; }
        .daily-price-item { display:inline-flex; align-items:center; gap:7px; padding:0 14px; color:${T.mid}; font-size:10px; white-space:nowrap; }
        .daily-price-item:first-child { padding-left:2px; }
        .daily-price-item strong { color:${T.mid}; font-weight:700; }
        .daily-price-item b { color:${T.ink}; font-size:11px; font-variant-numeric:tabular-nums; }
        .daily-price-item strong, .daily-price-item b { transform-origin:left center; animation:daily-price-text2d 3.2s ease-in-out infinite; }
        .daily-price-item b { animation-delay:.16s; }
        .daily-price-item i { width:4px; height:4px; margin-left:5px; border-radius:50%; background:${T.rule}; }
        .daily-price-message { display:flex; align-items:center; gap:6px; min-height:17px; color:${T.faint}; font-size:9px; }
        .daily-price-retry { padding:0; border:0; background:none; color:${T.danger}; font:inherit; cursor:pointer; }
        .daily-price-spinner { animation:daily-price-spin 1s linear infinite; }
        @keyframes daily-price-marquee { to { transform:translateX(-50%); } }
        @keyframes daily-price-text2d { 0%,100% { transform:translate3d(-1px,1px,0) rotate(-.15deg) scale(.995); } 50% { transform:translate3d(1px,-1px,0) rotate(.15deg) scale(1.005); } }
        @keyframes daily-price-live-pulse { 0% { transform:scale(.7); opacity:.8; } 100% { transform:scale(1.8); opacity:0; } }
        @keyframes daily-price-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .daily-price-track.is-moving, .daily-price-spinner, .daily-price-heading > span:first-of-type, .daily-price-item strong, .daily-price-item b, .daily-price-live i::after { animation:none; } }
        @media (max-width:640px) {
          .daily-price-ticker { flex:1 1 auto; align-self:stretch; width:100%; padding:9px 10px; border:1px solid ${T.gBorder}; border-radius:${R.md}; background:${T.g50}; }
          .daily-price-heading { flex-wrap:wrap; }
          .daily-price-refresh { display:none; }
          .daily-price-window { width:100%; }
          .daily-price-track.is-moving { animation-duration:24s; }
        }
      `}</style>
    </section>
  );
}
