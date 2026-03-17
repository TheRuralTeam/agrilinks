import { Building2, ShoppingCart, Package, Truck } from "lucide-react";

const audiences = [
  { icon: Building2, title: "Fabricantes", desc: "Que querem vender em escala com previsibilidade" },
  { icon: ShoppingCart, title: "Supermercados & Grossistas", desc: "Que precisam de fornecimento confiável" },
  { icon: Package, title: "Revendedores", desc: "Que buscam melhores preços e prazos" },
  { icon: Truck, title: "Parceiros Logísticos", desc: "Que desejam operar de forma estruturada" },
];

const TargetAudience = () => {
  return (
    <section className="py-16 lg:py-24 bg-business">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3">
            OrbisLink é para quem
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {audiences.map((item, i) => (
            <div
              key={i}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 text-center group hover:bg-white/15 transition-all duration-300"
            >
              <div className="p-4 bg-accent rounded-2xl w-fit mx-auto mb-4 group-hover:scale-110 transition-transform">
                <item.icon className="h-7 w-7 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-white/60 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TargetAudience;
