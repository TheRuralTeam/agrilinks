import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, MapPin, ShoppingCart, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const MarketData = () => {
  const navigate = useNavigate();

  const topProducts = [
    { name: "Arroz", sales: 1250, trend: "up", change: "+15%" },
    { name: "Tomate", sales: 980, trend: "up", change: "+22%" },
    { name: "Milho", sales: 850, trend: "down", change: "-5%" },
    { name: "Feijão", sales: 720, trend: "up", change: "+8%" },
    { name: "Batata", sales: 650, trend: "up", change: "+12%" },
  ];

  const pricesByRegion = [
    {
      product: "Arroz",
      region: "Luanda",
      price: 4000,
      unit: "Kz/kg",
      demand: "alta",
      trend: "stable"
    },
    {
      product: "Tomate",
      region: "Huíla",
      price: 1200,
      unit: "Kz/kg",
      demand: "muito alta",
      trend: "up"
    },
    {
      product: "Milho",
      region: "Benguela",
      price: 800,
      unit: "Kz/kg",
      demand: "média",
      trend: "stable"
    },
    {
      product: "Feijão",
      region: "Malanje",
      price: 1500,
      unit: "Kz/kg",
      demand: "alta",
      trend: "up"
    },
    {
      product: "Batata",
      region: "Huambo",
      price: 900,
      unit: "Kz/kg",
      demand: "alta",
      trend: "stable"
    },
  ];

  const bestMarkets = [
    {
      product: "Arroz",
      location: "Luanda",
      price: "4.000 Kz/kg",
      reason: "Alta demanda urbana e poder de compra"
    },
    {
      product: "Tomate",
      location: "Huíla",
      price: "1.200 Kz/kg",
      reason: "Maior valorização e procura crescente"
    },
    {
      product: "Milho",
      location: "Benguela",
      price: "800 Kz/kg",
      reason: "Proximidade portuária facilita exportação"
    },
    {
      product: "Feijão",
      location: "Malanje",
      price: "1.500 Kz/kg",
      reason: "Centro de distribuição nacional"
    },
  ];

  const marketInsights = [
    {
      title: "Tendência de Alta",
      description: "Tomate e produtos frescos estão com preços em alta devido à procura",
      type: "positive"
    },
    {
      title: "Oportunidade",
      description: "Arroz em Luanda mantém preços estáveis com demanda consistente",
      type: "info"
    },
    {
      title: "Atenção",
      description: "Milho apresenta leve queda de preço - momento para vendas estratégicas",
      type: "warning"
    },
  ];

  const getDemandBadge = (demand: string) => {
    switch (demand) {
      case "muito alta":
        return <Badge className="bg-success text-success-foreground">Muito Alta</Badge>;
      case "alta":
        return <Badge className="bg-primary text-primary-foreground">Alta</Badge>;
      case "média":
        return <Badge className="bg-accent text-accent-foreground">Média</Badge>;
      default:
        return <Badge variant="outline">{demand}</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <DollarSign className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-card-border sticky top-0 z-50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Dados de Mercado
                </h1>
                <p className="text-sm text-muted-foreground">
                  Análise em tempo real do mercado agrícola
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Market Insights */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Insights do Mercado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {marketInsights.map((insight, index) => (
              <Card key={index} className="border-l-4" style={{
                borderLeftColor: insight.type === "positive" ? "hsl(var(--success))" :
                               insight.type === "warning" ? "hsl(var(--warning))" :
                               "hsl(var(--business))"
              }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Top Products */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Produtos Mais Comercializados
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sales} transações</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(product.trend)}
                      <span className={product.trend === "up" ? "text-success font-medium" : "text-destructive font-medium"}>
                        {product.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Prices by Region */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Preços Competitivos por Região
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricesByRegion.map((item, index) => (
              <Card key={index} className="hover:shadow-medium transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.product}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {item.region}
                      </CardDescription>
                    </div>
                    {getTrendIcon(item.trend)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {item.price.toLocaleString()} {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Procura:</span>
                      {getDemandBadge(item.demand)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Best Markets */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Melhores Mercados para Vender
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {bestMarkets.map((market, index) => (
                  <div key={index} className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{market.product}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {market.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">{market.price}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted/30 rounded-md">
                      <strong>Por quê?</strong> {market.reason}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground text-center">
            * Os preços e dados apresentados são estimativas baseadas em análises de mercado recentes. 
            Para informações precisas e atualizadas, consulte as cotações locais.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MarketData;
