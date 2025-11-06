import { useState } from "react";
import { Button } from "./ui/button";
import { Menu, X, ShoppingCart, Phone, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AgrilinkLogo from "@/assets/agrilink-logo.png";

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
    <header className="bg-card shadow-soft border-b border-card-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <img src={AgrilinkLogo} alt="Agrilink Logo" className="h-10" />    

          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-foreground hover:text-primary transition-colors duration-300 font-medium"
                >
                  {item.name}
                </a>
              ))}
            </div>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/mercado')}
            >
              <TrendingUp className="h-4 w-4" />
              Dados de Mercado
            </Button>
            <Button variant="outline" size="sm">
              <Phone className="h-4 w-4" />
              Contato
            </Button>
            <Button variant="hero" size="sm">
              <ShoppingCart className="h-4 w-4" />
              Fazer Pedido
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-background-secondary rounded-lg mt-2 shadow-medium">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 text-base font-medium text-foreground hover:text-primary hover:bg-muted rounded-md transition-colors duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="flex flex-col space-y-2 px-3 pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    navigate('/mercado');
                    setIsMenuOpen(false);
                  }}
                >
                  <TrendingUp className="h-4 w-4" />
                  Dados de Mercado
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  <Phone className="h-4 w-4" />
                  Contato
                </Button>
                <Button variant="hero" size="sm" className="w-full">
                  <ShoppingCart className="h-4 w-4" />
                  Fazer Pedido
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