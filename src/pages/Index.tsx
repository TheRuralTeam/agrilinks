import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, CreditCard, MapPin, Menu, Navigation, Play, ShieldCheck, Smartphone, Sprout, Truck, X } from "lucide-react";

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
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#mercado", label: "Mercado" },
  { href: "#operacoes", label: "Operações" },
  { href: "#rastreio", label: "Rastreio" },
  { href: "#parceiros", label: "Parceiros" },
  { href: "#faq", label: "Perguntas" },
];

const HOW_STEPS = [
  { icon: Sprout, title: "Encontre e negoceie", text: "Explore publicações de fornecedores para entrega imediata ou reserve uma colheita futura." },
  { icon: ShieldCheck, title: "Pague em garantia", text: "O valor fica retido e só é libertado ao fornecedor depois de a entrega ser confirmada." },
  { icon: Truck, title: "Acompanhe a entrega", text: "Veja localização, estado da rota e previsão de chegada num único lugar." },
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

// Atraso escalonado para as animações de entrada.
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
  const [scrolled, setScrolled] = React.useState(false);
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

  // Sombra subtil no menu depois de sair do topo.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
        .al { --shadow-sm: 0 1px 2px rgba(17,24,20,.05); --shadow-md: 0 1px 2px rgba(17,24,20,.04), 0 12px 28px -8px rgba(17,24,20,.12); margin: 0; font-family: ${FONT}; color: var(--ink); background: var(--canvas); overflow-x: clip; -webkit-font-smoothing: antialiased; }
        .al :focus-visible { outline: 3px solid var(--green); outline-offset: 3px; }
        .app-panel :focus-visible, footer :focus-visible { outline-color: #fff; }
        .al section[id] { scroll-margin-top: 128px; }

        .wrap { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
        .disp { font-weight: 800; letter-spacing: -.04em; }
        .kick { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--green-700); }
        .idx { display: inline-grid; place-items: center; min-width: 28px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--green-50); color: var(--green-700); font-size: 11px; font-weight: 800; letter-spacing: .02em; font-variant-numeric: tabular-nums; }

        /* Botões */
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border: 1px solid transparent; border-radius: var(--radius-card); font-size: 15px; font-weight: 700; white-space: nowrap; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease; }
        .btn svg { transition: transform .18s ease; }
        .btn:hover svg:last-child { transform: translateX(3px); }
        .btn:active { transform: scale(.98); }
        .btn-primary { background: var(--green); color: #fff; box-shadow: var(--shadow-sm); }
        .btn-primary:hover { background: var(--green-dark); box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .btn-ghost { background: var(--white); color: var(--ink); border-color: var(--line); }
        .btn-ghost:hover { border-color: var(--ink); transform: translateY(-1px); }
        .btn-sm { min-height: 42px; padding: 0 18px; font-size: 14px; }

        /* Topo: ticker + menu num único bloco fixo */
        .chrome { position: sticky; top: 0; z-index: 30; }
        .live-ticker-bar { height: 44px; background: var(--green-dark); color: #fff; }
        .live-ticker-bar .wrap { display: flex; align-items: center; height: 44px; }
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

        .top { position: relative; background: rgba(255,255,255,.88); -webkit-backdrop-filter: saturate(180%) blur(14px); backdrop-filter: saturate(180%) blur(14px); transition: box-shadow .25s ease; }
        .top.scrolled { box-shadow: 0 10px 24px -12px rgba(17,24,20,.14); }
        .top-in { height: 68px; display: flex; align-items: center; gap: 28px; }
        .top-logo { display: flex; align-items: center; }
        .top-logo img { display: block; width: 124px; height: auto; }
        .top-links { margin-left: auto; display: flex; gap: 2px; }
        .top-links a { position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: var(--radius-card); font-size: 14px; font-weight: 600; color: var(--muted); transition: color .15s ease, background .15s ease; }
        .top-links a:hover { color: var(--ink); background: var(--canvas); }
        .top-actions { display: flex; align-items: center; gap: 8px; }
        .burger { display: none; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--white); color: var(--ink); }

        /* Secções */
        .sec { padding: 112px 0; }
        .sec-white { background: var(--white); }
        .sec-head { max-width: 640px; margin-bottom: 48px; }
        .h2 { margin: 14px 0 0; font-size: clamp(30px, 3.6vw, 44px); line-height: 1.1; letter-spacing: -.04em; color: var(--ink); }
        .lead { margin: 16px 0 0; font-size: 17px; line-height: 1.65; font-weight: 500; color: var(--muted); }

        /* Hero */
        .hero { position: relative; overflow: hidden; padding: 88px 0 112px; background: var(--white); }
        .hero::before { content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none; background-image: radial-gradient(circle, var(--line) 1.2px, transparent 1.2px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(ellipse 70% 80% at 78% 40%, #000 0%, transparent 72%); mask-image: radial-gradient(ellipse 70% 80% at 78% 40%, #000 0%, transparent 72%); }
        .hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.1fr .9fr; gap: 72px; align-items: center; }
        .hero h1 { margin: 0; font-size: clamp(42px, 5.4vw, 68px); line-height: 1.04; letter-spacing: -.05em; color: var(--ink); }
        .hero h1 .accent { color: var(--green); }
        .hero-copy { max-width: 520px; margin: 24px 0 0; font-size: 18px; line-height: 1.65; font-weight: 500; color: var(--muted); }
        .hero-actions { margin-top: 34px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .hero .btn { min-height: 52px; padding: 0 26px; }

        .proof { margin: 28px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px 22px; list-style: none; }
        .proof li { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--muted); }
        .proof li span { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--green-50); color: var(--green-700); }

        .payment-options { margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--line); max-width: 520px; }
        .payment-label { display: block; margin-bottom: 12px; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .payment-brands { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .payment-brand { display: inline-flex; align-items: center; gap: 9px; min-height: 42px; padding: 7px 14px 7px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--ink); transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .payment-brand:hover { transform: translateY(-2px); border-color: var(--green); box-shadow: var(--shadow-md); }
        .payment-brand-mark { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 50%; color: #fff; }
        .payment-brand-mark.emis { background: #d33b32; }
        .payment-brand-mark.unitel { background: #e85c25; }
        .payment-brand strong { font-size: 12px; font-weight: 800; }
        .payment-note { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }

        .shape { position: absolute; pointer-events: none; z-index: 0; border-radius: 50%; }
        .shape.s1 { top: -120px; right: -90px; width: 380px; height: 380px; background: var(--green-50); }
        .shape.s2 { bottom: -50px; left: -40px; width: 140px; height: 140px; background: var(--green-light); opacity: .16; }

        .hero-visual { position: relative; display: flex; justify-content: center; padding: 24px 0; }
        .hero-visual::before { content: ""; position: absolute; top: 50%; left: 50%; width: min(100%, 360px); aspect-ratio: 1; border-radius: 50%; background: var(--green-50); transform: translate(-50%, -50%); }
        .hero-visual .phone-frame { position: relative; }
        .chip { position: absolute; z-index: 2; display: inline-flex; align-items: center; gap: 9px; padding: 10px 16px 10px 10px; background: var(--white); border: 1px solid var(--line); border-radius: 999px; box-shadow: var(--shadow-md); font-size: 13px; font-weight: 700; color: var(--ink); white-space: nowrap; }
        .chip i { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--green-50); color: var(--green-700); }
        .chip.a { top: 14%; left: -8%; }
        .chip.b { bottom: 12%; right: -6%; }
        .dot { position: relative; width: 8px; height: 8px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

        .phone-frame { margin: 0 auto; width: min(100%, 300px); padding: 10px; background: var(--white); border: 1px solid var(--line); border-radius: 36px; box-shadow: var(--shadow-md); }
        .phone-frame img { display: block; width: 100%; height: auto; border-radius: 26px; }

        /* Como funciona */
        .how { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; counter-reset: step; }
        .how-card { position: relative; padding: 32px 28px 30px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        .how-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--green); }
        .how-ico { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 12px; background: var(--green-50); color: var(--green-700); transition: background .2s ease, color .2s ease; }
        .how-card:hover .how-ico { background: var(--green); color: #fff; }
        .how-n { position: absolute; top: 28px; right: 28px; font-size: 13px; font-weight: 800; letter-spacing: .06em; color: var(--muted); opacity: .5; font-variant-numeric: tabular-nums; }
        .how-card h3 { margin: 22px 0 0; font-size: 19px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
        .how-card p { margin: 10px 0 0; font-size: 15px; line-height: 1.65; font-weight: 500; color: var(--muted); }

        /* Mercado */
        .featured-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 40px; }
        .featured-heading .sec-head { margin-bottom: 0; }
        .featured-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        .featured-product-card { min-width: 0; transition: transform .22s ease; }
        .featured-product-card:hover { transform: translateY(-6px); }
        .featured-empty { padding: 48px 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-card); background: var(--canvas); color: var(--muted); font-size: 15px; font-weight: 500; }

        /* Operações: fotos quadradas a deslizar na horizontal, com esbatido nas pontas */
        .strip { --count: 3; --gap: 20px; --tile: calc((100cqw - var(--gap) * (var(--count) - 1)) / var(--count)); container-type: inline-size; width: 100%; padding: 14px 0; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%); mask-image: linear-gradient(90deg, transparent 0, #000 56px, #000 calc(100% - 56px), transparent 100%); }
        .strip-track { display: flex; width: max-content; animation: strip-move 40s linear infinite; }
        .strip:hover .strip-track { animation-play-state: paused; }
        .tile { position: relative; flex: 0 0 var(--tile); width: var(--tile); aspect-ratio: 1; margin-right: var(--gap); overflow: hidden; border-radius: var(--radius-card); background: #17231b; transition: scale .25s ease; }
        .tile img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .45s ease; }
        .tile:hover { scale: 1.03; }
        .tile:hover img { transform: scale(1.07); }
        .tile::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(14,22,17,.78) 100%); pointer-events: none; }
        .tile span { position: absolute; z-index: 1; right: 0; bottom: 0; left: 0; padding: 14px 14px; color: #fff; font-size: 13px; line-height: 1.3; font-weight: 700; }
        @keyframes strip-move { to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .strip { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
          .strip-track { animation: none; }
          .tile[aria-hidden="true"] { display: none; }
        }

        /* Rastreio */
        .track { display: grid; grid-template-columns: 1.1fr .9fr; gap: 72px; align-items: center; }
        .track-visual { position: relative; display: flex; justify-content: center; }
        .track-visual::before { content: ""; position: absolute; top: 50%; left: 50%; width: min(100%, 360px); aspect-ratio: 1; border-radius: 50%; background: var(--green-50); transform: translate(-50%, -50%); }
        .pin { position: absolute; z-index: 2; top: 8%; right: 8%; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: var(--green); color: #fff; box-shadow: var(--shadow-md); }
        .track-points { margin: 32px 0 0; padding: 0; max-width: 500px; list-style: none; display: grid; gap: 12px; }
        .track-points li { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: var(--canvas); border: 1px solid var(--line); border-radius: var(--radius-card); font-size: 15px; font-weight: 600; transition: transform .2s ease, border-color .2s ease, background .2s ease; }
        .track-points li:hover { transform: translateX(6px); border-color: var(--green); background: var(--white); }
        .track-points li span { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: var(--green-50); color: var(--green-700); }

        /* Parceiros */
        .partners { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 24px 72px; padding: 44px 32px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); }
        .partners img { display: block; height: 52px; width: auto; max-width: 220px; object-fit: contain; transition: transform .2s ease; }
        .partners img:hover { transform: scale(1.06); }

        /* App */
        .app-panel { position: relative; overflow: hidden; display: grid; grid-template-columns: 1.1fr .9fr; gap: 40px; align-items: center; padding: 64px; background: var(--green-dark); color: #fff; border-radius: calc(var(--radius-card) + 6px); }
        .app-panel > * { position: relative; z-index: 1; }
        .app-panel::before { content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none; background-image: radial-gradient(circle, rgba(255,255,255,.16) 1.2px, transparent 1.2px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(ellipse 60% 90% at 100% 0%, #000, transparent 75%); mask-image: radial-gradient(ellipse 60% 90% at 100% 0%, #000, transparent 75%); }
        .app-panel::after { content: ""; position: absolute; z-index: 0; bottom: -120px; left: 34%; width: 280px; height: 280px; border-radius: 50%; background: var(--green); opacity: .35; pointer-events: none; }
        .app-panel .kick { color: #fff; opacity: .9; }
        .app-panel .idx { background: rgba(255,255,255,.14); color: #fff; }
        .app-panel h2 { margin: 14px 0 0; font-size: clamp(30px, 3.6vw, 44px); line-height: 1.1; }
        .app-panel p { margin: 16px 0 0; max-width: 460px; font-size: 17px; line-height: 1.65; font-weight: 500; color: rgba(255,255,255,.88); }
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
        .faq-layout { display: grid; grid-template-columns: .8fr 1.2fr; gap: 72px; align-items: start; }
        .faq-layout .sec-head { position: sticky; top: 160px; margin-bottom: 0; }
        .faq-list { display: grid; gap: 10px; }
        .faq-item { background: var(--canvas); border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; transition: border-color .2s ease, background .2s ease; }
        .faq-item:hover { border-color: var(--green-light); }
        .faq-item[open] { background: var(--white); border-color: var(--ink); }
        .faq-item summary { position: relative; min-height: 64px; display: flex; align-items: center; padding: 18px 60px 18px 22px; color: var(--ink); font-size: 15px; font-weight: 700; cursor: pointer; list-style: none; }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after { content: '+'; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--white); border: 1px solid var(--line); color: var(--ink); font-size: 18px; line-height: 1; transition: background .2s ease, color .2s ease, transform .25s ease; }
        .faq-item[open] summary::after { content: '−'; background: var(--green); border-color: var(--green); color: #fff; transform: translateY(-50%) rotate(180deg); }
        .faq-item p { margin: 0; padding: 0 22px 22px; color: var(--muted); font-size: 15px; line-height: 1.7; font-weight: 500; }

        /* Rodapé */
        footer { padding: 64px 0 28px; background: #17231b; color: #fff; }
        .foot { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 36px; font-size: 14px; line-height: 1.7; font-weight: 500; }
        .foot img { display: block; width: 124px; margin-bottom: 16px; }
        .foot strong { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78); }
        .foot address { font-style: normal; }
        .foot p { margin: 0; }
        .foot .foot-name { font-size: 15px; font-weight: 700; }
        .foot a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
        .foot-legal { grid-column: 1 / -1; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.16); font-size: 13px; color: rgba(255,255,255,.78); }

        /* Animações (só com movimento permitido) */
        @keyframes rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
        @keyframes rv { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes float-b { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } }
        @keyframes drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(14px, -16px); } }
        @keyframes rv-l { from { opacity: 0; transform: translateX(-34px); } to { opacity: 1; transform: none; } }
        @keyframes rv-r { from { opacity: 0; transform: translateX(34px); } to { opacity: 1; transform: none; } }
        @keyframes rv-z { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes pin-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes faq-open { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes ping { 0% { transform: scale(1); opacity: .6; } 80%, 100% { transform: scale(2.8); opacity: 0; } }

        @media (prefers-reduced-motion: no-preference) {
          .js .rv { opacity: 0; }
          .js .rv.in { opacity: 1; animation: rv .55s cubic-bezier(.2,.7,.2,1) var(--d, 0s) backwards; }
          .js .rv.in.l { animation-name: rv-l; }
          .js .rv.in.r { animation-name: rv-r; }
          .js .rv.in.z { animation-name: rv-z; }

          .fx { animation: rise .7s cubic-bezier(.2,.7,.2,1) var(--d, 0s) both; }
          .hero-visual .phone-frame { animation: rise .8s cubic-bezier(.2,.7,.2,1) .25s both, float 7s ease-in-out 1.1s infinite; }
          .chip.a { animation: pop .5s cubic-bezier(.3,1.4,.5,1) .9s both, float 5s ease-in-out 1.4s infinite; }
          .chip.b { animation: pop .5s cubic-bezier(.3,1.4,.5,1) 1.1s both, float-b 5.5s ease-in-out 1.6s infinite; }
          .payment-brand:first-child { animation: pop .5s cubic-bezier(.3,1.4,.5,1) .55s both; }
          .payment-brand:last-child { animation: pop .5s cubic-bezier(.3,1.4,.5,1) .7s both; }
          .shape.s1 { animation: drift 14s ease-in-out infinite; }
          .shape.s2 { animation: drift 10s ease-in-out infinite reverse; }
          .track-visual .phone-frame { animation: float 7s ease-in-out infinite; }
          .pin { animation: pin-bounce 2.2s ease-in-out infinite; }
          .app-panel::after { animation: drift 12s ease-in-out infinite reverse; }
          .faq-item[open] p { animation: faq-open .3s ease both; }
          .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--green); animation: ping 1.8s ease-out infinite; }
        }

        @media (max-width: 920px) {
          .live-ticker-bar, .live-ticker-bar .wrap { height: 44px; }
          .top-in { gap: 12px; height: 64px; }
          .top-actions { margin-left: auto; }
          .burger { display: inline-flex; }
          .top-links { display: none; position: absolute; top: 100%; left: 0; right: 0; margin: 0; padding: 8px 24px 16px; flex-direction: column; gap: 0; background: var(--white); box-shadow: 0 16px 24px -12px rgba(17,24,20,.16); }
          .top-links.open { display: flex; }
          .top-links a { min-height: 48px; font-size: 16px; }
          .al section[id] { scroll-margin-top: 116px; }

          .sec { padding: 80px 0; }
          .hero { padding: 56px 0 80px; }
          .hero-grid, .track { grid-template-columns: 1fr; gap: 56px; }
          .hero-visual, .track .track-visual { order: 2; }
          .how { grid-template-columns: 1fr; }
          .faq-layout { grid-template-columns: 1fr; gap: 36px; }
          .faq-layout .sec-head { position: static; }
          .app-panel { grid-template-columns: 1fr; padding: 44px 28px; gap: 28px; }
          .stores { justify-self: start; }
          .foot { grid-template-columns: 1fr 1fr; }
          .foot > :first-child { grid-column: 1 / -1; }
        }

        /* Fotos: duas visíveis em ecrãs pequenos */
        @media (max-width: 640px) {
          .strip { --count: 2; --gap: 12px; }
        }

        @media (max-width: 520px) {
          .wrap { width: min(100% - 32px, 1160px); }
          .live-ticker-bar { height: auto; min-height: 52px; }
          .live-ticker-bar .wrap { height: auto; min-height: 52px; }
          .top-logo img { width: 112px; }
          .top-links { padding: 8px 16px 16px; }
          .hero h1 { font-size: clamp(36px, 11vw, 46px); }
          .hero-actions { flex-direction: column; align-items: stretch; }
          .chip { font-size: 12px; padding: 8px 12px 8px 8px; }
          .chip.a { left: 0; }
          .chip.b { right: 0; }
          .shape.s1 { width: 240px; height: 240px; }
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

        <header className={`top ${scrolled ? "scrolled" : ""}`}>
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
            <ul className="proof fx" style={delay(0.25)} aria-label="Vantagens">
              <li><span aria-hidden="true"><Check size={12} strokeWidth={3} /></span>Pagamento em garantia</li>
              <li><span aria-hidden="true"><Check size={12} strokeWidth={3} /></span>Rastreio de cargas</li>
              <li><span aria-hidden="true"><Check size={12} strokeWidth={3} /></span>Conta grátis</li>
            </ul>
            <div className="payment-options fx" style={delay(0.3)} aria-label="Opções de pagamento previstas">
              <span className="payment-label">Opções de pagamento</span>
              <div className="payment-brands">
                <span className="payment-brand">
                  <span className="payment-brand-mark emis" aria-hidden="true"><CreditCard size={14} /></span>
                  <strong>EMIS GPO</strong>
                </span>
                <span className="payment-brand">
                  <span className="payment-brand-mark unitel" aria-hidden="true"><Smartphone size={14} /></span>
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
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="sec" id="como-funciona" aria-labelledby="como-title">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="kick"><i className="idx">01</i>Como funciona</span>
            <h2 className="h2 disp" id="como-title">Do campo ao comprador, em três passos.</h2>
            <p className="lead">Negociação, pagamento e entrega ligados na mesma plataforma.</p>
          </div>
          <div className="how">
            {HOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <article className="how-card rv" key={step.title} style={delay(i * 0.1)}>
                  <span className="how-n" aria-hidden="true">0{i + 1}</span>
                  <span className="how-ico" aria-hidden="true"><Icon size={22} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* MERCADO */}
      <section className="sec sec-white" id="mercado" aria-labelledby="mercado-title">
        <div className="wrap">
          <div className="featured-heading rv">
            <div className="sec-head">
              <span className="kick"><i className="idx">02</i><span className="dot" aria-hidden="true" />Mercado ao vivo</span>
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
            <span className="kick"><i className="idx">03</i>AgriLink no terreno</span>
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
                    style={{ margin: 0, marginRight: "var(--gap)" } as React.CSSProperties}
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
            <span className="kick"><i className="idx">04</i>Rastreio de cargas</span>
            <h2 className="h2 disp" id="tracking-title">Saiba onde está a sua entrega.</h2>
            <p className="lead">Acompanhe a rota e consulte os dados da carga no mapa, do envio à recepção.</p>
            <ul className="track-points">
              <li><span aria-hidden="true"><MapPin size={20} /></span>Localização da carga no mapa</li>
              <li><span aria-hidden="true"><Navigation size={20} /></span>Distância e previsão da rota</li>
              <li><span aria-hidden="true"><ShieldCheck size={20} /></span>Informação acessível durante a entrega</li>
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
            <span className="kick"><i className="idx">05</i>A rede</span>
            <h2 className="h2 disp" id="parceiros-title">Já a negociar na AgriLink.</h2>
          </div>
          <div className="partners rv z" aria-label="Parceiros AgriLink">
            <img src={casaLettoLogo} alt="Grupo CasaLetto" loading="lazy" />
          </div>
        </div>
      </section>

      {/* APP */}
      <section id="app" aria-labelledby="app-title" style={{ paddingBottom: 112 }}>
        <div className="wrap">
          <div className="app-panel rv z">
            <div>
              <span className="kick"><i className="idx">06</i>App AgriLink</span>
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
      <section className="sec sec-white" id="faq" aria-labelledby="faq-title">
        <div className="wrap faq-layout">
          <div className="sec-head rv l">
            <span className="kick"><i className="idx">07</i>Perguntas frequentes</span>
            <h2 className="h2 disp" id="faq-title">Tudo o que precisa de saber.</h2>
            <p className="lead">Não encontra o que procura? Escreva-nos para contacto@agrilink.ao.</p>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <details className="faq-item rv" key={item.question} style={delay((i % 3) * 0.06)}>
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