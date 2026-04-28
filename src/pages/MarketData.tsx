import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Loader2, RefreshCw, AlertCircle, ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── AgriLink Design System (Branding T) ─────────────────────── */
const T = {
  /* Greens */
  g900:   '#2c863b',
  g700:   '#1A5C24',
  g600:   '#2D7D3A',
  g500:   '#3D9A48',
  g400:   '#4CAF50',
  g100:   '#E8F5E9',
  g50:    '#F2FAF3',
  gBorder:'#C8E6CA',

  /* Earth */
  e700:   '#5C3317',
  e500:   '#7B4F2E',
  e300:   '#A0522D',
  ePale:  '#FDF5EE',
  eBorder:'#EDD9C6',

  /* Neutrals */
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F7F9F7',
  white:  '#FFFFFF',
  rule:   '#E5EDE6',

  /* Accents */
  gold:   '#B07D0A',
  goldL:  '#E5A020',

  /* Shadow */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

interface ProductStats {
  product: string;
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalQuantity: number;
}

interface MarketProduct {
  product_type: string;
  price: number;
  quantity: number;
}

interface MarketAnalysis {
  analysis: string;
  stats: ProductStats[];
  totalProducts: number;
  generatedAt: string;
}

const MarketData = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketAnalysis | null>(null);
  const [products, setProducts] = useState<MarketProduct[]>([]);

  const fetchProducts = async (): Promise<MarketProduct[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      const parsedData = (data || []) as MarketProduct[];
      setProducts(parsedData);
      return parsedData;
    } catch (err) {
      console.error("Erro ao buscar produtos:", err);
      setError("Erro ao carregar produtos");
      return [];
    }
  };

  const calculateLocalStats = (productsData: MarketProduct[]): ProductStats[] => {
    const productsByType: Record<string, MarketProduct[]> = {};
    
    productsData.forEach((p) => {
      if (!productsByType[p.product_type]) {
        productsByType[p.product_type] = [];
      }
      productsByType[p.product_type].push(p);
    });

    return Object.entries(productsByType).map(([type, items]) => {
      const prices = items.map((p) => p.price);
      const quantities = items.map((p) => p.quantity);
      return {
        product: type,
        count: items.length,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        totalQuantity: quantities.reduce((a, b) => a + b, 0)
      };
    }).sort((a, b) => b.count - a.count);
  };

  const generateAnalysis = async (productsData: MarketProduct[]) => {
    if (productsData.length === 0) {
      setError("Nenhum produto disponível para análise");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("market-analysis", {
        body: { products: productsData, language: "pt" }
      });

      if (fnError) throw fnError;

      setMarketData(data);
      setError(null);
    } catch (err: unknown) {
      console.error("Erro na análise de mercado:", err);
      const localStats = calculateLocalStats(productsData);
      setMarketData({
        analysis: "",
        stats: localStats,
        totalProducts: productsData.length,
        generatedAt: new Date().toISOString()
      });
      toast.error("Análise IA indisponível, mostrando dados locais");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const productsData = await fetchProducts();
      if (productsData.length > 0) {
        const localStats = calculateLocalStats(productsData);
        setMarketData({
          analysis: "",
          stats: localStats,
          totalProducts: productsData.length,
          generatedAt: new Date().toISOString()
        });
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleRefresh = async () => {
    const productsData = await fetchProducts();
    await generateAnalysis(productsData);
  };

  const formatPrice = (price: number) => `${price.toLocaleString("pt-AO")} Kz`;

  const getDemandLevel = (count: number, total: number): string => {
    const percentage = (count / total) * 100;
    if (percentage >= 20) return "muito alta";
    if (percentage >= 10) return "alta";
    if (percentage >= 5) return "média";
    return "baixa";
  };

  const getDemandBadge = (demand: string) => {
    switch (demand) {
      case "muito alta":
        return <Badge style={{ background: T.g900, color: T.white }}>Muito Alta</Badge>;
      case "alta":
        return <Badge style={{ background: T.g600, color: T.white }}>Alta</Badge>;
      case "média":
        return <Badge style={{ background: T.gold, color: T.white }}>Média</Badge>;
      default:
        return <Badge variant="outline" style={{ borderColor: T.gBorder, color: T.muted }}>{demand}</Badge>;
    }
  };

  const getTrendIcon = (avgPrice: number, minPrice: number, maxPrice: number) => {
    const range = maxPrice - minPrice;
    if (range === 0) return <DollarSign className="h-4 w-4" style={{ color: T.muted }} />;
    const position = (avgPrice - minPrice) / range;
    if (position > 0.6) return <TrendingUp className="h-4 w-4" style={{ color: T.g900 }} />;
    if (position < 0.4) return <TrendingDown className="h-4 w-4" style={{ color: T.e700 }} />;
    return <DollarSign className="h-4 w-4" style={{ color: T.muted }} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.canvas }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.g900 }} />
          <span className="text-sm" style={{ color: T.muted }}>Carregando dados de mercado...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: T.canvas }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: T.white, borderBottom: `1px solid ${T.rule}`, boxShadow: `0 2px 8px ${T.shadow}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
                style={{ color: T.mid }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: T.g900 }}>
                  Dados de Mercado
                </h1>
                <p className="text-xs hidden sm:block" style={{ color: T.muted }}>
                  Análise baseada em {marketData?.totalProducts || 0} produtos ativos
                </p>
              </div>
            </div>
            <Button 
              onClick={handleRefresh}
              disabled={analyzing}
              className="shrink-0 gap-2"
              style={{ background: T.g900, color: T.white }}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{analyzing ? "Analisando..." : "Atualizar"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Error State */}
        {error && products.length === 0 && (
          <Card style={{ border: `1px solid ${T.eBorder}`, background: T.ePale }}>
            <CardContent className="flex items-center gap-3 py-6">
              <AlertCircle className="h-5 w-5 shrink-0" style={{ color: T.e700 }} />
              <p className="text-sm" style={{ color: T.e700 }}>{error}</p>
            </CardContent>
          </Card>
        )}

        {/* AI Analysis */}
        {marketData?.analysis && (
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: T.g700 }}>
              <BarChart3 className="h-5 w-5" />
              Análise Estratégica
            </h2>
            <Card style={{ border: `1px solid ${T.gBorder}`, background: T.white, boxShadow: `0 4px 12px ${T.shadow}` }}>
              <CardContent className="pt-6">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap" style={{ color: T.mid }}>
                  {marketData.analysis}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Product Statistics */}
        {marketData?.stats && marketData.stats.length > 0 && (
          <>
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: T.g700 }}>
                <ShoppingCart className="h-5 w-5" />
                Produtos em Destaque
              </h2>
              <Card style={{ border: `1px solid ${T.rule}`, background: T.white }}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {marketData.stats.slice(0, 5).map((product, index) => (
                      <div 
                        key={product.product} 
                        className="flex items-center justify-between p-4 rounded-xl transition-all hover:shadow-sm"
                        style={{ background: T.g50, border: `1px solid ${T.gBorder}` }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0" style={{ background: T.g900, color: T.white }}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm sm:text-base truncate" style={{ color: T.ink }}>{product.product}</p>
                            <p className="text-xs" style={{ color: T.muted }}>
                              {product.count} ofertas • {product.totalQuantity.toLocaleString()} kg
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getDemandBadge(getDemandLevel(product.count, marketData.totalProducts))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: T.g700 }}>
                <DollarSign className="h-5 w-5" />
                Variação de Preços
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketData.stats.map((item) => (
                  <Card key={item.product} className="transition-all hover:translate-y-[-2px]" style={{ border: `1px solid ${T.rule}`, background: T.white, boxShadow: `0 2px 6px ${T.shadow}` }}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate" style={{ color: T.ink }}>
                            {item.product}
                          </CardTitle>
                          <CardDescription style={{ color: T.muted }}>
                            {item.count} ofertas ativas
                          </CardDescription>
                        </div>
                        <div className="p-2 rounded-lg" style={{ background: T.g50 }}>
                          {getTrendIcon(item.avgPrice, item.minPrice, item.maxPrice)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.faint }}>Preço Médio</p>
                          <p className="text-xl font-bold" style={{ color: T.g900 }}>{formatPrice(item.avgPrice)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: T.rule }}>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: T.faint }}>Mínimo</p>
                            <p className="text-sm font-bold" style={{ color: T.mid }}>{formatPrice(item.minPrice)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: T.faint }}>Máximo</p>
                            <p className="text-sm font-bold" style={{ color: T.mid }}>{formatPrice(item.maxPrice)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default MarketData;
