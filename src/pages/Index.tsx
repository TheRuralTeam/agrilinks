import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowDown, CalendarClock, Check, MapPin, Menu, Navigation, Play, ShieldCheck, Smartphone, X, Zap } from "lucide-react";

import { FONT, R, T } from "../lib/brand";
import DailyProductPriceTicker from "../components/DailyProductPriceTicker";

import agrilinkLogo from "../assets/agrilink-logo.png";
import casaLettoLogo from "../assets/parceiros/Grupo_CasaLetto-no-bg.png";
import totalEnergiesLogo from "../assets/Parceiros Institucionais/total energies.png";
import totalEntrepreneursLogo from "../assets/Parceiros Institucionais/Total Energies 100 anos 100 empreendedores.png";
import communityConferenceImage from "../assets/agrilink-community-conference.jpg";
import communityMeetupImage from "../assets/agrilink-meetup.jpg";
import liveTrackingImage from "../assets/agrilink-live-tracking.jpg";
import heroImage from "../assets/hero-agriculture.jpg";

// Preenche com os links reais das lojas. Enquanto estiverem vazios,
// os botões aparecem como "Brevemente" (sem links mortos).
const PLAY_STORE_URL = "";
const APP_STORE_URL = "";

const NAV_LINKS = [
  { href: "#compra", label: "Compra" },
  { href: "#produto", label: "Produto" },
  { href: "#rastreio", label: "Rastreio" },
  { href: "#parceiros", label: "Parceiros" },
  { href: "#app", label: "App" },
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

const RULES = [
  {
    n: "01",
    title: "Dinheiro em garantia até à entrega",
    text: "O comprador deposita, o valor fica retido e só é libertado quando a entrega é confirmada.",
  },
  {
    n: "02",
    title: "Transporte pela rota real",
    text: "O custo do frete é calculado pelas estradas efectivas. Todos sabem o preço antes de aceitar.",
  },
  {
    n: "03",
    title: "Oferta e procura ligadas sozinhas",
    text: "Defina o que precisa uma vez. Cada novo lote que encaixa chega até si automaticamente.",
  },
];

export default function AgriLinkLanding() {
  const navigate = useNavigate();
  const rootRef = React.useRef<HTMLElement>(null);
  const [ready, setReady] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const goToRegister = () => navigate("/cadastro");

  // Animações de entrada ao fazer scroll (respeita prefers-reduced-motion via CSS).
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
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
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
        * { box-sizing: border-box; }
        @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
        :where(.al) a { color: inherit; text-decoration: none; }
        :where(.al) button { font: inherit; cursor: pointer; }
        .al { margin: 0; font-family: ${FONT}; color: var(--ink); background: var(--canvas); overflow: hidden; }
        .al :focus-visible { outline: 3px solid var(--green); outline-offset: 3px; }
        .app-panel :focus-visible, footer :focus-visible { outline-color: #fff; }
        .al section[id] { scroll-margin-top: 84px; }

        .wrap { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
        .disp { font-weight: 800; letter-spacing: -.04em; }
        .lbl { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .num { font-variant-numeric: tabular-nums; }
        .tag, .kick { display: inline-flex; align-items: center; gap: 10px; color: var(--green-700); }

        /* Marcador */
        .mk { display: inline-block; white-space: nowrap; background: var(--green); color: #fff; border-radius: var(--radius-card); padding: .02em .16em .08em; margin: 0 .02em; }
        .mk-inv { background: #fff; color: var(--green-700); }

        /* TOPO */
        .top { position: fixed; inset: 0 0 auto; z-index: 20; background: rgba(255,255,255,.92); border-bottom: 1px solid var(--line); backdrop-filter: blur(14px); }
        .top-in { height: 76px; display: flex; align-items: center; gap: 32px; }
        .top img { width: 138px; display: block; }
        .top-links { margin-left: auto; display: flex; gap: 4px; }
        .top-links a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: var(--radius-card); font-size: 13px; font-weight: 700; color: var(--muted); transition: color .18s ease, background .18s ease; }
        .top-links a:hover { color: var(--ink); background: var(--canvas); }
        .top-actions { display: flex; align-items: center; gap: 8px; }
        .burger { display: none; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--white); color: var(--ink); }
        .sq { min-height: 42px; padding: 0 20px; border: 0; border-radius: var(--radius-card); background: var(--green); color: #fff; font-size: 14px; font-weight: 800; transition: transform .18s ease, background .18s ease, box-shadow .18s ease; }
        .sq:hover { transform: translateY(-1px); background: var(--green-dark); box-shadow: 0 6px 16px rgba(44,134,59,.18); }

        /* HERO */
        .hero { padding: 142px 0 88px; background: var(--canvas); }
        .hero-grid { display: grid; grid-template-columns: 1.08fr .92fr; gap: 56px; align-items: center; }
        .hero h1 { margin: 20px 0; font-size: clamp(42px, 5.4vw, 72px); line-height: 1.08; letter-spacing: -.055em; color: var(--ink); }
        .hero-copy { max-width: 500px; margin: 0; font-size: 16px; line-height: 1.75; font-weight: 500; color: var(--muted); }
        .hero-actions { margin-top: 28px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .big { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border: 0; border-radius: var(--radius-card); background: var(--green); color: #fff; font-size: 15px; font-weight: 800; transition: background .18s ease, transform .18s ease, box-shadow .18s ease; }
        .big:hover { transform: translateY(-2px); background: var(--green-dark); box-shadow: 0 8px 20px rgba(44,134,59,.2); }
        .big svg, .textlink svg { transition: transform .2s ease; }
        .big:hover svg { transform: translateX(4px); }
        .textlink { display: inline-flex; align-items: center; gap: 7px; min-height: 42px; color: var(--ink); font-size: 14px; font-weight: 800; }
        .textlink:hover svg { transform: translateY(3px); }

        .collage { position: relative; height: 470px; }
        .photo { position: absolute; top: 0; right: 0; width: 86%; height: 430px; border-radius: var(--radius-card); background: url(${heroImage}) center/cover; box-shadow: 0 18px 48px rgba(17,24,20,.14); }
        .ticket { position: absolute; left: 0; bottom: 4px; width: 284px; padding: 18px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 12px 32px rgba(17,24,20,.12); }
        .tk-head { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
        .tk-head b { font-size: 19px; font-weight: 800; letter-spacing: -.03em; color: var(--green-700); }
        .tk-head span { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
        .tk-body { margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; }
        .tk-body div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
        .tk-body dt { color: var(--muted); font-weight: 600; }
        .tk-body dd { margin: 0; font-weight: 700; text-align: right; }
        .tk-tear { margin: 16px -18px 14px; border-top: 1px dashed var(--line); }
        .tk-foot { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 600; color: var(--muted); }
        .tk-foot strong { color: var(--ink); font-size: 14px; font-weight: 800; }
        .stamp { position: absolute; right: 14px; bottom: 16px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid var(--green); border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); font-size: 11px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
        .stamp svg { color: var(--green); }

        /* REFERÊNCIAS DIÁRIAS DE PREÇOS */
        .marq { overflow: hidden; background: var(--white); color: var(--muted); box-shadow: inset 0 1px 0 var(--line), inset 0 -1px 0 var(--line); }
        .marq .wrap { display: flex; align-items: center; min-height: 74px; }

        /* SECÇÕES */
        .sec { padding: 88px 0 0; }
        .h2 { margin: 10px 0 0; max-width: 720px; font-size: clamp(30px, 4vw, 48px); line-height: 1.12; letter-spacing: -.045em; color: var(--ink); }

        /* FORMAS DE COMPRA */
        .modes { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .mode { display: flex; flex-direction: column; gap: 14px; padding: 26px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 4px 16px rgba(17,24,20,.04); transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .mode:hover { transform: translateY(-3px); border-color: rgba(44,134,59,.28); box-shadow: 0 12px 28px rgba(17,24,20,.08); }
        .mode-top { display: flex; align-items: center; justify-content: space-between; }
        .mode-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); }
        .mode-badge { padding: 6px 10px; border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); font-size: 10px; }
        .mode h3 { margin: 4px 0 0; font-size: 27px; line-height: 1.04; letter-spacing: -.035em; }
        .mode p { margin: 0; max-width: 440px; font-size: 15.5px; line-height: 1.7; font-weight: 500; color: var(--muted); }
        .flow { margin-top: 8px; padding-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; border-top: 1px solid var(--line); font-size: 13px; font-weight: 700; }
        .flow span { padding: 6px 9px; background: var(--canvas); border: 1px solid var(--line); border-radius: var(--radius-card); color: var(--muted); font-size: 12px; }
        .flow i { font-style: normal; font-weight: 800; color: var(--green); }

        /* PRODUTO */
        .rules { margin-top: 30px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .rule { display: grid; grid-template-columns: 1fr; gap: 14px; align-content: start; padding: 22px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); transition: transform .2s ease, box-shadow .2s ease; }
        .rule:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(17,24,20,.07); }
        .rule-n { font-size: 36px; font-weight: 800; line-height: 1; letter-spacing: -.05em; color: var(--green); }
        .rule h3 { margin: 0; font-size: 19px; line-height: 1.3; letter-spacing: -.025em; }
        .rule p { margin: 0; max-width: 440px; font-size: 14px; line-height: 1.65; font-weight: 500; color: var(--muted); }

        /* RASTREIO */
        .track { display: grid; grid-template-columns: 1fr .7fr; gap: 48px; align-items: center; }
        .track-copy > p { margin: 18px 0 0; max-width: 460px; font-size: 16px; line-height: 1.7; font-weight: 500; color: var(--muted); }
        .track-points { margin: 28px 0 0; padding: 0; max-width: 460px; list-style: none; border-top: 1px solid var(--line); }
        .track-points li { display: flex; align-items: center; gap: 12px; min-height: 50px; border-bottom: 1px solid var(--line); font-size: 14px; font-weight: 600; }
        .track-points svg { color: var(--green); flex-shrink: 0; }
        .phone-wrap { position: relative; display: flex; justify-content: center; align-items: center; padding: 10px; }
        .pulse { position: absolute; inset: 0; margin: auto; width: 270px; height: 270px; border-radius: 50%; border: 1px solid var(--green); opacity: 0; }
        .phone { position: relative; z-index: 1; width: min(100%, 280px); padding: 9px; background: var(--white); border: 8px solid var(--white); border-radius: 28px; box-shadow: 0 18px 42px rgba(17,24,20,.12); }
        .phone img { display: block; width: 100%; height: auto; border-radius: 18px; }

        /* REDE */
        .net { margin-top: 48px; display: grid; grid-template-columns: 1.25fr 1fr; grid-template-rows: 1fr 1fr; overflow: hidden; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 6px 24px rgba(17,24,20,.05); }
        .cell { padding: 28px; display: flex; flex-direction: column; justify-content: space-between; gap: 22px; }
        .cell + .cell { border-left: 1px solid var(--line); }
        .cell.big-cell { grid-row: 1 / span 2; }
        .cell.b { border-top: 1px solid var(--line); }
        .cell-label { color: var(--muted); }
        .cell img { display: block; object-fit: contain; max-width: 100%; }
        .logo-big { height: 96px; width: auto; align-self: flex-start; }
        .cell h3 { margin: 0 0 12px; font-size: 31px; line-height: 1.08; color: var(--ink); }
        .cell p { margin: 0 0 22px; max-width: 420px; font-size: 15px; line-height: 1.7; font-weight: 500; color: var(--muted); }
        .logos-pair { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
        .logos-pair img { height: 46px; width: auto; }
        .logos-pair img.tall { height: 76px; }
        .cell.photos { padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0; min-height: 200px; }
        .cell.photos figure { position: relative; margin: 0; overflow: hidden; }
        .cell.photos figure + figure { border-left: 1px solid var(--line); }
        .cell.photos img { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; object-fit: cover; transition: transform .5s ease; }
        .cell.photos figure:hover img { transform: scale(1.05); }
        .cell.photos figcaption { position: absolute; left: 0; bottom: 0; padding: 6px 10px; border-top-right-radius: var(--radius-card); background: rgba(18,30,22,.78); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }

        /* APP */
        .app-panel { position: relative; overflow: hidden; display: grid; grid-template-columns: 1.1fr .9fr; gap: 24px; min-height: 440px; padding: 56px 56px 0; background: var(--green-700); color: #fff; border-radius: var(--radius-card); }
        .app-copy { align-self: center; padding-bottom: 56px; }
        .app-copy .kick { color: #fff; }
        .app-copy h2 { margin: 14px 0; font-size: clamp(34px, 4.4vw, 54px); line-height: 1.04; }
        .app-copy p { margin: 0; max-width: 440px; font-size: 16px; line-height: 1.7; font-weight: 500; color: #fff; }
        .stores { margin-top: 30px; display: flex; gap: 16px; flex-wrap: wrap; }
        .store { display: inline-flex; align-items: center; gap: 14px; min-height: 62px; padding: 8px 24px 8px 14px; background: #fff; color: var(--ink); border-radius: var(--radius-card); transition: transform .15s ease; }
        a.store:hover { transform: translateY(-2px); }
        .store-ico { width: 40px; height: 40px; display: grid; place-items: center; flex-shrink: 0; border-radius: var(--radius-card); background: var(--green-50); color: var(--green-700); }
        .store-txt { display: flex; flex-direction: column; line-height: 1.15; }
        .store-txt small { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
        .store-txt strong { font-size: 20px; font-weight: 800; letter-spacing: -.03em; }
        .store.off { cursor: default; background: transparent; color: #fff; border: 1px dashed rgba(255,255,255,.5); }
        .store.off .store-ico { background: #fff; color: var(--ink); }
        .store.off .store-txt small { color: rgba(255,255,255,.82); }
        .app-visual { position: relative; display: flex; justify-content: center; align-items: flex-end; }
        .app-phone { width: min(100%, 270px); height: 390px; padding: 9px 9px 0; background: #fff; border-radius: 30px 30px 0 0; overflow: hidden; }
        .app-phone img { display: block; width: 100%; height: auto; border-radius: 22px 22px 0 0; }
        .chip { position: absolute; display: inline-flex; align-items: center; gap: 8px; padding: 9px 13px; background: #fff; color: var(--ink); border-radius: var(--radius-card); box-shadow: 0 6px 18px rgba(17,24,20,.14); font-size: 12.5px; font-weight: 800; white-space: nowrap; }
        .chip svg { color: var(--green); }
        .chip.c1 { left: -6px; top: 76px; }
        .chip.c2 { right: -8px; top: 206px; }

        /* CTA */
        .cta { margin-top: 88px; padding: 90px 0; background: var(--green-50); color: var(--ink); }
        .cta-in { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; }
        .cta h2 { margin: 0; max-width: 760px; font-size: clamp(40px, 6vw, 78px); line-height: 1.04; }
        .cta p { margin: 18px 0 0; max-width: 420px; font-size: 16px; line-height: 1.6; font-weight: 500; color: var(--muted); }
        .cta .big { white-space: nowrap; }

        /* RODAPÉ */
        footer { padding: 52px 0 28px; background: #17231b; color: #fff; }
        .foot { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 36px; font-size: 14px; line-height: 1.7; font-weight: 500; }
        .foot img { display: block; width: 124px; margin-bottom: 16px; }
        .foot strong { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78); }
        .foot address { font-style: normal; }
        .foot p { margin: 0; }
        .foot .foot-name { font-size: 15px; font-weight: 700; }
        .foot a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
        .foot-legal { grid-column: 1 / -1; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.16); font-size: 12.5px; color: rgba(255,255,255,.78); }

        /* ── ANIMAÇÕES ────────────────────────────────────────────────── */
        @media (prefers-reduced-motion: no-preference) {
          @keyframes up { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
          @keyframes rv { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
          @keyframes wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
          @keyframes stampIn { 0% { opacity: 0; transform: rotate(-9deg) scale(2.4); } 60% { opacity: 1; transform: rotate(-9deg) scale(.9); } 100% { opacity: 1; transform: rotate(-9deg) scale(1); } }
          @keyframes ring { 0% { transform: scale(.62); opacity: .5; } 100% { transform: scale(1.75); opacity: 0; } }
          @keyframes zap { 0%,100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.22) rotate(-8deg); } }
          @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px) rotate(6deg); } }
          @keyframes chipA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
          @keyframes chipB { 0%,100% { transform: translateY(0); } 50% { transform: translateY(10px); } }

          .hero .a1, .hero .a2, .hero .a3, .hero .a4 { animation: up .8s cubic-bezier(.2,.7,.2,1) both; }
          .hero .a1 { animation-delay: .05s; } .hero .a2 { animation-delay: .18s; } .hero .a3 { animation-delay: .34s; } .hero .a4 { animation-delay: .46s; }
          .mk { clip-path: inset(0 100% 0 0); }
          .al:not(.js) .mk { clip-path: none; }
          .hero .mk { animation: wipe .75s .55s cubic-bezier(.7,0,.2,1) forwards; }
          .rv.in .mk { animation: wipe .75s .4s cubic-bezier(.7,0,.2,1) forwards; }
          .stamp { animation: stampIn .5s 1.5s cubic-bezier(.2,.7,.2,1) both; }
          .pulse { animation: ring 3.4s ease-out infinite; }
          .pulse + .pulse { animation-delay: 1.7s; }
          .mode.now .mode-icon svg { animation: zap 1.6s ease-in-out infinite; }
          .mode.future .mode-icon svg { animation: bob 3s ease-in-out infinite; }
          .chip.c1 { animation: chipA 4.5s ease-in-out infinite; }
          .chip.c2 { animation: chipB 5.2s ease-in-out infinite; }

          /* Revelação ao scroll: animação (não transição) para não colidir com os hovers dos cartões */
          .js .rv { opacity: 0; }
          .js .rv.in { opacity: 1; animation: rv .7s cubic-bezier(.2,.7,.2,1) var(--d, 0s) backwards; }
        }

        @media (max-width: 920px) {
          .top-in { gap: 12px; }
          .top-actions { margin-left: auto; }
          .burger { display: inline-flex; }
          .top-links { display: none; position: absolute; top: 100%; left: 0; right: 0; margin: 0; padding: 8px 24px 16px; flex-direction: column; gap: 0; background: rgba(255,255,255,.98); border-bottom: 1px solid var(--line); }
          .top-links.open { display: flex; }
          .top-links a { min-height: 48px; font-size: 15px; }
          .hero { padding: 118px 0 72px; }
          .hero-grid { grid-template-columns: 1fr; gap: 38px; }
          .collage { max-width: 460px; }
          .rules { grid-template-columns: 1fr; }
          .rule { grid-template-columns: 56px 1fr; }
          .rule-n { grid-row: span 2; align-self: start; font-size: 34px; }
          .track { grid-template-columns: 1fr; }
          .modes { grid-template-columns: 1fr; }
          .app-panel { grid-template-columns: 1fr; padding: 40px 28px 0; }
          .app-copy { padding-bottom: 8px; }
          .app-phone { height: 330px; }
          .chip.c1 { left: 0; }
          .chip.c2 { right: 0; }
          .net { grid-template-columns: 1fr; grid-template-rows: auto; }
          .cell.big-cell { grid-row: auto; }
          .cell + .cell { border-left: 0; border-top: 1px solid var(--line); }
          .cell.photos { min-height: 190px; }
          .sec { padding-top: 72px; }
          .cta { margin-top: 72px; padding: 64px 0; }
          .cta-in { flex-direction: column; align-items: flex-start; }
          .foot { grid-template-columns: 1fr 1fr; }
          .foot > :first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 520px) {
          .wrap { width: min(100% - 32px, 1160px); }
          .top-in { height: 68px; }
          .top img { width: 124px; }
          .top-links { padding: 8px 16px 16px; }
          .sq { min-height: 40px; padding: 0 16px; }
          .hero { padding-top: 104px; }
          .hero h1 { font-size: clamp(40px, 12vw, 54px); }
          .hero-actions { align-items: stretch; gap: 12px; }
          .big { width: 100%; }
          .textlink { justify-content: center; }
          .collage { height: 430px; }
          .photo { width: 88%; height: 360px; }
          .ticket { width: min(278px, 88%); }
          .mode { padding: 21px; }
          .rule { padding: 18px; }
          .cell { padding: 22px; }
          .cta-in { gap: 24px; }
          .foot { grid-template-columns: 1fr; }
        }
      `}</style>

      <header className="top">
        <div className="wrap top-in">
          <a href="#top" aria-label="AgriLink"><img src={agrilinkLogo} alt="AgriLink" /></a>
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
            <button type="button" className="sq" onClick={goToRegister}>Começar</button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <span className="tag lbl a1">Tecnologia para o agronegócio angolano</span>
            <h1 className="disp a2">
              Conecta-te <span className="mk">ao mercado</span>.
            </h1>
            <p className="hero-copy a3">
              Compre para entrega imediata ou garanta a colheita futura. Feche acordos digitais e
              acompanhe a entrega numa só plataforma, ligando produtores, compradores e transportadores.
            </p>
            <div className="hero-actions a4">
              <button type="button" className="big" onClick={goToRegister}>Criar conta grátis <ArrowRight size={18} aria-hidden="true" /></button>
              <a className="textlink" href="#produto">Explorar a plataforma <ArrowDown size={15} aria-hidden="true" /></a>
            </div>
          </div>

          <div className="collage" aria-hidden="true">
            <div className="photo" />
            <div className="ticket num">
              <span className="stamp"><Check size={15} strokeWidth={3} /> Em garantia</span>
              <div className="tk-head"><b>AgriLink</b><span>Exemplo de negócio</span></div>
              <dl className="tk-body">
                <div><dt>Produto</dt><dd>Tomate</dd></div>
                <div><dt>Quantidade</dt><dd>2 t</dd></div>
                <div><dt>Origem</dt><dd>Caxito</dd></div>
                <div><dt>Destino</dt><dd>Rangel, Luanda</dd></div>
                <div><dt>Frete</dt><dd>Rota real</dd></div>
              </dl>
              <div className="tk-tear" />
              <div className="tk-foot">
                <span>Pagamento</span>
                <strong>Retido até à entrega</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREÇOS PUBLICADOS */}
      <div className="marq">
        <div className="wrap">
          <DailyProductPriceTicker />
        </div>
      </div>

      {/* FORMAS DE COMPRA */}
      <section className="sec" id="compra">
        <div className="wrap">
          <div className="rv">
            <span className="kick lbl">Formas de compra</span>
            <h2 className="h2 disp">Compre já ou garanta a colheita futura.</h2>
          </div>
          <div className="modes">
            <article className="mode now rv">
              <div className="mode-top">
                <span className="mode-icon" aria-hidden="true"><Zap size={24} /></span>
                <span className="mode-badge lbl">Imediata</span>
              </div>
              <h3 className="disp">Compra imediata</h3>
              <p>Escolha produtos que já estão colhidos e disponíveis na rede, feche o acordo e receba com a entrega acompanhada.</p>
              <div className="flow">
                <span>Escolhe</span><i>→</i><span>Fecha o acordo</span><i>→</i><span>Recebe</span>
              </div>
            </article>
            <article className="mode future rv" style={{ "--d": ".14s" } as React.CSSProperties}>
              <div className="mode-top">
                <span className="mode-icon" aria-hidden="true"><CalendarClock size={24} /></span>
                <span className="mode-badge lbl">Futura</span>
              </div>
              <h3 className="disp">Compra futura</h3>
              <p>Contrate hoje a colheita que ainda vai ser produzida, com quantidade e prazo acordados, e planeie o seu abastecimento.</p>
              <div className="flow">
                <span>Reserva</span><i>→</i><span>Aguarda a colheita</span><i>→</i><span>Recebe</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* PRODUTO */}
      <section className="sec" id="produto">
        <div className="wrap">
          <div className="rv">
            <span className="kick lbl">O produto</span>
            <h2 className="h2 disp">Tudo o que precisa para negociar melhor.</h2>
          </div>
          <div className="rules">
            {RULES.map((r, i) => (
              <article className="rule rv" style={{ "--d": `${i * 0.12}s` } as React.CSSProperties} key={r.n}>
                <span className="rule-n num" aria-hidden="true">{r.n}</span>
                <h3 className="disp">{r.title}</h3>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* RASTREIO */}
      <section className="sec" id="rastreio" aria-labelledby="tracking-title">
        <div className="wrap track">
          <div className="track-copy rv">
            <span className="kick lbl">Rastreio de cargas</span>
            <h2 className="h2 disp" id="tracking-title">Saiba onde está a sua entrega.</h2>
            <p>Acompanhe a rota e consulte os dados da carga no mapa, do envio à recepção.</p>
            <ul className="track-points">
              <li><MapPin size={20} aria-hidden="true" /> Localização da carga no mapa</li>
              <li><Navigation size={20} aria-hidden="true" /> Distância e previsão da rota</li>
              <li><ShieldCheck size={20} aria-hidden="true" /> Informação acessível durante a entrega</li>
            </ul>
          </div>
          <div className="phone-wrap rv" style={{ "--d": ".15s" } as React.CSSProperties}>
            <span className="pulse" aria-hidden="true" />
            <span className="pulse" aria-hidden="true" />
            <div className="phone">
              <img
                src={liveTrackingImage}
                alt="Ecrã de rastreio AgriLink com mapa da rota, carga, distância e botão para acompanhar"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* REDE: CLIENTES, PARCEIROS E COMUNIDADE */}
      <section className="sec" id="parceiros">
        <div className="wrap">
          <div className="rv">
            <span className="kick lbl">A rede</span>
            <h2 className="h2 disp">Já a negociar na AgriLink.</h2>
          </div>

          <div className="net rv" style={{ "--d": ".1s" } as React.CSSProperties}>
            <div className="cell big-cell">
              <span className="cell-label lbl">Cliente e parceiro</span>
              <img className="logo-big" src={casaLettoLogo} alt="Grupo CasaLetto" loading="lazy" />
              <div>
                <h3 className="disp">Grupo CasaLetto compra directo da fonte.</h3>
                <p>Compra directa a fornecedores da rede, com contrato digital e entrega acompanhada.</p>
                <a className="textlink" href="https://casaletto.co.ao/" target="_blank" rel="noreferrer">
                  Conhecer o Grupo <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="cell">
              <span className="cell-label lbl">Parceiro institucional</span>
              <div className="logos-pair">
                <img src={totalEnergiesLogo} alt="TotalEnergies" loading="lazy" />
                <img className="tall" src={totalEntrepreneursLogo} alt="TotalEnergies — 100 Anos, 100 Empreendedores" loading="lazy" />
              </div>
            </div>

            <div className="cell b photos">
              <figure>
                <img src={communityMeetupImage} alt="Encontro da comunidade AgriLink com produtores e parceiros" loading="lazy" />
                <figcaption>Encontros</figcaption>
              </figure>
              <figure>
                <img src={communityConferenceImage} alt="Membros da comunidade AgriLink em conversa" loading="lazy" />
                <figcaption>Comunidade</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* APP */}
      <section className="sec" id="app" aria-labelledby="app-title">
        <div className="wrap">
          <div className="app-panel rv">
            <div className="app-copy">
              <span className="kick lbl">App AgriLink</span>
              <h2 className="disp" id="app-title">Leve o mercado no bolso.</h2>
              <p>Negocie, pague em garantia e acompanhe cada entrega no telemóvel, onde estiver.</p>
              <div className="stores">
                <StoreButton href={PLAY_STORE_URL} icon={<Play size={18} fill="currentColor" />} small="Disponível no" name="Google Play" />
                <StoreButton href={APP_STORE_URL} icon={<Smartphone size={20} />} small="Descarregar na" name="App Store" />
              </div>
            </div>
            <div className="app-visual" aria-hidden="true">
              <span className="chip c1"><ShieldCheck size={16} /> Pagamento em garantia</span>
              <span className="chip c2"><Navigation size={16} /> Entrega a caminho</span>
              <div className="app-phone">
                <img src={liveTrackingImage} alt="" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="contacto">
        <div className="wrap cta-in rv">
          <div>
            <h2 className="disp">O seu próximo negócio agrícola <span className="mk mk-inv">começa aqui</span>.</h2>
            <p>Crie a conta em minutos e ligue-se à rede.</p>
          </div>
          <button type="button" className="big" onClick={goToRegister}>Criar conta <ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <div>
            <img src={agrilinkLogo} alt="AgriLink" />
            <p className="foot-name">AgriLink – Comércio e Serviços</p>
            <p className="num">NIF 5003313409</p>
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