import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/* ─── Design Tokens ─────────────────────────────────────────── */
const T = {
  ink:        '#0A0A0A',
  ink80:      '#1A1A1A',
  ink60:      '#2C2C2C',
  mid:        '#555555',
  muted:      '#888888',
  faint:      '#BBBBBB',
  rule:       '#E8E8E8',
  surface:    '#F5F4F0',
  canvas:     '#FFFFFF',
  accent:     '#1F4D2B',
  accentM:    '#2D6B3A',
  accentL:    '#4A8F5A',
  accentPale: '#EDF2EE',
  gold:       '#9A7B4F',
  goldPale:   '#F8F4EE',
  fontSans:   "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  fontSerif:  "'DM Serif Display', Georgia, serif",
  radius:     '4px',
  radiusMd:   '8px',
  radiusLg:   '16px',
  shadowSm:   '0 1px 3px rgba(0,0,0,0.06)',
  shadowMd:   '0 4px 16px rgba(0,0,0,0.06)',
  shadowLg:   '0 12px 40px rgba(0,0,0,0.08)',
}

/* ─── i18n ───────────────────────────────────────────────────── */
const LANGS = {
  pt: {
    nav: { models: 'Modelos', team: 'Equipa', contact: 'Contacto', login: 'Entrar', register: 'Registar' },
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
      { n: '3',    label: 'Modelos de Negócio' },
      { n: 'B2B',  label: 'Plataforma Institucional' },
      { n: '100%', label: 'Contratos Digitais' },
      { n: '3',    label: 'Idiomas Suportados' },
    ],
    models: {
      eyebrow: 'Como Operamos',
      title: 'Quatro Modelos de Atuação',
      sub: 'Escolha o modelo que melhor se adapta ao seu negócio agroalimentar.',
      list: [
        { num: '01', name: 'Compra Direta',        tag: 'Modelo Informal',          desc: 'A AgriLink compra diretamente aos produtores e revende nos mercados informais, criando fluxo imediato de caixa para o agricultor.' },
        { num: '02', name: 'Procurement Dedicado', tag: 'AgriLink Sourcing Premium', desc: 'Identificamos e garantimos o fornecimento de produtos específicos para empresas. Sourcing gerido, rastreado e certificado digitalmente.' },
        { num: '03', name: 'Produção por Contrato', tag: 'On-Demand',               desc: 'Agricultores produzem segundo fichas técnicas dos fabricantes. Contratos digitais, prazos definidos e pagamento garantido à produção.' },
        { num: '04', name: 'Pré-Compra Digital',   tag: 'Marketplace',              desc: 'Adquira antecipadamente colheitas futuras. Preços fixados hoje, entrega garantida na época. Totalmente digital e rastreável.' },
      ],
    },
    features: {
      eyebrow: 'Infraestrutura',
      title: 'Tecnologia ao Serviço da Agricultura',
      list: [
        { t: 'Contratos Digitais',    d: 'Validade legal plena com rastreabilidade imutável em cada transação.' },
        { t: 'Importação & Exportação', d: 'Operações transfronteiriças com documentação integrada e certificada.' },
        { t: 'Mercado de Futuros',    d: 'Preços e volumes negociados antecipadamente com segurança jurídica.' },
        { t: 'Plataforma B2B',        d: 'Desenhada para empresas, cooperativas e distribuidores institucionais.' },
      ],
    },
    team: {
      eyebrow: 'Liderança',
      title: 'A Nossa Equipa',
      sub: 'Profissionais com visão de longo prazo construindo a infraestrutura digital do agronegócio angolano.',
      list: [
        { name: 'Feliciano Cassoma',  role: 'Co-Fundador & CEO' },
        { name: 'Moisés Lucamba',     role: 'Co-Fundador & CTO' },
        { name: 'Cláudio Henriques',  role: 'Co-Fundador & Director de Operações' },
        { name: 'Lizeth Caieie',      role: 'Secretária Geral' },
      ],
    },
    faq: [
      { q: 'Como funciona a plataforma AgriLink?',        a: 'A AgriLink conecta agricultores, empresas e compradores através de contratos digitais seguros. Nossa plataforma oferece quatro modelos de negócio adaptados às necessidades do mercado agroalimentar.' },
      { q: 'Quais países estão cobertos?',                a: 'Atualmente operamos em Angola, com planos de expansão para RDC, Namíbia e África do Sul, criando o maior marketplace B2B agroalimentar da SADC.' },
      { q: 'Como garante a segurança das transações?',    a: 'Utilizamos smart contracts com validade legal plena, rastreabilidade imutável e documentação certificada para cada transação.' },
      { q: 'Quem pode se cadastrar?',                     a: 'Agricultores, cooperativas, fábricas, distribuidores e compradores institucionais podem se cadastrar na plataforma.' },
    ],
    community: {
      eyebrow: 'Presença Nacional',
      title: 'Comunidades AgriLink',
      sub: 'Encontros mensais com a comunidade AgriLink em cada uma das 21 províncias de Angola.',
      desc: 'Realizamos encontros presenciais em cada província para fortalecer a comunidade, compartilhar conhecimento e criar oportunidades de negócio.',
      provinces: ['Luanda','Benguela','Huíla','Cabinda','Malanje','Huambo','Bié','Uíge','Zaire','Cuanza Sul','Cuanza Norte','Lunda Sul'],
    },
    about: {
      eyebrow: 'Nossa História',
      title: 'Sobre a AgriLink',
      sub: 'Conectando o ecossistema agroalimentar com tecnologia e confiança.',
      desc: 'A AgriLink nasceu da visão de digitalizar o mercado agroalimentar em África. Somos uma plataforma B2B que conecta agricultores, fábricas, distribuidores e compradores institucionais através de contratos digitais seguros e rastreáveis.',
      values: [
        { t: 'Missão',     d: 'Digitalizar e simplificar a cadeia agroalimentar, conectando produtores e compradores com transparência.' },
        { t: 'Visão',      d: 'Ser o maior marketplace B2B agroalimentar da SADC.' },
        { t: 'Tecnologia', d: 'Contratos digitais, rastreabilidade blockchain e análise de dados.' },
        { t: 'Impacto',    d: 'Fluxo de caixa imediato para agricultores e segurança jurídica para compradores.' },
      ],
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
    nav: { models: 'Modèles', team: 'Équipe', contact: 'Contact', login: 'Connexion', register: "S'inscrire" },
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
      { n: '3',    label: "Modèles d'Activité" },
      { n: 'B2B',  label: 'Plateforme Institutionnelle' },
      { n: '100%', label: 'Contrats Numériques' },
      { n: '3',    label: 'Langues Supportées' },
    ],
    models: {
      eyebrow: 'Comment Nous Opérons',
      title: "Quatre Modèles d'Activité",
      sub: 'Choisissez le modèle adapté à votre activité agroalimentaire.',
      list: [
        { num: '01', name: 'Achat Direct',               tag: 'Modèle Informel',          desc: "AgriLink achète directement aux producteurs et revend sur les marchés informels, créant un flux de trésorerie immédiat." },
        { num: '02', name: 'Approvisionnement Dédié',    tag: 'AgriLink Sourcing Premium', desc: "Nous identifions et garantissons l'approvisionnement de produits spécifiques pour les entreprises." },
        { num: '03', name: 'Production Sous Contrat',    tag: 'Sur Demande',               desc: 'Les agriculteurs produisent selon les fiches techniques des fabricants. Contrats numériques, délais définis.' },
        { num: '04', name: 'Pré-Achat Numérique',        tag: 'Marketplace',               desc: "Achetez des récoltes futures à l'avance. Prix fixés aujourd'hui, livraison garantie à la saison." },
      ],
    },
    features: {
      eyebrow: 'Infrastructure',
      title: "La Technologie au Service de l'Agriculture",
      list: [
        { t: 'Contrats Numériques', d: 'Validité juridique complète avec traçabilité immuable.' },
        { t: 'Import & Export',     d: 'Opérations transfrontalières avec documentation intégrée et certifiée.' },
        { t: "Marché à Terme",      d: "Prix et volumes négociés à l'avance avec sécurité juridique." },
        { t: 'Plateforme B2B',      d: 'Conçue pour les entreprises, coopératives et distributeurs institutionnels.' },
      ],
    },
    team: {
      eyebrow: 'Direction',
      title: 'Notre Équipe',
      sub: "Professionnels à vision long terme construisant l'infrastructure numérique de l'agribusiness angolais.",
      list: [
        { name: 'Feliciano Cassoma',  role: 'Co-Fondateur & PDG' },
        { name: 'Moisés Lucamba',     role: 'Co-Fondateur & CTO' },
        { name: 'Cláudio Henriques',  role: "Co-Fondateur & Directeur des Opérations" },
        { name: 'Lizeth Caieie',      role: 'Secrétaire Générale' },
      ],
    },
    faq: [
      { q: 'Comment fonctionne la plateforme AgriLink ?', a: "AgriLink connecte les agriculteurs, entreprises et acheteurs via des contrats numériques sécurisés. Notre plateforme propose quatre modèles d'affaires." },
      { q: 'Quels pays sont couverts ?',                  a: 'Nous opérons actuellement en Angola, avec des plans d\'expansion vers la RDC, la Namibie et l\'Afrique du Sud.' },
      { q: 'Comment garantissez-vous la sécurité ?',      a: 'Nous utilisons des smart contracts avec pleine validité juridique, traçabilité immuable et documentation certifiée.' },
      { q: 'Qui peut s\'inscrire ?',                      a: 'Agriculteurs, coopératives, usines, distributeurs et acheteurs institutionnels peuvent s\'inscrire.' },
    ],
    community: {
      eyebrow: 'Présence Nationale',
      title: 'Communautés AgriLink',
      sub: 'Rencontres mensuelles avec la communauté AgriLink dans chacune des 21 provinces d\'Angola.',
      desc: 'Nous organisons des rencontres en présentiel dans chaque province pour renforcer la communauté et créer des opportunités d\'affaires.',
      provinces: ['Luanda','Benguela','Huíla','Cabinda','Malanje','Huambo','Bié','Uíge','Zaire','Cuanza Sul','Cuanza Norte','Lunda Sul'],
    },
    about: {
      eyebrow: 'Notre Histoire',
      title: 'À propos d\'AgriLink',
      sub: 'Connecter l\'écosystème agroalimentaire avec technologie et confiance.',
      desc: 'AgriLink est né de la vision de digitaliser le marché agroalimentaire en Afrique. Nous sommes une plateforme B2B qui connecte agriculteurs, usines, distributeurs et acheteurs institutionnels.',
      values: [
        { t: 'Mission',     d: 'Digitaliser et simplifier la chaîne agroalimentaire avec transparence.' },
        { t: 'Vision',      d: 'Être le plus grand marketplace B2B agroalimentaire de la SADC.' },
        { t: 'Technologie', d: 'Contrats numériques, traçabilité blockchain et analyse de données.' },
        { t: 'Impact',      d: 'Flux de trésorerie immédiat pour les agriculteurs et sécurité juridique pour les acheteurs.' },
      ],
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
    nav: { models: 'Models', team: 'Team', contact: 'Contact', login: 'Login', register: 'Register' },
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
      { n: '3',    label: 'Business Models' },
      { n: 'B2B',  label: 'Institutional Platform' },
      { n: '100%', label: 'Digital Contracts' },
      { n: '3',    label: 'Languages Supported' },
    ],
    models: {
      eyebrow: 'How We Operate',
      title: 'Four Business Models',
      sub: 'Choose the model that best fits your agri-food business.',
      list: [
        { num: '01', name: 'Direct Purchase',       tag: 'Informal Model',          desc: 'AgriLink buys directly from producers and resells in informal markets, creating immediate cash flow for the farmer.' },
        { num: '02', name: 'Dedicated Procurement', tag: 'AgriLink Sourcing Premium', desc: 'We identify and secure the supply of specific products for companies. Digitally managed, tracked and certified sourcing.' },
        { num: '03', name: 'Contract Production',   tag: 'On-Demand',               desc: 'Farmers produce according to manufacturer technical specs. Digital contracts, set deadlines and guaranteed payment.' },
        { num: '04', name: 'Digital Pre-Purchase',  tag: 'Marketplace',             desc: 'Buy future harvests in advance. Prices locked today, delivery guaranteed at harvest. Fully digital.' },
      ],
    },
    features: {
      eyebrow: 'Infrastructure',
      title: 'Technology Serving Agriculture',
      list: [
        { t: 'Digital Contracts', d: 'Full legal validity with immutable traceability on every transaction.' },
        { t: 'Import & Export',   d: 'Simplified cross-border operations with integrated certified documentation.' },
        { t: 'Futures Market',    d: 'Prices and volumes negotiated in advance with legal certainty.' },
        { t: 'B2B Platform',      d: 'Designed for companies, cooperatives and institutional distributors.' },
      ],
    },
    team: {
      eyebrow: 'Leadership',
      title: 'Our Team',
      sub: 'Long-horizon professionals building the digital infrastructure of Angolan agribusiness.',
      list: [
        { name: 'Feliciano Cassoma',  role: 'Co-Founder & CEO' },
        { name: 'Moisés Lucamba',     role: 'Co-Founder & CTO' },
        { name: 'Cláudio Henriques',  role: 'Co-Founder & COO' },
        { name: 'Lizeth Caieie',      role: 'General Secretary' },
      ],
    },
    faq: [
      { q: 'How does the AgriLink platform work?',     a: 'AgriLink connects farmers, companies and buyers through secure digital contracts. Our platform offers four business models adapted to the agri-food market.' },
      { q: 'Which countries are covered?',             a: 'We currently operate in Angola, with expansion plans for DRC, Namibia and South Africa, creating the largest B2B agri-food marketplace in SADC.' },
      { q: 'How do you ensure transaction security?',  a: 'We use smart contracts with full legal validity, immutable traceability and certified documentation for every transaction.' },
      { q: 'Who can register?',                        a: 'Farmers, cooperatives, factories, distributors and institutional buyers can register on the platform.' },
    ],
    community: {
      eyebrow: 'National Presence',
      title: 'AgriLink Communities',
      sub: 'Monthly meetings with the AgriLink community across all 21 provinces of Angola.',
      desc: 'We hold in-person meetings in each province to strengthen the community, share knowledge and create business opportunities.',
      provinces: ['Luanda','Benguela','Huíla','Cabinda','Malanje','Huambo','Bié','Uíge','Zaire','Cuanza Sul','Cuanza Norte','Lunda Sul'],
    },
    about: {
      eyebrow: 'Our Story',
      title: 'About AgriLink',
      sub: 'Connecting the agri-food ecosystem with technology and trust.',
      desc: 'AgriLink was born from the vision of digitising the agri-food market in Africa. We are a B2B platform connecting farmers, factories, distributors and institutional buyers through secure, traceable digital contracts.',
      values: [
        { t: 'Mission',    d: 'Digitise and simplify the agri-food chain, connecting producers and buyers with transparency.' },
        { t: 'Vision',     d: 'Become the largest B2B agri-food marketplace in SADC.' },
        { t: 'Technology', d: 'Digital contracts, blockchain traceability and data analytics.' },
        { t: 'Impact',     d: 'Immediate cash flow for farmers and legal certainty for buyers.' },
      ],
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

/* ─── Hooks ─────────────────────────────────────────────────── */
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
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.08 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return isVisible
}

/* ─── Avatar ─────────────────────────────────────────────────── */
const Avatar = ({ name }) => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('')
  const colors = ['#1F4D2B','#2D6B3A','#9A7B4F','#555555']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div style={{
      width: '100%', height: '100%',
      background: colors[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: T.fontSerif, fontSize: '40px', color: 'rgba(255,255,255,0.85)',
        fontWeight: 400, letterSpacing: '-0.03em',
      }}>{initials}</span>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────── */
const Index = () => {
  const navigate = useNavigate()
  const [lang, setLang] = useState('pt')
  const [faqOpen, setFaqOpen] = useState(null)
  const t = LANGS[lang]
  const scrolled = useScrolled()

  const statsRef     = useRef(null)
  const modelsRef    = useRef(null)
  const featRef      = useRef(null)
  const teamRef      = useRef(null)
  const aboutRef     = useRef(null)
  const faqRef       = useRef(null)
  const communityRef = useRef(null)

  const statsVis     = useVisible(statsRef)
  const modelsVis    = useVisible(modelsRef)
  const featVis      = useVisible(featRef)
  const teamVis      = useVisible(teamRef)
  const aboutVis     = useVisible(aboutRef)
  const faqVis       = useVisible(faqRef)
  const communityVis = useVisible(communityRef)

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

        /* NAV */
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
          gap: 10px;
          text-decoration: none;
        }
        .nav-logo-mark {
          width: 32px; height: 32px;
          background: ${T.accent};
          border-radius: 50% 50% 50% 0;
          display: flex; align-items: center; justify-content: center;
        }
        .nav-logo-mark svg { display: block; }
        .nav-wordmark {
          font-family: ${T.fontSerif};
          font-size: 22px;
          color: ${T.ink};
          letter-spacing: -0.01em;
        }
        .nav-wordmark em { color: ${T.accent}; font-style: normal; }
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
          transition: color 0.2s;
        }
        .nav-link:hover { color: ${T.ink}; }
        .nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lang-btn {
          height: 30px; padding: 0 10px;
          border-radius: ${T.radius};
          border: 1px solid transparent;
          background: transparent;
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: ${T.muted};
          cursor: pointer; transition: all 0.2s;
          font-family: ${T.fontSans};
        }
        .lang-btn:hover { color: ${T.ink}; }
        .lang-btn.active {
          border-color: ${T.accent};
          color: ${T.accent};
          background: ${T.accentPale};
        }
        .btn-login {
          height: 38px; padding: 0 20px;
          border-radius: ${T.radius};
          border: 1px solid ${T.rule};
          background: transparent;
          color: ${T.ink60}; font-size: 13px;
          cursor: pointer; transition: all 0.2s;
          font-family: ${T.fontSans}; margin-left: 8px;
        }
        .btn-login:hover { border-color: ${T.mid}; color: ${T.ink}; }
        .btn-reg {
          height: 38px; padding: 0 20px;
          border-radius: ${T.radius};
          border: 1px solid ${T.accent};
          background: ${T.accent};
          color: white; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.25s;
          font-family: ${T.fontSans};
        }
        .btn-reg:hover { background: ${T.accentM}; border-color: ${T.accentM}; }

        /* HERO */
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column; justify-content: center;
          padding: 140px 48px 80px;
          position: relative; overflow: hidden;
          background: ${T.canvas};
        }
        .hero-location-bar {
          position: absolute;
          top: 0; left: 0; right: 0; height: 36px;
          background: ${T.ink};
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-size: 11px; font-weight: 400; letter-spacing: 0.1em;
          color: rgba(255,255,255,0.55);
        }
        .hero-location-bar span { color: rgba(255,255,255,0.85); font-weight: 500; }
        .hero-location-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: ${T.accentL};
          animation: pulse-dot 2.5s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.5; transform:scale(1.5); }
        }
        .hero-inner {
          max-width: 1320px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 100px; align-items: center;
        }
        .hero-title {
          font-family: ${T.fontSerif};
          font-size: clamp(48px, 5.5vw, 80px);
          line-height: 1.0; font-weight: 400; color: ${T.ink};
          letter-spacing: -0.03em; margin-bottom: 28px;
        }
        .hero-title em { font-style: italic; color: ${T.accent}; }
        .hero-sub {
          font-size: 16px; line-height: 1.75; color: ${T.mid};
          max-width: 480px; margin-bottom: 48px;
        }
        .hero-ctas { display: flex; align-items: center; gap: 20px; }
        .btn-primary {
          height: 50px; padding: 0 32px;
          border-radius: ${T.radius};
          border: 1px solid ${T.accent}; background: ${T.accent};
          color: white; font-size: 14px; font-weight: 500;
          cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
          transition: all 0.25s; font-family: ${T.fontSans};
        }
        .btn-primary:hover {
          background: ${T.accentM}; border-color: ${T.accentM};
          transform: translateY(-1px); box-shadow: ${T.shadowMd};
        }
        .btn-secondary {
          height: 50px; padding: 0 28px;
          border-radius: ${T.radius};
          border: 1px solid ${T.rule}; background: transparent;
          color: ${T.ink60}; font-size: 14px;
          cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
          transition: all 0.25s; font-family: ${T.fontSans};
        }
        .btn-secondary:hover { border-color: ${T.mid}; color: ${T.ink}; }

        /* HERO CARD */
        .hero-card {
          background: ${T.canvas};
          border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd};
          padding: 32px;
          box-shadow: ${T.shadowLg};
        }
        .hero-card-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 28px; padding-bottom: 20px;
          border-bottom: 1px solid ${T.rule};
        }
        .hero-card-label {
          font-size: 10px; font-weight: 500; letter-spacing: 0.14em;
          text-transform: uppercase; color: ${T.faint}; margin-bottom: 6px;
        }
        .hero-card-value {
          font-family: ${T.fontSerif}; font-size: 26px; color: ${T.ink}; letter-spacing: -0.02em;
        }
        .hero-card-amount { font-family: ${T.fontSerif}; font-size: 22px; color: ${T.accent}; text-align: right; }
        .hero-card-amount-label {
          font-size: 10px; font-weight: 500; letter-spacing: 0.12em;
          text-transform: uppercase; color: ${T.faint}; text-align: right; margin-bottom: 6px;
        }
        .contract-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 0; border-bottom: 1px solid ${T.rule};
        }
        .contract-row:last-child { border-bottom: none; }
        .contract-name { font-size: 13px; color: ${T.mid}; }
        .contract-badge {
          font-size: 10px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; padding: 3px 10px; border-radius: 2px;
        }
        .badge-active  { color: ${T.accent}; background: ${T.accentPale}; border: 1px solid rgba(31,77,43,.15); }
        .badge-pending { color: ${T.gold};   background: ${T.goldPale};   border: 1px solid rgba(154,123,79,.2); }

        .hero-float {
          position: absolute; bottom: -32px; right: -32px;
          background: ${T.ink}; border-radius: ${T.radiusMd};
          padding: 18px 22px; display: flex; align-items: center; gap: 14px;
          box-shadow: ${T.shadowLg};
          animation: float 4s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .hero-float-icon {
          width: 36px; height: 36px; border-radius: ${T.radius};
          background: rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
        }
        .hero-float-label {
          font-size: 10px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 3px;
        }
        .hero-float-value { font-size: 14px; font-weight: 500; color: white; }
        .hero-line { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: ${T.rule}; }

        /* STATS */
        .stats-wrap { border-top: 1px solid ${T.rule}; border-bottom: 1px solid ${T.rule}; }
        .stats-inner {
          max-width: 1320px; margin: 0 auto; padding: 56px 48px;
          display: grid; grid-template-columns: repeat(4,1fr);
        }
        .stat-item { padding: 0 40px; text-align: left; border-right: 1px solid ${T.rule}; }
        .stat-item:first-child { padding-left: 0; }
        .stat-item:last-child  { border-right: none; }
        .stat-n {
          font-family: ${T.fontSerif}; font-size: 44px;
          color: ${T.ink}; line-height: 1; letter-spacing: -0.03em;
        }
        .stat-label { font-size: 13px; color: ${T.muted}; margin-top: 8px; line-height: 1.4; }

        /* FADE UP */
        .fade-up { opacity: 0; transform: translateY(20px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .fade-up.visible { opacity: 1; transform: translateY(0); }

        /* SECTIONS */
        section { padding: 112px 48px; }
        .section-inner { max-width: 1320px; margin: 0 auto; }
        .section-header { margin-bottom: 72px; }
        .section-title {
          font-family: ${T.fontSerif};
          font-size: clamp(32px, 3.5vw, 52px); font-weight: 400; color: ${T.ink};
          line-height: 1.1; letter-spacing: -0.025em; margin-bottom: 16px;
        }
        .section-sub { font-size: 16px; color: ${T.mid}; line-height: 1.7; max-width: 520px; }

        /* MODELS */
        .models-grid {
          display: grid; grid-template-columns: repeat(2,1fr);
          gap: 1px; background: ${T.rule};
          border: 1px solid ${T.rule}; border-radius: ${T.radiusMd}; overflow: hidden;
        }
        .model-card { background: ${T.canvas}; padding: 44px 40px; transition: background 0.3s; }
        .model-card:hover { background: ${T.surface}; }
        .model-num { font-family: ${T.fontSerif}; font-size: 13px; color: ${T.faint}; margin-bottom: 32px; }
        .model-tag { font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: ${T.gold}; margin-bottom: 10px; }
        .model-name { font-family: ${T.fontSerif}; font-size: 24px; color: ${T.ink}; letter-spacing: -0.02em; margin-bottom: 16px; line-height: 1.2; }
        .model-desc { font-size: 14px; line-height: 1.75; color: ${T.mid}; }

        /* FEATURES */
        .features-bg { background: ${T.surface}; }
        .features-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 32px; }
        .feat-card {
          padding: 36px 28px; background: ${T.canvas};
          border: 1px solid ${T.rule}; border-radius: ${T.radiusMd}; transition: box-shadow 0.3s;
        }
        .feat-card:hover { box-shadow: ${T.shadowMd}; }
        .feat-num { font-family: ${T.fontSerif}; font-size: 11px; color: ${T.faint}; margin-bottom: 28px; }
        .feat-title { font-size: 15px; font-weight: 500; color: ${T.ink}; margin-bottom: 12px; }
        .feat-desc { font-size: 14px; line-height: 1.7; color: ${T.muted}; }

        /* ABOUT */
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .about-description { font-size: 16px; line-height: 1.8; color: ${T.mid}; margin-bottom: 40px; }
        .about-values { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }
        .about-value-item { border-left: 2px solid ${T.accent}; padding-left: 20px; }
        .about-value-title { font-size: 14px; font-weight: 600; color: ${T.ink}; margin-bottom: 8px; }
        .about-value-desc { font-size: 13px; color: ${T.muted}; line-height: 1.6; }
        .about-visual {
          background: ${T.surface};
          border-radius: ${T.radiusMd};
          aspect-ratio: 4/5;
          border: 1px solid ${T.rule};
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }

        /* VISION */
        .vision-section { background: ${T.ink}; color: white; padding: 120px 48px; text-align: center; }
        .vision-quote {
          font-family: ${T.fontSerif};
          font-size: clamp(32px, 4.5vw, 64px);
          line-height: 1.1; letter-spacing: -0.02em;
          max-width: 800px; margin: 0 auto 40px;
        }
        .vision-quote em { color: ${T.accentL}; font-style: italic; }
        .vision-author { font-size: 14px; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; text-transform: uppercase; }

        /* CULTURE */
        .culture-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 32px; margin-top: 60px; }
        .culture-card {
          padding: 40px 32px; border: 1px solid ${T.rule}; border-radius: ${T.radiusMd}; transition: all 0.3s;
        }
        .culture-card:hover { box-shadow: ${T.shadowMd}; border-color: ${T.accentPale}; }
        .culture-icon { font-size: 28px; color: ${T.accent}; margin-bottom: 24px; }
        .culture-title { font-family: ${T.fontSerif}; font-size: 20px; margin-bottom: 16px; color: ${T.ink}; }
        .culture-desc { font-size: 14px; color: ${T.muted}; line-height: 1.7; }

        /* FAQ */
        .faq-section { background: ${T.surface}; }
        .faq-grid { margin-top: 60px; max-width: 800px; }
        .faq-item { border-bottom: 1px solid ${T.rule}; padding: 24px 0; cursor: pointer; }
        .faq-question {
          font-size: 18px; font-weight: 500; color: ${T.ink};
          display: flex; justify-content: space-between; align-items: center;
          user-select: none; transition: color 0.2s;
        }
        .faq-question:hover { color: ${T.accent}; }
        .faq-answer { font-size: 15px; color: ${T.muted}; line-height: 1.7; margin-top: 12px; display: none; }
        .faq-answer.open { display: block; }

        /* COMMUNITY */
        .community-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start; margin-top: 60px; }
        .community-map-visual {
          background: ${T.surface}; border: 1px solid ${T.rule};
          border-radius: ${T.radiusMd}; aspect-ratio: 4/3;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .community-provinces { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-top: 32px; }
        .province-tag {
          padding: 10px 16px; border: 1px solid ${T.rule}; border-radius: ${T.radius};
          font-size: 13px; text-align: center; color: ${T.mid}; transition: all 0.2s;
        }
        .province-tag:hover { border-color: ${T.accent}; color: ${T.accent}; background: ${T.accentPale}; }

        /* TEAM */
        .team-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 28px; }
        .team-card { cursor: default; }
        .team-photo {
          aspect-ratio: 3/4; background: ${T.surface};
          border: 1px solid ${T.rule}; border-radius: ${T.radiusMd};
          overflow: hidden; display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px; transition: box-shadow 0.3s;
        }
        .team-card:hover .team-photo { box-shadow: ${T.shadowMd}; }
        .team-name { font-size: 15px; font-weight: 500; color: ${T.ink}; margin-bottom: 5px; }
        .team-role { font-size: 13px; color: ${T.muted}; line-height: 1.4; }

        /* CTA */
        .cta-section { background: ${T.canvas}; }
        .cta-inner { max-width: 1320px; margin: 0 auto; padding: 0 48px; }
        .cta-box {
          background: ${T.ink}; border-radius: ${T.radiusMd};
          padding: 96px 80px;
          display: grid; grid-template-columns: 1fr auto; gap: 80px; align-items: center;
          position: relative; overflow: hidden;
        }
        .cta-box::before {
          content: ''; position: absolute; right: -80px; top: -80px;
          width: 320px; height: 320px; border-radius: 50%;
          background: rgba(255,255,255,0.02); pointer-events: none;
        }
        .cta-eyebrow {
          font-size: 11px; font-weight: 500; letter-spacing: 0.18em;
          text-transform: uppercase; color: ${T.accentL}; margin-bottom: 20px;
          display: flex; align-items: center; gap: 10px;
        }
        .cta-eyebrow::before { content: ''; display: block; width: 20px; height: 1px; background: ${T.accentL}; }
        .cta-title { font-family: ${T.fontSerif}; font-size: clamp(28px,3vw,44px); color: white; line-height: 1.1; letter-spacing: -0.025em; margin-bottom: 16px; }
        .cta-sub { font-size: 15px; color: rgba(255,255,255,0.5); line-height: 1.7; max-width: 420px; }
        .btn-cta {
          height: 52px; padding: 0 36px;
          border-radius: ${T.radius}; border: 1px solid white; background: white;
          color: ${T.ink}; font-size: 14px; font-weight: 500;
          cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
          white-space: nowrap; transition: all 0.25s; font-family: ${T.fontSans};
          position: relative; flex-shrink: 0;
        }
        .btn-cta:hover { background: transparent; color: white; transform: translateY(-2px); }

        /* FOOTER */
        .footer-section { background: ${T.ink80}; padding: 80px 48px 40px; }
        .footer-grid {
          max-width: 1320px; margin: 0 auto;
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 60px; margin-bottom: 60px;
        }
        .footer-brand { font-family: ${T.fontSerif}; font-size: 18px; color: rgba(255,255,255,0.85); margin-bottom: 8px; }
        .footer-brand em { color: ${T.accentL}; font-style: normal; }
        .footer-brand-col p { color: rgba(255,255,255,0.4); font-size: 13px; line-height: 1.7; margin-top: 16px; max-width: 300px; }
        .footer-col-title { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 24px; }
        .footer-link { display: block; color: rgba(255,255,255,0.35); text-decoration: none; font-size: 13px; margin-bottom: 12px; transition: color 0.2s; cursor: pointer; }
        .footer-link:hover { color: rgba(255,255,255,0.8); }
        .footer-bottom {
          max-width: 1320px; margin: 0 auto;
          padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .footer-copyright { color: rgba(255,255,255,0.25); font-size: 12px; }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .features-grid { grid-template-columns: repeat(2,1fr); }
          .team-grid      { grid-template-columns: repeat(2,1fr); }
          .culture-grid   { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 900px) {
          .hero-inner      { grid-template-columns: 1fr; gap: 64px; }
          .hero-visual     { display: none; }
          .stats-inner     { grid-template-columns: repeat(2,1fr); }
          .stat-item       { border-right: none; border-bottom: 1px solid ${T.rule}; padding: 28px 0; }
          .nav-links       { display: none; }
          .models-grid     { grid-template-columns: 1fr; }
          .features-grid   { grid-template-columns: 1fr; }
          .cta-box         { grid-template-columns: 1fr; padding: 56px 36px; gap: 36px; }
          .hero            { padding: 120px 24px 80px; }
          section          { padding: 72px 24px; }
          .about-grid      { grid-template-columns: 1fr; }
          .community-grid  { grid-template-columns: 1fr; }
          .footer-grid     { grid-template-columns: 1fr 1fr; }
          .culture-grid    { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .team-grid     { grid-template-columns: 1fr; }
          .nav-inner     { padding: 0 24px; }
          .footer-bottom { flex-direction: column; gap: 16px; }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav className={`nav ${scrolled ? 'solid' : ''}`}>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <div className="nav-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2C5 2 3 5 3 8s2 5 5 5c1.5 0 3-.5 4-1.5L8 8V2z" fill="white" opacity=".9"/>
                <path d="M8 2v6l4 3.5C13.2 10.3 13 9.2 13 8c0-3-2-6-5-6z" fill="white" opacity=".5"/>
              </svg>
            </div>
            <span className="nav-wordmark">Agri<em>Link</em></span>
          </a>

          <div className="nav-links">
            <a href="#about"     className="nav-link">Sobre Nós</a>
            <a href="#models"    className="nav-link">{t.nav.models}</a>
            <a href="#team"      className="nav-link">{t.nav.team}</a>
            <a href="#faq"       className="nav-link">FAQ</a>
            <a href="#community" className="nav-link">Comunidades</a>
            <a href="#contact"   className="nav-link">{t.nav.contact}</a>
          </div>

          <div className="nav-right">
            {['pt','fr','en'].map(l => (
              <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
            <button className="btn-login" onClick={() => navigate('/login')}>{t.nav.login}</button>
            <button className="btn-reg"   onClick={() => navigate('/cadastro')}>{t.nav.register}</button>
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

          <div className="hero-visual" style={{ position: 'relative' }}>
            <div className="hero-card">
              <div className="hero-card-header">
                <div>
                  <div className="hero-card-label">Contrato Ativo</div>
                  <div className="hero-card-value">Tomate · 40 ton.</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="hero-card-amount-label">Valor Total</div>
                  <div className="hero-card-amount">AOA 2.4M</div>
                </div>
              </div>
              {[
                { name: 'Soja · 120 ton.',    status: 'Ativo',    cls: 'badge-active' },
                { name: 'Milho · 80 ton.',    status: 'Pendente', cls: 'badge-pending' },
                { name: 'Feijão · 60 ton.',   status: 'Ativo',    cls: 'badge-active' },
                { name: 'Mandioca · 30 ton.', status: 'Pendente', cls: 'badge-pending' },
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
            <div className="eyebrow">{t.about.eyebrow}</div>
            <h2 className="section-title">{t.about.title}</h2>
            <p className="section-sub">{t.about.sub}</p>
          </div>
          <div className="about-grid">
            <div>
              <p className="about-description">{t.about.desc}</p>
              <div className="about-values">
                {t.about.values.map((v, i) => (
                  <div key={i} className="about-value-item">
                    <div className="about-value-title">{v.t}</div>
                    <div className="about-value-desc">{v.d}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="about-visual">
              {/* Ilustração SVG Angola */}
              <svg width="260" height="300" viewBox="0 0 260 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="30" y="40" width="200" height="220" rx="8" fill="#EDF2EE" stroke="#E8E8E8"/>
                <circle cx="130" cy="150" r="60" fill="#1F4D2B" opacity=".08"/>
                <circle cx="130" cy="150" r="40" fill="#1F4D2B" opacity=".12"/>
                <circle cx="130" cy="150" r="20" fill="#1F4D2B" opacity=".25"/>
                <circle cx="130" cy="150" r="6" fill="#1F4D2B"/>
                {/* Linhas de conexão */}
                {[[80,90],[180,90],[60,180],[200,180],[130,220]].map(([x,y],i) => (
                  <g key={i}>
                    <line x1="130" y1="150" x2={x} y2={y} stroke="#1F4D2B" strokeWidth="1" strokeOpacity=".3" strokeDasharray="4 3"/>
                    <circle cx={x} cy={y} r="5" fill="#4A8F5A" opacity=".7"/>
                  </g>
                ))}
                <text x="130" y="270" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#888" letterSpacing="2">ANGOLA · SADC</text>
              </svg>
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
            {[
              { icon: '◎', title: 'Trabalho Remoto',    desc: 'Nossa equipa trabalha de qualquer lugar, desde que os resultados sejam entregues com excelência e dentro dos prazos.' },
              { icon: '◈', title: 'Foco em Resultados', desc: 'Medimos performance por resultados concretos, não por horas trabalhadas. Autonomia com responsabilidade.' },
              { icon: '◇', title: 'Colaboração',        desc: 'Times multidisciplinares trabalhando juntos para transformar o agronegócio africano com tecnologia.' },
            ].map((c, i) => (
              <div key={i} className="culture-card">
                <div className="culture-icon" style={{ fontFamily: 'monospace', fontSize: '24px' }}>{c.icon}</div>
                <div className="culture-title">{c.title}</div>
                <div className="culture-desc">{c.desc}</div>
              </div>
            ))}
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
            {t.faq.map((item, i) => (
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
            <div className="eyebrow">{t.community.eyebrow}</div>
            <h2 className="section-title">{t.community.title}</h2>
            <p className="section-sub">{t.community.sub}</p>
          </div>
          <div className="community-grid">
            <div className="community-map-visual">
              {/* SVG mapa estilizado das províncias */}
              <svg width="320" height="240" viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="320" height="240" fill="#F5F4F0"/>
                {/* Pontos representando províncias */}
                {[
                  [160,80,'Luanda'],[100,120,'Uíge'],[80,160,'Cuanza Norte'],
                  [140,140,'Malanje'],[200,100,'Zaire'],[220,150,'Lunda Sul'],
                  [120,180,'Cuanza Sul'],[160,200,'Bié'],[200,200,'Moxico'],
                  [100,210,'Huambo'],[80,230,'Huíla'],[240,80,'Cabinda'],
                  [260,200,'Cuando'],[140,230,'Benguela'],[200,230,'Namibe'],
                ].map(([x,y,name],i) => (
                  <g key={i}>
                    <circle cx={x} cy={y} r={i < 6 ? 8 : 5} fill="#1F4D2B" opacity={i < 6 ? .7 : .35}/>
                    <circle cx={x} cy={y} r={i < 6 ? 4 : 2.5} fill="#4A8F5A"/>
                  </g>
                ))}
                {/* Linhas de conexão */}
                <line x1="160" y1="80" x2="100" y2="120" stroke="#1F4D2B" strokeWidth=".8" strokeOpacity=".2"/>
                <line x1="160" y1="80" x2="140" y2="140" stroke="#1F4D2B" strokeWidth=".8" strokeOpacity=".2"/>
                <line x1="160" y1="80" x2="200" y2="100" stroke="#1F4D2B" strokeWidth=".8" strokeOpacity=".2"/>
                <line x1="140" y1="140" x2="120" y2="180" stroke="#1F4D2B" strokeWidth=".8" strokeOpacity=".2"/>
                <line x1="140" y1="140" x2="160" y2="200" stroke="#1F4D2B" strokeWidth=".8" strokeOpacity=".2"/>
                <text x="160" y="24" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="10" fill="#888" letterSpacing="2">21 PROVÍNCIAS</text>
              </svg>
            </div>
            <div>
              <h3 style={{ fontFamily: T.fontSerif, fontSize: '24px', marginBottom: '16px', color: T.ink }}>
                Encontros Mensais
              </h3>
              <p style={{ color: T.muted, lineHeight: 1.7, marginBottom: '32px' }}>
                {t.community.desc}
              </p>
              <div className="community-provinces">
                {t.community.provinces.map(p => (
                  <div key={p} className="province-tag">{p}</div>
                ))}
                <div className="province-tag" style={{ background: T.accent, color: 'white', border: 'none' }}>
                  +9 Províncias
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TEAM ═══ */}
      <section id="team" ref={teamRef} style={{ background: T.surface }}>
        <div className="section-inner">
          <div className={`section-header fade-up ${teamVis ? 'visible' : ''}`}>
            <div className="eyebrow">{t.team.eyebrow}</div>
            <h2 className="section-title">{t.team.title}</h2>
            <p className="section-sub">{t.team.sub}</p>
          </div>
          <div className="team-grid">
            {t.team.list.map((m, i) => (
              <div key={i} className={`team-card fade-up ${teamVis ? 'visible' : ''}`} style={{ transitionDelay: `${200 + i * 80}ms` }}>
                <div className="team-photo">
                  <Avatar name={m.name} />
                </div>
                <div className="team-name">{m.name}</div>
                <div className="team-role">{m.role}</div>
              </div>
            ))}
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
            {['Modelos de Negócio','Sobre Nós','Equipa','Perguntas Frequentes','Comunidades'].map((l,i) => (
              <a key={i} href={['#models','#about','#team','#faq','#community'][i]} className="footer-link">{l}</a>
            ))}
          </div>
          <div>
            <div className="footer-col-title">Links Úteis</div>
            {['Agentes de Campo','Fábricas','Agricultores','Missão','Visão','Tecnologias'].map((l,i) => (
              <a key={i} href="#" className="footer-link">{l}</a>
            ))}
          </div>
          <div>
            <div className="footer-col-title">Presença</div>
            {['Angola','RDC','África do Sul','Namíbia'].map((l,i) => (
              <a key={i} href="#" className="footer-link">{l}</a>
            ))}
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

export default Index;