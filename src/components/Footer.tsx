import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-business text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold mb-4 text-accent">AgriLink</h3>
            <p className="text-white/70 mb-4 text-sm leading-relaxed">
              Conectando produtores a grandes compradores com transparência,
              qualidade e eficiência no mercado agrícola.
            </p>
            <div className="flex space-x-4">
              {[Facebook, Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="text-white/40 hover:text-accent transition-colors">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white/50">Links Rápidos</h4>
            <ul className="space-y-2">
              {["Como Funciona", "Catálogo", "Fazer Pedido", "Sobre Nós", "Contato"].map((link) => (
                <li key={link}>
                  <a href={`#${link.toLowerCase().replace(/ /g, "-")}`} className="text-white/70 hover:text-accent transition-colors text-sm">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
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

          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white/50">Contato</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-accent shrink-0" />
                <span className="text-white/70 text-sm">+244 922 717 574 / 935358417</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-accent shrink-0" />
                <span className="text-white/70 text-sm">contactos@agrilink.ao</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span className="text-white/70 text-sm">Luanda, Angola<br />Zona Industrial</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-xs text-white/50">
                <strong className="text-white/70">Horário:</strong><br />
                Segunda a Sexta: 8h às 18h
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/40 text-sm">
            © {currentYear} AgriLink. Todos os direitos reservados.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            {["Política de Privacidade", "Termos de Uso", "Cookies"].map((link) => (
              <a key={link} href="#" className="text-white/40 hover:text-accent text-sm transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
