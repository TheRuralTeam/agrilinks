import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
// IMPORTA├ç├âO DAS FOTOS DA EQUIPE E LOGO (com fallbacks)
// ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
// Substitua pelos seus paths reais ou remova as importa├º├Áes e use URLs
// Em vez de @/assets/, use ./assets/ ou ../assets/
import orbisLinkLogo from '../assets/orbislink-logo.png';
import fotoFeliciano from '../assets/FELICIANO.jpeg';
import fotoMoises from '../assets/MOISES.jpeg';
import fotoLizeth from '../assets/LIZETH.jpeg';
import fotoClaudio from '../assets/CLAUDIO.jpeg';import comunidadeImg from '../assets/Comunidade.png';
import comunidadeImg2 from '../assets/COMUNIDADE2.jpeg';

/* ÔöÇÔöÇÔöÇ Design Tokens ÔöÇ Luxo Editorial Minimalista ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
const T = {
  ink:     '#0A0A0A',
  ink80:   '#1A1A1A',
  ink60:   '#2C2C2C',

  
  mid:     '#555555',
  muted:   '#888888',
  faint:   '#BBBBBB',
  rule:    '#E8E8E8',
  surface: '#F5F4F0',
  canvas:  '#FFFFFF',
  accent:  '#1F4D2B',
  accentM: '#2D6B3A',
  accentL: '#4A8F5A',
  accentPale: '#EDF2EE',
  gold:    '#9A7B4F',
  goldPale:'#F8F4EE',
  fontSans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  fontSerif: "'DM Serif Display', Georgia, serif",
  radius:  '4px',
  radiusMd:'8px',
  radiusLg:'16px',
  shadowSm: '0 1px 3px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.06)',
  shadowLg: '0 12px 40px rgba(0,0,0,0.08)',
}

/* ÔöÇÔöÇÔöÇ i18n ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
const LANGS = {
  pt: {
    nav: { platform: 'Plataforma', models: 'Modelos', team: 'Equipa', contact: 'Contacto', login: 'Entrar', register: 'Registar' },
    hero: {
      location: 'Luanda ┬À Torre 1 ┬À Total Energies Angola ┬À Coworking 100 Empreendedores',
      eyebrow: 'Mercado Agroalimentar B2B',
      title1: 'A Cadeia Alimentar',
      title2: 'Digital de Angola',
      sub: 'Contratos digitais de compra, venda e produ├º├úo. Importa├º├úo e exporta├º├úo com rastreabilidade total. Conectamos produtores, empresas e compradores institucionais.',
      cta1: 'Aceder ├á Plataforma',
      cta2: 'Saber Mais',
    },
    stats: [
      { n: '3', label: 'Modelos de Neg├│cio' },
      { n: 'B2B', label: 'Plataforma Institucional' },
      { n: '100%', label: 'Contratos Digitais' },
      { n: '3', label: 'Idiomas Suportados' },
    ],
    models: {
      eyebrow: 'Como Operamos',
      title: 'Quatro Modelos de Atua├º├úo',
      sub: 'Escolha o modelo que melhor se adapta ao seu neg├│cio agroalimentar.',
      list: [
        { num: '01', name: 'Compra Direta', tag: 'Modelo Informal', desc: 'A AgriLink compra diretamente aos produtores e revende nos mercados informais, criando fluxo imediato de caixa para o agricultor.' },
        { num: '02', name: 'Procurement Dedicado', tag: 'AgriLink Sourcing Premium', desc: 'Identificamos e garantimos o fornecimento de produtos espec├¡ficos para empresas. Sourcing gerido, rastreado e certificado digitalmente.' },
        { num: '03', name: 'Produ├º├úo por Contrato', tag: 'On-Demand', desc: 'Agricultores produzem segundo fichas t├®cnicas dos fabricantes. Contratos digitais, prazos definidos e pagamento garantido ├á produ├º├úo.' },
        { num: '04', name: 'Pr├®-Compra Digital', tag: 'Marketplace', desc: 'Adquira antecipadamente colheitas futuras. Pre├ºos fixados hoje, entrega garantida na ├®poca. Totalmente digital e rastre├ível.' },
      ],
    },
    features: {
      eyebrow: 'Infraestrutura',
      title: 'Tecnologia ao Servi├ºo da Agricultura',
      list: [
        { t: 'Contratos Digitais', d: 'Validade legal plena com rastreabilidade imut├ível em cada transa├º├úo.' },
        { t: 'Importa├º├úo & Exporta├º├úo', d: 'Opera├º├Áes transfronteiri├ºas com documenta├º├úo integrada e certificada.' },
        { t: 'Mercado de Futuros', d: 'Pre├ºos e volumes negociados antecipadamente com seguran├ºa jur├¡dica.' },
        { t: 'Plataforma B2B', d: 'Desenhada para empresas, cooperativas e distribuidores institucionais.' },
      ],
    },
    team: {
      eyebrow: 'Lideran├ºa',
      title: 'A Nossa Equipa',
      sub: 'Profissionais com vis├úo de longo prazo construindo a infraestrutura digital do agroneg├│cio angolano.',
    },
    cta: {
      eyebrow: 'Pr├│ximo Passo',
      title: 'Pronto para Transformar a sua Cadeia Agroalimentar?',
      sub: 'Junte-se ├á plataforma que est├í a digitalizar o agroneg├│cio em ├üfrica.',
      btn: 'Come├ºar Agora',
    },
    footer: { rights: '┬® 2025 AgriLink Lda. Todos os direitos reservados.' },
  },
  fr: {
    nav: { platform: 'Plateforme', models: 'Mod├¿les', team: '├ëquipe', contact: 'Contact', login: 'Connexion', register: "S'inscrire" },
    hero: {
      location: 'Luanda ┬À Tour 1 ┬À Total Energies Angola ┬À Coworking 100 Entrepreneurs',
      eyebrow: 'March├® Agroalimentaire B2B',
      title1: "La Cha├«ne Alimentaire",
      title2: "Digitale d'Angola",
      sub: "Contrats num├®riques d'achat, vente et production. Import-export avec tra├ºabilit├® totale. Nous connectons producteurs, entreprises et acheteurs institutionnels.",
      cta1: 'Acc├®der ├á la Plateforme',
      cta2: 'En Savoir Plus',
    },
    stats: [
      { n: '3', label: "Mod├¿les d'Activit├®" },
      { n: 'B2B', label: 'Plateforme Institutionnelle' },
      { n: '100%', label: 'Contrats Num├®riques' },
      { n: '3', label: 'Langues Support├®es' },
    ],
    models: {
      eyebrow: 'Comment Nous Op├®rons',
      title: 'Quatre Mod├¿les d\'Activit├®',
      sub: 'Choisissez le mod├¿le adapt├® ├á votre activit├® agroalimentaire.',
      list: [
        { num: '01', name: 'Achat Direct', tag: 'Mod├¿le Informel', desc: 'AgriLink ach├¿te directement aux producteurs et revend sur les march├®s informels, cr├®ant un flux de tr├®sorerie imm├®diat.' },
        { num: '02', name: 'Approvisionnement D├®di├®', tag: 'AgriLink Sourcing Premium', desc: "Nous identifions et garantissons l'approvisionnement de produits sp├®cifiques pour les entreprises." },
        { num: '03', name: 'Production Sous Contrat', tag: 'Sur Demande', desc: 'Les agriculteurs produisent selon les fiches techniques des fabricants. Contrats num├®riques, d├®lais d├®finis.' },
        { num: '04', name: 'Pr├®-Achat Num├®rique', tag: 'Marketplace', desc: "Achetez des r├®coltes futures ├á l'avance. Prix fix├®s aujourd'hui, livraison garantie ├á la saison." },
      ],
    },
    features: {
      eyebrow: 'Infrastructure',
      title: 'La Technologie au Service de l\'Agriculture',
      list: [
        { t: 'Contrats Num├®riques', d: 'Validit├® juridique compl├¿te avec tra├ºabilit├® immuable.' },
        { t: 'Import & Export', d: 'Op├®rations transfrontali├¿res avec documentation int├®gr├®e et certifi├®e.' },
        { t: 'March├® ├á Terme', d: 'Prix et volumes n├®goci├®s ├á l\'avance avec s├®curit├® juridique.' },
        { t: 'Plateforme B2B', d: 'Con├ºue pour les entreprises, coop├®ratives et distributeurs institutionnels.' },
      ],
    },
    team: {
      eyebrow: 'Direction',
      title: 'Notre ├ëquipe',
      sub: "Professionnels ├á vision long terme construisant l'infrastructure num├®rique de l'agribusiness angolais.",
    },
    cta: {
      eyebrow: 'Prochaine ├ëtape',
      title: 'Pr├¬t ├á Transformer votre Cha├«ne Agroalimentaire?',
      sub: "Rejoignez la plateforme qui num├®rise l'agribusiness en Afrique.",
      btn: 'Commencer Maintenant',
    },
    footer: { rights: '┬® 2025 AgriLink Lda. Tous droits r├®serv├®s.' },
  },
  en: {
    nav: { platform: 'Platform', models: 'Models', team: 'Team', contact: 'Contact', login: 'Login', register: 'Register' },
    hero: {
      location: 'Luanda ┬À Tower 1 ┬À Total Energies Angola ┬À Coworking 100 Entrepreneurs',
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
    footer: { rights: '┬® 2025 AgriLink Lda. All rights reserved.' },
  },
}

/* ÔöÇÔöÇÔöÇ Hooks ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
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

/* ÔöÇÔöÇÔöÇ Main Component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
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
    {
      q: 'Como funciona a plataforma AgriLink?',
      a: 'A AgriLink conecta agricultores, empresas e compradores atrav├®s de contratos digitais seguros. Nossa plataforma oferece quatro modelos de neg├│cio adaptados ├ás necessidades do mercado agroalimentar.'
    },
    {
      q: 'Quais pa├¡ses est├úo cobertos?',
      a: 'Atualmente operamos em Angola, com planos de expans├úo para RDC, Nam├¡bia e ├üfrica do Sul, criando o maior marketplace B2B agroalimentar da SADC.'
    },
    {
      q: 'Como garante a seguran├ºa das transa├º├Áes?',
      a: 'Utilizamos smart contracts com validade legal plena, rastreabilidade imut├ível e documenta├º├úo certificada para cada transa├º├úo.'
    },
    {
      q: 'Quem pode se cadastrar?',
      a: 'Agricultores, cooperativas, f├íbricas, distribuidores e compradores institucionais podem se cadastrar na plataforma.'
    }
  ]

  const teamMembers = [
    { name: 'Feliciano Cassoma',  role: 'Co-Fundador & CEO',                    photo: fotoFeliciano },
    { name: 'Mois├®s Lucamba',     role: 'Co-Fundador & CTO',                    photo: fotoMoises },
    { name: 'Cl├íudio Henriques',  role: 'Co-Fundador & Director de Opera├º├Áes',  photo: fotoClaudio },
    { name: 'Lizeth Caieie',      role: 'Secret├íria Geral',                     photo: fotoLizeth },
  ]

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; font-size: 16px; }
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
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${T.accent};
          margin-bottom: 20px;
        }
        .eyebrow::before {
          content: '';
          display: block;
          width: 20px;
          height: 1px;
          background: ${T.accent};
        }

        /* ÔöÇÔöÇ NAV ÔöÇÔöÇ */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          transition: all 0.4s ease;
        }
        .nav.solid {
          background: rgba(255,255,255,0.97);
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
        .nav-logo img {
          height: 36px;
          width: auto;
        }
        .nav-wordmark {
          font-family: ${T.fontSerif};
          font-size: 22px;
          color: ${T.ink};
          letter-spacing: -0.01em;
        }
        .nav-wordmark em {
          color: ${T.accent};
          font-style: normal;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 40px;
        }
        .nav-link {
          color: ${T.mid};
          text-decoration: none;
          font-size: 14px;
          font-weight: 400;
          letter-spacing: 0.01em;
          transition: color 0.2s;
        }
        .nav-link:hover { color: ${T.ink}; }
        .nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lang-btn {
          height: 30px;
          padding: 0 10px;
          border-radius: ${T.radius};
          border: 1px solid transparent;
          background: transparent;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${T.muted};
          cursor: pointer;
          transition: all 0.2s;
          font-family: ${T.fontSans};
        }
        .lang-btn:hover { color: ${T.ink}; }
        .lang-btn.active {
          border-color: ${T.accent};
          color: ${T.accent};
          background: ${T.accentPale};
        }
        .btn-login {
          height: 38px;
          padding: 0 20px;
          border-radius: ${T.radius};
          border: 1px solid ${T.rule};
          background: transparent;
          color: ${T.ink60};
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s;
          font-family: ${T.fontSans};
          margin-left: 8px;
        }
        .btn-login:hover {
          border-color: ${T.mid};
          color: ${T.ink};
        }
        .btn-reg {
          height: 38px;
          padding: 0 20px;
          border-radius: ${T.radius};
          border: 1px solid ${T.accent};
          background: ${T.accent};
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s;
          font-family: ${T.fontSans};
          letter-spacing: 0.01em;
        }
        .btn-reg:hover {
          background: ${T.accentM};
          border-color: ${T.accentM};
        }

        /* ÔöÇÔöÇ HERO ÔöÇÔöÇ */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 140px 48px 80px;
          position: relative;
          overflow: hidden;
          background: ${T.canvas};
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
        .hero-location-bar span {
          color: rgba(255,255,255,0.85);
          font-weight: 500;
        }
        .hero-location-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${T.accentL};
          animation: pulse-dot 2.5s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.5; transform:scale(1.5); }
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
          font-family: ${T.fontSerif};
          font-size: clamp(48px, 5.5vw, 80px);
          line-height: 1.0;
          font-weight: 400;
          color: ${T.ink};
          letter-spacing: -0.03em;
          margin-bottom: 28px;
        }
        .hero-title em {
          font-style: italic;
          color: ${T.accent};
        }
        .hero-sub {
          font-size: 16px;
          line-height: 1.75;
          color: ${T.mid};
          max-width: 480px;
          margin-bottom: 48px;
          font-weight: 400;
        }
        .hero-ctas {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .btn-primary {
          height: 50px;
          padding: 0 32px;
          border-radius: ${T.radius};
          border: 1px solid ${T.accent};
          background: ${T.accent};
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: all 0.25s;
          font-family: ${T.fontSans};
          letter-spacing: 0.01em;
        }
        .btn-primary:hover {
          background: ${T.accentM};
          border-color: ${T.accentM};
          transform: translateY(-1px);
          box-shadow: ${T.shadowMd};
        }
        .btn-secondary {
          height: 50px;
          padding: 0 28px;
          border-radius: ${T.radius};
          border: 1px solid ${T.rule};
          background: transparent;
          color: ${T.ink60};
          font-size: 14px;
          font-weight: 400;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: all 0.25s;
          font-family: ${T.fontSans};
        }
        .btn-secondary:hover {
          border-color: ${T.mid};
          color: ${T.ink};
        }

        .hero-visual { position: relative; }
        .hero-card {
          background: ${T.canvas};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          padding: 32px;
          box-shadow: ${T.shadowLg};
        }
        .hero-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid ${T.rule};
        }
        .hero-card-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${T.faint};
          margin-bottom: 6px;
        }
        .hero-card-value {
          font-family: ${T.fontSerif};
          font-size: 26px;
          color: ${T.ink};
          letter-spacing: -0.02em;
        }
        .hero-card-amount {
          font-family: ${T.fontSerif};
          font-size: 22px;
          color: ${T.accent};
          text-align: right;
        }
        .hero-card-amount-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${T.faint};
          text-align: right;
          margin-bottom: 6px;
        }
        .contract-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 0;
          border-bottom: 1px solid ${T.rule};
        }
        .contract-row:last-child { border-bottom: none; }
        .contract-name {
          font-size: 13px;
          font-weight: 400;
          color: ${T.mid};
        }
        .contract-badge {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 2px;
        }
        .badge-active {
          color: ${T.accent};
          background: ${T.accentPale};
          border: 1px solid rgba(31,77,43,0.15);
        }
        .badge-pending {
          color: ${T.gold};
          background: ${T.goldPale};
          border: 1px solid rgba(154,123,79,0.2);
        }

        .hero-float {
          position: absolute;
          bottom: -32px;
          right: -32px;
          background: ${T.ink};
          border-radius: ${T.radiusMd};
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: ${T.shadowLg};
          animation: float 4s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .hero-float-icon {
          width: 36px;
          height: 36px;
          border-radius: ${T.radius};
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        .hero-float-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin-bottom: 3px;
        }
        .hero-float-value {
          font-size: 14px;
          font-weight: 500;
          color: white;
        }

        .hero-line {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 1px;
          background: ${T.rule};
        }

        /* ÔöÇÔöÇ STATS ÔöÇÔöÇ */
        .stats-wrap {
          border-top: 1px solid ${T.rule};
          border-bottom: 1px solid ${T.rule};
          background: ${T.canvas};
        }
        .stats-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 56px 48px;
          display: grid;
          grid-template-columns: repeat(4,1fr);
        }
        .stat-item {
          padding: 0 40px;
          text-align: left;
          border-right: 1px solid ${T.rule};
        }
        .stat-item:first-child { padding-left: 0; }
        .stat-item:last-child { border-right: none; }
        .stat-n {
          font-family: ${T.fontSerif};
          font-size: 44px;
          font-weight: 400;
          color: ${T.ink};
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .stat-label {
          font-size: 13px;
          font-weight: 400;
          color: ${T.muted};
          margin-top: 8px;
          line-height: 1.4;
        }

        .fade-up {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }

        section { padding: 112px 48px; }
        .section-inner { max-width: 1320px; margin: 0 auto; }
        .section-header { margin-bottom: 72px; }
        .section-title {
          font-family: ${T.fontSerif};
          font-size: clamp(32px, 3.5vw, 52px);
          font-weight: 400;
          color: ${T.ink};
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin-bottom: 16px;
        }
        .section-sub {
          font-size: 16px;
          color: ${T.mid};
          line-height: 1.7;
          max-width: 520px;
          font-weight: 400;
        }

        /* ÔöÇÔöÇ MODELS ÔöÇÔöÇ */
        .models-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: ${T.rule};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          overflow: hidden;
        }
        .model-card {
          background: ${T.canvas};
          padding: 44px 40px;
          transition: background 0.3s;
          cursor: default;
        }
        .model-card:hover { background: ${T.surface}; }
        .model-num {
          font-family: ${T.fontSerif};
          font-size: 13px;
          color: ${T.faint};
          letter-spacing: 0.05em;
          margin-bottom: 32px;
        }
        .model-tag {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${T.gold};
          margin-bottom: 10px;
        }
        .model-name {
          font-family: ${T.fontSerif};
          font-size: 24px;
          font-weight: 400;
          color: ${T.ink};
          letter-spacing: -0.02em;
          margin-bottom: 16px;
          line-height: 1.2;
        }
        .model-desc {
          font-size: 14px;
          line-height: 1.75;
          color: ${T.mid};
          font-weight: 400;
        }

        /* ÔöÇÔöÇ FEATURES ÔöÇÔöÇ */
        .features-bg { background: ${T.surface}; }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }
        .feat-card {
          padding: 36px 28px;
          background: ${T.canvas};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          transition: box-shadow 0.3s;
        }
        .feat-card:hover { box-shadow: ${T.shadowMd}; }
        .feat-num {
          font-family: ${T.fontSerif};
          font-size: 11px;
          color: ${T.faint};
          margin-bottom: 28px;
          letter-spacing: 0.05em;
        }
        .feat-title {
          font-size: 15px;
          font-weight: 500;
          color: ${T.ink};
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .feat-desc {
          font-size: 14px;
          line-height: 1.7;
          color: ${T.muted};
          font-weight: 400;
        }

        /* ÔöÇÔöÇ ABOUT ÔöÇÔöÇ */
        .about-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }
        .about-content { max-width: 560px; }
        .about-description {
          font-size: 16px;
          line-height: 1.8;
          color: ${T.mid};
          margin-bottom: 40px;
        }
        .about-values {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 40px;
        }
        .about-value-item {
          border-left: 2px solid ${T.accent};
          padding-left: 20px;
        }
        .about-value-title {
          font-size: 14px;
          font-weight: 600;
          color: ${T.ink};
          margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .about-value-desc {
          font-size: 13px;
          color: ${T.muted};
          line-height: 1.6;
        }
        .about-visual {
          position: relative;
          background: ${T.surface};
          border-radius: ${T.radiusMd};
          aspect-ratio: 4/5;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${T.rule};
          overflow: hidden;
        }
        .about-visual img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .about-visual-placeholder {
          text-align: center;
          color: ${T.faint};
        }
        .about-visual-placeholder i {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .about-visual-placeholder p {
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* ÔöÇÔöÇ VISION ÔöÇÔöÇ */
        .vision-section {
          background: ${T.ink};
          color: white;
          padding: 120px 48px;
          text-align: center;
        }
        .vision-quote {
          font-family: ${T.fontSerif};
          font-size: clamp(32px, 4.5vw, 64px);
          line-height: 1.1;
          font-weight: 400;
          letter-spacing: -0.02em;
          max-width: 800px;
          margin: 0 auto 40px;
        }
        .vision-quote em {
          color: ${T.accentL};
          font-style: italic;
        }
        .vision-author {
          font-size: 14px;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* ÔöÇÔöÇ CULTURE ÔöÇÔöÇ */
        .culture-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-top: 60px;
        }
        .culture-card {
          padding: 40px 32px;
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          transition: all 0.3s;
        }
        .culture-card:hover {
          box-shadow: ${T.shadowMd};
          border-color: ${T.accentPale};
        }
        .culture-icon {
          font-size: 28px;
          color: ${T.accent};
          margin-bottom: 24px;
        }
        .culture-title {
          font-family: ${T.fontSerif};
          font-size: 20px;
          margin-bottom: 16px;
          color: ${T.ink};
        }
        .culture-desc {
          font-size: 14px;
          color: ${T.muted};
          line-height: 1.7;
        }

        /* ÔöÇÔöÇ FAQ ÔöÇÔöÇ */
        .faq-section { background: ${T.surface}; }
        .faq-grid {
          margin-top: 60px;
          max-width: 800px;
        }
        .faq-item {
          border-bottom: 1px solid ${T.rule};
          padding: 24px 0;
          cursor: pointer;
        }
        .faq-question {
          font-size: 18px;
          font-weight: 500;
          color: ${T.ink};
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
        }
        .faq-question:hover { color: ${T.accent}; }
        .faq-answer {
          font-size: 15px;
          color: ${T.muted};
          line-height: 1.7;
          margin-top: 12px;
          display: none;
        }
        .faq-answer.open { display: block; }

        /* ÔöÇÔöÇ COMMUNITY ÔöÇÔöÇ */
        .community-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          margin-top: 60px;
        }
        .community-image {
          background: ${T.surface};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .community-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .community-image-placeholder {
          text-align: center;
          color: ${T.faint};
        }
        .community-image-placeholder i {
          font-size: 56px;
          margin-bottom: 16px;
          display: block;
        }
        .community-image-placeholder p {
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .community-provinces {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 32px;
        }
        .province-tag {
          padding: 10px 16px;
          border: 1px solid ${T.rule};
          border-radius: ${T.radius};
          font-size: 13px;
          text-align: center;
          color: ${T.mid};
          transition: all 0.2s;
        }
        .province-tag:hover {
          border-color: ${T.accent};
          color: ${T.accent};
          background: ${T.accentPale};
        }

        /* ÔöÇÔöÇ TEAM ÔöÇÔöÇ */
        .team-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 28px;
        }
        .team-card { cursor: default; }
        .team-photo {
          aspect-ratio: 3 / 4;
          background: ${T.surface};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
          position: relative;
          transition: box-shadow 0.3s;
        }
        .team-card:hover .team-photo { box-shadow: ${T.shadowMd}; }
        .team-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          transition: transform 0.4s ease;
        }
        .team-card:hover .team-photo img { transform: scale(1.03); }
        .team-photo-init {
          font-family: ${T.fontSerif};
          font-size: 40px;
          color: ${T.faint};
          font-weight: 400;
          letter-spacing: -0.03em;
        }
        .team-name {
          font-size: 15px;
          font-weight: 500;
          color: ${T.ink};
          margin-bottom: 5px;
          letter-spacing: -0.01em;
        }
        .team-role {
          font-size: 13px;
          font-weight: 400;
          color: ${T.muted};
          line-height: 1.4;
        }

        /* ÔöÇÔöÇ CTA ÔöÇÔöÇ */
        .cta-section { background: ${T.canvas}; }
        .cta-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 0 48px;
        }
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
          position: absolute;
          right: -80px;
          top: -80px;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: rgba(255,255,255,0.02);
          pointer-events: none;
        }
        .cta-eyebrow {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${T.accentL};
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cta-eyebrow::before {
          content: '';
          display: block;
          width: 20px;
          height: 1px;
          background: ${T.accentL};
        }
        .cta-title {
          font-family: ${T.fontSerif};
          font-size: clamp(28px, 3vw, 44px);
          font-weight: 400;
          color: white;
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin-bottom: 16px;
        }
        .cta-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.5);
          line-height: 1.7;
          font-weight: 400;
          max-width: 420px;
        }
        .btn-cta {
          height: 52px;
          padding: 0 36px;
          border-radius: ${T.radius};
          border: 1px solid white;
          background: white;
          color: ${T.ink};
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
          transition: all 0.25s;
          font-family: ${T.fontSans};
          position: relative;
          flex-shrink: 0;
        }
        .btn-cta:hover {
          background: transparent;
          color: white;
          transform: translateY(-2px);
        }

        /* ÔöÇÔöÇ FOOTER ÔöÇÔöÇ */
        .footer-section {
          background: ${T.ink80};
          padding: 80px 48px 40px;
        }
        .footer-grid {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 60px;
          margin-bottom: 60px;
        }
        .footer-brand-col p {
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          line-height: 1.7;
          margin-top: 20px;
          max-width: 300px;
        }
        .footer-col-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 24px;
        }
        .footer-link {
          display: block;
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          font-size: 13px;
          margin-bottom: 12px;
          transition: color 0.2s;
          line-height: 1.6;
          cursor: pointer;
        }
        .footer-link:hover { color: rgba(255,255,255,0.8); }
        .footer-bottom {
          max-width: 1320px;
          margin: 0 auto;
          padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-copyright {
          color: rgba(255,255,255,0.25);
          font-size: 12px;
        }
        .footer-brand {
          font-family: ${T.fontSerif};
          font-size: 18px;
          color: rgba(255,255,255,0.85);
          letter-spacing: -0.01em;
          margin-bottom: 8px;
        }
        .footer-brand em {
          color: ${T.accentL};
          font-style: normal;
        }

        /* ÔöÇÔöÇ RESPONSIVE ÔöÇÔöÇ */
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
        }
        @media (max-width: 600px) {
          .team-grid { grid-template-columns: 1fr; }
          .nav-inner { padding: 0 24px; }
          .footer-bottom { flex-direction: column; gap: 16px; }
        }
      `}</style>

      {/* ÔòÉÔòÉÔòÉ NAV ÔòÉÔòÉÔòÉ */}
      <nav className={`nav ${scrolled ? 'solid' : ''}`}>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src={orbisLinkLogo} alt="AgriLink" />
          </a>

          <div className="nav-links">
            <a href="#about" className="nav-link">Sobre N├│s</a>
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

      {/* ÔòÉÔòÉÔòÉ HERO ÔòÉÔòÉÔòÉ */}
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
            <div className="hero-card">
              <div className="hero-card-header">
                <div>
                  <div className="hero-card-label">Contrato Ativo</div>
                  <div className="hero-card-value">Tomate ┬À 40 ton.</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="hero-card-amount-label">Valor Total</div>
                  <div className="hero-card-amount">AOA 2.4M</div>
                </div>
              </div>

              {[
                { name: 'Soja ┬À 120 ton.', status: 'Ativo', cls: 'badge-active' },
                { name: 'Milho ┬À 80 ton.', status: 'Pendente', cls: 'badge-pending' },
                { name: 'Feij├úo ┬À 60 ton.', status: 'Ativo', cls: 'badge-active' },
                { name: 'Mandioca ┬À 30 ton.', status: 'Pendente', cls: 'badge-pending' },
              ].map((r, i) => (
                <div key={i} className="contract-row">
                  <span className="contract-name">{r.name}</span>
                  <span className={`contract-badge ${r.cls}`}>{r.status}</span>
                </div>
              ))}
            </div>

            <div className="hero-float">
              <div className="hero-float-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5l1.5 3 3.3.5L10.5 7.2l.6 3.3L8 9l-3.1 1.5.6-3.3L3.2 5l3.3-.5z" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" fill="none"/>
                </svg>
              </div>
              <div>
                <div className="hero-float-label">Contratos Digitais</div>
                <div className="hero-float-value">100% Seguros</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-line" />
      </section>

      {/* ÔòÉÔòÉÔòÉ STATS ÔòÉÔòÉÔòÉ */}
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

      {/* ÔòÉÔòÉÔòÉ MODELS ÔòÉÔòÉÔòÉ */}
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

      {/* ÔòÉÔòÉÔòÉ FEATURES ÔòÉÔòÉÔòÉ */}
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

      {/* ÔòÉÔòÉÔòÉ SOBRE N├ôS ÔòÉÔòÉÔòÉ */}
      <section id="about" ref={aboutRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${aboutVis ? 'visible' : ''}`}>
            <div className="eyebrow">Nossa Hist├│ria</div>
            <h2 className="section-title">Sobre a AgriLink</h2>
            <p className="section-sub">Conectando o ecossistema agroalimentar com tecnologia e confian├ºa.</p>
          </div>
          <div className="about-grid">
            <div className="about-content">
              <p className="about-description">
                A AgriLink nasceu da vis├úo de digitalizar o mercado agroalimentar em ├üfrica. 
                Somos uma plataforma B2B que conecta agricultores, f├íbricas, distribuidores 
                e compradores institucionais atrav├®s de contratos digitais seguros e rastre├íveis.
              </p>
              <div className="about-values">
                <div className="about-value-item">
                  <div className="about-value-title">Miss├úo</div>
                  <div className="about-value-desc">Digitalizar e simplificar a cadeia agroalimentar, conectando produtores e compradores com transpar├¬ncia.</div>
                </div>
                <div className="about-value-item">
                  <div className="about-value-title">Vis├úo</div>
                  <div className="about-value-desc">Ser o maior marketplace B2B agroalimentar da SADC.</div>
                </div>
                <div className="about-value-item">
                  <div className="about-value-title">Tecnologia</div>
                  <div className="about-value-desc">Contratos digitais, rastreabilidade blockchain e an├ílise de dados.</div>
                </div>
                <div className="about-value-item">
                  <div className="about-value-title">Impacto</div>
                  <div className="about-value-desc">Fluxo de caixa imediato para agricultores e seguran├ºa jur├¡dica para compradores.</div>
                </div>
              </div>
            </div>
            <div className="about-visual">
              {comunidadeImg ? (
                <img src={comunidadeImg} alt="Comunidade AgriLink" />
              ) : (
                <div className="about-visual-placeholder">
                  <div>­ƒî¥</div>
                  <p>Comunidade AgriLink</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ÔòÉÔòÉÔòÉ VIS├âO ÔòÉÔòÉÔòÉ */}
      <section className="vision-section">
        <div className="section-inner">
          <h2 className="vision-quote">
            "SER O MAIOR <em>MARKETPLACE B2B AGROALIMENTAR</em> DA SADC"
          </h2>
          <div className="vision-author">AgriLink ┬À Vis├úo 2030</div>
        </div>
      </section>

      {/* ÔòÉÔòÉÔòÉ CULTURA ÔòÉÔòÉÔòÉ */}
      <section>
        <div className="section-inner">
          <div className="section-header">
            <div className="eyebrow">Cultura</div>
            <h2 className="section-title">Entrega de Resultados</h2>
            <p className="section-sub">Trabalhe onde quiseres, entregue o resultado. Nossa cultura valoriza autonomia e excel├¬ncia.</p>
          </div>
          <div className="culture-grid">
            <div className="culture-card">
              <div className="culture-icon"></div>
              <div className="culture-title">Trabalho Remoto</div>
              <div className="culture-desc">Nossa equipa trabalha de qualquer lugar, desde que os resultados sejam entregues com excel├¬ncia e dentro dos prazos.</div>
            </div>
            <div className="culture-card">
              <div className="culture-icon"></div>
              <div className="culture-title">Foco em Resultados</div>
              <div className="culture-desc">Medimos performance por resultados concretos, n├úo por horas trabalhadas. Autonomia com responsabilidade.</div>
            </div>
            <div className="culture-card">
              <div className="culture-icon"></div>
              <div className="culture-title">Colabora├º├úo</div>
              <div className="culture-desc">Times multidisciplinares trabalhando juntos para transformar o agroneg├│cio africano com tecnologia.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ÔòÉÔòÉÔòÉ FAQ ÔòÉÔòÉÔòÉ */}
      <section id="faq" className="faq-section" ref={faqRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${faqVis ? 'visible' : ''}`}>
            <div className="eyebrow">D├║vidas</div>
            <h2 className="section-title">Perguntas Frequentes</h2>
            <p className="section-sub">Tudo o que precisa saber sobre a AgriLink.</p>
          </div>
          <div className="faq-grid">
            {faqItems.map((item, i) => (
              <div key={i} className="faq-item" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <div className="faq-question">
                  <span>{item.q}</span>
                  <span>{faqOpen === i ? 'ÔêÆ' : '+'}</span>
                </div>
                <div className={`faq-answer ${faqOpen === i ? 'open' : ''}`}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ÔòÉÔòÉÔòÉ COMUNIDADES ÔòÉÔòÉÔòÉ */}
      <section id="community" ref={communityRef}>
        <div className="section-inner">
          <div className={`section-header fade-up ${communityVis ? 'visible' : ''}`}>
            <div className="eyebrow">Presen├ºa Nacional</div>
            <h2 className="section-title">Comunidades AgriLink</h2>
            <p className="section-sub">Encontros mensais com a comunidade AgriLink em cada uma das 21 prov├¡ncias de Angola.</p>
          </div>
          <div className="community-grid">
            <div className="community-image">
              {comunidadeImg2 ? (
                <img src={comunidadeImg2} alt="Encontro da Comunidade AgriLink" />
              ) : (
                <div className="community-image-placeholder">
                  <div>­ƒîì</div>
                  <p>Encontros AgriLink</p>
                </div>
              )}
            </div>
            <div>
              <h3 style={{ fontFamily: T.fontSerif, fontSize: '24px', marginBottom: '16px', color: T.ink }}>
                Encontros Mensais
              </h3>
              <p style={{ color: T.muted, lineHeight: 1.7, marginBottom: '32px' }}>
                Realizamos encontros presenciais em cada prov├¡ncia para fortalecer 
                a comunidade, compartilhar conhecimento e criar oportunidades de neg├│cio.
              </p>
              <div className="community-provinces">
                {['Luanda', 'Benguela', 'Hu├¡la', 'Cabinda', 'Malanje', 'Huambo', 'Bi├®', 'U├¡ge', 'Zaire', 'Cuanza Sul', 'Cuanza Norte', 'Lunda Sul'].map(provincia => (
                  <div key={provincia} className="province-tag">{provincia}</div>
                ))}
                <div className="province-tag" style={{background: T.accent, color: 'white', border: 'none'}}>
                  +9 Prov├¡ncias
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ÔòÉÔòÉÔòÉ TEAM ÔòÉÔòÉÔòÉ */}
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

      {/* ÔòÉÔòÉÔòÉ CTA ÔòÉÔòÉÔòÉ */}
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

      {/* ÔòÉÔòÉÔòÉ FOOTER ÔòÉÔòÉÔòÉ */}
      <footer className="footer-section">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">Agri<em>Link</em></div>
            <p>O marketplace B2B agroalimentar que conecta agricultores, f├íbricas e compradores institucionais em toda a SADC.</p>
          </div>
          <div>
            <div className="footer-col-title">Plataforma</div>
            <a href="#models" className="footer-link">Modelos de Neg├│cio</a>
            <a href="#about" className="footer-link">Sobre N├│s</a>
            <a href="#team" className="footer-link">Equipa</a>
            <a href="#faq" className="footer-link">Perguntas Frequentes</a>
            <a href="#community" className="footer-link">Comunidades</a>
          </div>
          <div>
            <div className="footer-col-title">Links ├Üteis</div>
            <a href="#" className="footer-link">Agentes de Campo</a>
            <a href="#" className="footer-link">F├íbricas</a>
            <a href="#" className="footer-link">Agricultores</a>
            <a href="#about" className="footer-link">Miss├úo</a>
            <a href="#about" className="footer-link">Vis├úo</a>
            <a href="#about" className="footer-link">Tecnologias</a>
          </div>
          <div>
            <div className="footer-col-title">Presen├ºa</div>
            <a href="#" className="footer-link">Angola</a>
            <a href="#" className="footer-link">RDC</a>
            <a href="#" className="footer-link">├üfrica do Sul</a>
            <a href="#" className="footer-link">Nam├¡bia</a>
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
