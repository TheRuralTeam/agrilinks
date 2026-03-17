import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supplyChainHero from "@/assets/supply-chain-hero.jpg";

const HeroBanner = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-business min-h-[520px] lg:min-h-[600px]">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={supplyChainHero}
          alt="Supply Chain"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-business via-business/95 to-business/60" />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 rounded-full px-4 py-1.5 mb-6 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
            <span className="text-sm font-bold text-accent">Plataforma B2B de Integração</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white mb-5 leading-[1.1] animate-slide-up">
            Conectando{" "}
            <span className="text-accent">produção</span>,{" "}
            <span className="text-accent">logística</span> e{" "}
            <span className="text-accent">mercados</span>{" "}
            em escala
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-white/70 mb-8 leading-relaxed max-w-2xl animate-slide-up stagger-1">
            A OrbisLink conecta fabricantes, distribuidores e grandes compradores em um único ecossistema digital,
            permitindo entregas diretas da fábrica para supermercados, grossistas e revendedores.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-10 animate-slide-up stagger-2">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-bold rounded-xl bg-accent text-accent-foreground hover:bg-accent-light shadow-strong"
              onClick={() => navigate("/login")}
            >
              Começar Agora
              <ArrowRight className="h-5 w-5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base font-bold rounded-xl border-white/20 text-white hover:bg-white/10 hover:border-white/40"
            >
              <Play className="h-4 w-4 mr-1" />
              Como Funciona
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-6 sm:gap-10 animate-slide-up stagger-3">
            {[
              { value: "100+", label: "Parceiros Ativos" },
              { value: "Nacional", label: "Cobertura" },
              { value: "24/7", label: "Operação Contínua" },
            ].map((stat, i) => (
              <div key={i} className="text-left">
                <div className="text-2xl sm:text-3xl font-black text-accent">{stat.value}</div>
                <div className="text-sm text-white/50 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
