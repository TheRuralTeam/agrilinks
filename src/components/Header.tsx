import { useState } from "react";
import { Button } from "./ui/button";
import { Menu, X, ShoppingCart, Phone, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OrbisLinkLogo from "@/assets/orbislink-logo.png";

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
    <header className="bg-card border-b border-border sticky top-0 z-50 shadow-xs">
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
              className="h-9 rounded-lg text-sm"
              onClick={() => navigate("/mercado")}
            >
              <TrendingUp className="h-4 w-4" />
              Dados de Mercado
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-lg text-sm">
              <Phone className="h-4 w-4" />
              Contato
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-lg text-sm shadow-soft"
              onClick={() => navigate("/login")}
            >
              <ShoppingCart className="h-4 w-4" />
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
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden animate-fade-in">
            <div className="px-3 pt-3 pb-4 space-y-1 bg-card rounded-2xl mt-2 shadow-medium border border-border/50">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-3 text-base font-semibold text-foreground hover:bg-muted rounded-xl transition-colors duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="flex flex-col space-y-2 px-3 pt-4 border-t border-border/50 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-11 rounded-xl justify-start"
                  onClick={() => {
                    navigate("/mercado");
                    setIsMenuOpen(false);
                  }}
                >
                  <TrendingUp className="h-4 w-4" />
                  Dados de Mercado
                </Button>
                <Button
                  size="sm"
                  className="w-full h-11 rounded-xl justify-start shadow-soft"
                  onClick={() => {
                    navigate("/login");
                    setIsMenuOpen(false);
                  }}
                >
                  <ShoppingCart className="h-4 w-4" />
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
