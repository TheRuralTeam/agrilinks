const ChallengeSection = () => {
  return (
    <section className="py-16 lg:py-24 bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4">
            O Desafio do Mercado Atual
          </h2>
          <p className="text-base sm:text-lg text-background/70 mb-8 leading-relaxed">
            Em mercados em crescimento, as cadeias de fornecimento ainda operam de forma fragmentada,
            com múltiplos intermediários, pouca visibilidade de preços, falhas logísticas e falta de dados para planeamento.
          </p>
          <div className="bg-accent rounded-2xl p-6 sm:p-8">
            <p className="text-lg sm:text-xl font-black text-accent-foreground leading-relaxed">
              A OrbisLink nasce para resolver esse desalinhamento, criando conexões diretas, seguras e eficientes entre quem produz e quem compra em grande escala.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChallengeSection;
