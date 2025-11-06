import { Button } from "./ui/button";
import { ArrowRight, TrendingUp, Shield, Clock } from "lucide-react";
import heroImage from "@/assets/hero-agriculture.jpg";

const Hero = () => {
  return (
    <section className="relative bg-gradient-hero overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-business/80"></div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            {/* Main Heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Conectamos{" "}
              <span className="text-accent">Produtores</span> a{" "}
              <span className="text-accent">Grandes Compradores</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Plataforma B2B para pedidos em grande escala de produtos alimentares.
              Mínimo de 50.000 de Kz, entrega programada.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">50.000+ Kz</div>
                <div className="text-white/80 text-sm">Pedido Mínimo</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">2 Semanas</div>
                <div className="text-white/80 text-sm">Prazo Máximo</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">24/7</div>
                <div className="text-white/80 text-sm">Suporte</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="accent" size="lg" className="text-lg px-8 py-4">
                Ver Catálogo
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-primary">
                Como Funciona
              </Button>
            </div>
          </div>

          {/* Features Cards */}
          <div className="grid gap-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-strong">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent rounded-lg">
                  <TrendingUp className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Preços Competitivos</h3>
                  <p className="text-white/80">Negociação direta com produtores</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-strong">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent rounded-lg">
                  <Shield className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Qualidade Garantida</h3>
                  <p className="text-white/80">Produtos certificados e inspecionados</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-strong">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent rounded-lg">
                  <Clock className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Entrega Programada</h3>
                  <p className="text-white/80">Agendamento com até 5 dias</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;