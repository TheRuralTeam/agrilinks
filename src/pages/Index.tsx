import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronDown, Clock3, FileCheck2, Globe2, Home, Menu,
  Quote, Route, ShieldCheck, Sprout, Truck as TruckIcon, Users, Wallet, Warehouse, X,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTractor, faUserTie, faCartShopping, faTruck } from "@fortawesome/free-solid-svg-icons";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Mesma fonte de verdade de cor usada no ecrã de Cadastro — garante que
// a Landing e o Cadastro nunca desalinham de branding.
import { T } from "../lib/brand";

import orbisLinkLogo from "../assets/orbislink-logo.png";
import ttgiLogo from "../assets/ttgi.jpg";
import fotoFeliciano from "../assets/FELICIANO.jpeg";
import fotoMoises from "../assets/MOISES.jpeg";
import fotoLizeth from "../assets/LIZETH.jpeg";
import fotoClaudio from "../assets/CLAUDIO.jpeg";
import heroImage from "../assets/agrilink-community-conference.jpg";

// ─── Equipa ───────────────────────────────────────────────────────────────
const team = [
  { name: "Feliciano Cassoma", role: "Diretor-geral e fundador", image: fotoFeliciano },
  { name: "Moises Lucamba", role: "Diretor financeiro e fundador", image: fotoMoises },
  { name: "Claudio Henriques", role: "Diretor operacional e fundador", image: fotoClaudio },
  { name: "Lizeth Caieie", role: "Gestora da Comunidade AgriLink", image: fotoLizeth },
];

// ─── Papéis na plataforma — mesmas cores do ecrã de Cadastro ───────────────
const ROLES = [
  { id: "agricultor", label: "Fornecedor", desc: "Regista a colheita e vende directamente na rede, sem intermediários a mais.", icon: faTractor, color: "#2D7D3A" },
  { id: "agente", label: "Agente", desc: "Liga fornecedores a compradores e acompanha cada negociação até à entrega.", icon: faUserTie, color: "#C6871E" },
  { id: "comprador", label: "Comprador", desc: "Compra directo da fonte — em grande volume ou num ponto de agregação.", icon: faCartShopping, color: "#2563EB" },
  { id: "motorista", label: "Motorista", desc: "Transporta cargas entre o campo, os pontos de agregação e o destino final.", icon: faTruck, color: "#DB6B1F" },
];

// ─── Pontos de agregação ────────────────────────────────────────────────────
// NOTA: coordenadas aproximadas em Luanda, a confirmar com a equipa antes
// de publicar — os nomes ditados para "Estalagem/Golfe" e "Mangueirinhas"
// ficam marcados para revisão; "Congolenses" (Rangel) está confirmado.
type AggregationPoint = {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  note: string;
};

const AGGREGATION_POINTS: AggregationPoint[] = [
  {
    id: "congolenses",
    name: "Mercado dos Congolenses",
    area: "Rangel",
    lat: -8.8241,
    lng: 13.2645,
    note: "Um dos maiores mercados populares de Luanda, no coração do Rangel.",
  },
  {
    id: "golfe",
    name: "Estalagem — Golfe",
    area: "Kilamba Kiaxi",
    lat: -8.8967,
    lng: 13.2456,
    note: "Ponto de recolha junto à zona do Golfe, no Kilamba Kiaxi.",
  },
  {
    id: "mangueirinhas",
    name: "Mangueirinhas",
    area: "Kilamba Kiaxi",
    lat: -8.8814,
    lng: 13.2308,
    note: "Ponto de recolha para compradores da zona das Mangueirinhas.",
  },
];

const mapCenter: [number, number] = [
  AGGREGATION_POINTS.reduce((s, p) => s + p.lat, 0) / AGGREGATION_POINTS.length,
  AGGREGATION_POINTS.reduce((s, p) => s + p.lng, 0) / AGGREGATION_POINTS.length,
];

const networkLines: [number, number][][] = [
  [[AGGREGATION_POINTS[0].lat, AGGREGATION_POINTS[0].lng], [AGGREGATION_POINTS[1].lat, AGGREGATION_POINTS[1].lng]],
  [[AGGREGATION_POINTS[1].lat, AGGREGATION_POINTS[1].lng], [AGGREGATION_POINTS[2].lat, AGGREGATION_POINTS[2].lng]],
  [[AGGREGATION_POINTS[2].lat, AGGREGATION_POINTS[2].lng], [AGGREGATION_POINTS[0].lat, AGGREGATION_POINTS[0].lng]],
];

