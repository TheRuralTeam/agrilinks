import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VisionSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 lg:py-24 bg-accent">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-accent-foreground mb-5">
          Nossa Visão
        </h2>
        <p className="text-lg sm:text-xl font-medium text-accent-foreground/80 mb-8 leading-relaxed">
          Ser a plataforma que organiza e conecta os sectores essenciais da economia, criando um mercado mais eficiente, transparente e sustentável.
        </p>
        <div className="inline-block bg-foreground/10 rounded-2xl px-8 py-4 mb-8">
          <p className="text-lg font-black text-accent-foreground">
            Conectando mercados. Movendo economias.
          </p>
        </div>
        <div>
          <Button
            size="lg"
            className="h-12 px-8 text-base font-bold rounded-xl bg-business text-white hover:bg-business-light"
            onClick={() => navigate("/login")}
          >
            Entrar na Plataforma
            <ArrowRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default VisionSection;
