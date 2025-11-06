import { Search, ShoppingCart, Calendar, Truck } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: Search,
      title: "1. Consulte o Catálogo",
      description: "Navegue pelos nossos produtos alimentares disponíveis com preços e quantidades mínimas.",
      color: "text-primary"
    },
    {
      icon: ShoppingCart,
      title: "2. Faça seu Pedido",
      description: "Selecione produtos, quantidades e valor mínimo de 1 milhão de Kz.",
      color: "text-business"
    },
    {
      icon: Calendar,
      title: "3. Agende a Entrega",
      description: "Escolha a data de entrega com até 2 semanas de antecedência.",
      color: "text-accent"
    },
    {
      icon: Truck,
      title: "4. Receba os Produtos",
      description: "Produtos entregues na data agendada com qualidade garantida.",
      color: "text-success"
    }
  ];

  return (
    <section id="como-funciona" className="py-16 lg:py-24 bg-background-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Como Funciona Nossa Plataforma
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Um processo simples e eficiente para conectar você aos melhores produtores
            com pedidos de grande escala e entrega programada.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-xl p-6 shadow-soft border border-card-border hover:shadow-medium transition-all duration-300 text-center group"
              >
                <div className={`inline-flex p-4 rounded-xl bg-gradient-card mb-6 ${step.color} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Important Note */}
        <div className="mt-16 bg-gradient-card rounded-xl p-8 border border-card-border shadow-medium">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Requisitos Importantes
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="text-foreground">
                    <strong>Valor mínimo:</strong> 1.000.000 Kz por pedido
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="text-foreground">
                    <strong>Prazo de entrega:</strong> Máximo 2 semanas após o pedido
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="text-foreground">
                    <strong>Agendamento:</strong> Obrigatório com antecedência
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="text-foreground">
                    <strong>Qualidade:</strong> Produtos certificados e inspecionados
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;