const pinIcon = (color: string) =>
  L.divIcon({
    className: "agrilink-pin-wrap",
    html: `<span class="agrilink-pin" style="--pin-color:${color}"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });

const productFeatures = [
  {
    icon: FileCheck2,
    title: "Contratos digitais",
    description: "Formalize compras, vendas e produção num único fluxo simples e rastreável.",
  },
  {
    icon: ShieldCheck,
    title: "Mais confiança",
    description: "Reduza incerteza com informação clara, documentação organizada e acordos registados.",
  },
  {
    icon: Globe2,
    title: "Mercado B2B",
    description: "Conecte produtores, agentes, compradores e transportadores num só sítio.",
  },
];

const steps = [
  "Regista a tua oferta ou a tua necessidade na rede.",
  "A AgriLink liga-te ao parceiro certo — fornecedor, agente ou comprador.",
  "Escolhe como recebes: entrega directa ou levantamento num ponto de agregação.",
];

// TODO(TIO): substituir pelos números reais da plataforma antes de publicar.
const stats = [
  { value: "3", label: "pontos de agregação activos em Luanda" },
  { value: "4", label: "papéis na rede — de quem produz a quem entrega" },
  { value: "100%", label: "pagamentos retidos em garantia até à entrega" },
  { value: "24h", label: "tempo médio para ligar oferta a comprador" },
];

// ─── O motor do produto — mecânica real da plataforma ──────────────────────
const engineFeatures = [
  {
    icon: Route,
    tag: "Frete",
    title: "Preço de transporte calculado pela rota real",
    description: "Cada frete é orçamentado a partir da distância e das estradas efectivas entre origem e destino, não de uma estimativa em linha recta — o motorista e o comprador sabem o custo antes de aceitar.",
  },
  {
    icon: Users,
    tag: "Match",
    title: "Ligação automática entre oferta e procura",
    description: "Compradores definem o que precisam de forma recorrente — produto, quantidade, zona — e a AgriLink liga essa necessidade a novos lotes assim que eles entram na rede.",
  },
  {
    icon: Wallet,
    tag: "Pagamento",
    title: "Dinheiro retido em garantia até à entrega",
    description: "O comprador deposita na plataforma, o valor fica retido, e só é libertado ao fornecedor e ao motorista quando a entrega é confirmada por ambas as partes.",
  },
  {
    icon: TruckIcon,
    tag: "Logística",
    title: "O motorista escolhe a carga que transporta",
    description: "Cada motorista vê as cargas disponíveis na sua zona e aceita as que lhe convêm — sem despacho central a impor rotas.",
  },
];

// TODO(TIO): substituir por testemunhos reais de fornecedores, agentes e
// compradores assim que existirem — mantidos como placeholder por agora.
const testimonials = [
  {
    quote: "Antes vendia a quem aparecesse no mercado. Agora sei com quem estou a negociar antes de carregar o camião.",
    name: "[Nome do fornecedor]",
    role: "Fornecedor — Huambo",
    color: T.g600,
  },
  {
    quote: "Deixei de perder dias à procura de comprador para cada lote — a rede liga-me a quem já está à procura.",
    name: "[Nome do agente]",
    role: "Agente — Luanda",
    color: T.gold,
  },
  {
    quote: "Sei o preço do frete antes de aceitar a carga, e o pagamento chega assim que confirmo a entrega.",
    name: "[Nome do motorista]",
    role: "Motorista — Kilamba Kiaxi",
    color: "#2563EB",
  },
];

const faqs = [
  {
    q: "Como é que o pagamento fica protegido?",
    a: "O valor do comprador fica retido em garantia dentro da plataforma assim que o contrato é aceite, e só é libertado ao fornecedor e ao motorista depois da entrega confirmada por ambas as partes.",
  },
  {
    q: "Preciso de camião próprio para vender na AgriLink?",
    a: "Não. Podes registar a colheita e escolher entre entrega por um motorista da rede ou levantamento por um comprador num ponto de agregação.",
  },
  {
    q: "Como é calculado o preço do transporte?",
    a: "O frete é calculado com base na rota real entre a origem e o destino, para que o custo apresentado reflicta a distância e as estradas que o motorista vai percorrer.",
  },
  {
    q: "O que acontece se eu comprar um volume pequeno?",
    a: "És ligado ao ponto de agregação mais próximo, onde levantas o produto ao preço de produtor, sem precisares de receber uma entrega directa em grande escala.",
  },
];

export default function AgriLinkLanding() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  const goToRegister = () => navigate("/cadastro");

  return (
    <main
      className="agrilink-page"
      style={
        {
          "--ink": T.ink,
          "--muted": T.muted,
          "--line": T.rule,
          "--soft": T.canvas,
          "--white": T.white,
          "--green": T.g600,
          "--green-dark": T.g900,
          "--green-light": T.g400,
          "--gold": T.gold,
          "--gold-light": T.goldL,
          "--gold-bg": T.goldBg,
        } as React.CSSProperties
      }
    >
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .agrilink-page { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; color: var(--ink); background: var(--white); overflow: hidden; }
        .agrilink-page button, .agrilink-page a { font: inherit; }
        .agrilink-page button { cursor: pointer; }
        .agrilink-page a { color: inherit; text-decoration: none; }

        .container { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }

        .nav { position: absolute; z-index: 20; inset: 0 0 auto; border-bottom: 1px solid rgba(255,255,255,.16); color: white; }
        .nav-inner { height: 78px; display: flex; align-items: center; justify-content: space-between; gap: 28px; }
        .brand img { width: 142px; display: block; filter: brightness(0) invert(1); }
        .nav-links { display: flex; align-items: center; gap: 28px; font-size: 13px; color: rgba(255,255,255,.8); }
        .nav-links a:hover { color: white; }
        .nav-actions { display: flex; align-items: center; gap: 10px; }
        .login-btn { color: white; border: 1px solid rgba(255,255,255,.35); background: transparent; border-radius: 999px; padding: 10px 18px; font-size: 13px; font-weight: 600; }
        .register-btn { color: var(--green-dark); border: 0; background: var(--gold-light); border-radius: 999px; padding: 11px 19px; font-weight: 800; font-size: 13px; }
        .menu-button { display: none; border: 0; background: transparent; color: white; }

        .hero { min-height: 720px; position: relative; display: flex; align-items: center; color: white; background: linear-gradient(100deg, ${T.g900} 0%, rgba(16,35,26,.74) 46%, rgba(16,35,26,.18) 100%), url(${heroImage}) center/cover; }
        .hero-content { position: relative; z-index: 1; padding: 132px 0 92px; max-width: 700px; }
        .eyebrow { display: inline-flex; align-items: center; gap: 9px; color: var(--gold-light); font-size: 13px; font-weight: 700; }
        .eyebrow::before { content: ''; width: 26px; height: 2px; background: var(--gold-light); }
        .hero h1 { margin: 20px 0 22px; font-weight: 800; font-size: clamp(36px, 5.4vw, 58px); line-height: 1.08; letter-spacing: -0.02em; }
        .hero-copy { max-width: 540px; color: rgba(255,255,255,.8); font-size: 17px; line-height: 1.75; font-weight: 500; }
        .hero-actions { margin-top: 34px; display: flex; flex-wrap: wrap; gap: 12px; }
        .btn-primary, .btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 9px; border-radius: 999px; padding: 15px 23px; font-size: 14px; font-weight: 700; transition: transform .18s ease, background .18s ease, box-shadow .18s ease; }
        .btn-primary { border: 0; background: var(--gold-light); color: var(--green-dark); }
        .btn-ghost { border: 1px solid rgba(255,255,255,.35); color: white; background: rgba(255,255,255,.05); }
        .btn-primary:hover, .btn-ghost:hover { transform: translateY(-2px); }
        .btn-ghost:hover { background: rgba(255,255,255,.12); }

        .stats-bar { position: relative; z-index: 2; margin-top: -56px; background: var(--white); border-radius: 22px; box-shadow: 0 18px 44px rgba(16,35,26,.14); display: grid; grid-template-columns: repeat(4, 1fr); }
        .stat { padding: 26px 22px; border-left: 1px solid var(--line); }
        .stat:first-child { border-left: 0; }
        .stat-value { font-size: 30px; font-weight: 800; color: var(--green); letter-spacing: -0.02em; }
        .stat-label { margin-top: 4px; color: var(--muted); font-size: 12.5px; line-height: 1.5; font-weight: 500; max-width: 20ch; }

        .intro { padding: 108px 0 96px; }
        .intro-grid { display: grid; grid-template-columns: .82fr 1.18fr; gap: 80px; align-items: start; }
        .section-title { margin: 14px 0 16px; font-weight: 800; font-size: clamp(28px, 3.4vw, 42px); line-height: 1.12; letter-spacing: -0.02em; }
        .section-copy { color: var(--muted); font-size: 15.5px; line-height: 1.8; max-width: 520px; font-weight: 500; }
        .feature-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .feature { border-top: 1px solid var(--line); padding-top: 20px; }
        .feature-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: var(--gold-bg); color: var(--green); margin-bottom: 24px; }
        .feature h3 { margin: 0 0 9px; font-size: 15.5px; font-weight: 800; }
        .feature p { margin: 0; color: var(--muted); font-size: 13.5px; line-height: 1.65; font-weight: 500; }

        /* ── Papéis (mesmo vocabulário visual do Cadastro) ───────────────── */
        .roles { background: var(--soft); padding: 100px 0; }
        .roles-head { max-width: 600px; margin-bottom: 44px; }
        .roles-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .role-card { background: var(--white); border: 1.5px solid var(--line); border-radius: 20px; padding: 26px 22px; transition: transform .18s ease, border-color .18s ease; }
        .role-card:hover { transform: translateY(-3px); }
        .role-icon { width: 46px; height: 46px; border-radius: 13px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .role-card h3 { margin: 0 0 8px; font-size: 16px; font-weight: 800; }
        .role-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; font-weight: 500; }

        /* ── O motor do produto ───────────────────────────────────────────── */
        .engine { padding: 108px 0; }
        .engine-head { max-width: 600px; margin-bottom: 44px; }
        .engine-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .engine-card { border: 1.5px solid var(--line); border-radius: 20px; padding: 26px 26px 24px; }
        .engine-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
        .engine-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: var(--gold-bg); color: var(--green); }
        .engine-tag { font-size: 11.5px; font-weight: 800; color: var(--gold); background: var(--gold-bg); border-radius: 999px; padding: 5px 12px; }
        .engine-card h3 { margin: 0 0 10px; font-size: 16.5px; font-weight: 800; line-height: 1.35; }
        .engine-card p { margin: 0; color: var(--muted); font-size: 13.5px; line-height: 1.65; font-weight: 500; }

        /* ── Testemunhos ───────────────────────────────────────────────────── */
        .testimonials { background: var(--soft); padding: 100px 0; }
        .testimonials-head { max-width: 560px; margin-bottom: 40px; }
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .testimonial-card { background: var(--white); border: 1.5px solid var(--line); border-radius: 20px; padding: 28px 24px; display: flex; flex-direction: column; }
        .testimonial-quote { margin: 0 0 22px; font-size: 14.5px; line-height: 1.7; font-weight: 600; color: var(--ink); flex: 1; }
        .testimonial-who { display: flex; align-items: center; gap: 11px; }
        .testimonial-avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 14px; flex-shrink: 0; }
        .testimonial-name { font-size: 13px; font-weight: 800; }
        .testimonial-role { font-size: 12px; color: var(--muted); font-weight: 500; margin-top: 1px; }

        /* ── FAQ ──────────────────────────────────────────────────────────── */
        .faq { padding: 108px 0; }
        .faq-inner { display: grid; grid-template-columns: .8fr 1.2fr; gap: 64px; align-items: start; }
        .faq-head { max-width: 380px; }
        .faq-list { display: flex; flex-direction: column; }
        .faq-item { border-top: 1px solid var(--line); }
        .faq-item:last-child { border-bottom: 1px solid var(--line); }
        .faq-question { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: transparent; border: 0; padding: 22px 2px; text-align: left; font-size: 15px; font-weight: 700; color: var(--ink); }
        .faq-chevron { flex-shrink: 0; color: var(--green); transition: transform .2s ease; }
        .faq-item.open .faq-chevron { transform: rotate(180deg); }
        .faq-answer { margin: -6px 2px 22px; color: var(--muted); font-size: 13.5px; line-height: 1.7; font-weight: 500; max-width: 56ch; }

        /* ── Pontos de agregação ──────────────────────────────────────────── */
        .aggregation { padding: 112px 0 100px; position: relative; }
        .aggregation-head { max-width: 640px; margin: 0 auto 20px; text-align: center; }
        .aggregation-head .eyebrow { color: var(--gold); }
        .aggregation-head .eyebrow::before { background: var(--gold); }
        .aggregation-explainer { max-width: 760px; margin: 0 auto 56px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .explain-card { border: 1.5px solid var(--line); border-radius: 18px; padding: 22px 24px; background: var(--white); }
        .explain-card .row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .explain-card .row-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .explain-card h4 { margin: 0; font-size: 14.5px; font-weight: 800; }
        .explain-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; font-weight: 500; }

        .map-block { position: relative; border-radius: 28px; padding: 3px; background: linear-gradient(135deg, var(--green), var(--gold)); }
        .map-block::before { content: ''; position: absolute; inset: -60px; background: radial-gradient(closest-side, rgba(45,125,58,.12), transparent 72%); z-index: -1; }
        .map-inner { border-radius: 25px; overflow: hidden; background: var(--white); display: grid; grid-template-columns: 1.5fr 1fr; min-height: 460px; }
        .map-canvas { position: relative; }
        .map-canvas .leaflet-container { height: 100%; width: 100%; min-height: 460px; background: #eef3ea; }
        .map-legend { padding: 30px 26px; display: flex; flex-direction: column; gap: 0; border-left: 1px solid var(--line); }
        .map-legend-head { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--gold); margin-bottom: 4px; }
        .map-legend h3 { margin: 2px 0 18px; font-size: 19px; font-weight: 800; line-height: 1.25; }
        .point-row { display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid var(--line); }
        .point-row:first-of-type { border-top: 1px solid var(--line); }
        .point-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--green); margin-top: 6px; flex-shrink: 0; box-shadow: 0 0 0 4px rgba(45,125,58,.14); }
        .point-row strong { display: block; font-size: 13.5px; font-weight: 800; }
        .point-row span { display: block; font-size: 12px; color: var(--muted); font-weight: 500; margin-top: 2px; line-height: 1.5; }

        .agrilink-pin { position: relative; display: block; width: 28px; height: 28px; }
        .agrilink-pin::before { content: ''; position: absolute; inset: 0; background: var(--pin-color); border: 3px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 3px 10px rgba(0,0,0,.28); }
        .agrilink-flow-line { stroke-dasharray: 8 7; animation: flow 2.6s linear infinite; }
        @keyframes flow { to { stroke-dashoffset: -60; } }
        @media (prefers-reduced-motion: reduce) { .agrilink-flow-line { animation: none; } }

        .steps-strip { padding: 0 0 112px; }
        .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .step-card { border-top: 2px solid var(--green); padding-top: 20px; }
        .step-num { color: var(--green); font-weight: 800; font-size: 26px; }
        .step-card p { margin: 6px 0 0; color: var(--muted); font-size: 14px; line-height: 1.6; font-weight: 500; }

        .team { padding: 108px 0; }
        .team-head { max-width: 550px; margin-bottom: 46px; }
        .team-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .team-card { border-top: 1px solid var(--line); padding-top: 14px; }
        .team-card img { width: 100%; aspect-ratio: 1 / 1.12; object-fit: cover; border-radius: 18px; filter: saturate(.85); display: block; margin-bottom: 16px; }
        .team-name { font-size: 15.5px; font-weight: 800; }
        .team-role { margin-top: 4px; color: var(--muted); font-size: 12.5px; font-weight: 500; }

        .cta { padding: 20px 0 100px; }
        .cta-box { position: relative; overflow: hidden; border-radius: 26px; padding: 64px; background: var(--green); color: white; display: flex; align-items: end; justify-content: space-between; gap: 40px; }
        .cta-box::after { content: ''; position: absolute; width: 340px; height: 340px; right: -110px; top: -160px; border-radius: 50%; border: 1px solid rgba(255,255,255,.18); box-shadow: 0 0 0 36px rgba(255,255,255,.04), 0 0 0 74px rgba(255,255,255,.04); }
        .cta-box > * { position: relative; z-index: 1; }
        .cta-box h2 { margin: 14px 0 14px; max-width: 600px; font: 800 clamp(30px, 4.2vw, 46px)/1.08 inherit; letter-spacing: -0.02em; }
        .cta-box p { margin: 0; max-width: 480px; color: rgba(255,255,255,.78); line-height: 1.7; font-weight: 500; }
        .cta-box .btn-primary { white-space: nowrap; }

        footer { background: var(--green-dark); color: white; padding: 42px 0 28px; }
        .footer-inner { display: grid; grid-template-columns: 1.1fr 1fr 1fr; align-items: start; gap: 36px; }
        .footer-brand img { width: 124px; filter: brightness(0) invert(1); }
        .footer-copy { color: rgba(255,255,255,.5); font-size: 12px; line-height: 1.6; }
        .footer-company { margin-top: 16px; color: rgba(255,255,255,.68); font-size: 12px; line-height: 1.7; }
        .footer-company strong { display: block; color: white; font-size: 13px; margin-bottom: 4px; }
        .footer-contact { color: rgba(255,255,255,.65); font-size: 12px; line-height: 1.9; }
        .footer-contact a { color: var(--gold-light); }
        .footer-ttgi { display: flex; align-items: center; justify-content: flex-end; gap: 12px; color: rgba(255,255,255,.5); font-size: 11px; text-align: right; }
        .footer-ttgi img { width: 86px; max-height: 52px; object-fit: contain; border-radius: 8px; background: white; padding: 5px; }

        @media (max-width: 900px) {
          .footer-inner { grid-template-columns: 1fr; gap: 22px; }
          .footer-ttgi { justify-content: flex-start; text-align: left; }
          .nav-links, .nav-actions { display: none; }
          .menu-button { display: block; }
          .nav.mobile-open { background: var(--green-dark); }
          .nav.mobile-open .nav-inner { height: auto; padding: 20px 0; align-items: flex-start; flex-wrap: wrap; }
          .nav.mobile-open .nav-links, .nav.mobile-open .nav-actions { display: flex; }
          .nav.mobile-open .nav-links { order: 3; width: 100%; flex-direction: column; align-items: flex-start; padding: 20px 0 5px; }
          .nav.mobile-open .nav-actions { order: 4; width: 100%; justify-content: flex-start; }
          .intro-grid { grid-template-columns: 1fr; gap: 44px; }
          .roles-grid { grid-template-columns: repeat(2, 1fr); }
          .stats-bar { grid-template-columns: repeat(2, 1fr); }
          .stat:nth-child(3) { border-left: 0; }
          .engine-grid { grid-template-columns: 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .faq-inner { grid-template-columns: 1fr; gap: 28px; }
          .aggregation-explainer { grid-template-columns: 1fr; }
          .map-inner { grid-template-columns: 1fr; }
          .map-canvas .leaflet-container, .map-canvas { min-height: 320px; }
          .steps-grid { grid-template-columns: 1fr; }
          .team-grid { grid-template-columns: repeat(2, 1fr); }
          .cta-box { padding: 44px 30px; display: block; }
          .cta-box .btn-primary { margin-top: 26px; }
        }
        @media (max-width: 580px) {
          .container { width: min(100% - 32px, 1160px); }
          .hero { min-height: 640px; }
          .hero-content { padding-top: 132px; }
          .feature-list, .roles-grid, .team-grid { grid-template-columns: 1fr; }
          .intro, .roles, .team, .engine, .testimonials, .faq { padding: 72px 0; }
          .aggregation { padding: 76px 0 72px; }
          .stats-bar { grid-template-columns: 1fr; margin-top: -32px; border-radius: 18px; }
          .stat { border-left: 0; border-top: 1px solid var(--line); }
          .stat:first-child { border-top: 0; }
          .footer-inner { align-items: flex-start; flex-direction: column; }
        }
      `}</style>

      <nav className={`nav ${menuOpen ? "mobile-open" : ""}`}>
        <div className="container nav-inner">
          <a className="brand" href="#top" aria-label="AgriLink">
            <img src={orbisLinkLogo} alt="AgriLink" />
          </a>
          <div className="nav-links">
            <a href="#produto">Produto</a>
            <a href="#tecnologia">Como funciona</a>
            <a href="#agregacao">Pontos de agregação</a>
            <a href="#faq">FAQ</a>
            <a href="#equipa">Equipa</a>
          </div>
          <div className="nav-actions">
            <button className="login-btn" onClick={() => navigate("/login")}>Entrar</button>
            <button className="register-btn" onClick={goToRegister}>Começar</button>
          </div>
          <button className="menu-button" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menu">
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="container hero-content">
          <div className="eyebrow">Mercado agrícola digital de Angola</div>
          <h1>A tua produção, o teu negócio, numa rede que se encontra.</h1>
          <p className="hero-copy">
            A AgriLink liga fornecedores, agentes, compradores e motoristas num só sítio —
            e leva o produto até quem compra em grande volume ou até ao ponto de agregação
            mais próximo de quem compra menos.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={goToRegister}>Aceder à plataforma <ArrowRight size={16} /></button>
            <a className="btn-ghost" href="#agregacao">Ver pontos de agregação</a>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="stats-bar">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="intro" id="produto">
        <div className="container intro-grid">
          <div>
            <div className="eyebrow" style={{ color: T.g600 }}>
              <span style={{ display: "inline-block", width: 26, height: 2, background: T.g600 }} />
            </div>
            <h2 className="section-title">Menos incerteza. Mais negócio.</h2>
            <p className="section-copy">
              A AgriLink transforma relações dispersas em operações claras: aproxima quem
              produz de quem compra, formaliza o acordo e acompanha a carga até chegar
              ao destino certo — seja uma casa, um armazém ou um ponto de agregação.
            </p>
          </div>
          <div className="feature-list">
            {productFeatures.map(({ icon: Icon, title, description }) => (
              <article className="feature" key={title}>
                <div className="feature-icon"><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Papéis na plataforma ──────────────────────────────────────────── */}
      <section className="roles">
        <div className="container">
          <div className="roles-head">
            <div className="eyebrow" style={{ color: T.gold }}>
              <span style={{ display: "inline-block", width: 26, height: 2, background: T.gold }} />
            </div>
            <h2 className="section-title">Uma rede, quatro papéis.</h2>
            <p className="section-copy">Cada conta AgriLink tem o seu lugar próprio na cadeia — do campo até à mesa.</p>
          </div>
          <div className="roles-grid">
            {ROLES.map((role) => (
              <article className="role-card" key={role.id} style={{ borderColor: `${role.color}33` }}>
                <div className="role-icon" style={{ background: `${role.color}1E` }}>
                  <FontAwesomeIcon icon={role.icon} style={{ color: role.color, fontSize: 18 }} />
                </div>
                <h3 style={{ color: role.color }}>{role.label}</h3>
                <p>{role.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── O motor do produto ────────────────────────────────────────────── */}
      <section className="engine" id="tecnologia">
        <div className="container">
          <div className="engine-head">
            <div className="eyebrow" style={{ color: T.g600 }}>
              <span style={{ display: "inline-block", width: 26, height: 2, background: T.g600 }} />
              Como funciona por dentro
            </div>
            <h2 className="section-title">Não é só um catálogo. É a operação toda.</h2>
            <p className="section-copy">
              Por trás de cada negócio fechado na AgriLink há regras concretas a proteger
              as duas partes — do preço do frete ao momento exacto em que o dinheiro muda de mãos.
            </p>
          </div>
          <div className="engine-grid">
            {engineFeatures.map(({ icon: Icon, tag, title, description }) => (
              <article className="engine-card" key={title}>
                <div className="engine-card-top">
                  <div className="engine-icon"><Icon size={19} /></div>
                  <span className="engine-tag">{tag}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pontos de agregação ───────────────────────────────────────────── */}
      <section className="aggregation" id="agregacao">
        <div className="container">
          <div className="aggregation-head">
            <div className="eyebrow" style={{ justifyContent: "center" }}>Pontos de agregação</div>
            <h2 className="section-title">A entrega certa para cada tipo de compra.</h2>
            <p className="section-copy" style={{ margin: "0 auto" }}>
              Nem todo o comprador consegue levar um camião de tomate para casa —
              e é por isso que a AgriLink tem pontos de agregação: locais próximos
              onde compradores informais e de pequena escala levantam os seus produtos
              ao preço de quem produz.
            </p>
          </div>

          <div className="aggregation-explainer">
            <div className="explain-card">
              <div className="row">
                <div className="row-icon" style={{ background: `${T.g600}1E` }}>
                  <Home size={17} color={T.g600} />
                </div>
                <h4>Grande volume</h4>
              </div>
              <p>Quem compra em grande quantidade recebe entrega directa em casa ou no armazém — sem paragens intermédias.</p>
            </div>
            <div className="explain-card">
              <div className="row">
                <div className="row-icon" style={{ background: `${T.gold}1E` }}>
                  <Warehouse size={17} color={T.gold} />
                </div>
                <h4>Pequeno volume</h4>
              </div>
              <p>Quem compra menos levanta no ponto de agregação mais próximo — mais barato para todos, sem perder acesso ao preço de produtor.</p>
            </div>
          </div>

          <div className="map-block">
            <div className="map-inner">
              <div className="map-canvas">
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  scrollWheelZoom={false}
                  attributionControl={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {networkLines.map((line, i) => (
                    <Polyline
                      key={i}
                      positions={line}
                      pathOptions={{ color: T.g600, weight: 2.5, opacity: 0.55, className: "agrilink-flow-line" }}
                    />
                  ))}
                  {AGGREGATION_POINTS.map((point) => (
                    <Marker key={point.id} position={[point.lat, point.lng]} icon={pinIcon(T.g600)}>
                      <Tooltip direction="top" offset={[0, -26]}>
                        <strong>{point.name}</strong><br />{point.area}
                      </Tooltip>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div className="map-legend">
                <span className="map-legend-head">Rede activa</span>
                <h3>Os nossos 3 pontos de agregação em Luanda</h3>
                {AGGREGATION_POINTS.map((point) => (
                  <div className="point-row" key={point.id}>
                    <span className="point-dot" />
                    <div>
                      <strong>{point.name} — {point.area}</strong>
                      <span>{point.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="steps-strip">
        <div className="container">
          <div className="steps-grid">
            {steps.map((step, i) => (
              <div className="step-card" key={step}>
                <div className="step-num">0{i + 1}</div>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testemunhos ──────────────────────────────────────────────────── */}
      <section className="testimonials">
        <div className="container">
          <div className="testimonials-head">
            <div className="eyebrow" style={{ color: T.gold }}>
              <span style={{ display: "inline-block", width: 26, height: 2, background: T.gold }} />
              Quem já está na rede
            </div>
            <h2 className="section-title">Contado por quem usa, não por nós.</h2>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t) => (
              <article className="testimonial-card" key={t.name}>
                <Quote size={22} color={t.color} style={{ marginBottom: 16 }} />
                <p className="testimonial-quote">{t.quote}</p>
                <div className="testimonial-who">
                  <span className="testimonial-avatar" style={{ background: `${t.color}1E`, color: t.color }}>
                    {t.name.replace(/[\[\]]/g, "").charAt(0)}
                  </span>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="faq" id="faq">
        <div className="container faq-inner">
          <div className="faq-head">
            <div className="eyebrow" style={{ color: T.g600 }}>
              <span style={{ display: "inline-block", width: 26, height: 2, background: T.g600 }} />
              Perguntas frequentes
            </div>
            <h2 className="section-title">Antes de começar.</h2>
            <p className="section-copy">Se tiver outra dúvida, fale connosco pelos contactos no fundo da página.</p>
          </div>
          <div className="faq-list">
            {faqs.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div className={`faq-item ${isOpen ? "open" : ""}`} key={item.q}>
                  <button className="faq-question" onClick={() => setOpenFaq(isOpen ? null : i)} aria-expanded={isOpen}>
                    {item.q}
                    <ChevronDown size={18} className="faq-chevron" />
                  </button>
                  {isOpen && <p className="faq-answer">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="team" id="equipa">
        <div className="container">
          <div className="team-head">
            <div className="eyebrow">Quem está a construir</div>
            <h2 className="section-title">Uma equipa próxima do terreno.</h2>
            <p className="section-copy">
              Tecnologia só cria impacto quando entende as pessoas que a utilizam. É por
              isso que a nossa equipa combina produto, operações, comunidade e visão estratégica.
            </p>
          </div>
          <div className="team-grid">
            {team.map((member) => (
              <article className="team-card" key={member.name}>
                <img src={member.image} alt={member.name} loading="lazy" />
                <div className="team-name">{member.name}</div>
                <div className="team-role">{member.role}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta" id="contacto">
        <div className="container">
          <div className="cta-box">
            <div>
              <div className="eyebrow" style={{ color: "rgba(255,255,255,.85)" }}>
                <span style={{ display: "inline-block", width: 26, height: 2, background: "rgba(255,255,255,.85)" }} />
                Próximo passo
              </div>
              <h2>Faça parte da próxima fase do agronegócio angolano.</h2>
              <p>Se produz, compra, transporta ou liga negócios agroalimentares, a AgriLink foi criada para si.</p>
            </div>
            <button className="btn-primary" onClick={goToRegister}>Criar conta <ArrowRight size={16} /></button>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-inner">
          <div>
            <a className="footer-brand" href="#top"><img src={orbisLinkLogo} alt="AgriLink" /></a>
            <div className="footer-company">
              <strong>The Team - Comércio e Serviços, Lda.</strong>
              Empresa gestora da plataforma AgriLink.
            </div>
          </div>
          <div>
            <div className="footer-contact">
              <strong style={{ color: "white" }}>Contactos</strong><br />
              <a href="mailto:contacto@agrilink.ao">contacto@agrilink.ao</a><br />
              <a href="tel:+244937577782">+244 937 577 782</a>
            </div>
            <div className="footer-copy" style={{ marginTop: 12 }}>© 2025 AgriLink. Todos os direitos reservados.</div>
          </div>
          <div className="footer-ttgi">
            <span>Uma plataforma gerida por</span>
            <img src={ttgiLogo} alt="The Team - Comércio e Serviços, Lda." />
          </div>
        </div>
      </footer>
    </main>
  );
}