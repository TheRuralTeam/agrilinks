import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CreditCard, MapPin, Menu, Navigation, Play, ShieldCheck, Smartphone, Sprout, X } from "lucide-react";

import { FONT, R, T } from "../lib/brand";
import DailyProductPriceTicker from "../components/DailyProductPriceTicker";

import agrilinkLogo from "../assets/agrilink-logo.png";
import casaLettoLogo from "../assets/parceiros/Grupo_CasaLetto-no-bg.png";
import liveTrackingImage from "../assets/agrilink-live-tracking.jpg";
import appPreviewImage from "../assets/supply-chain-hero.jpg";
import operationPhoto1 from "../assets/operacoes/agrilink-operacao-01.jpg";
import operationPhoto2 from "../assets/operacoes/agrilink-operacao-02.jpg";
import operationPhoto3 from "../assets/operacoes/agrilink-operacao-03.jpg";
import operationPhoto4 from "../assets/operacoes/agrilink-operacao-04.jpg";
import operationPhoto5 from "../assets/operacoes/agrilink-operacao-05.jpg";
import { supabase } from "../integrations/supabase/client";
import { ProductCard, type Product as ProductCardProduct } from "../components/ProductCard";

// Preencha com os links reais das lojas. Enquanto estiverem vazios,
// os botões aparecem como "Brevemente" (sem links mortos).
const PLAY_STORE_URL = "";
const APP_STORE_URL = "";

const FEED_CACHE_KEY = "agrilink:marketplace:feed";

const NAV_LINKS = [
  { href: "#mercado", label: "Mercado" },
  { href: "#operacoes", label: "Operações" },
  { href: "#rastreio", label: "Rastreio" },
  { href: "#parceiros", label: "Parceiros" },
  { href: "#app", label: "App" },
  { href: "#faq", label: "Perguntas" },
];

