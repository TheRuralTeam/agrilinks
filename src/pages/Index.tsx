import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, FileCheck2, Globe2, Menu, ShieldCheck, Sprout, Users, X } from "lucide-react";
import orbisLinkLogo from "../assets/orbislink-logo.png";
import ttgiLogo from "../assets/ttgi.jpg";
import fotoFeliciano from "../assets/FELICIANO.jpeg";
import fotoMoises from "../assets/MOISES.jpeg";
import fotoLizeth from "../assets/LIZETH.jpeg";
import fotoClaudio from "../assets/CLAUDIO.jpeg";
import heroImage from "../assets/agrilink-community-conference.jpg";

const team = [
  { name: "Feliciano Cassoma", role: "Diretor-geral e fundador", image: fotoFeliciano },
  { name: "Moises Lucamba", role: "Diretor financeiro e fundador", image: fotoMoises },
  { name: "Claudio Henriques", role: "Diretor operacional e fundador", image: fotoClaudio },
  { name: "Lizeth Caieie", role: "Gestora da Comunidade AgriLink", image: fotoLizeth },
];

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
    description: "Conecte produtores, empresas, fábricas e compradores institucionais.",
  },
];

const steps = [
  "Registe a sua necessidade ou oferta.",
  "Encontre o parceiro certo para a operação.",
  "Formalize o acordo e acompanhe a entrega.",
];

