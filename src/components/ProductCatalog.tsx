import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Filter, Package, ShoppingCart } from "lucide-react";
import Loader from "./ui/Loader";
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
            <Loader compact label="A carregar catálogo" />
            <span className="text-sm text-muted-foreground">Carregando catálogo...</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="catalogo" className="bg-background py-12 sm:py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="mb-3 text-2xl font-bold text-foreground sm:mb-4 sm:text-3xl md:text-4xl animate-slide-up">
            Catálogo de Produtos
          </h2>
          <p className="mx-auto max-w-3xl px-4 text-base text-muted-foreground sm:text-xl animate-slide-up stagger-1">
            Produtos agrícolas disponíveis na plataforma OrbisLink.
          </p>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12">
            <Filter className="mt-2 hidden h-5 w-5 text-muted-foreground sm:block" aria-hidden="true" />
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
                className="animate-fade-in border-border/70 p-4 transition-shadow duration-200 hover:border-primary/40 hover:shadow-medium sm:p-6"
              >
                <div className="text-center mb-4">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary sm:h-20 sm:w-20">
                    <Package className="h-8 w-8 text-primary sm:h-10 sm:w-10" aria-hidden="true" />
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
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-3">
                    <span className="text-xs font-semibold text-muted-foreground">Preço:</span>
                    <span className="text-xs font-semibold text-foreground">
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
                  className="w-full gap-2 font-bold"
                  onClick={() => handleViewProduct(product.id)}
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Consultar no App
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
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
            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-xs sm:p-8">
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
