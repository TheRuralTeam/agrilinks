import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouseLaptop, faBullseye, faHandshake, faWheatAwn, faGlobe, faUserPlus, faRightToBracket, faShieldHalved, faUsers, faSeedling, faChartLine, faCircleCheck, faEnvelopeCircleCheck, faRoute, faLeaf } from '@fortawesome/free-solid-svg-icons'

// ═══════════════════════════════════════════════════════════════
// IMPORTAÇÃO DAS FOTOS DA EQUIPE E LOGO (com fallbacks)
// ═══════════════════════════════════════════════════════════════
import orbisLinkLogo from '@/assets/orbislink-logo.png';
import fotoFeliciano from '@/assets/FELICIANO.jpeg';
import fotoMoises from '@/assets/MOISES.jpeg';
import fotoLizeth from '@/assets/LIZETH.jpeg';
import fotoClaudio from '@/assets/CLAUDIO.jpeg';
import comunidadeImg from '@/assets/agrilink-community-conference.jpg';
import comunidadeImg2 from '@/assets/agrilink-meetup.jpg';
import MarketPriceTicker from '@/components/MarketPriceTicker';


/* ─────────────────────────────────────────────────────────────────────────
   DESIGN — "Selo Vivo" (Living Seal)
   Paleta: branco/preto com um verde profundo e vibrante como cor de ação,
   e um fio de dourado usado apenas como assinatura — nunca como decoração.
   O elemento de assinatura do site é o SELO no cartão de acesso (login /
   cadastro): um anel dourado que gira devagar como um selo de autenticação
   de contrato a ser validado — liga a estética diretamente ao produto
   (contratos digitais, rastreabilidade, confiança institucional).
   ───────────────────────────────────────────────────────────────────────── */
const T = {
  ink:      '#08110D',
  ink80:    '#0F1A14',
  ink60:    '#22322A',
  mid:      '#4C5C53',
  muted:    '#7C8B81',
  faint:    '#B7C2BA',
  rule:     '#E3E9E2',
  ruleSoft: '#EEF2EB',
  surface:  '#F5F8F3',
  canvas:   '#FFFFFF',
  accent:      '#7CB342',
  accentDeep:  '#5F8E2F',
  accentVivid: '#7CB342',
  accentPale:  '#E9F4EC',
  gold:     '#C7A02E',
  goldSoft: '#E4C567',
  goldPale: '#FBF5E3',
  fontDisplay: "'Fraunces', 'DM Serif Display', Georgia, serif",
  fontSans: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
  radius:  '6px',
  radiusMd:'10px',
  radiusLg:'20px',
  shadowSm: '0 1px 3px rgba(8,17,13,0.06)',
  shadowMd: '0 8px 28px rgba(8,17,13,0.08)',
  shadowLg: '0 20px 60px rgba(8,17,13,0.14)',
}

