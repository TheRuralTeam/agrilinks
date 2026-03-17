const reasons = [
  { title: "Eficiência", desc: "Menos intermediários, mais controlo" },
  { title: "Confiabilidade", desc: "Parceiros validados e processos claros" },
  { title: "Escala", desc: "Preparada para operar em nível nacional" },
  { title: "Transparência", desc: "Preços, prazos e volumes visíveis" },
  { title: "Inteligência", desc: "Dados que orientam decisões estratégicas" },
];

const WhyChooseSection = () => {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground mb-3">
            Por que escolher a OrbisLink
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {reasons.map((item, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-5 border border-border hover:border-accent/50 hover:shadow-medium transition-all duration-300 text-center"
            >
              <h3 className="text-base font-bold text-primary mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSection;
