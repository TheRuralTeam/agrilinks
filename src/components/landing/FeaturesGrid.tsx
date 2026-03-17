import { Link2, ShoppingCart, Truck, TrendingUp, BarChart3, Eye } from "lucide-react";

const features = [
  { icon: Link2, title: "Conecta Diretamente", desc: "Fabricantes a supermercados, grossistas e revendedores" },
  { icon: ShoppingCart, title: "Centraliza Pedidos", desc: "B2B em um único ambiente digital" },
  { icon: Truck, title: "Organiza Entregas", desc: "Logística integrada com parceiros certificados" },
  { icon: TrendingUp, title: "Reduz Custos", desc: "Operacionais e riscos de fornecimento" },
  { icon: BarChart3, title: "Gera Dados", desc: "Estratégicos de consumo e demanda" },
  { icon: Eye, title: "Transparência Total", desc: "Preços, prazos e volumes visíveis" },
];

const FeaturesGrid = () => {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground mb-3">
            O que a OrbisLink faz
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para organizar cadeias de fornecimento em escala
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((item, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-6 border border-border hover:border-accent/50 hover:shadow-medium transition-all duration-300 group"
            >
              <div className="p-3 bg-accent/10 rounded-xl w-fit mb-4 group-hover:bg-accent/20 transition-colors">
                <item.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
