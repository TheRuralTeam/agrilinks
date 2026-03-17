import { Package, Zap, Building2 } from "lucide-react";

const sectors = [
  {
    icon: Package,
    title: "Alimentos & Bebidas",
    desc: "Garantia de fornecimento contínuo, redução de rupturas e maior estabilidade de preços para produtos de consumo diário.",
  },
  {
    icon: Zap,
    title: "Higiene & Limpeza",
    desc: "Distribuição eficiente de produtos essenciais, com logística otimizada e maior previsibilidade de estoque.",
  },
  {
    icon: Building2,
    title: "Materiais de Construção",
    desc: "Organização da cadeia de distribuição para apoiar o crescimento urbano e o desenvolvimento económico.",
  },
];

const SectorsSection = () => {
  return (
    <section className="py-16 lg:py-24 bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-primary-foreground mb-3">
            Sectores Estratégicos
          </h2>
          <p className="text-primary-foreground/60 max-w-2xl mx-auto">
            Atuamos nos setores mais críticos da economia
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {sectors.map((item, i) => (
            <div
              key={i}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 text-center hover:bg-white/15 transition-all duration-300"
            >
              <div className="p-4 bg-accent rounded-2xl w-fit mx-auto mb-4">
                <item.icon className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SectorsSection;
