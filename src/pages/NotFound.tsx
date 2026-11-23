import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { R, T } from "../lib/brand";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: T.canvas, color: T.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <section style={{ width: 'min(100%, 520px)', padding: 32, border: 'none', borderRadius: R.md, background: T.white, textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, color: T.g600, fontSize: 13, fontWeight: 800, letterSpacing: '0.12em' }}>AGRILINK</p>
        <h1 style={{ margin: '14px 0 8px', fontSize: 48, fontWeight: 800, lineHeight: 1 }}>404</h1>
        <p style={{ margin: '0 0 24px', color: T.muted, fontSize: 15 }}>Esta página não foi encontrada.</p>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 18px', border: 'none', borderRadius: R.md, background: 'rgba(44,134,59,0.10)', color: T.g700, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
          <Home size={16} /> Voltar à página inicial
        </Link>
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={() => window.history.back()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 8, border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
            <ArrowLeft size={15} /> Voltar à página anterior
          </button>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
