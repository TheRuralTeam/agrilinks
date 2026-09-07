import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping, faFilter, faSpinner, faBox } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "../integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  product_type: string;
  price: number;
  quantity: number;
  description?: string;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  status: string;
}

const ProductCatalog = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [categories, setCategories] = useState<string[]>(["Todos"]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        setProducts(data || []);

        // Extract unique categories from products
        const uniqueCategories = [...new Set((data || []).map(p => p.product_type))];
        setCategories(["Todos", ...uniqueCategories]);
      } catch (err) {
        console.error("Erro ao buscar produtos:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = selectedCategory === "Todos" 
    ? products 
    : products.filter(product => product.product_type === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
      minimumFractionDigits: 0
    }).format(price);
  };

  const handleViewProduct = (productId: string) => {
    navigate(`/ficha-tecnica/${productId}`);
  };

  if (loading) {
    return (
      <section id="catalogo" className="py-16 lg:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <FontAwesomeIcon icon={faSpinner} className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Carregando catálogo...</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="catalogo" className="py-12 sm:py-16 lg:py-24 bg-gradient-to-b from-background via-[#FFF159]/5 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#2D3277] mb-3 sm:mb-4 animate-slide-up">
            Catálogo de Produtos
          </h2>
          <p className="text-base sm:text-xl text-[#2D3277]/70 max-w-3xl mx-auto px-4 font-bold animate-slide-up stagger-1">
            Produtos agrícolas disponíveis na plataforma OrbisLink.
          </p>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12">
            <FontAwesomeIcon icon={faFilter} className="h-5 w-5 text-muted-foreground mt-2 hidden sm:block" />
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="rounded-full text-xs sm:text-sm"
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id} 
                className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 border-2 border-[#FFF159]/30 hover:border-[#FFF159] bg-white/80 hover:bg-white animate-fade-in"
              >
                <div className="text-center mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full bg-[#FFF159]/30 flex items-center justify-center animate-float">
                    <FontAwesomeIcon icon={faBox} className="h-8 w-8 sm:h-10 sm:w-10 text-[#2D3277]" />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                    <Badge variant="default">Disponível</Badge>
                    <Badge variant="outline" className="text-xs">{product.product_type}</Badge>
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 text-center">
                  {product.product_type}
                </h3>
                
                <p className="text-muted-foreground mb-4 text-xs sm:text-sm text-center line-clamp-2">
                  {product.description || `${product.product_type} de ${product.farmer_name}`}
                </p>

                <div className="space-y-2 mb-4 sm:mb-6 text-sm">
                  <div className="flex justify-between items-center bg-[#FFF159]/20 p-2 rounded-lg border border-[#FFF159]/50">
                    <span className="text-[#2D3277] font-bold text-xs">Preço:</span>
                    <span className="font-black text-[#3483FA] text-xs animate-pulse">
                      Consultar no App
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantidade:</span>
                    <span className="font-semibold">
                      {product.quantity.toLocaleString()} kg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Região:</span>
                    <span className="font-semibold text-xs">
                      {product.province_id}
                    </span>
                  </div>
                </div>

                <Button 
                  className="w-full gap-2 bg-[#3483FA] hover:bg-[#3483FA]/90 text-white font-bold transition-all duration-300 hover:scale-105" 
                  onClick={() => handleViewProduct(product.id)}
                >
                  <FontAwesomeIcon icon={faCartShopping} className="h-4 w-4" />
                  Consultar no App
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
              <FontAwesomeIcon icon={faBox} className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Nenhum produto encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedCategory !== "Todos" 
                ? `Não há produtos na categoria "${selectedCategory}"`
                : "Novos produtos serão exibidos aqui."}
            </p>
          </div>
        )}

        {/* Call to Action */}
        {products.length > 0 && (
          <div className="text-center mt-8 sm:mt-12">
            <div className="bg-gradient-card rounded-xl p-6 sm:p-8 border border-card-border shadow-medium">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">
                Quer vender seus produtos?
              </h3>
              <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">
                Cadastre-se como agricultor e comece a vender na plataforma OrbisLink.
              </p>
              <Button 
                variant="business" 
                size="lg"
                onClick={() => navigate("/registro")}
              >
                Cadastrar-se
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductCatalog;
