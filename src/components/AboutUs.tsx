import { Card } from "./ui/card";
import { Users, Target, Award, Handshake } from "lucide-react";
import businessImage from "@/assets/business-partnership.jpg";
import warehouseImage from "@/assets/warehouse-products.jpg";

const AboutUs = () => {
  const values = [
    {
      icon: Target,
      title: "Nossa Missão",
      description: "Conectar produtores agrícolas diretamente a grandes compradores, eliminando intermediários e garantindo preços justos para ambas as partes."
    },
    {
      icon: Handshake,
      title: "Parcerias Sólidas",
      description: "Construímos relacionamentos duradouros baseados em confiança, transparência e qualidade em cada transação."
    },
    {
      icon: Award,
      title: "Qualidade Garantida",
      description: "Todos os nossos produtos passam por rigoroso controle de qualidade, assegurando que você receba apenas o melhor."
    },
    {
      icon: Users,
      title: "Suporte Especializado",
      description: "Nossa equipe de especialistas está sempre disponível para orientar e apoiar suas decisões de compra."
    }
  ];

  return (
    <section id="sobre" className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Sobre a AgriLink
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Somos a ponte entre produtores agrícolas e grandes compradores,
            facilitando negócios em escala com transparência e eficiência.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Story */}
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">
              Nossa História
            </h3>
            
            <div className="space-y-4 text-muted-foreground">
              <p>
                A AgriLink nasceu da necessidade de simplificar e modernizar o mercado de 
                produtos agrícolas em grande escala. Percebemos que tanto produtores quanto 
                grandes compradores enfrentavam dificuldades para se conectar de forma eficiente.
              </p>
              
              <p>
                Nossa plataforma elimina intermediários desnecessários, permitindo que 
                produtores rurais tenham acesso direto a empresas, distribuidores e outros 
                grandes compradores, garantindo preços mais justos e relações comerciais 
                transparentes.
              </p>
              
              <p>
                Com foco na qualidade, agilidade e confiabilidade, estabelecemos um 
                novo padrão no setor agrícola, onde a tecnologia serve para fortalecer 
                as relações comerciais e impulsionar o desenvolvimento do agronegócio.
              </p>
            </div>
            
            <div className="mt-8 p-6 bg-gradient-card rounded-lg border border-card-border">
              <h4 className="font-semibold text-foreground mb-2">Compromisso com a Qualidade</h4>
              <p className="text-muted-foreground text-sm">
                Cada produto em nossa plataforma é cuidadosamente selecionado e 
                inspecionado para garantir que atenda aos mais altos padrões de 
                qualidade e segurança alimentar.
              </p>
            </div>
          </div>

          {/* Images */}
          <div className="space-y-6">
            <div className="relative rounded-xl overflow-hidden shadow-medium">
              <img
                src={businessImage}
                alt="Parceria de negócios"
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
            </div>
            
            <div className="relative rounded-xl overflow-hidden shadow-medium">
              <img
                src={warehouseImage}
                alt="Armazém de produtos"
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-business/20 to-transparent"></div>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <Card
                key={index}
                className="p-6 text-center border-card-border hover:shadow-medium transition-all duration-300 group"
              >
                <div className="inline-flex p-4 rounded-xl bg-gradient-primary mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  {value.title}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {value.description}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Statistics */}
        <div className="mt-16 bg-gradient-hero rounded-xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-8">AgriLink em Números</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-accent mb-2">500+</div>
              <div className="text-white/90">Produtores Parceiros</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent mb-2">200+</div>
              <div className="text-white/90">Empresas Clientes</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent mb-2">1M+</div>
              <div className="text-white/90">Toneladas Comercializadas</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent mb-2">95%</div>
              <div className="text-white/90">Satisfação dos Clientes</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutUs;
