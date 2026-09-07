import { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowTrendUp, faArrowTrendDown, faMinus, faChartLine } from "@fortawesome/free-solid-svg-icons";

interface MarketPrice {
  id: string;
  product: string;
  unit: string;
  price_kz: number;
  market_location: string;
  market_type: string;
  date: string;
  price_change_pct: number;
}

const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(value);

const MarketPriceTicker = () => {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("market_prices")
        .select("id, product, unit, price_kz, market_location, market_type, date, price_change_pct")
        .eq("published", true)
        .order("date", { ascending: false })
        .limit(200);

      // manter só o registo mais recente por produto + localização + tipo
      const latest = new Map<string, MarketPrice>();
      (data || []).forEach((row: MarketPrice) => {
        const key = `${row.product}|${row.market_location}|${row.market_type}`;
        if (!latest.has(key)) latest.set(key, row);
      });

      setPrices(Array.from(latest.values()).slice(0, 12));
      setLoading(false);
    };
    load();
  }, []);

  const lastUpdate = useMemo(() => {
    if (!prices.length) return null;
    return prices
      .map((p) => p.date)
      .sort()
      .reverse()[0];
  }, [prices]);

  return (
    <section className="market-ticker">
      <div className="market-ticker-head">
        <div>
          <h3 className="market-ticker-title">
            <FontAwesomeIcon icon={faChartLine} /> Preços do Mercado Agroalimentar — Hoje
          </h3>
          <p className="market-ticker-sub">
            Dados actualizados diariamente. Rastreabilidade total entre o mercado formal e informal.
          </p>
        </div>
        {lastUpdate && (
          <span className="market-ticker-stamp">
            Última actualização · {new Date(lastUpdate).toLocaleDateString("pt-AO")}
          </span>
        )}
      </div>

      {loading ? (
        <div className="market-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="market-card market-card-skeleton" />
          ))}
        </div>
      ) : prices.length === 0 ? (
        <div className="market-empty">
          <FontAwesomeIcon icon={faChartLine} />
          <span>Preços a serem publicados em breve</span>
        </div>
      ) : (
        <div className="market-grid">
          {prices.map((p) => {
            const up = Number(p.price_change_pct) > 0;
            const down = Number(p.price_change_pct) < 0;
            return (
              <article key={p.id} className="market-card">
                <header className="market-card-top">
                  <span className="market-product">{p.product}</span>
                  <span className={`market-tag ${p.market_type === "formal" ? "formal" : "informal"}`}>
                    {p.market_type === "formal" ? "Formal" : "Informal"}
                  </span>
                </header>
                <div className="market-unit">{p.unit}</div>
                <div className="market-price-row">
                  <span className="market-price">{formatKz(Number(p.price_kz))} Kz</span>
                  <span className={`market-change ${up ? "up" : down ? "down" : "flat"}`}>
                    <FontAwesomeIcon icon={up ? faArrowTrendUp : down ? faArrowTrendDown : faMinus} />
                    {Math.abs(Number(p.price_change_pct)).toFixed(1)}%
                  </span>
                </div>
                <footer className="market-location">{p.market_location}</footer>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .market-ticker { margin: 26px 0 30px; }
        .market-ticker-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
        .market-ticker-title { margin:0; font-size:15px; font-weight:800; letter-spacing:-0.2px; color:#111714; display:flex; align-items:center; gap:8px; }
        .market-ticker-title svg { color:#7CB342; }
        .market-ticker-sub { margin:6px 0 0; font-size:12.5px; color:#6B8070; max-width:520px; line-height:1.5; }
        .market-ticker-stamp { font-family:'JetBrains Mono', ui-monospace, monospace; font-size:11px; color:#93A79A; text-transform:uppercase; letter-spacing:0.08em; }
        .market-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
        @media (min-width: 900px) { .market-grid { grid-template-columns:repeat(4, minmax(0,1fr)); } }
        .market-card { background:#FFFFFF; border:1px solid #E3EDE5; border-left:3px solid #7CB342; border-radius:12px; padding:12px 13px; display:flex; flex-direction:column; gap:6px; transition:transform .18s ease, box-shadow .18s ease; }
        .market-card:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(124,179,66,0.14); }
        .market-card-skeleton { height:104px; background:linear-gradient(90deg,#F3F7F1,#FAFCFA,#F3F7F1); animation:mkpulse 1.4s infinite; }
        @keyframes mkpulse { 0%,100%{opacity:.7} 50%{opacity:1} }
        .market-card-top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .market-product { font-size:13.5px; font-weight:800; color:#111714; }
        .market-tag { font-size:9.5px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:3px 7px; border-radius:999px; }
        .market-tag.formal { background:#F1F7E8; color:#5B8B2C; border:1px solid #DCEBC6; }
        .market-tag.informal { background:#FBF3E4; color:#B07D0A; border:1px solid #F0E1BF; }
        .market-unit { font-size:11px; color:#8CA193; font-family:'JetBrains Mono', ui-monospace, monospace; }
        .market-price-row { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
        .market-price { font-family:'JetBrains Mono', ui-monospace, monospace; font-size:17px; font-weight:800; color:#111714; font-variant-numeric:tabular-nums; }
        .market-change { font-family:'JetBrains Mono', ui-monospace, monospace; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; gap:4px; }
        .market-change.up { color:#2E7D32; }
        .market-change.down { color:#B03A2E; }
        .market-change.flat { color:#93A79A; }
        .market-location { font-size:11px; color:#6B8070; border-top:1px dashed #E7EFE8; padding-top:6px; }
        .market-empty { border:1px dashed #D8E6DA; border-radius:14px; padding:26px; text-align:center; color:#7D9384; font-size:13px; display:flex; flex-direction:column; align-items:center; gap:8px; background:#FBFDFB; }
        .market-empty svg { color:#B8CDBB; font-size:20px; }
      `}</style>
    </section>
  );
};

export default MarketPriceTicker;