const OPERATIONS_GALLERY = [
  { src: operationPhoto1, alt: "Representantes da AgriLink visitam uma exploração agrícola", caption: "Visita a produtores no campo" },
  { src: operationPhoto2, alt: "Equipa AgriLink percorre uma plantação com produtores", caption: "Acompanhamento das explorações" },
  { src: operationPhoto3, alt: "Equipa AgriLink numa estrada rural durante uma visita de campo", caption: "Operações nas comunidades rurais" },
  { src: operationPhoto4, alt: "Equipa AgriLink junto de um produtor agrícola", caption: "Ligação directa aos produtores" },
  { src: operationPhoto5, alt: "Equipa AgriLink visita uma plantação de hortícolas", caption: "Produção agrícola local" },
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

// Atraso escalonado para as animações de entrada do hero.
const delay = (seconds: number) => ({ "--d": `${seconds}s` } as React.CSSProperties);

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
    const els = Array.from(rootRef.current?.querySelectorAll(".rv:not(.in)") ?? []);
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
  }, [featuredProducts.length, feedLoaded]);

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
        .app-panel :focus-visible, footer :focus-visible { outline-color: #fff; }
        .al section[id] { scroll-margin-top: 128px; }

        .wrap { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
        .disp { font-weight: 800; letter-spacing: -.035em; }
        .kick { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--green-700); }

        /* Botões */
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border: 1px solid transparent; border-radius: var(--radius-card); font-size: 15px; font-weight: 700; white-space: nowrap; transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .btn-primary { background: var(--green); color: #fff; }
        .btn-primary:hover { background: var(--green-dark); }
        .btn-ghost { background: var(--white); color: var(--ink); border-color: var(--line); }
        .btn-ghost:hover { border-color: var(--green); color: var(--green-700); }
        .btn-sm { min-height: 42px; padding: 0 18px; font-size: 14px; }

        /* Topo: ticker e menu num único bloco fixo (NOVO, plano) */
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

        .top { position: relative; background: var(--white); }
        .top-in { height: 68px; display: flex; align-items: center; gap: 28px; }
        .top-logo { display: flex; align-items: center; }
        .top-logo img { display: block; width: 128px; height: auto; transition: transform .2s ease; }
        .top-logo:hover img { transform: scale(1.04); }
        .top-links { margin-left: auto; display: flex; gap: 2px; }
        .top-links a { position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: var(--radius-card); font-size: 14px; font-weight: 600; color: var(--muted); transition: color .15s ease; }
        .top-links a::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 5px; height: 2px; background: var(--green); transform: scaleX(0); transform-origin: left; transition: transform .2s ease; }
        .top-links a:hover { color: var(--green-700); }
        .top-links a:hover::after { transform: scaleX(1); }
        .top-actions { display: flex; align-items: center; gap: 8px; }
        .top .btn:hover { transform: translateY(-2px); }
        .top .btn { transition: background .18s ease, transform .18s ease; }
        .burger { display: none; width: 42px; height: 42px; align-items: center; justify-content: center; border: 2px solid var(--ink); border-radius: var(--radius-card); background: var(--white); color: var(--ink); }

        /* Secções (original) */
        .sec { padding: 96px 0; }
        .sec-white { background: var(--white); }
        .sec-head { max-width: 620px; margin-bottom: 44px; }
        .h2 { margin: 12px 0 0; font-size: clamp(30px, 3.6vw, 42px); line-height: 1.12; letter-spacing: -.035em; color: var(--ink); }
        .lead { margin: 16px 0 0; font-size: 17px; line-height: 1.65; font-weight: 500; color: var(--muted); }

        /* Hero (NOVO, plano e animado) */
        .hero { position: relative; overflow: hidden; padding: 72px 0 96px; }
        .hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.1fr .9fr; gap: 64px; align-items: center; }
        .hero h1 { margin: 16px 0 0; font-size: clamp(40px, 5vw, 64px); line-height: 1.06; letter-spacing: -.045em; color: var(--ink); }
        .hero h1 .accent { color: var(--green); }
        .hero-copy { max-width: 520px; margin: 22px 0 0; font-size: 17px; line-height: 1.7; font-weight: 500; color: var(--muted); }
        .hero-actions { margin-top: 32px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .hero .btn { border-width: 2px; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease; }
        .hero .btn:hover { transform: translateY(-2px); }
        .hero .btn:active { transform: translateY(0) scale(.98); }
        .hero .btn svg { transition: transform .18s ease; }
        .hero .btn:hover svg:last-child { transform: translateX(3px); }
        .hero .btn-ghost { border-color: var(--ink); }
        .hero .btn-ghost:hover { background: var(--ink); color: #fff; border-color: var(--ink); }
        .payment-options { margin-top: 24px; }
        .payment-label { display: block; margin-bottom: 10px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .payment-brands { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .payment-brand { display: inline-flex; align-items: center; gap: 9px; min-height: 42px; padding: 7px 13px; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--white); color: var(--ink); transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .payment-brand:hover { transform: translateY(-3px); border-color: var(--green); box-shadow: 0 8px 18px rgba(17,24,20,.08); }
        .payment-brand-mark { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 8px; color: #fff; }
        .payment-brand:hover .payment-brand-mark { transform: rotate(-8deg) scale(1.08); }
        .payment-brand-mark.emis { background: #d33b32; }
        .payment-brand-mark.unitel { background: #e85c25; }
        .payment-brand strong { font-size: 12px; font-weight: 800; }
        .payment-note { margin: 9px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }

        .shape { position: absolute; pointer-events: none; z-index: 0; }
        .shape.s1 { top: -90px; right: -70px; width: 320px; height: 320px; border-radius: 50%; background: var(--green-50); }
        .shape.s2 { bottom: 48px; left: -36px; width: 110px; height: 110px; border-radius: 50%; background: var(--green-light); opacity: .22; }
        .shape.s3 { top: 18%; left: 47%; width: 56px; height: 56px; border: 3px solid var(--green); border-radius: 14px; opacity: .5; }
        .shape.s4 { bottom: 14%; right: 38%; width: 18px; height: 18px; border-radius: 50%; background: var(--green); opacity: .6; }

        .hero-visual { position: relative; display: flex; justify-content: center; padding: 24px 0; }
        .hero-visual::before { content: ""; position: absolute; top: 50%; left: 50%; width: min(100%, 340px); aspect-ratio: 1; border-radius: 50%; background: var(--green-50); transform: translate(-50%, -50%); }
        .hero-visual .phone-frame { position: relative; }
        .chip { position: absolute; z-index: 2; display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--white); border: 2px solid var(--ink); border-radius: 999px; font-size: 13px; font-weight: 700; color: var(--ink); white-space: nowrap; }
        .chip svg { color: var(--green); }
        .chip.a { top: 14%; left: -6%; }
        .chip.b { bottom: 12%; right: -4%; }
        .dot { position: relative; width: 10px; height: 10px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

        .phone-frame { margin: 0 auto; width: min(100%, 300px); padding: 10px; background: var(--white); border: 0; border-radius: 32px; box-shadow: none; }
        .phone-frame img { display: block; width: 100%; height: auto; border-radius: 22px; }

        /* Mercado (original) */
        .featured-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
        .featured-heading .sec-head { margin-bottom: 0; }
        .featured-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        .featured-product-card { min-width: 0; }
        .featured-empty { padding: 40px 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-card); background: var(--white); color: var(--muted); font-size: 15px; font-weight: 500; }

        /* Operações: fotos quadradas pequenas a deslizar na horizontal */
        .strip { --count: 3; --gap: 20px; --tile: calc((100cqw - var(--gap) * (var(--count) - 1)) / var(--count)); container-type: inline-size; width: 100%; padding: 14px 0; overflow: hidden; }
        .strip-track { display: flex; width: max-content; animation: strip-move 36s linear infinite; }
        .strip:hover .strip-track { animation-play-state: paused; }
        .tile { position: relative; flex: 0 0 var(--tile); width: var(--tile); aspect-ratio: 1; margin-right: var(--gap); overflow: hidden; border-radius: var(--radius-card); background: #17231b; transition: scale .25s ease; animation: tile-bob 4s ease-in-out infinite; animation-delay: calc(var(--i) * -.8s); }
        .tile img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
        .tile:hover { scale: 1.04; }
        .tile:hover img { transform: scale(1.08); }
        .tile span { position: absolute; right: 0; bottom: 0; left: 0; padding: 8px 10px; background: rgba(23,35,27,.88); color: #fff; font-size: 12px; line-height: 1.3; font-weight: 700; }
        @keyframes strip-move { to { transform: translateX(-50%); } }
        @keyframes tile-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @media (prefers-reduced-motion: reduce) {
          .strip { overflow-x: auto; }
          .strip-track { animation: none; }
          .tile { animation: none; }
          .tile[aria-hidden="true"] { display: none; }
        }

        /* Extras animados */
        .featured-product-card { transition: transform .22s ease; }
        .featured-product-card:hover { transform: translateY(-6px); }
        .track-visual { position: relative; display: flex; justify-content: center; }
        .track-visual::before { content: ""; position: absolute; top: 50%; left: 50%; width: min(100%, 340px); aspect-ratio: 1; border-radius: 50%; background: var(--green-50); transform: translate(-50%, -50%); }
        .pin { position: absolute; z-index: 2; top: 8%; right: 8%; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: var(--green); color: #fff; }
        .track-points li { transition: padding-left .2s ease, color .2s ease; }
        .track-points li:hover { padding-left: 8px; color: var(--green-700); }
        .partners img { transition: transform .2s ease; }
        .partners img:hover { transform: scale(1.08); }
        .app-panel { position: relative; overflow: hidden; }
        .app-panel > * { position: relative; z-index: 1; }
        .app-panel::before, .app-panel::after { content: ""; position: absolute; z-index: 0; border-radius: 50%; background: #fff; opacity: .07; pointer-events: none; }
        .app-panel::before { top: -110px; right: -70px; width: 320px; height: 320px; }
        .app-panel::after { bottom: -80px; left: 36%; width: 200px; height: 200px; }
        .faq-item { transition: border-color .2s ease; }
        .faq-item:hover, .faq-item[open] { border-color: var(--ink); }
        .faq-item summary::after { transition: background .2s ease, color .2s ease, transform .25s ease; }
        .faq-item[open] summary::after { transform: translateY(-50%) rotate(180deg); }
        .kick .dot { margin-right: 0; }

        /* Rastreio (original) */
        .track { display: grid; grid-template-columns: 1.1fr .9fr; gap: 64px; align-items: center; }
        .track-points { margin: 32px 0 0; padding: 0; max-width: 480px; list-style: none; border-top: 1px solid var(--line); }
        .track-points li { display: flex; align-items: center; gap: 14px; min-height: 56px; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 600; }
        .track-points svg { color: var(--green); flex-shrink: 0; }

        /* Parceiros (original) */
        .partners { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 24px 72px; padding: 40px 32px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); }
        .partners img { display: block; height: 52px; width: auto; max-width: 220px; object-fit: contain; }

        /* App (original) */
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

        /* FAQ (original) */
        .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
        .faq-item { background: var(--canvas); border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; }
        .faq-item summary { position: relative; min-height: 64px; display: flex; align-items: center; padding: 18px 56px 18px 20px; color: var(--ink); font-size: 15px; font-weight: 700; cursor: pointer; list-style: none; }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after { content: '+'; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: grid; place-items: center; border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); font-size: 18px; }
        .faq-item[open] summary::after { content: '−'; background: var(--green); color: #fff; }
        .faq-item p { margin: 0; padding: 0 20px 20px; color: var(--muted); font-size: 15px; line-height: 1.7; font-weight: 500; }

        /* Rodapé (original) */
        footer { padding: 56px 0 28px; background: #17231b; color: #fff; }
        .foot { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 36px; font-size: 14px; line-height: 1.7; font-weight: 500; }
        .foot img { display: block; width: 124px; margin-bottom: 16px; }
        .foot strong { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78); }
        .foot address { font-style: normal; }
        .foot p { margin: 0; }
        .foot .foot-name { font-size: 15px; font-weight: 700; }
        .foot a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
        .foot-legal { grid-column: 1 / -1; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.16); font-size: 13px; color: rgba(255,255,255,.78); }

        /* Animações do hero + revelação ao scroll (só com movimento permitido) */
        @keyframes rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
        @keyframes rv { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes float-b { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } }
        @keyframes drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(14px, -16px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes rv-l { from { opacity: 0; transform: translateX(-34px); } to { opacity: 1; transform: none; } }
        @keyframes rv-r { from { opacity: 0; transform: translateX(34px); } to { opacity: 1; transform: none; } }
        @keyframes rv-z { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
        @keyframes pin-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes faq-open { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes ping { 0% { transform: scale(1); opacity: .6; } 80%, 100% { transform: scale(2.6); opacity: 0; } }

        @media (prefers-reduced-motion: no-preference) {
          .js .rv { opacity: 0; }
          .js .rv.in { opacity: 1; animation: rv .5s cubic-bezier(.2,.7,.2,1) var(--d, 0s) backwards; }

          .fx { animation: rise .7s cubic-bezier(.2,.7,.2,1) var(--d, 0s) both; }
          .hero-visual .phone-frame { animation: rise .8s cubic-bezier(.2,.7,.2,1) .25s both, float 6s ease-in-out 1.1s infinite; }
          .chip.a { animation: pop .5s cubic-bezier(.3,1.4,.5,1) .9s both, float 5s ease-in-out 1.4s infinite; }
          .chip.b { animation: pop .5s cubic-bezier(.3,1.4,.5,1) 1.1s both, float-b 5.5s ease-in-out 1.6s infinite; }
          .payment-brand:first-child { animation: pop .5s cubic-bezier(.3,1.4,.5,1) .55s both; }
          .payment-brand:last-child { animation: pop .5s cubic-bezier(.3,1.4,.5,1) .7s both; }
          .shape.s1 { animation: drift 14s ease-in-out infinite; }
          .shape.s2 { animation: drift 10s ease-in-out infinite reverse; }
          .shape.s3 { animation: spin 18s linear infinite; }
          .shape.s4 { animation: float 4s ease-in-out infinite; }
          .js .rv.in.l { animation-name: rv-l; }
          .js .rv.in.r { animation-name: rv-r; }
          .js .rv.in.z { animation-name: rv-z; }
          .track-visual .phone-frame { animation: float 6s ease-in-out infinite; }
          .pin { animation: pin-bounce 2.2s ease-in-out infinite; }
          .partners img { animation: float 5s ease-in-out infinite; }
          .app-panel::before { animation: drift 16s ease-in-out infinite; }
          .app-panel::after { animation: drift 12s ease-in-out infinite reverse; }
          .faq-item[open] p { animation: faq-open .3s ease both; }
          .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--green); animation: ping 1.8s ease-out infinite; }
        }

        @media (max-width: 920px) {
          .live-ticker-bar, .live-ticker-bar .wrap { height: 48px; }
          .top-in { gap: 12px; height: 64px; }
          .top-actions { margin-left: auto; }
          .burger { display: inline-flex; }
          .top-links { display: none; position: absolute; top: 100%; left: 0; right: 0; margin: 0; padding: 8px 24px 16px; flex-direction: column; gap: 0; background: var(--white); }
          .top-links.open { display: flex; }
          .top-links a { min-height: 48px; font-size: 16px; }
          .top-links a::after { display: none; }
          .al section[id] { scroll-margin-top: 116px; }

          .sec { padding: 72px 0; }
          .hero { padding: 48px 0 72px; }
          .hero-grid, .track { grid-template-columns: 1fr; gap: 48px; }
          .hero-visual, .track .track-visual { order: 2; }
          .faq-grid { grid-template-columns: 1fr; }
          .app-panel { grid-template-columns: 1fr; padding: 40px 28px; gap: 28px; }
          .stores { justify-self: start; }
          .foot { grid-template-columns: 1fr 1fr; }
          .foot > :first-child { grid-column: 1 / -1; }
          .shape.s3 { display: none; }
        }

        /* Fotos: duas visíveis em ecrãs pequenos */
        @media (max-width: 640px) {
          .strip { --count: 2; --gap: 12px; }
        }

        @media (max-width: 520px) {
          .wrap { width: min(100% - 32px, 1160px); }
          .live-ticker-bar { height: auto; min-height: 56px; }
          .live-ticker-bar .wrap { height: auto; min-height: 56px; }
          .top-logo img { width: 112px; }
          .top-links { padding: 8px 16px 16px; }
          .hero h1 { font-size: clamp(36px, 11vw, 46px); }
          .hero-actions { flex-direction: column; align-items: stretch; }
          .chip { font-size: 12px; padding: 8px 12px; }
          .chip.a { left: 0; }
          .chip.b { right: 0; }
          .shape.s1 { width: 220px; height: 220px; }
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
        <span className="shape s1" aria-hidden="true" />
        <span className="shape s2" aria-hidden="true" />
        <span className="shape s3" aria-hidden="true" />
        <span className="shape s4" aria-hidden="true" />
        <div className="wrap hero-grid">
          <div>
            <h1 className="disp fx" style={delay(0)}>
              CONECTA-TE <span className="accent">AO MERCADO.</span>
            </h1>
            <p className="hero-copy fx" style={delay(0.1)}>
              Compre para entrega imediata ou garanta a colheita futura. Feche o negócio, pague em garantia
              e acompanhe a entrega numa só plataforma, que liga produtores, compradores e transportadores.
            </p>
            <div className="hero-actions fx" style={delay(0.2)}>
              <button type="button" className="btn btn-primary" onClick={goToRegister}>
                Criar conta grátis <ArrowRight size={18} aria-hidden="true" />
              </button>
              <a className="btn btn-ghost" href="#mercado">Explorar publicações</a>
            </div>
            <div className="payment-options fx" style={delay(0.3)} aria-label="Opções de pagamento previstas">
              <span className="payment-label">Opções de pagamento</span>
              <div className="payment-brands">
                <span className="payment-brand">
                  <span className="payment-brand-mark emis" aria-hidden="true"><CreditCard size={15} /></span>
                  <strong>EMIS GPO</strong>
                </span>
                <span className="payment-brand">
                  <span className="payment-brand-mark unitel" aria-hidden="true"><Smartphone size={15} /></span>
                  <strong>Unitel Money</strong>
                </span>
              </div>
              <p className="payment-note">A disponibilidade é confirmada no checkout de cada operação.</p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="phone-frame">
              <img src={appPreviewImage} alt="Prévia da aplicação móvel AgriLink" />
            </div>
            <span className="chip a" aria-hidden="true"><Sprout size={16} /> Rede de produtores</span>
            <span className="chip b" aria-hidden="true"><Navigation size={16} /> Operações no campo</span>
          </div>
        </div>
      </section>

      {/* MERCADO */}
      <section className="sec sec-white" id="mercado" aria-labelledby="mercado-title">
        <div className="wrap">
          <div className="featured-heading rv">
            <div className="sec-head">
              <span className="kick"><span className="dot" aria-hidden="true" />Mercado ao vivo</span>
              <h2 className="h2 disp" id="mercado-title">Publicações em destaque</h2>
              <p className="lead">As publicações mais recentes de fornecedores com stock disponível.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/app")}>
              Explorar mais <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="featured-grid">
              {featuredProducts.map((product, i) => (
                <div className="featured-product-card rv" key={product.id} style={delay(i * 0.1)}>
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

      {/* OPERAÇÕES */}
      <section className="sec" id="operacoes" aria-labelledby="operacoes-title">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="kick">AgriLink no terreno</span>
            <h2 className="h2 disp" id="operacoes-title">A acompanhar de perto a produção local.</h2>
            <p className="lead">Conheça algumas das operações e visitas da nossa equipa junto dos produtores.</p>
          </div>
          <div className="strip rv z" aria-label="Galeria de operações da AgriLink">
            <div className="strip-track">
              {/* A lista é repetida para o movimento ser contínuo, sem saltos. */}
              {[...OPERATIONS_GALLERY, ...OPERATIONS_GALLERY].map((photo, index) => {
                const isCopy = index >= OPERATIONS_GALLERY.length;
                return (
                  <figure
                    className="tile"
                    key={`${photo.src}-${index}`}
                    style={{ "--i": index % OPERATIONS_GALLERY.length, margin: 0, marginRight: "var(--gap)" } as React.CSSProperties}
                    aria-hidden={isCopy || undefined}
                  >
                    <img src={photo.src} alt={isCopy ? "" : photo.alt} loading={index === 0 ? "eager" : "lazy"} />
                    <span>{photo.caption}</span>
                  </figure>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* RASTREIO */}
      <section className="sec sec-white" id="rastreio" aria-labelledby="tracking-title">
        <div className="wrap track">
          <div className="rv l">
            <span className="kick">Rastreio de cargas</span>
            <h2 className="h2 disp" id="tracking-title">Saiba onde está a sua entrega.</h2>
            <p className="lead">Acompanhe a rota e consulte os dados da carga no mapa, do envio à recepção.</p>
            <ul className="track-points">
              <li><MapPin size={20} aria-hidden="true" /> Localização da carga no mapa</li>
              <li><Navigation size={20} aria-hidden="true" /> Distância e previsão da rota</li>
              <li><ShieldCheck size={20} aria-hidden="true" /> Informação acessível durante a entrega</li>
            </ul>
          </div>
          <div className="track-visual rv r" style={delay(0.1)}>
            <div className="phone-frame">
              <img
                src={liveTrackingImage}
                alt="Ecrã de rastreio AgriLink com mapa da rota, carga, distância e botão para acompanhar"
                loading="lazy"
              />
            </div>
            <span className="pin" aria-hidden="true"><MapPin size={24} /></span>
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
          <div className="partners rv z" aria-label="Parceiros AgriLink">
            <img src={casaLettoLogo} alt="Grupo CasaLetto" loading="lazy" />
          </div>
        </div>
      </section>

      {/* APP */}
      <section id="app" aria-labelledby="app-title" style={{ paddingBottom: 96 }}>
        <div className="wrap">
          <div className="app-panel rv z">
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
            {FAQ_ITEMS.map((item, i) => (
              <details className="faq-item rv" key={item.question} style={delay((i % 2) * 0.08)}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
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
          <div className="foot-legal">
            © {new Date().getFullYear()} AgriLink – Comércio e Serviços. Todos os direitos reservados.
            {" · "}
            <a href="/termos-publicidade">Termos de Publicação</a>
            {" · "}
            <a href="/privacidade">Privacidade</a>
          </div>
        </div>
      </footer>
    </main>
  );
}