/* ─── i18n ───────────────────────────────────────────────────────────────────── */
const LANGS = {
  pt: {
    nav: { platform: 'Plataforma', models: 'Modelos', team: 'Equipa', contact: 'Contacto', login: 'Entrar', register: 'Registar' },
    hero: {
      location: 'Luanda · Torre 1 · Total Energies Angola · Coworking 100 Empreendedores',
      eyebrow: 'Mercado Agroalimentar B2B',
      title1: 'A Cadeia Alimentar',
      title2: 'Digital de Angola',
      sub: 'Contratos digitais de compra, venda e produção. Importação e exportação com rastreabilidade total. Conectamos produtores, empresas e compradores institucionais.',
      cta1: 'Aceder à Plataforma',
      cta2: 'Saber Mais',
    },
    stats: [
      { n: '3', label: 'Modelos de Negócio' },
      { n: 'B2B', label: 'Plataforma Institucional' },
      { n: '100%', label: 'Contratos Digitais' },
      { n: '3', label: 'Idiomas Suportados' },
    ],
    models: {
      eyebrow: 'Como Operamos',
      title: 'Quatro Modelos de Atuação',
      sub: 'Escolha o modelo que melhor se adapta ao seu negócio agroalimentar.',
      list: [
        { num: '01', name: 'Compra Direta', tag: 'Modelo Informal', desc: 'A AgriLink compra diretamente aos produtores e revende nos mercados informais, criando fluxo imediato de caixa para o agricultor.' },
        { num: '02', name: 'Procurement Dedicado', tag: 'AgriLink Sourcing Premium', desc: 'Identificamos e garantimos o fornecimento de produtos específicos para empresas. Sourcing gerido, rastreado e certificado digitalmente.' },
        { num: '03', name: 'Produção por Contrato', tag: 'On-Demand', desc: 'Agricultores produzem segundo fichas técnicas dos fabricantes. Contratos digitais, prazos definidos e pagamento garantido à produção.' },
        { num: '04', name: 'Pré-Compra Digital', tag: 'Marketplace', desc: 'Adquira antecipadamente colheitas futuras. Preços fixados hoje, entrega garantida na época. Totalmente digital e rastreável.' },
      ],
    },
    features: {
      eyebrow: 'Infraestrutura',
      title: 'Tecnologia ao Serviço da Agricultura',
      list: [
        { t: 'Contratos Digitais', d: 'Validade legal plena com rastreabilidade imutável em cada transação.' },
        { t: 'Importação & Exportação', d: 'Operações transfronteiriças com documentação integrada e certificada.' },
        { t: 'Mercado de Futuros', d: 'Preços e volumes negociados antecipadamente com segurança jurídica.' },
        { t: 'Plataforma B2B', d: 'Desenhada para empresas, cooperativas e distribuidores institucionais.' },
      ],
    },
    team: {
      eyebrow: 'Liderança',
      title: 'A Nossa Equipa',
      sub: 'Profissionais com visão de longo prazo construindo a infraestrutura digital do agronegócio angolano.',
    },
    cta: {
      eyebrow: 'Próximo Passo',
      title: 'Pronto para Transformar a sua Cadeia Agroalimentar?',
      sub: 'Junte-se à plataforma que está a digitalizar o agronegócio em África.',
      btn: 'Começar Agora',
    },
    footer: { rights: '© 2025 AgriLink Lda. Todos os direitos reservados.' },
  },
  fr: {
    nav: { platform: 'Plateforme', models: 'Modèles', team: 'Équipe', contact: 'Contact', login: 'Connexion', register: "S'inscrire" },
    hero: {
      location: 'Luanda · Tour 1 · Total Energies Angola · Coworking 100 Entrepreneurs',
      eyebrow: 'Marché Agroalimentaire B2B',
      title1: "La Chaîne Alimentaire",
      title2: "Digitale d'Angola",
      sub: "Contrats numériques d'achat, vente et production. Import-export avec traçabilité totale. Nous connectons producteurs, entreprises et acheteurs institutionnels.",
      cta1: 'Accéder à la Plateforme',
      cta2: 'En Savoir Plus',
    },
    stats: [
      { n: '3', label: "Modèles d'Activité" },
      { n: 'B2B', label: 'Plateforme Institutionnelle' },
      { n: '100%', label: 'Contrats Numériques' },
      { n: '3', label: 'Langues Supportées' },
    ],
    models: {
      eyebrow: 'Comment Nous Opérons',
      title: 'Quatre Modèles d\'Activité',
      sub: 'Choisissez le modèle adapté à votre activité agroalimentaire.',
      list: [
        { num: '01', name: 'Achat Direct', tag: 'Modèle Informel', desc: 'AgriLink achète directement aux producteurs et revend sur les marchés informels, créant un flux de trésorerie immédiat.' },
        { num: '02', name: 'Approvisionnement Dédié', tag: 'AgriLink Sourcing Premium', desc: "Nous identifions et garantissons l'approvisionnement de produits spécifiques pour les entreprises." },
        { num: '03', name: 'Production Sous Contrat', tag: 'Sur Demande', desc: 'Les agriculteurs produisent selon les fiches techniques des fabricants. Contrats numériques, délais définis.' },
        { num: '04', name: 'Pré-Achat Numérique', tag: 'Marketplace', desc: "Achetez des récoltes futures à l'avance. Prix fixés aujourd'hui, livraison garantie à la saison." },
      ],
    },
    features: {
      eyebrow: 'Infrastructure',
      title: 'La Technologie au Service de l\'Agriculture',
      list: [
        { t: 'Contrats Numériques', d: 'Validité juridique complète avec traçabilité immuable.' },
        { t: 'Import & Export', d: 'Opérations transfrontalières avec documentation intégrée et certifiée.' },
        { t: 'Marché à Terme', d: 'Prix et volumes négociés à l\'avance avec sécurité juridique.' },
        { t: 'Plateforme B2B', d: 'Conçue pour les entreprises, coopératives et distributeurs institutionnels.' },
      ],
    },
    team: {
      eyebrow: 'Direction',
      title: 'Notre Équipe',
      sub: "Professionnels à vision long terme construisant l'infrastructure numérique de l'agribusiness angolais.",
    },
    cta: {
      eyebrow: 'Prochaine Étape',
      title: 'Prêt à Transformer votre Chaîne Agroalimentaire?',
      sub: "Rejoignez la plateforme qui numérise l'agribusiness en Afrique.",
      btn: 'Commencer Maintenant',
    },
    footer: { rights: '© 2025 AgriLink Lda. Tous droits réservés.' },
  },
  en: {
    nav: { platform: 'Platform', models: 'Models', team: 'Team', contact: 'Contact', login: 'Login', register: 'Register' },
    hero: {
      location: 'Luanda · Tower 1 · Total Energies Angola · Coworking 100 Entrepreneurs',
      eyebrow: 'B2B Agri-Food Market',
      title1: 'The Digital Food',
      title2: 'Supply Chain of Angola',
      sub: 'Digital contracts for buying, selling and production. Import and export with full traceability. We connect producers, companies and institutional buyers.',
      cta1: 'Access Platform',
      cta2: 'Learn More',
    },
    stats: [
      { n: '3', label: 'Business Models' },
      { n: 'B2B', label: 'Institutional Platform' },
      { n: '100%', label: 'Digital Contracts' },
      { n: '3', label: 'Languages Supported' },
    ],
    models: {
      eyebrow: 'How We Operate',
      title: 'Four Business Models',
      sub: 'Choose the model that best fits your agri-food business.',
      list: [
        { num: '01', name: 'Direct Purchase', tag: 'Informal Model', desc: 'AgriLink buys directly from producers and resells in informal markets, creating immediate cash flow for the farmer.' },
        { num: '02', name: 'Dedicated Procurement', tag: 'AgriLink Sourcing Premium', desc: 'We identify and secure the supply of specific products for companies. Digitally managed, tracked and certified sourcing.' },
        { num: '03', name: 'Contract Production', tag: 'On-Demand', desc: 'Farmers produce according to manufacturer technical specs. Digital contracts, set deadlines and guaranteed payment.' },
        { num: '04', name: 'Digital Pre-Purchase', tag: 'Marketplace', desc: 'Buy future harvests in advance. Prices locked today, delivery guaranteed at harvest. Fully digital.' },
      ],
    },
    features: {
      eyebrow: 'Infrastructure',
      title: 'Technology Serving Agriculture',
      list: [
        { t: 'Digital Contracts', d: 'Full legal validity with immutable traceability on every transaction.' },
        { t: 'Import & Export', d: 'Simplified cross-border operations with integrated certified documentation.' },
        { t: 'Futures Market', d: 'Prices and volumes negotiated in advance with legal certainty.' },
        { t: 'B2B Platform', d: 'Designed for companies, cooperatives and institutional distributors.' },
      ],
    },
    team: {
      eyebrow: 'Leadership',
      title: 'Our Team',
      sub: 'Long-horizon professionals building the digital infrastructure of Angolan agribusiness.',
    },
    cta: {
      eyebrow: 'Next Step',
      title: 'Ready to Transform your Agri-Food Chain?',
      sub: 'Join the platform digitising agribusiness across Africa.',
      btn: 'Get Started',
    },
    footer: { rights: '© 2025 AgriLink Lda. All rights reserved.' },
  },
}

/* ─── Hooks ────────────────────────────────────────────────────────────────── */
function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [threshold])
  return scrolled
}

function useVisible(ref) {
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true)
    }, { threshold: 0.08 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return isVisible
}

/* Fio dourado — divisor de secção que se acende quando entra em vista.
   É o único lugar (fora do selo do cartão de acesso) onde o dourado se
   move — usado com moderação, como pontuação entre capítulos. */
function GoldDivider() {
  const ref = useRef(null)
  const vis = useVisible(ref)
  return (
    <div ref={ref} className="gold-divider">
      <span className={`gold-divider-fill ${vis ? 'run' : ''}`} />
    </div>
  )
}

