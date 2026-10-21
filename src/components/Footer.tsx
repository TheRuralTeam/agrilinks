import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPhone, faLocationDot } from "@fortawesome/free-solid-svg-icons";

const quickLinks = [
  { label: "Como Funciona", href: "/#tecnologia" },
  { label: "Catálogo", href: "/app" },
  { label: "Fazer Pedido", href: "/app" },
  { label: "Sobre Nós", href: "/#equipa" },
  { label: "Contacto", href: "/#contacto" },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-business text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-accent">AgriLink</h3>
            <p className="text-white/70 mb-4 text-sm leading-relaxed">
              Conectando produtores a grandes compradores com transparência,
              qualidade e eficiência no mercado agrícola.
            </p>
            <p className="text-white/50 text-xs leading-relaxed">
              Os perfis oficiais das redes sociais ainda não estão configurados.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white/50">Links Rápidos</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/70 hover:text-accent transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white/50">Nossos Serviços</h4>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>Venda de Grãos em Larga Escala</li>
              <li>Frutas e Vegetais Frescos</li>
              <li>Proteínas de Qualidade</li>
              <li>Logística e Entrega</li>
              <li>Consultoria Comercial</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white/50">Contato</h4>
            <div className="space-y-3">
              <a href="tel:+244922717574" className="flex items-center gap-3 text-white/70 hover:text-accent text-sm transition-colors">
                <FontAwesomeIcon icon={faPhone} className="h-4 w-4 text-accent shrink-0" />
                <span>+244 922 717 574</span>
              </a>
              <a href="tel:+244935358417" className="flex items-center gap-3 text-white/70 hover:text-accent text-sm transition-colors">
                <FontAwesomeIcon icon={faPhone} className="h-4 w-4 text-accent shrink-0" />
                <span>+244 935 358 417</span>
              </a>
              <a href="mailto:contacto@agrilink.ao" className="flex items-center gap-3 text-white/70 hover:text-accent text-sm transition-colors">
                <FontAwesomeIcon icon={faEnvelope} className="h-4 w-4 text-accent shrink-0" />
                <span>contacto@agrilink.ao</span>
              </a>
              <div className="flex items-start gap-3">
                <FontAwesomeIcon icon={faLocationDot} className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span className="text-white/70 text-sm">Luanda, Angola — Zona Industrial</span>
              </div>
            </div>
            <a href="/suporte" className="mt-4 inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:text-accent transition-colors">
              Abrir área de suporte
            </a>
            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-xs text-white/50">
                <strong className="text-white/70">Horário:</strong>
                <br />
                Segunda a Sexta: 8h às 18h
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © {currentYear} AgriLink. Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="/termos-publicidade" className="text-white/60 hover:text-accent text-sm transition-colors">
              Termos de Publicação
            </a>
            <a href="/suporte" className="text-white/60 hover:text-accent text-sm transition-colors">
              Privacidade e cookies — contactar suporte
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