export default function AgriLinkLanding() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const goToRegister = () => navigate("/cadastro");

  return (
    <main className="agrilink-page">
      <style>{`
        :root {
          --ink: #10231a;
          --muted: #637168;
          --line: #dfe8df;
          --soft: #f4f8f2;
          --green: #317a48;
          --green-dark: #205d36;
          --lime: #b7d96b;
          --white: #ffffff;
          --serif: Georgia, 'Times New Roman', serif;
          --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; font-family: var(--sans); color: var(--ink); background: var(--white); }
        button, a { font: inherit; }
        button { cursor: pointer; }
        a { color: inherit; text-decoration: none; }

        .agrilink-page { overflow: hidden; }
        .container { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }

        .nav {
          position: absolute; z-index: 20; inset: 0 0 auto;
          border-bottom: 1px solid rgba(255,255,255,.16);
          color: white;
        }
        .nav-inner { height: 78px; display: flex; align-items: center; justify-content: space-between; gap: 28px; }
        .brand img { width: 142px; display: block; filter: brightness(0) invert(1); }
        .nav-links { display: flex; align-items: center; gap: 28px; font-size: 13px; color: rgba(255,255,255,.78); }
        .nav-links a:hover { color: white; }
        .nav-actions { display: flex; align-items: center; gap: 10px; }
        .lang { border: 0; background: transparent; color: rgba(255,255,255,.7); font-size: 12px; }
        .login { color: white; border: 1px solid rgba(255,255,255,.35); background: transparent; border-radius: 999px; padding: 10px 17px; font-size: 13px; }
        .register { color: var(--ink); border: 0; background: var(--lime); border-radius: 999px; padding: 11px 18px; font-weight: 700; font-size: 13px; }
        .menu-button { display: none; border: 0; background: transparent; color: white; }

        .hero { min-height: 720px; position: relative; display: flex; align-items: center; color: white; background: linear-gradient(90deg, rgba(8,30,19,.92) 0%, rgba(8,30,19,.72) 44%, rgba(8,30,19,.18) 100%), url(${heroImage}) center/cover; }
        .hero::after { content: ''; position: absolute; inset: auto 0 0; height: 150px; background: linear-gradient(transparent, rgba(8,30,19,.42)); pointer-events: none; }
        .hero-content { position: relative; z-index: 1; padding: 130px 0 90px; max-width: 720px; }
        .eyebrow { display: inline-flex; align-items: center; gap: 9px; color: var(--lime); text-transform: uppercase; letter-spacing: .16em; font-size: 11px; font-weight: 800; }
        .eyebrow::before { content: ''; width: 28px; height: 2px; background: var(--lime); }
        .hero h1 { margin: 22px 0 22px; max-width: 720px; font: 500 clamp(48px, 7vw, 86px)/.97 var(--serif); letter-spacing: -.055em; }
        .hero h1 em { color: var(--lime); font-style: italic; }
        .hero-copy { max-width: 555px; color: rgba(255,255,255,.76); font-size: 17px; line-height: 1.75; }
        .hero-actions { margin-top: 34px; display: flex; flex-wrap: wrap; gap: 12px; }
        .button-primary, .button-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; padding: 15px 22px; font-size: 14px; font-weight: 750; transition: transform .18s ease, background .18s ease; }
        .button-primary { border: 0; background: var(--lime); color: var(--ink); }
        .button-ghost { border: 1px solid rgba(255,255,255,.35); color: white; background: rgba(255,255,255,.04); }
        .button-primary:hover, .button-ghost:hover { transform: translateY(-2px); }
        .button-ghost:hover { background: rgba(255,255,255,.12); }

        .intro { padding: 120px 0 105px; }
        .intro-grid { display: grid; grid-template-columns: .82fr 1.18fr; gap: 90px; align-items: start; }
        .section-title { margin: 16px 0 18px; font: 500 clamp(34px, 4.5vw, 58px)/1.02 var(--serif); letter-spacing: -.045em; }
        .section-copy { color: var(--muted); font-size: 16px; line-height: 1.8; max-width: 520px; }
        .feature-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .feature { border-top: 1px solid var(--line); padding-top: 21px; }
        .feature-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: #eaf4e6; color: var(--green); margin-bottom: 28px; }
        .feature h3 { margin: 0 0 10px; font-size: 16px; }
        .feature p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.65; }

        .product { background: var(--soft); padding: 120px 0; }
        .product-head { display: flex; justify-content: space-between; align-items: end; gap: 40px; margin-bottom: 52px; }
        .product-head .section-copy { max-width: 390px; }
        .product-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 22px; }
        .product-card { background: white; border: 1px solid var(--line); border-radius: 24px; padding: 35px; }
        .product-card.dark { background: var(--ink); color: white; border: 0; min-height: 390px; display: flex; flex-direction: column; justify-content: space-between; }
        .product-card h3 { margin: 0 0 16px; font: 500 32px/1.1 var(--serif); }
        .product-card p { color: var(--muted); line-height: 1.7; font-size: 15px; }
        .product-card.dark p { color: rgba(255,255,255,.65); }
        .product-mark { display: flex; justify-content: space-between; align-items: center; margin-bottom: 65px; }
        .product-mark span { display: inline-flex; align-items: center; gap: 8px; color: var(--lime); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
        .product-mark svg { color: var(--lime); }
        .check-list { display: grid; gap: 17px; margin: 30px 0 0; padding: 0; list-style: none; }
        .check-list li { display: flex; gap: 11px; align-items: start; color: #44534a; font-size: 14px; }
        .check-list svg { flex: 0 0 auto; margin-top: 2px; color: var(--green); }
        .steps { display: grid; gap: 18px; }
        .step { display: flex; gap: 18px; align-items: start; border-top: 1px solid var(--line); padding-top: 18px; }
        .step-number { color: var(--green); font: 500 27px var(--serif); }
        .step p { margin: 3px 0 0; color: var(--muted); line-height: 1.55; font-size: 14px; }

        .team { padding: 120px 0; }
        .team-head { max-width: 550px; margin-bottom: 50px; }
        .team-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .team-card { border-top: 1px solid var(--line); padding-top: 14px; }
        .team-card img { width: 100%; aspect-ratio: 1 / 1.12; object-fit: cover; border-radius: 18px; filter: saturate(.82); display: block; margin-bottom: 17px; }
        .team-name { font-size: 16px; font-weight: 800; }
        .team-role { margin-top: 5px; color: var(--muted); font-size: 13px; }

        .cta { padding: 30px 0 100px; }
        .cta-box { position: relative; overflow: hidden; border-radius: 25px; padding: 68px; background: var(--green); color: white; display: flex; align-items: end; justify-content: space-between; gap: 40px; }
        .cta-box::after { content: ''; position: absolute; width: 350px; height: 350px; right: -110px; top: -170px; border-radius: 50%; border: 1px solid rgba(255,255,255,.18); box-shadow: 0 0 0 38px rgba(255,255,255,.04), 0 0 0 78px rgba(255,255,255,.04); }
        .cta-box > * { position: relative; z-index: 1; }
        .cta-box h2 { margin: 17px 0 15px; max-width: 630px; font: 500 clamp(35px, 5vw, 61px)/1 var(--serif); letter-spacing: -.045em; }
        .cta-box p { margin: 0; max-width: 500px; color: rgba(255,255,255,.75); line-height: 1.7; }
        .cta-box .button-primary { background: white; white-space: nowrap; }

        footer { background: var(--ink); color: white; padding: 42px 0 28px; }
        .footer-inner { display: grid; grid-template-columns: 1.1fr 1fr 1fr; align-items: start; gap: 36px; }
        .footer-brand img { width: 124px; filter: brightness(0) invert(1); }
        .footer-copy { color: rgba(255,255,255,.5); font-size: 12px; line-height: 1.6; }
        .footer-company { margin-top: 16px; color: rgba(255,255,255,.68); font-size: 12px; line-height: 1.7; }
        .footer-company strong { display: block; color: white; font-size: 13px; margin-bottom: 4px; }
        .footer-contact { color: rgba(255,255,255,.65); font-size: 12px; line-height: 1.9; }
        .footer-contact a { color: var(--lime); }
        .footer-ttgi { display: flex; align-items: center; justify-content: flex-end; gap: 12px; color: rgba(255,255,255,.5); font-size: 11px; text-align: right; }
        .footer-ttgi img { width: 86px; max-height: 52px; object-fit: contain; border-radius: 8px; background: white; padding: 5px; }
        @media (max-width: 900px) { .footer-inner { grid-template-columns: 1fr; gap: 22px; } .footer-ttgi { justify-content: flex-start; text-align: left; } }

        @media (max-width: 900px) {
          .nav-links, .nav-actions { display: none; }
          .menu-button { display: block; }
          .nav.mobile-open { background: var(--ink); }
          .nav.mobile-open .nav-links, .nav.mobile-open .nav-actions { display: flex; }
          .nav.mobile-open .nav-inner { height: auto; padding: 20px 0; align-items: flex-start; flex-wrap: wrap; }
          .nav.mobile-open .nav-links { order: 3; width: 100%; flex-direction: column; align-items: flex-start; padding: 20px 0 5px; }
          .nav.mobile-open .nav-actions { order: 4; width: 100%; justify-content: flex-start; }
          .intro-grid, .product-grid { grid-template-columns: 1fr; gap: 48px; }
          .product-head { display: block; }
          .team-grid { grid-template-columns: repeat(2, 1fr); }
          .cta-box { padding: 48px 35px; display: block; }
          .cta-box .button-primary { margin-top: 30px; }
        }
        @media (max-width: 580px) {
          .container { width: min(100% - 32px, 1160px); }
          .hero { min-height: 650px; }
          .hero-content { padding-top: 135px; }
          .hero h1 { font-size: 52px; }
          .feature-list, .team-grid { grid-template-columns: 1fr; }
          .intro, .product, .team { padding: 78px 0; }
          .product-card { padding: 26px; }
          .footer-inner { align-items: flex-start; flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
        }
      `}</style>

      <nav className={`nav ${menuOpen ? "mobile-open" : ""}`}>
        <div className="container nav-inner">
          <a className="brand" href="#top" aria-label="AgriLink">
            <img src={orbisLinkLogo} alt="AgriLink" />
          </a>
          <div className="nav-links">
            <a href="#produto">Produto</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#equipa">Equipa</a>
          </div>
          <div className="nav-actions">
            <button className="lang">PT</button>
            <button className="login" onClick={() => navigate("/login")}>Entrar</button>
            <button className="register" onClick={goToRegister}>Começar</button>
          </div>
          <button className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu">
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="container hero-content">
          <div className="eyebrow">Mercado agroalimentar B2B</div>
          <h1>A cadeia alimentar de Angola, <em>mais simples.</em></h1>
          <p className="hero-copy">A AgriLink conecta produtores, empresas e compradores institucionais através de uma plataforma digital para negociar, contratar e acompanhar operações agroalimentares.</p>
          <div className="hero-actions">
            <button className="button-primary" onClick={goToRegister}>Aceder à plataforma <ArrowRight size={16} /></button>
            <a className="button-ghost" href="#produto">Conhecer o produto</a>
          </div>
        </div>
      </section>

      <section className="intro" id="produto">
        <div className="container intro-grid">
          <div>
            <div className="eyebrow">Uma plataforma para o mercado real</div>
            <h2 className="section-title">Menos incerteza. Mais negócio.</h2>
            <p className="section-copy">A AgriLink transforma relações dispersas em operações claras: aproxima quem produz de quem compra e dá estrutura a cada etapa da cadeia.</p>
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

      <section className="product" id="como-funciona">
        <div className="container">
          <div className="product-head">
            <div>
              <div className="eyebrow">O produto</div>
              <h2 className="section-title">Da oportunidade ao acordo.</h2>
            </div>
            <p className="section-copy">Tudo o que precisa para criar relações comerciais mais rápidas, transparentes e preparadas para crescer.</p>
          </div>
          <div className="product-grid">
            <article className="product-card dark">
              <div>
                <div className="product-mark"><span><Sprout size={16} /> AgriLink Platform</span><Users size={22} /></div>
                <h3>Um novo ponto de encontro para o agronegócio.</h3>
                <p>Uma experiência B2B feita para aproximar oferta e procura, com confiança desde o primeiro contacto até à entrega.</p>
              </div>
              <button className="button-primary" onClick={goToRegister}>Começar agora <ArrowRight size={16} /></button>
            </article>
            <article className="product-card">
              <h3>Como funciona</h3>
              <ul className="check-list">
                {steps.map((step, index) => (
                  <li key={step}><Check size={17} /><span><strong>0{index + 1}</strong> — {step}</span></li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="team" id="equipa">
        <div className="container">
          <div className="team-head">
            <div className="eyebrow">Quem está a construir</div>
            <h2 className="section-title">Uma equipa próxima do terreno.</h2>
            <p className="section-copy">Tecnologia só cria impacto quando entende as pessoas que a utilizam. É por isso que a nossa equipa combina produto, operações, comunidade e visão estratégica.</p>
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
              <div className="eyebrow">Próximo passo</div>
              <h2>Faça parte da próxima fase do agronegócio.</h2>
              <p>Se produz, compra ou transforma produtos agroalimentares, a AgriLink foi criada para si.</p>
            </div>
            <button className="button-primary" onClick={goToRegister}>Criar conta <ArrowRight size={16} /></button>
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