/* ─── Main Component ───────────────────────────────────────────────────────── */
const AgriLinkLanding = () => {
  const navigate = useNavigate()
  const [lang, setLang] = useState('pt')
  const [faqOpen, setFaqOpen] = useState(null)
  const t = LANGS[lang]
  const scrolled = useScrolled()

  const statsRef   = useRef(null)
  const modelsRef  = useRef(null)
  const featRef    = useRef(null)
  const teamRef    = useRef(null)
  const aboutRef   = useRef(null)
  const faqRef     = useRef(null)
  const communityRef = useRef(null)

  const statsVis  = useVisible(statsRef)
  const modelsVis = useVisible(modelsRef)
  const featVis   = useVisible(featRef)
  const teamVis   = useVisible(teamRef)
  const aboutVis  = useVisible(aboutRef)
  const faqVis    = useVisible(faqRef)
  const communityVis = useVisible(communityRef)

  const faqItems = [
    { q: 'Como funciona a plataforma AgriLink?', a: 'A AgriLink conecta agricultores, empresas e compradores através de contratos digitais seguros. Nossa plataforma oferece quatro modelos de negócio adaptados às necessidades do mercado agroalimentar.' },
    { q: 'Quais países estão cobertos?', a: 'Atualmente operamos em Angola, com planos de expansão para RDC, Namíbia e África do Sul, criando o maior marketplace B2B agroalimentar da SADC.' },
    { q: 'Como garante a segurança das transações?', a: 'Utilizamos smart contracts com validade legal plena, rastreabilidade imutável e documentação certificada para cada transação.' },
    { q: 'Quem pode se cadastrar?', a: 'Agricultores, cooperativas, fábricas, distribuidores e compradores institucionais podem se cadastrar na plataforma.' },
  ]

  const teamMembers = [
    { name: 'Feliciano Cassoma',  role: 'Co-Fundador & CEO',                    photo: fotoFeliciano },
    { name: 'Moisés Lucamba',     role: 'Co-Fundador & CFO',                    photo: fotoMoises },
    { name: 'Cláudio Henriques',  role: 'Co-Fundador & Director de Operações',  photo: fotoClaudio },
    { name: 'Lizeth Caieie',      role: 'Secretária Geral',                     photo: fotoLizeth },
  ]

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; font-size: 16px; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
        body {
          background: ${T.canvas};
          color: ${T.ink};
          font-family: ${T.fontSans};
          font-weight: 400;
          -webkit-font-smoothing: antialiased;
          line-height: 1.6;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${T.accent};
          margin-bottom: 20px;
        }
        .eyebrow::before {
          content: '';
          display: block;
          width: 20px;
          height: 2px;
          background: ${T.gold};
        }

        /* ── FIO DOURADO — divisor assinatura ── */
        .gold-divider {
          max-width: 1320px;
          margin: 0 auto;
          padding: 0 48px;
          height: 1px;
          position: relative;
          background: ${T.rule};
        }
        .gold-divider-fill {
          position: absolute;
          top: 0; left: 48px;
          height: 1px;
          width: 0;
          background: linear-gradient(90deg, ${T.gold}, ${T.accentVivid});
        }
        .gold-divider-fill.run {
          animation: fillLine 1.4s cubic-bezier(.16,1,.3,1) forwards;
        }
        @keyframes fillLine {
          from { width: 0; }
          to { width: calc(100% - 96px); }
        }

        /* ── NAV ── */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          transition: all 0.4s ease;
        }
        .nav.solid {
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid ${T.rule};
        }
        .nav-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 0 48px;
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .nav-logo img { height: 36px; width: auto; }
        .nav-links { display: flex; align-items: center; gap: 40px; }
        .nav-link {
          color: ${T.mid};
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: color 0.2s;
          position: relative;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          left: 0; bottom: -6px;
          width: 0; height: 1.5px;
          background: ${T.accent};
          transition: width 0.25s ease;
        }
        .nav-link:hover { color: ${T.ink}; }
        .nav-link:hover::after { width: 100%; }
        .nav-right { display: flex; align-items: center; gap: 8px; }
        .lang-btn {
          height: 30px;
          padding: 0 10px;
          border-radius: ${T.radius};
          border: 1px solid transparent;
          background: transparent;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${T.muted};
          cursor: pointer;
          transition: all 0.2s;
          font-family: ${T.fontSans};
        }
        .lang-btn:hover { color: ${T.ink}; }
        .lang-btn.active { border-color: ${T.accent}; color: ${T.accent}; background: ${T.accentPale}; }
        .btn-login {
          height: 38px;
          padding: 0 20px;
          border-radius: ${T.radius};
          border: 1px solid ${T.rule};
          background: transparent;
          color: ${T.ink60};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: ${T.fontSans};
          margin-left: 8px;
        }
        .btn-login:hover { border-color: ${T.mid}; color: ${T.ink}; }
        .btn-reg {
          height: 38px;
          padding: 0 20px;
          border-radius: ${T.radius};
          border: 1px solid ${T.accent};
          background: ${T.accent};
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s;
          font-family: ${T.fontSans};
          letter-spacing: 0.01em;
        }
        .btn-reg:hover { background: ${T.accentDeep}; border-color: ${T.accentDeep}; box-shadow: 0 6px 20px rgba(14,107,61,0.28); }

        /* ── HERO ── */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 140px 48px 80px;
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(124,179,66,0.10) 0%, rgba(255,255,255,0) 42%),
            radial-gradient(720px 420px at 88% -6%, ${T.accentPale} 0%, rgba(233,244,236,0) 62%),
            ${T.canvas};
        }
        .hero-location-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 36px;
          background: ${T.ink};
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.55);
        }
        .hero-location-bar span { color: rgba(255,255,255,0.85); font-weight: 500; }
        .hero-location-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: ${T.accentVivid};
          animation: pulse-dot 2.5s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50% { opacity:0.75; transform:scale(1.4); box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        .hero-inner {
          max-width: 1320px;
          margin: 0 auto;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 100px;
          align-items: center;
        }
        .hero-title {
          font-family: ${T.fontDisplay};
          font-size: clamp(48px, 5.5vw, 80px);
          line-height: 1.0;
          font-weight: 500;
          color: ${T.ink};
          letter-spacing: -0.02em;
          margin-bottom: 28px;
          animation: rise 0.9s cubic-bezier(.16,1,.3,1) both;
        }
        .hero-title em {
          font-style: italic;
          font-weight: 500;
          background: linear-gradient(100deg, ${T.accent} 20%, ${T.accentVivid} 55%, ${T.accent} 85%);
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: sheen 7s ease-in-out infinite;
        }
        @keyframes sheen {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-sub {
          font-size: 16px;
          line-height: 1.75;
          color: ${T.mid};
          max-width: 480px;
          margin-bottom: 40px;
          font-weight: 400;
          animation: rise 0.9s cubic-bezier(.16,1,.3,1) 0.08s both;
        }
        .hero-proof {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 36px;
          animation: rise 0.9s cubic-bezier(.16,1,.3,1) 0.14s both;
        }
        .hero-proof-avatars { display: flex; }
        .hero-proof-avatars img {
          width: 34px; height: 34px;
          border-radius: 50%;
          border: 2px solid ${T.canvas};
          object-fit: cover;
          margin-left: -10px;
          box-shadow: ${T.shadowSm};
        }
        .hero-proof-avatars img:first-child { margin-left: 0; }
        .hero-proof-text { font-size: 13px; color: ${T.muted}; }
        .hero-proof-text strong { color: ${T.ink}; font-weight: 700; }
        .hero-live-rail {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin: 0 0 34px;
          max-width: 560px;
          animation: rise 0.9s cubic-bezier(.16,1,.3,1) 0.16s both;
        }
        .hero-live-pill {
          border: 1px solid ${T.rule};
          background: rgba(255,255,255,0.78);
          border-radius: 14px;
          padding: 14px 12px;
          box-shadow: ${T.shadowSm};
          display: flex;
          align-items: center;
          gap: 10px;
          color: ${T.ink60};
          font-size: 12px;
          font-weight: 800;
        }
        .hero-live-pill svg { color: ${T.accent}; font-size: 16px; flex-shrink: 0; }
        .hero-ctas {
          display: flex;
          align-items: center;
          gap: 20px;
          animation: rise 0.9s cubic-bezier(.16,1,.3,1) 0.2s both;
        }
        .btn-primary {
          height: 52px;
          padding: 0 32px;
          border-radius: ${T.radius};
          border: 1px solid ${T.accent};
          background: ${T.accent};
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: all 0.25s;
          font-family: ${T.fontSans};
          letter-spacing: 0.01em;
        }
        .btn-primary:hover {
          background: ${T.accentDeep};
          border-color: ${T.accentDeep};
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(14,107,61,0.3);
        }
        .btn-secondary {
          height: 52px;
          padding: 0 28px;
          border-radius: ${T.radius};
          border: 1px solid ${T.rule};
          background: transparent;
          color: ${T.ink60};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: all 0.25s;
          font-family: ${T.fontSans};
        }
        .btn-secondary:hover { border-color: ${T.mid}; color: ${T.ink}; }

        /* ══════════════════════════════════════════════════════════
           O SELO — cartão de acesso (login / cadastro)
           Elemento-assinatura do site: uma fotografia real da comunidade
           AgriLink ancora o cartão por trás, como prova de vida — com um
           fio dourado estático a emoldurar, sem movimento que distorça.
           ══════════════════════════════════════════════════════════ */
        .hero-visual {
          position: relative;
          animation: rise 1s cubic-bezier(.16,1,.3,1) 0.1s both;
          padding: 26px 22px 22px 0;
        }
        .hero-photo-panel {
          position: absolute;
          top: 0; right: 0;
          width: 84%;
          aspect-ratio: 5/4;
          border-radius: 20px;
          overflow: hidden;
          transform: rotate(4deg);
          box-shadow: ${T.shadowLg};
          border: 6px solid ${T.canvas};
        }
        .hero-photo-panel img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .hero-photo-panel::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(200deg, rgba(8,17,13,0) 45%, rgba(8,17,13,0.55) 100%);
        }
        .hero-photo-caption {
          position: absolute;
          left: 20px; bottom: 16px;
          z-index: 1;
          color: white;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-photo-caption span.dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: ${T.accentVivid};
          box-shadow: 0 0 0 3px rgba(34,197,94,0.25);
        }

        .hero-card {
          position: relative;
          z-index: 1;
          overflow: hidden;
          background: ${T.canvas};
          border-radius: 19px;
          padding: 40px;
          border: 1px solid ${T.rule};
          box-shadow: 0 26px 60px rgba(8,17,13,0.16);
          margin: 76px 30px 0 0;
        }
        .hero-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, ${T.gold}, ${T.accentVivid} 50%, ${T.gold});
        }
        .hero-card::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 0%, rgba(124,179,66,0.08) 45%, transparent 72%);
          transform: translateX(-100%);
          animation: accessScan 5.5s ease-in-out infinite;
        }
        @keyframes accessScan {
          0%, 42% { transform: translateX(-100%); }
          70%, 100% { transform: translateX(100%); }
        }
        .access-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border: 1px solid ${T.accentPale};
          background: ${T.accentPale};
          color: ${T.accentDeep};
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-radius: 999px;
          margin-bottom: 22px;
        }
        .access-title {
          font-family: ${T.fontDisplay};
          font-size: clamp(28px, 2.6vw, 38px);
          font-weight: 500;
          line-height: 1.06;
          color: ${T.ink};
          margin: 0 0 12px;
        }
        .access-copy {
          color: ${T.mid};
          font-size: 15px;
          line-height: 1.65;
          margin: 0 0 28px;
          max-width: 40ch;
        }
        .access-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 26px;
        }
        .access-btn {
          height: 56px;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 800;
          font-family: ${T.fontSans};
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .access-btn-primary {
          background: ${T.accent};
          color: #FFFFFF;
          background-image: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.16) 45%, transparent 60%);
          background-size: 220% 100%;
        }
        .access-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(14,107,61,0.32);
          background-position: -60% 0;
        }
        .access-btn-secondary {
          background: ${T.surface};
          color: ${T.ink};
          border: 1px solid ${T.rule};
        }
        .access-btn-secondary:hover { border-color: ${T.mid}; transform: translateY(-2px); }

        .access-chips {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }
        .access-chip {
          min-height: 78px;
          padding: 13px 8px;
          border: 1px solid ${T.rule};
          background: ${T.surface};
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: ${T.mid};
          transition: border-color 0.2s, color 0.2s, transform 0.2s;
        }
        .access-chip:hover { border-color: ${T.accent}; color: ${T.accentDeep}; transform: translateY(-2px); }
        .access-chip svg { color: ${T.accent}; font-size: 17px; }

        .access-flow {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 20px;
          border-top: 1px dashed ${T.rule};
        }
        .access-flow span {
          flex: 1;
          text-align: center;
          padding: 9px 8px;
          border-radius: 999px;
          background: ${T.goldPale};
          color: ${T.gold};
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        @media (max-width: 560px) {
          .hero-live-rail { grid-template-columns: 1fr; }
          .access-actions, .access-chips { grid-template-columns: 1fr; }
          .access-flow { flex-direction: column; align-items: stretch; }
        }

        .hero-line { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: ${T.rule}; }

        /* ── STATS ── */
        .stats-wrap { border-top: 1px solid ${T.rule}; border-bottom: 1px solid ${T.rule}; background: ${T.canvas}; }
        .stats-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 56px 48px;
          display: grid;
          grid-template-columns: repeat(4,1fr);
        }
        .stat-item { padding: 0 40px; text-align: left; border-right: 1px solid ${T.rule}; }
        .stat-item:first-child { padding-left: 0; }
        .stat-item:last-child { border-right: none; }
        .stat-n {
          font-family: ${T.fontDisplay};
          font-size: 44px;
          font-weight: 500;
          color: ${T.ink};
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .stat-label { font-size: 13px; font-weight: 500; color: ${T.muted}; margin-top: 8px; line-height: 1.4; }

        .fade-up { opacity: 0; transform: translateY(20px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .fade-up.visible { opacity: 1; transform: translateY(0); }

        section { padding: 108px 48px; }
        .section-inner { max-width: 1320px; margin: 0 auto; }
        .section-header { margin-bottom: 72px; }
        .section-title {
          font-family: ${T.fontDisplay};
          font-size: clamp(32px, 3.5vw, 52px);
          font-weight: 500;
          color: ${T.ink};
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }
        .section-sub { font-size: 16px; color: ${T.mid}; line-height: 1.7; max-width: 520px; font-weight: 400; }

        /* ── MODELS ── */
        .models-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: ${T.rule};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          overflow: hidden;
        }
        .model-card { background: ${T.canvas}; padding: 44px 40px; transition: background 0.3s; cursor: default; position: relative; }
        .model-card::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: ${T.accent}; transform: scaleY(0); transform-origin: top;
          transition: transform 0.35s ease;
        }
        .model-card:hover { background: ${T.surface}; }
        .model-card:hover::before { transform: scaleY(1); }
        .model-num { font-family: ${T.fontDisplay}; font-size: 13px; color: ${T.faint}; letter-spacing: 0.05em; margin-bottom: 32px; }
        .model-tag { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: ${T.gold}; margin-bottom: 10px; }
        .model-name { font-family: ${T.fontDisplay}; font-size: 24px; font-weight: 500; color: ${T.ink}; letter-spacing: -0.01em; margin-bottom: 16px; line-height: 1.2; }
        .model-desc { font-size: 14px; line-height: 1.75; color: ${T.mid}; font-weight: 400; }

        /* ── FEATURES ── */
        .features-bg { background: ${T.surface}; }
        .features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
        .feat-card {
          padding: 34px 26px;
          background: ${T.canvas};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          transition: box-shadow 0.3s, transform 0.3s, border-color 0.3s;
        }
        .feat-card:hover { box-shadow: ${T.shadowMd}; transform: translateY(-4px); border-color: ${T.accentPale}; }
        .feat-num { font-family: ${T.fontDisplay}; font-size: 11px; color: ${T.faint}; margin-bottom: 26px; letter-spacing: 0.05em; }
        .feat-title { font-size: 15px; font-weight: 700; color: ${T.ink}; margin-bottom: 12px; letter-spacing: -0.01em; }
        .feat-desc { font-size: 14px; line-height: 1.7; color: ${T.muted}; font-weight: 400; }

        /* ── ABOUT ── */
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .about-content { max-width: 560px; }
        .about-description { font-size: 16px; line-height: 1.8; color: ${T.mid}; margin-bottom: 40px; }
        .about-values { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }
        .about-value-item { border-left: 2px solid ${T.accent}; padding-left: 20px; }
        .about-value-title { font-size: 14px; font-weight: 700; color: ${T.ink}; margin-bottom: 8px; letter-spacing: -0.01em; }
        .about-value-desc { font-size: 13px; color: ${T.muted}; line-height: 1.6; }
        .about-visual {
          position: relative; background: ${T.surface}; border-radius: ${T.radiusMd};
          aspect-ratio: 4/5; display: flex; align-items: center; justify-content: center;
          border: 1px solid ${T.rule}; overflow: hidden;
        }
        .about-visual img { width: 100%; height: 100%; object-fit: cover; }
        .about-visual-placeholder { text-align: center; color: ${T.faint}; }
        .about-visual-placeholder i { font-size: 48px; margin-bottom: 16px; }
        .about-visual-placeholder p { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }

        /* ── VISION ── */
        .vision-section {
          background: ${T.ink};
          color: white;
          padding: 120px 48px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .vision-section::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(560px 320px at 50% 120%, rgba(34,197,94,0.14), transparent 70%);
        }
        .vision-quote {
          position: relative;
          font-family: ${T.fontDisplay};
          font-size: clamp(32px, 4.5vw, 64px);
          line-height: 1.1;
          font-weight: 500;
          letter-spacing: -0.02em;
          max-width: 800px;
          margin: 0 auto 40px;
        }
        .vision-quote em { color: ${T.accentVivid}; font-style: italic; }
        .vision-author { position: relative; font-size: 14px; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; text-transform: uppercase; }

        /* ── CULTURE ── */
        .culture-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 60px; }
        .culture-card { padding: 40px 32px; border: 1px solid ${T.rule}; border-radius: ${T.radiusMd}; transition: all 0.3s; }
        .culture-card:hover { box-shadow: ${T.shadowMd}; border-color: ${T.accentPale}; transform: translateY(-4px); }
        .culture-icon { font-size: 26px; color: ${T.accent}; margin-bottom: 24px; }
        .culture-title { font-family: ${T.fontDisplay}; font-size: 20px; font-weight: 500; margin-bottom: 16px; color: ${T.ink}; }
        .culture-desc { font-size: 14px; color: ${T.muted}; line-height: 1.7; }

        /* ── FAQ ── */
        .faq-section { background: ${T.surface}; }
        .faq-grid { margin-top: 60px; max-width: 800px; }
        .faq-item { border-bottom: 1px solid ${T.rule}; padding: 24px 0; cursor: pointer; }
        .faq-question { font-size: 17px; font-weight: 600; color: ${T.ink}; display: flex; justify-content: space-between; align-items: center; user-select: none; }
        .faq-question:hover { color: ${T.accent}; }
        .faq-answer { font-size: 15px; color: ${T.muted}; line-height: 1.7; margin-top: 12px; display: none; }
        .faq-answer.open { display: block; }

        /* ── COMMUNITY ── */
        .community-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; margin-top: 60px; }
        .community-image {
          background: ${T.surface}; border: 1px solid ${T.rule}; border-radius: ${T.radiusMd};
          aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;
        }
        .community-image img { width: 100%; height: 100%; object-fit: cover; }
        .community-image-placeholder { text-align: center; color: ${T.faint}; }
        .community-image-placeholder i { font-size: 56px; margin-bottom: 16px; display: block; }
        .community-image-placeholder p { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; }
        .community-provinces { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 32px; }
        .province-tag { padding: 10px 16px; border: 1px solid ${T.rule}; border-radius: ${T.radius}; font-size: 13px; text-align: center; color: ${T.mid}; transition: all 0.2s; }
        .province-tag:hover { border-color: ${T.accent}; color: ${T.accentDeep}; background: ${T.accentPale}; }

        /* ── TEAM ── */
        .team-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
        .team-card { cursor: default; }
        .team-photo {
          aspect-ratio: 3 / 4; background: ${T.surface}; border: 1px solid ${T.rule}; border-radius: ${T.radiusMd};
          overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
          position: relative; transition: box-shadow 0.3s;
        }
        .team-card:hover .team-photo { box-shadow: ${T.shadowMd}; }
        .team-photo img { width: 100%; height: 100%; object-fit: cover; object-position: center top; transition: transform 0.4s ease; }
        .team-card:hover .team-photo img { transform: scale(1.03); }
        .team-photo-init { font-family: ${T.fontDisplay}; font-size: 40px; color: ${T.faint}; font-weight: 500; letter-spacing: -0.02em; }
        .team-name { font-size: 15px; font-weight: 700; color: ${T.ink}; margin-bottom: 5px; letter-spacing: -0.01em; }
        .team-role { font-size: 13px; font-weight: 400; color: ${T.muted}; line-height: 1.4; }

        /* ── CTA ── */
        .cta-section { background: ${T.canvas}; }
        .cta-inner { max-width: 1320px; margin: 0 auto; padding: 0 48px; }
        .cta-box {
          background: ${T.ink};
          border-radius: ${T.radiusMd};
          padding: 96px 80px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 80px;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .cta-box::before {
          content: '';
          position: absolute; right: -80px; top: -80px; width: 320px; height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34,197,94,0.14), transparent 70%);
          pointer-events: none;
        }
        .cta-eyebrow {
          font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
          color: ${T.accentVivid}; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .cta-eyebrow::before { content: ''; display: block; width: 20px; height: 2px; background: ${T.gold}; }
        .cta-title { font-family: ${T.fontDisplay}; font-size: clamp(28px, 3vw, 44px); font-weight: 500; color: white; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 16px; }
        .cta-sub { font-size: 15px; color: rgba(255,255,255,0.55); line-height: 1.7; font-weight: 400; max-width: 420px; }
        .btn-cta {
          height: 54px; padding: 0 36px; border-radius: ${T.radius}; border: 1px solid white; background: white; color: ${T.ink};
          font-size: 14px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
          white-space: nowrap; transition: all 0.25s; font-family: ${T.fontSans}; position: relative; flex-shrink: 0;
        }
        .btn-cta:hover { background: transparent; color: white; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }

        /* ── FOOTER ── */
        .footer-section { background: ${T.ink80}; padding: 80px 48px 40px; }
        .footer-grid { max-width: 1320px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 60px; margin-bottom: 60px; }
        .footer-brand-col p { color: rgba(255,255,255,0.4); font-size: 13px; line-height: 1.7; margin-top: 20px; max-width: 300px; }
        .footer-col-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 24px; }
        .footer-link { display: block; color: rgba(255,255,255,0.35); text-decoration: none; font-size: 13px; margin-bottom: 12px; transition: color 0.2s; line-height: 1.6; cursor: pointer; }
        .footer-link:hover { color: rgba(255,255,255,0.85); }
        .footer-bottom { max-width: 1320px; margin: 0 auto; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
        .footer-copyright { color: rgba(255,255,255,0.25); font-size: 12px; }
        .footer-brand { font-family: ${T.fontDisplay}; font-size: 18px; color: rgba(255,255,255,0.9); letter-spacing: -0.01em; margin-bottom: 8px; }
        .footer-brand em { color: ${T.accentVivid}; font-style: normal; }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .features-grid { grid-template-columns: repeat(2,1fr); }
          .team-grid { grid-template-columns: repeat(2,1fr); }
          .culture-grid { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 900px) {
          .hero-inner { grid-template-columns: 1fr; gap: 64px; }
          .hero-visual { display: none; }
          .stats-inner { grid-template-columns: repeat(2,1fr); gap: 0; }
          .stat-item { border-right: none; border-bottom: 1px solid ${T.rule}; padding: 28px 0; }
          .stat-item:first-child { padding-left: 0; }
          .nav-links { display: none; }
          .models-grid { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: 1fr; }
          .team-grid { grid-template-columns: repeat(2,1fr); }
          .cta-box { grid-template-columns: 1fr; padding: 56px 36px; gap: 36px; }
          .hero { padding: 120px 24px 80px; }
          section { padding: 72px 24px; }
          .about-grid { grid-template-columns: 1fr; }
          .community-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 1fr 1fr; }
          .vision-quote { font-size: clamp(24px, 6vw, 40px); }
          .culture-grid { grid-template-columns: 1fr; }
          .gold-divider { padding: 0 24px; }
        }
        @media (max-width: 600px) {
          .team-grid { grid-template-columns: 1fr; }
          .nav-inner { padding: 0 24px; }
          .footer-bottom { flex-direction: column; gap: 16px; }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav className={`nav ${scrolled ? 'solid' : ''}`}>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src={orbisLinkLogo} alt="AgriLink" />
          </a>
          <div className="nav-links">
            <a href="#about" className="nav-link">Sobre Nós</a>
            <a href="#models" className="nav-link">{t.nav.models}</a>
            <a href="#team" className="nav-link">{t.nav.team}</a>
            <a href="#faq" className="nav-link">Perguntas Frequentes</a>
            <a href="#community" className="nav-link">Comunidades</a>
            <a href="#contact" className="nav-link">{t.nav.contact}</a>
          </div>
          <div className="nav-right">
            {['pt','fr','en'].map(l => (
              <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
            <button className="btn-login" onClick={() => navigate('/login')}>{t.nav.login}</button>
            <button className="btn-reg" onClick={() => navigate('/cadastro')}>{t.nav.register}</button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="hero" id="platform" style={{ paddingTop: 140 }}>
        <div className="hero-location-bar">
          <div className="hero-location-dot" />
          <span>{t.hero.location}</span>
        </div>

        <div className="hero-inner">
          <div>
            <div className="eyebrow">{t.hero.eyebrow}</div>
            <h1 className="hero-title">
              {t.hero.title1}<br />
              <em>{t.hero.title2}</em>
            </h1>
            <p className="hero-sub">{t.hero.sub}</p>

            <MarketPriceTicker />


            <div className="hero-ctas">
              <button className="btn-primary" onClick={() => navigate('/cadastro')}>
                {t.hero.cta1}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="btn-secondary" onClick={() => document.getElementById('models')?.scrollIntoView({ behavior: 'smooth' })}>
                {t.hero.cta2}
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-photo-panel">
              {comunidadeImg2 ? (
                <img src={comunidadeImg2} alt="Comunidade AgriLink" />
              ) : (
                <img src={comunidadeImg} alt="Comunidade AgriLink" />
              )}
              <div className="hero-photo-caption"><span className="dot" />Comunidade AgriLink · 21 províncias</div>
            </div>
            <div className="hero-card">
              <div className="access-kicker">
                <FontAwesomeIcon icon={faShieldHalved} />
                Acesso institucional AgriLink
              </div>
              <h2 className="access-title">Criar a sua conta AgriLink</h2>
              <p className="access-copy">Entre como fornecedor, comprador ou agente e confirme o seu email com um código de 6 dígitos.</p>
              <div className="access-actions">
                <button className="access-btn access-btn-primary" onClick={() => navigate('/cadastro')}>
                  <FontAwesomeIcon icon={faUserPlus} />
                  Criar conta
                </button>
                <button className="access-btn access-btn-secondary" onClick={() => navigate('/login')}>
                  <FontAwesomeIcon icon={faRightToBracket} />
                  Entrar
                </button>
              </div>
              <div className="access-chips">
                <div className="access-chip"><FontAwesomeIcon icon={faSeedling} />Fornecedores</div>
                <div className="access-chip"><FontAwesomeIcon icon={faChartLine} />Compradores</div>
                <div className="access-chip"><FontAwesomeIcon icon={faUsers} />Agentes</div>
              </div>
              <div className="access-flow">
                <span>Dados</span>
                <span>Código OTP</span>
                <span>Acesso</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-line" />
      </section>

      {/* ═══ STATS ═══ */}
      <div className="stats-wrap" ref={statsRef}>
        <div className="stats-inner">
          {t.stats.map((s, i) => (
            <div key={i} className={`stat-item fade-up ${statsVis ? 'visible' : ''}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="stat-n">{s.n}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <GoldDivider />

      {/* ═══ MODELS ═══ */}
      <section id="models" ref={modelsRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${modelsVis ? 'visible' : ''}`}>
            <div className="eyebrow">{t.models.eyebrow}</div>
            <h2 className="section-title">{t.models.title}</h2>
            <p className="section-sub">{t.models.sub}</p>
          </div>
          <div className="models-grid">
            {t.models.list.map((m, i) => (
              <div key={i} className={`model-card fade-up ${modelsVis ? 'visible' : ''}`} style={{ transitionDelay: `${100 + i * 80}ms` }}>
                <div className="model-num">{m.num}</div>
                <div className="model-tag">{m.tag}</div>
                <div className="model-name">{m.name}</div>
                <p className="model-desc">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="features-bg" ref={featRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${featVis ? 'visible' : ''}`}>
            <div className="eyebrow">{t.features.eyebrow}</div>
            <h2 className="section-title">{t.features.title}</h2>
          </div>
          <div className="features-grid">
            {t.features.list.map((f, i) => (
              <div key={i} className={`feat-card fade-up ${featVis ? 'visible' : ''}`} style={{ transitionDelay: `${100 + i * 80}ms` }}>
                <div className="feat-num">0{i + 1}</div>
                <div className="feat-title">{f.t}</div>
                <p className="feat-desc">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOBRE NÓS ═══ */}
      <section id="about" ref={aboutRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${aboutVis ? 'visible' : ''}`}>
            <div className="eyebrow">Nossa História</div>
            <h2 className="section-title">Sobre a AgriLink</h2>
            <p className="section-sub">Conectando o ecossistema agroalimentar com tecnologia e confiança.</p>
          </div>
          <div className="about-grid">
            <div className="about-content">
              <p className="about-description">
                A AgriLink nasceu da visão de digitalizar o mercado agroalimentar em África.
                Somos uma plataforma B2B que conecta agricultores, fábricas, distribuidores
                e compradores institucionais através de contratos digitais seguros e rastreáveis.
              </p>
              <div className="about-values">
                <div className="about-value-item">
                  <div className="about-value-title">Missão</div>
                  <div className="about-value-desc">Digitalizar e simplificar a cadeia agroalimentar, conectando produtores e compradores com transparência.</div>
                </div>
                <div className="about-value-item">
                  <div className="about-value-title">Visão</div>
                  <div className="about-value-desc">Ser o maior marketplace B2B agroalimentar da SADC.</div>
                </div>
                <div className="about-value-item">
                  <div className="about-value-title">Tecnologia</div>
                  <div className="about-value-desc">Contratos digitais, rastreabilidade blockchain e análise de dados.</div>
                </div>
                <div className="about-value-item">
                  <div className="about-value-title">Impacto</div>
                  <div className="about-value-desc">Fluxo de caixa imediato para agricultores e segurança jurídica para compradores.</div>
                </div>
              </div>
            </div>
            <div className="about-visual">
              {comunidadeImg ? (
                <img src={comunidadeImg} alt="Comunidade AgriLink" />
              ) : (
                <div className="about-visual-placeholder">
                  <div><FontAwesomeIcon icon={faWheatAwn} /></div>
                  <p>Comunidade AgriLink</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ VISÃO ═══ */}
      <section className="vision-section">
        <div className="section-inner">
          <h2 className="vision-quote">
            "SER O MAIOR <em>MARKETPLACE B2B AGROALIMENTAR</em> DA SADC"
          </h2>
          <div className="vision-author">AgriLink · Visão 2030</div>
        </div>
      </section>

      {/* ═══ CULTURA ═══ */}
      <section>
        <div className="section-inner">
          <div className="section-header">
            <div className="eyebrow">Cultura</div>
            <h2 className="section-title">Entrega de Resultados</h2>
            <p className="section-sub">Trabalhe onde quiseres, entregue o resultado. Nossa cultura valoriza autonomia e excelência.</p>
          </div>
          <div className="culture-grid">
            <div className="culture-card">
              <div className="culture-icon"><FontAwesomeIcon icon={faHouseLaptop} /></div>
              <div className="culture-title">Trabalho Remoto</div>
              <div className="culture-desc">Nossa equipa trabalha de qualquer lugar, desde que os resultados sejam entregues com excelência e dentro dos prazos.</div>
            </div>
            <div className="culture-card">
              <div className="culture-icon"><FontAwesomeIcon icon={faBullseye} /></div>
              <div className="culture-title">Foco em Resultados</div>
              <div className="culture-desc">Medimos performance por resultados concretos, não por horas trabalhadas. Autonomia com responsabilidade.</div>
            </div>
            <div className="culture-card">
              <div className="culture-icon"><FontAwesomeIcon icon={faHandshake} /></div>
              <div className="culture-title">Colaboração</div>
              <div className="culture-desc">Times multidisciplinares trabalhando juntos para transformar o agronegócio africano com tecnologia.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="faq-section" ref={faqRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${faqVis ? 'visible' : ''}`}>
            <div className="eyebrow">Dúvidas</div>
            <h2 className="section-title">Perguntas Frequentes</h2>
            <p className="section-sub">Tudo o que precisa saber sobre a AgriLink.</p>
          </div>
          <div className="faq-grid">
            {faqItems.map((item, i) => (
              <div key={i} className="faq-item" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <div className="faq-question">
                  <span>{item.q}</span>
                  <span>{faqOpen === i ? '−' : '+'}</span>
                </div>
                <div className={`faq-answer ${faqOpen === i ? 'open' : ''}`}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COMUNIDADES ═══ */}
      <section id="community" ref={communityRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${communityVis ? 'visible' : ''}`}>
            <div className="eyebrow">Presença Nacional</div>
            <h2 className="section-title">Comunidades AgriLink</h2>
            <p className="section-sub">Encontros mensais com a comunidade AgriLink em cada uma das 21 províncias de Angola.</p>
          </div>
          <div className="community-grid">
            <div className="community-image">
              {comunidadeImg2 ? (
                <img src={comunidadeImg2} alt="Encontro da Comunidade AgriLink" />
              ) : (
                <div className="community-image-placeholder">
                  <div><FontAwesomeIcon icon={faGlobe} /></div>
                  <p>Encontros AgriLink</p>
                </div>
              )}
            </div>
            <div>
              <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: '24px', marginBottom: '16px', color: T.ink }}>
                Encontros Mensais
              </h3>
              <p style={{ color: T.muted, lineHeight: 1.7, marginBottom: '32px' }}>
                Realizamos encontros presenciais em cada província para fortalecer
                a comunidade, compartilhar conhecimento e criar oportunidades de negócio.
              </p>
              <div className="community-provinces">
                {['Luanda', 'Benguela', 'Huíla', 'Cabinda', 'Malanje', 'Huambo', 'Bié', 'Uíge', 'Zaire', 'Cuanza Sul', 'Cuanza Norte', 'Lunda Sul'].map(provincia => (
                  <div key={provincia} className="province-tag">{provincia}</div>
                ))}
                <div className="province-tag" style={{background: T.accent, color: 'white', border: 'none'}}>
                  +9 Províncias
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TEAM ═══ */}
      <section id="team" ref={teamRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${teamVis ? 'visible' : ''}`}>
            <div className="eyebrow">{t.team.eyebrow}</div>
            <h2 className="section-title">{t.team.title}</h2>
            <p className="section-sub">{t.team.sub}</p>
          </div>
          <div className="team-grid">
            {teamMembers.map((m, i) => {
              const initials = m.name.split(' ').map(n => n[0]).slice(0,2).join('')
              return (
                <div key={i} className={`team-card fade-up ${teamVis ? 'visible' : ''}`} style={{ transitionDelay: `${200 + i * 80}ms` }}>
                  <div className="team-photo">
                    {m.photo ? (
                      <img src={m.photo} alt={m.name} loading="lazy" />
                    ) : (
                      <div className="team-photo-init">{initials}</div>
                    )}
                  </div>
                  <div className="team-name">{m.name}</div>
                  <div className="team-role">{m.role}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="cta-section" id="contact">
        <div className="cta-inner">
          <div className="cta-box">
            <div>
              <div className="cta-eyebrow">{t.cta.eyebrow}</div>
              <h2 className="cta-title">{t.cta.title}</h2>
              <p className="cta-sub">{t.cta.sub}</p>
            </div>
            <button className="btn-cta" onClick={() => navigate('/cadastro')}>
              {t.cta.btn}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer-section">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">Agri<em>Link</em></div>
            <p>O marketplace B2B agroalimentar que conecta agricultores, fábricas e compradores institucionais em toda a SADC.</p>
          </div>
          <div>
            <div className="footer-col-title">Plataforma</div>
            <a href="#models" className="footer-link">Modelos de Negócio</a>
            <a href="#about" className="footer-link">Sobre Nós</a>
            <a href="#team" className="footer-link">Equipa</a>
            <a href="#faq" className="footer-link">Perguntas Frequentes</a>
            <a href="#community" className="footer-link">Comunidades</a>
          </div>
          <div>
            <div className="footer-col-title">Links Úteis</div>
            <a href="#" className="footer-link">Agentes de Campo</a>
            <a href="#" className="footer-link">Fábricas</a>
            <a href="#" className="footer-link">Agricultores</a>
            <a href="#about" className="footer-link">Missão</a>
            <a href="#about" className="footer-link">Visão</a>
            <a href="#about" className="footer-link">Tecnologias</a>
          </div>
          <div>
            <div className="footer-col-title">Presença</div>
            <a href="#" className="footer-link">Angola</a>
            <a href="#" className="footer-link">RDC</a>
            <a href="#" className="footer-link">África do Sul</a>
            <a href="#" className="footer-link">Namíbia</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copyright">{t.footer.rights}</div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span className="footer-link" onClick={() => navigate('/termos-publicidade')}>Termos de Uso</span>
            <span className="footer-link">Privacidade</span>
          </div>
        </div>
      </footer>
    </>
  )
}

export default AgriLinkLanding