import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, Menu, Navigation, Play, ShieldCheck, Smartphone, Sprout, X } from "lucide-react";

import { FONT, R, T } from "../lib/brand";
import DailyProductPriceTicker from "../components/DailyProductPriceTicker";

import agrilinkLogo from "../assets/agrilink-logo.png";
import casaLettoLogo from "../assets/parceiros/Grupo_CasaLetto-no-bg.png";
import totalEnergiesLogo from "../assets/Parceiros Institucionais/total energies.png";
import totalEntrepreneursLogo from "../assets/Parceiros Institucionais/Total Energies 100 anos 100 empreendedores.png";
import liveTrackingImage from "../assets/agrilink-live-tracking.jpg";
import appPreviewImage from "../assets/agrilink-app-preview.jpg";
import { supabase } from "../integrations/supabase/client";
import { ProductCard, type Product as ProductCardProduct } from "../components/ProductCard";

// Preencha com os links reais das lojas. Enquanto estiverem vazios,
// os botões aparecem como "Brevemente" (sem links mortos).
const PLAY_STORE_URL = "";
const APP_STORE_URL = "";

const FEED_CACHE_KEY = "agrilink:marketplace:feed";

const NAV_LINKS = [
  { href: "#mercado", label: "Mercado" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#rastreio", label: "Rastreio" },
  { href: "#parceiros", label: "Parceiros" },
  { href: "#app", label: "App" },
  { href: "#faq", label: "Perguntas" },
];

const HERO_POINTS = [
  { icon: Sprout, label: "Compra imediata ou colheita futura" },
  { icon: ShieldCheck, label: "Pagamento em garantia" },
  { icon: Navigation, label: "Entrega acompanhada no mapa" },
];

const STEPS = [
  {
    title: "Encontre ou publique",
    text: "Explore produtos disponíveis e colheitas futuras. Os fornecedores publicam com preço, quantidade e origem.",
  },
  {
    title: "Pague em garantia",
    text: "O valor fica retido até a entrega ser confirmada. Só então o fornecedor recebe o pagamento.",
  },
  {
    title: "Acompanhe a entrega",
    text: "Veja a localização da carga e a previsão de chegada no mapa, do envio à recepção.",
  },
];

const FAQ_ITEMS = [
  { question: "Como posso criar uma conta na AgriLink?", answer: "Selecione “Começar” ou “Criar conta grátis”, escolha o seu perfil e complete o cadastro com os dados solicitados." },
  { question: "Posso usar a plataforma como visitante?", answer: "Sim. Visitantes podem explorar publicações, pesquisar produtos e consultar perfis públicos. Compras, mensagens e publicação exigem uma conta." },
  { question: "Como funciona o pagamento em garantia?", answer: "O valor é retido até que a entrega seja confirmada. Só depois a plataforma libera o pagamento ao fornecedor." },
  { question: "Como acompanho uma entrega?", answer: "Pode consultar localização, estado da rota e previsão da entrega na área de rastreio." },
  { question: "Posso comprar produtos para entrega imediata?", answer: "Quando um produto está disponível e qualifica para compra imediata, pode iniciar o pedido após criar uma conta." },
  { question: "Como funciona uma compra futura?", answer: "Permite reservar uma colheita prevista. Quantidade, data e condições são confirmadas com o fornecedor." },
  { question: "Quem pode publicar produtos?", answer: "Contas de fornecedor podem publicar produtos com preço, quantidade, unidade, origem e data de colheita." },
  { question: "Como é calculado o frete?", answer: "O frete considera origem, destino, peso ou quantidade e a rota disponível. O valor é confirmado pela equipa logística." },
  { question: "A minha informação está protegida?", answer: "Dados públicos são separados dos dados privados da conta, pagamentos e contactos administrativos." },
];

function StoreButton({ href, icon, small, name }: { href: string; icon: React.ReactNode; small: string; name: string }) {
  const inner = (
    <>
      <span className="store-ico" aria-hidden="true">{icon}</span>
      <span className="store-txt">
        <small>{href ? small : "Brevemente na"}</small>
        <strong>{name}</strong>
      </span>
    </>
  );
  return href ? (
    <a className="store" href={href} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <span className="store off" aria-disabled="true">{inner}</span>
  );
}

function readCachedFeed(): ProductCardProduct[] {
  try {
    const cached = JSON.parse(sessionStorage.getItem(FEED_CACHE_KEY) || "null");
    return cached?.expiresAt > Date.now() && Array.isArray(cached.products)
      ? (cached.products as ProductCardProduct[]).slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

export default function AgriLinkLanding() {
  const navigate = useNavigate();
  const rootRef = React.useRef<HTMLElement>(null);
  const [ready, setReady] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [featuredProducts, setFeaturedProducts] = React.useState<ProductCardProduct[]>(readCachedFeed);
  const [feedLoaded, setFeedLoaded] = React.useState(() => readCachedFeed().length > 0);
  const goToRegister = () => navigate("/cadastro");

  React.useEffect(() => {
    let active = true;
    void supabase
      .from("products_public")
      .select("id, user_id, product_type, price, quantity, harvest_date, sale_unit, province_id, municipality_id, farmer_name, photos, status, created_at, description")
      .gt("quantity", 0)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (!active) return;
        setFeedLoaded(true);
        if (error || !data) return;
        const realProducts = (data as unknown as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          user_id: String(row.user_id || ""),
          product_type: String(row.product_type || "Produto"),
          description: row.description == null ? null : String(row.description),
          quantity: Number(row.quantity || 0),
          harvest_date: String(row.harvest_date || ""),
          price: Number(row.price || 0),
          province_id: String(row.province_id || ""),
          municipality_id: String(row.municipality_id || ""),
          farmer_name: String(row.farmer_name || "Fornecedor"),
          photos: Array.isArray(row.photos) ? (row.photos as string[]) : null,
          status: String(row.status || "active"),
          created_at: row.created_at == null ? null : String(row.created_at),
          sale_unit: row.sale_unit == null ? "kg" : String(row.sale_unit),
          min_order_quantity: 1,
          comments_count: 0,
          is_liked: false,
          likes_count: 0,
        }));
        setFeaturedProducts(realProducts);
        try {
          sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
            expiresAt: Date.now() + 5 * 60_000,
            products: realProducts,
          }));
        } catch {}
      });
    return () => { active = false; };
  }, []);

  // Revelação suave ao fazer scroll (desativada com prefers-reduced-motion via CSS).
  React.useEffect(() => {
    setReady(true);
    const els = Array.from(rootRef.current?.querySelectorAll(".rv") ?? []);
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Menu móvel: fecha com a tecla Esc.
  React.useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <main
      ref={rootRef}
      className={`al ${ready ? "js" : ""}`}
      style={
        {
          "--ink": T.ink,
          "--muted": T.mid,
          "--line": T.rule,
          "--canvas": T.canvas,
          "--white": T.white,
          "--green": T.g600,
          "--green-dark": T.g900,
          "--green-light": T.g400,
          "--green-50": T.g50,
          "--green-700": T.g700,
          "--radius-card": `${R.md}px`,
        } as React.CSSProperties
      }
    >
      <style>{`
        .al, .al *, .al *::before, .al *::after { box-sizing: border-box; }
        @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
        :where(.al) a { color: inherit; text-decoration: none; }
        :where(.al) button { font: inherit; cursor: pointer; }
        .al { margin: 0; font-family: ${FONT}; color: var(--ink); background: var(--canvas); overflow-x: clip; }
        .al :focus-visible { outline: 3px solid var(--green); outline-offset: 3px; }
        .app-panel :focus-visible, .final-cta :focus-visible, footer :focus-visible { outline-color: #fff; }
        .al section[id] { scroll-margin-top: 128px; }

        .wrap { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
        .disp { font-weight: 800; letter-spacing: -.035em; }
        .kick { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--green-700); }

        /* Botões */
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border: 1px solid transparent; border-radius: var(--radius-card); font-size: 15px; font-weight: 700; white-space: nowrap; transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .btn-primary { background: var(--green); color: #fff; }
        .btn-primary:hover { background: var(--green-dark); }
        .btn-ghost { background: var(--white); color: var(--ink); border-color: var(--line); }
        .btn-ghost:hover { border-color: var(--green); color: var(--green-700); }
        .btn-sm { min-height: 42px; padding: 0 18px; font-size: 14px; }

        /* Topo: ticker e menu num único bloco fixo */
        .chrome { position: sticky; top: 0; z-index: 30; }
        .live-ticker-bar { height: 52px; background: var(--green-700); color: #fff; }
        .live-ticker-bar .wrap { display: flex; align-items: center; height: 52px; }
        .live-ticker-bar .daily-price-ticker { color: #fff; }
        .live-ticker-bar .daily-price-heading { color: #fff; }
        .live-ticker-bar .daily-price-heading > svg,
        .live-ticker-bar .daily-price-item strong,
        .live-ticker-bar .daily-price-item b { color: #fff; }
        .live-ticker-bar .daily-price-item { color: rgba(255,255,255,.85); }
        .live-ticker-bar .daily-price-refresh { color: rgba(255,255,255,.75); }
        .live-ticker-bar .daily-price-live { background: rgba(255,255,255,.16); color: #fff; }
        .live-ticker-bar .daily-price-live i { background: #fff; }
        .live-ticker-bar .daily-price-fallback { background: rgba(255,255,255,.16); color: #fff; }

        .top { position: relative; background: var(--white); border-bottom: 1px solid var(--line); }
        .top-in { height: 68px; display: flex; align-items: center; gap: 28px; }
        .top-logo { display: flex; align-items: center; }
        .top-logo img { display: block; width: 128px; height: auto; }
        .top-links { margin-left: auto; display: flex; gap: 2px; }
        .top-links a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: var(--radius-card); font-size: 14px; font-weight: 600; color: var(--muted); transition: color .15s ease, background .15s ease; }
        .top-links a:hover { color: var(--green-700); background: var(--green-50); }
        .top-actions { display: flex; align-items: center; gap: 8px; }
        .burger { display: none; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--white); color: var(--ink); }

        /* Secções */
        .sec { padding: 96px 0; }
        .sec-white { background: var(--white); border-block: 1px solid var(--line); }
        .sec-head { max-width: 620px; margin-bottom: 44px; }
        .h2 { margin: 12px 0 0; font-size: clamp(30px, 3.6vw, 42px); line-height: 1.12; letter-spacing: -.035em; color: var(--ink); }
        .lead { margin: 16px 0 0; font-size: 17px; line-height: 1.65; font-weight: 500; color: var(--muted); }

        /* Hero */
        .hero { padding: 72px 0 96px; }
        .hero-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 64px; align-items: center; }
        .hero h1 { margin: 16px 0 0; font-size: clamp(40px, 5vw, 64px); line-height: 1.06; letter-spacing: -.045em; color: var(--ink); }
        .hero h1 .accent { color: var(--green); }
        .hero-copy { max-width: 520px; margin: 22px 0 0; font-size: 17px; line-height: 1.7; font-weight: 500; color: var(--muted); }
        .hero-actions { margin-top: 32px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .hero-points { margin: 40px 0 0; padding: 24px 0 0; list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-top: 1px solid var(--line); }
        .hero-points li { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.4; font-weight: 600; color: var(--ink); }
        .hero-points svg { color: var(--green); }

        .phone-frame { margin: 0 auto; width: min(100%, 300px); padding: 10px; background: var(--white); border: 1px solid var(--line); border-radius: 32px; box-shadow: 0 20px 48px rgba(17,24,20,.10); }
        .phone-frame img { display: block; width: 100%; height: auto; border-radius: 22px; }
        .hero-visual { display: flex; justify-content: center; }

        /* Mercado */
        .featured-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
        .featured-heading .sec-head { margin-bottom: 0; }
        .featured-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        .featured-product-card { min-width: 0; }
        .featured-empty { padding: 40px 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-card); background: var(--white); color: var(--muted); font-size: 15px; font-weight: 500; }

        /* Como funciona */
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 0; padding: 0; list-style: none; counter-reset: step; }
        .step { counter-increment: step; padding: 28px; background: var(--canvas); border: 1px solid var(--line); border-radius: var(--radius-card); }
        .step::before { content: counter(step, decimal-leading-zero); display: block; margin-bottom: 20px; font-size: 14px; font-weight: 800; letter-spacing: .04em; color: var(--green); font-variant-numeric: tabular-nums; }
        .step h3 { margin: 0 0 8px; font-size: 20px; line-height: 1.25; letter-spacing: -.02em; }
        .step p { margin: 0; font-size: 15px; line-height: 1.65; font-weight: 500; color: var(--muted); }

        /* Rastreio */
        .track { display: grid; grid-template-columns: 1.1fr .9fr; gap: 64px; align-items: center; }
        .track-points { margin: 32px 0 0; padding: 0; max-width: 480px; list-style: none; border-top: 1px solid var(--line); }
        .track-points li { display: flex; align-items: center; gap: 14px; min-height: 56px; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 600; }
        .track-points svg { color: var(--green); flex-shrink: 0; }

        /* Parceiros */
        .partners { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 24px 72px; padding: 40px 32px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); }
        .partners img { display: block; height: 52px; width: auto; max-width: 220px; object-fit: contain; }
        .partners img.tall { height: 72px; }

        /* App */
        .app-panel { display: grid; grid-template-columns: 1.1fr .9fr; gap: 40px; align-items: center; padding: 56px; background: var(--green-700); color: #fff; border-radius: var(--radius-card); }
        .app-panel .kick { color: #fff; opacity: .9; }
        .app-panel h2 { margin: 12px 0 0; font-size: clamp(30px, 3.6vw, 42px); line-height: 1.1; }
        .app-panel p { margin: 16px 0 0; max-width: 460px; font-size: 17px; line-height: 1.65; font-weight: 500; color: rgba(255,255,255,.92); }
        .stores { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; justify-self: end; width: min(100%, 300px); }
        .store { display: inline-flex; align-items: center; gap: 14px; width: 100%; min-height: 64px; padding: 8px 22px 8px 14px; background: #fff; color: var(--ink); border-radius: var(--radius-card); transition: transform .15s ease; }
        a.store:hover { transform: translateY(-2px); }
        .store-ico { width: 40px; height: 40px; display: grid; place-items: center; flex-shrink: 0; border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); }
        .store-txt { display: flex; flex-direction: column; line-height: 1.15; }
        .store-txt small { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
        .store-txt strong { font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
        .store.off { cursor: default; background: transparent; color: #fff; border: 1px dashed rgba(255,255,255,.55); }
        .store.off .store-ico { background: #fff; color: var(--ink); }
        .store.off .store-txt small { color: rgba(255,255,255,.85); }

        /* FAQ */
        .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
        .faq-item { background: var(--canvas); border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; }
        .faq-item summary { position: relative; min-height: 64px; display: flex; align-items: center; padding: 18px 56px 18px 20px; color: var(--ink); font-size: 15px; font-weight: 700; cursor: pointer; list-style: none; }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after { content: '+'; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: grid; place-items: center; border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); font-size: 18px; }
        .faq-item[open] summary::after { content: '−'; background: var(--green); color: #fff; }
        .faq-item p { margin: 0; padding: 0 20px 20px; color: var(--muted); font-size: 15px; line-height: 1.7; font-weight: 500; }

        /* CTA final */
        .final-cta { padding: 88px 0; background: var(--green-50); border-top: 1px solid var(--line); }
        .final-cta-in { display: flex; align-items: center; justify-content: space-between; gap: 40px; }
        .final-cta h2 { margin: 0; max-width: 640px; font-size: clamp(32px, 4.4vw, 52px); line-height: 1.08; }
        .final-cta p { margin: 16px 0 0; max-width: 460px; font-size: 17px; line-height: 1.6; font-weight: 500; color: var(--muted); }

        /* Rodapé */
        footer { padding: 56px 0 28px; background: #17231b; color: #fff; }
        .foot { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 36px; font-size: 14px; line-height: 1.7; font-weight: 500; }
        .foot img { display: block; width: 124px; margin-bottom: 16px; }
        .foot strong { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78); }
        .foot address { font-style: normal; }
        .foot p { margin: 0; }
        .foot .foot-name { font-size: 15px; font-weight: 700; }
        .foot a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
        .foot-legal { grid-column: 1 / -1; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.16); font-size: 13px; color: rgba(255,255,255,.78); }

        /* Revelação ao scroll */
        @media (prefers-reduced-motion: no-preference) {
          @keyframes rv { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
          .js .rv { opacity: 0; }
          .js .rv.in { opacity: 1; animation: rv .5s cubic-bezier(.2,.7,.2,1) var(--d, 0s) backwards; }
        }

        @media (max-width: 920px) {
          .live-ticker-bar, .live-ticker-bar .wrap { height: 48px; }
          .top-in { gap: 12px; height: 64px; }
          .top-actions { margin-left: auto; }
          .burger { display: inline-flex; }
          .top-links { display: none; position: absolute; top: 100%; left: 0; right: 0; margin: 0; padding: 8px 24px 16px; flex-direction: column; gap: 0; background: var(--white); border-bottom: 1px solid var(--line); box-shadow: 0 16px 24px rgba(17,24,20,.08); }
          .top-links.open { display: flex; }
          .top-links a { min-height: 48px; font-size: 16px; }
          .al section[id] { scroll-margin-top: 116px; }

          .sec { padding: 72px 0; }
          .hero { padding: 48px 0 72px; }
          .hero-grid, .track { grid-template-columns: 1fr; gap: 48px; }
          .hero-visual, .track .phone-frame { order: 2; }
          .steps { grid-template-columns: 1fr; }
          .faq-grid { grid-template-columns: 1fr; }
          .app-panel { grid-template-columns: 1fr; padding: 40px 28px; gap: 28px; }
          .stores { justify-self: start; }
          .final-cta { padding: 64px 0; }
          .final-cta-in { flex-direction: column; align-items: flex-start; gap: 28px; }
          .foot { grid-template-columns: 1fr 1fr; }
          .foot > :first-child { grid-column: 1 / -1; }
        }

        @media (max-width: 520px) {
          .wrap { width: min(100% - 32px, 1160px); }
          .top-logo img { width: 112px; }
          .top-links { padding: 8px 16px 16px; }
          .hero h1 { font-size: clamp(36px, 11vw, 46px); }
          .hero-actions { flex-direction: column; align-items: stretch; }
          .hero-points { grid-template-columns: 1fr; gap: 14px; }
          .hero-points li { flex-direction: row; align-items: center; gap: 12px; }
          .featured-heading { flex-direction: column; align-items: flex-start; }
          .featured-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 12px; padding-bottom: 8px; scrollbar-width: none; }
          .featured-grid::-webkit-scrollbar { display: none; }
          .featured-product-card { flex: 0 0 min(82vw, 300px); scroll-snap-align: start; }
          .partners { gap: 20px 40px; padding: 28px 20px; }
          .stores { width: 100%; }
          .foot { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="chrome">
        <div className="live-ticker-bar" aria-label="Mercado ao vivo">
          <div className="wrap">
            <DailyProductPriceTicker />
          </div>
        </div>

        <header className="top">
          <div className="wrap top-in">
            <a className="top-logo" href="#top" aria-label="AgriLink"><img src={agrilinkLogo} alt="AgriLink" /></a>
            <nav id="menu-principal" className={`top-links ${menuOpen ? "open" : ""}`} aria-label="Principal" onClick={() => setMenuOpen(false)}>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href}>{l.label}</a>
              ))}
            </nav>
            <div className="top-actions">
              <button
                type="button"
                className="burger"
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuOpen}
                aria-controls="menu-principal"
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={goToRegister}>Começar</button>
            </div>
          </div>
        </header>
      </div>

      {/* HERO */}
      <section className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <span className="kick">Tecnologia para o agronegócio angolano</span>
            <h1 className="disp">
              Ligue-se ao <span className="accent">mercado agrícola</span> de Angola.
            </h1>
            <p className="hero-copy">
              Compre para entrega imediata ou garanta a colheita futura. Feche o negócio, pague em garantia
              e acompanhe a entrega numa só plataforma, que liga produtores, compradores e transportadores.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={goToRegister}>
                Criar conta grátis <ArrowRight size={18} aria-hidden="true" />
              </button>
              <a className="btn btn-ghost" href="#mercado">Explorar publicações</a>
            </div>
            <ul className="hero-points">
              {HERO_POINTS.map(({ icon: Icon, label }) => (
                <li key={label}><Icon size={22} aria-hidden="true" />{label}</li>
              ))}
            </ul>
          </div>

          <div className="hero-visual">
            <div className="phone-frame">
              <img src={appPreviewImage} alt="Prévia da aplicação móvel AgriLink" />
            </div>
          </div>
        </div>
      </section>

      {/* MERCADO */}
      <section className="sec sec-white" id="mercado" aria-labelledby="mercado-title">
        <div className="wrap">
          <div className="featured-heading rv">
            <div className="sec-head">
              <span className="kick">Mercado ao vivo</span>
              <h2 className="h2 disp" id="mercado-title">Publicações em destaque</h2>
              <p className="lead">As publicações mais recentes de fornecedores com stock disponível.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/app")}>
              Explorar mais <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="featured-grid">
              {featuredProducts.map((product) => (
                <div className="featured-product-card" key={product.id}>
                  <ProductCard
                    product={product}
                    onOpenMap={() => navigate(`/produto/${product.id}/localizacao`)}
                  />
                </div>
              ))}
            </div>
          ) : feedLoaded ? (
            <p className="featured-empty">Ainda não há publicações em destaque. Volte em breve.</p>
          ) : null}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="sec" id="como-funciona" aria-labelledby="como-title">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="kick">Como funciona</span>
            <h2 className="h2 disp" id="como-title">Do campo à entrega, em três passos.</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className="step rv" key={s.title} style={{ "--d": `${i * 0.08}s` } as React.CSSProperties}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* RASTREIO */}
      <section className="sec sec-white" id="rastreio" aria-labelledby="tracking-title">
        <div className="wrap track">
          <div className="rv">
            <span className="kick">Rastreio de cargas</span>
            <h2 className="h2 disp" id="tracking-title">Saiba onde está a sua entrega.</h2>
            <p className="lead">Acompanhe a rota e consulte os dados da carga no mapa, do envio à recepção.</p>
            <ul className="track-points">
              <li><MapPin size={20} aria-hidden="true" /> Localização da carga no mapa</li>
              <li><Navigation size={20} aria-hidden="true" /> Distância e previsão da rota</li>
              <li><ShieldCheck size={20} aria-hidden="true" /> Informação acessível durante a entrega</li>
            </ul>
          </div>
          <div className="phone-frame rv" style={{ "--d": ".1s" } as React.CSSProperties}>
            <img
              src={liveTrackingImage}
              alt="Ecrã de rastreio AgriLink com mapa da rota, carga, distância e botão para acompanhar"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* PARCEIROS */}
      <section className="sec" id="parceiros" aria-labelledby="parceiros-title">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="kick">A rede</span>
            <h2 className="h2 disp" id="parceiros-title">Já a negociar na AgriLink.</h2>
          </div>
          <div className="partners rv" aria-label="Parceiros AgriLink">
            <img src={casaLettoLogo} alt="Grupo CasaLetto" loading="lazy" />
            <img src={totalEnergiesLogo} alt="TotalEnergies" loading="lazy" />
            <img className="tall" src={totalEntrepreneursLogo} alt="TotalEnergies, 100 Anos, 100 Empreendedores" loading="lazy" />
          </div>
        </div>
      </section>

      {/* APP */}
      <section id="app" aria-labelledby="app-title" style={{ paddingBottom: 96 }}>
        <div className="wrap">
          <div className="app-panel rv">
            <div>
              <span className="kick">App AgriLink</span>
              <h2 className="disp" id="app-title">Leve o mercado no bolso.</h2>
              <p>Negocie, pague em garantia e acompanhe cada entrega no telemóvel, onde estiver.</p>
            </div>
            <div className="stores">
              <StoreButton href={PLAY_STORE_URL} icon={<Play size={18} fill="currentColor" />} small="Disponível no" name="Google Play" />
              <StoreButton href={APP_STORE_URL} icon={<Smartphone size={20} />} small="Descarregar na" name="App Store" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec sec-white" id="faq" aria-labelledby="faq-title" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="kick">Perguntas frequentes</span>
            <h2 className="h2 disp" id="faq-title">Tudo o que precisa de saber.</h2>
          </div>
          <div className="faq-grid">
            {FAQ_ITEMS.map((item) => (
              <details className="faq-item rv" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="final-cta" aria-labelledby="cta-title">
        <div className="wrap final-cta-in">
          <div>
            <h2 className="disp" id="cta-title">Comece a negociar hoje.</h2>
            <p>Crie a sua conta grátis e explore o mercado, mesmo antes de publicar ou comprar.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={goToRegister}>
            Criar conta grátis <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <div>
            <img src={agrilinkLogo} alt="AgriLink" />
            <p className="foot-name">AgriLink – Comércio e Serviços</p>
            <p style={{ fontVariantNumeric: "tabular-nums" }}>NIF 5003313409</p>
          </div>
          <div>
            <strong>Onde estamos</strong>
            <address>
              Centro Logístico<br />
              Talatona, Luanda<br />
              Angola
            </address>
          </div>
          <div>
            <strong>Contacto</strong>
            <a href="mailto:contacto@agrilink.ao">contacto@agrilink.ao</a>
          </div>
          <div className="foot-legal">© {new Date().getFullYear()} AgriLink – Comércio e Serviços. Todos os direitos reservados.</div>
        </div>
      </footer>
    </main>
  );
}