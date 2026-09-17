import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const { products, language = 'pt' } = payload ?? {};
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: "products array is required and cannot be empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build product summary for analysis
    const productSummary = products.map((p: any) => ({
      type: p.product_type,
      quantity: p.quantity,
      price: p.price,
      location: `${p.province_id} - ${p.municipality_id}`,
      logistics: p.logistics_access,
      date: p.created_at
    }));

    // Group products by type
    const productsByType: Record<string, any[]> = {};
    products.forEach((p: any) => {
      if (!productsByType[p.product_type]) {
        productsByType[p.product_type] = [];
      }
      productsByType[p.product_type].push(p);
    });

    // Calculate statistics
    const stats = Object.entries(productsByType).map(([type, items]) => {
      const prices = items.map((p: any) => p.price);
      const quantities = items.map((p: any) => p.quantity);
      return {
        product: type,
        count: items.length,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        totalQuantity: quantities.reduce((a, b) => a + b, 0)
      };
    });

    const languagePrompts: Record<string, string> = {
      pt: `Você é um analista de mercado agrícola especializado em Angola, RD Congo, África do Sul e mercados africanos. 
Analise os seguintes dados de produtos agrícolas e forneça:

1. **Resumo do Mercado**: Visão geral do estado atual do mercado
2. **Análise de Preços**: Produtos com melhores preços, variações notáveis
3. **Tendências de Demanda**: Quais produtos têm mais oferta e potencial demanda
4. **Recomendações para Compradores**: Melhores oportunidades de compra
5. **Recomendações para Agricultores**: Produtos com maior potencial de lucro
6. **Previsões**: Tendências esperadas para o próximo período

Dados dos produtos:
${JSON.stringify(stats, null, 2)}

Total de produtos: ${products.length}
Resumo detalhado:
${JSON.stringify(productSummary.slice(0, 20), null, 2)}

Forneça uma análise detalhada e prática em PORTUGUÊS.`,

      en: `You are an agricultural market analyst specialized in Angola, DR Congo, South Africa and African markets.
Analyze the following agricultural product data and provide:

1. **Market Summary**: Overview of the current market state
2. **Price Analysis**: Products with best prices, notable variations
3. **Demand Trends**: Which products have most supply and potential demand
4. **Recommendations for Buyers**: Best buying opportunities
5. **Recommendations for Farmers**: Products with highest profit potential
6. **Forecasts**: Expected trends for the next period

Product data:
${JSON.stringify(stats, null, 2)}

Total products: ${products.length}
Detailed summary:
${JSON.stringify(productSummary.slice(0, 20), null, 2)}

Provide a detailed and practical analysis in ENGLISH.`,

      fr: `Vous êtes un analyste de marché agricole spécialisé en Angola, RD Congo, Afrique du Sud et marchés africains.
Analysez les données suivantes sur les produits agricoles et fournissez:

1. **Résumé du Marché**: Aperçu de l'état actuel du marché
2. **Analyse des Prix**: Produits avec les meilleurs prix, variations notables
3. **Tendances de Demande**: Quels produits ont le plus d'offre et de demande potentielle
4. **Recommandations pour les Acheteurs**: Meilleures opportunités d'achat
5. **Recommandations pour les Agriculteurs**: Produits avec le meilleur potentiel de profit
6. **Prévisions**: Tendances attendues pour la prochaine période

Données des produits:
${JSON.stringify(stats, null, 2)}

Total des produits: ${products.length}
Résumé détaillé:
${JSON.stringify(productSummary.slice(0, 20), null, 2)}

Fournissez une analyse détaillée et pratique en FRANÇAIS.`
    };

    const systemPrompt = languagePrompts[language] || languagePrompts.pt;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert agricultural market analyst for African markets." },
          { role: "user", content: systemPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Unable to generate analysis";

    return new Response(JSON.stringify({ 
      analysis,
      stats,
      totalProducts: products.length,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in market-analysis function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});