import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ShoppingCart, Filter } from "lucide-react";

const ProductCatalog = () => {
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const categories = ["Todos", "Grãos", "Frutas", "Vegetais", "Proteínas"];

  const products = [
    {
      id: 1,
      name: "Arroz Branco Premium",
      category: "Grãos",
      price: 85000,
      unit: "saco 50kg",
      minQuantity: 100,
      image: "🌾",
      description: "Arroz de alta qualidade, grão longo, ideal para revendas.",
      available: true
    },
    {
      id: 2,
      name: "Feijão Preto",
      category: "Grãos",
      price: 120000,
      unit: "saco 50kg",
      minQuantity: 50,
      image: "🫘",
      description: "Feijão preto selecionado, rico em proteínas.",
      available: true
    },
    {
      id: 3,
      name: "Banana da Madeira",
      category: "Frutas",
      price: 45000,
      unit: "caixa 20kg",
      minQuantity: 80,
      image: "🍌",
      description: "Bananas frescas, direto do produtor.",
      available: true
    },
    {
      id: 4,
      name: "Tomate Industrial",
      category: "Vegetais",
      price: 35000,
      unit: "caixa 15kg",
      minQuantity: 120,
      image: "🍅",
      description: "Tomates para processamento industrial.",
      available: false
    },
    {
      id: 5,
      name: "Carne Bovina",
      category: "Proteínas",
      price: 1800000,
      unit: "kg",
      minQuantity: 500,
      image: "🥩",
      description: "Carne bovina de primeira qualidade, refrigerada.",
      available: true
    },
    {
      id: 6,
      name: "Milho em Grão",
      category: "Grãos",
      price: 65000,
      unit: "saco 50kg",
      minQuantity: 200,
      image: "🌽",
      description: "Milho amarelo para ração e consumo.",
      available: true
    }
  ];

  const filteredProducts = selectedCategory === "Todos" 
    ? products 
    : products.filter(product => product.category === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <section id="catalogo" className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Catálogo de Produtos
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Produtos alimentares de alta qualidade direto dos produtores para sua empresa.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <Filter className="h-5 w-5 text-muted-foreground mt-2" />
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="rounded-full"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="p-6 hover:shadow-medium transition-all duration-300 border-card-border">
              <div className="text-center mb-4">
                <div className="text-6xl mb-4">{product.image}</div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={product.available ? "default" : "secondary"}>
                    {product.available ? "Disponível" : "Indisponível"}
                  </Badge>
                  <Badge variant="outline">{product.category}</Badge>
                </div>
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-2">
                {product.name}
              </h3>
              
              <p className="text-muted-foreground mb-4 text-sm">
                {product.description}
              </p>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço:</span>
                  <span className="font-semibold text-primary">
                    {formatPrice(product.price)}/{product.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qtd. Mínima:</span>
                  <span className="font-semibold">
                    {product.minQuantity} {product.unit}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Mínimo:</span>
                  <span className="font-semibold text-accent">
                    {formatPrice(product.price * product.minQuantity)}
                  </span>
                </div>
              </div>

              <Button 
                className="w-full" 
                variant={product.available ? "default" : "outline"}
                disabled={!product.available}
              >
                <ShoppingCart className="h-4 w-4" />
                {product.available ? "Adicionar ao Pedido" : "Indisponível"}
              </Button>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12">
          <div className="bg-gradient-card rounded-xl p-8 border border-card-border shadow-medium">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Não encontrou o que procura?
            </h3>
            <p className="text-muted-foreground mb-6">
              Entre em contato conosco para consultar outros produtos disponíveis.
            </p>
            <Button variant="business" size="lg">
              Falar com Especialista
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductCatalog;