import { useState } from "react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { BarChart3, Menu, Phone, ShoppingCart, X } from "lucide-react";
import OrbisLinkLogo from "../assets/orbislink-logo.png";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navigation = [
    { name: "Como Funciona", href: "#como-funciona" },
    { name: "Catálogo", href: "#catalogo" },
    { name: "Fazer Pedido", href: "#pedidos" },
    { name: "Sobre Nós", href: "#sobre" },
    { name: "Contato", href: "#contato" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-card/90 shadow-xs backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <img src={OrbisLinkLogo} alt="OrbisLink Logo" className="h-9 sm:h-10 drop-shadow-sm" />

          {/* Desktop Navigation */}
          <nav className="hidden lg:block">
            <div className="ml-10 flex items-baseline space-x-6 xl:space-x-8">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-foreground/70 hover:text-foreground transition-colors duration-200 font-semibold text-sm"
                >
                  {item.name}
                </a>
              ))}
            </div>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-xl text-sm"
              onClick={() => navigate("/mercado")}
            >
              <BarChart3 aria-hidden="true" />
              Dados de Mercado
            </Button>
            <Button variant="outline" size="sm" className="h-10 rounded-xl text-sm">
              <Phone aria-hidden="true" />
              Contato
            </Button>
            <Button
              size="sm"
              className="h-10 rounded-xl text-sm"
              onClick={() => navigate("/login")}
            >
              <ShoppingCart aria-hidden="true" />
              Entrar
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden animate-fade-in">
            <div className="mt-2 space-y-1 rounded-2xl border border-border/70 bg-card px-3 pb-4 pt-3 shadow-medium">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block rounded-xl px-4 py-3 text-base font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="flex flex-col space-y-2 px-3 pt-4 border-t border-border/50 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 w-full justify-start rounded-xl"
                  onClick={() => {
                    navigate("/mercado");
                    setIsMenuOpen(false);
                  }}
                >
                  <BarChart3 aria-hidden="true" />
                  Dados de Mercado
                </Button>
                <Button
                  size="sm"
                  className="h-11 w-full justify-start rounded-xl"
                  onClick={() => {
                    navigate("/login");
                    setIsMenuOpen(false);
                  }}
                >
                  <ShoppingCart aria-hidden="true" />
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
