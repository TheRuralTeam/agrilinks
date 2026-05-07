import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { product_id, ficha_id } = await req.json();
    if (!product_id && !ficha_id) {
      return new Response(JSON.stringify({ error: 'product_id or ficha_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

    // Build (product, ficha) pairs
    let pairs: Array<{ product: any; ficha: any }> = [];

    if (product_id) {
      const { data: product } = await supabase.from('products').select('*').eq('id', product_id).maybeSingle();
      if (!product) throw new Error('Product not found');
      const { data: fichas } = await supabase
        .from('fichas_recebimento').select('*')
        .ilike('produto', `%${product.product_type}%`);
      pairs = (fichas || []).map((f) => ({ product, ficha: f }));
    } else {
      const { data: ficha } = await supabase.from('fichas_recebimento').select('*').eq('id', ficha_id).maybeSingle();
      if (!ficha) throw new Error('Ficha not found');
      const { data: products } = await supabase
        .from('products').select('*').eq('status', 'active')
        .ilike('product_type', `%${ficha.produto}%`);
      pairs = (products || []).map((p) => ({ product: p, ficha }));
    }

    if (pairs.length === 0) {
      return new Response(JSON.stringify({ message: 'No matches found', verifications: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const { product, ficha } of pairs) {

      // Ask AI to compare
      const prompt = `És um verificador agrícola. Compara o PRODUTO publicado com a FICHA TÉCNICA do comprador e devolve JSON com: match_score (0-100), status ("match" se >=80, "partial" se 50-79, "mismatch" se <50), issues (array de strings curtas em português) e summary (1 frase).

PRODUTO:
- Tipo: ${product.product_type}
- Quantidade: ${product.quantity}
- Preço: ${product.price} Kz
- Província: ${product.province_id}
- Município: ${product.municipality_id}
- Logística: ${product.logistics_access}
- Descrição: ${product.description || 'N/A'}
- Data colheita: ${product.harvest_date}

FICHA TÉCNICA:
- Produto desejado: ${ficha.produto}
- Qualidade: ${ficha.qualidade || 'N/A'}
- Embalagem: ${ficha.embalagem || 'N/A'}
- Transporte: ${ficha.transporte || 'N/A'}
- Locais de entrega: ${JSON.stringify(ficha.locais_entrega || [])}
- Observações: ${ficha.observacoes || 'N/A'}
- Descrição final: ${ficha.descricao_final || 'N/A'}

Responde APENAS com JSON válido.`;

      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Devolve sempre JSON válido sem markdown.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResp.ok) {
        console.error('AI error', aiResp.status, await aiResp.text());
        continue;
      }
      const aiData = await aiResp.json();
      let analysis: any = {};
      try {
        analysis = JSON.parse(aiData.choices?.[0]?.message?.content ?? '{}');
      } catch { analysis = {}; }

      const score = Number(analysis.match_score) || 0;
      const status = analysis.status || (score >= 80 ? 'match' : score >= 50 ? 'partial' : 'mismatch');
      const issues: string[] = Array.isArray(analysis.issues) ? analysis.issues : [];

      // Save verification
      const { data: verif } = await supabase.from('product_verifications').insert({
        product_id: product.id,
        ficha_id: ficha.id,
        producer_id: product.user_id,
        buyer_id: ficha.user_id,
        match_score: score,
        status,
        ai_analysis: analysis,
        issues,
      }).select().single();

      results.push(verif);

      // Notify producer
      await supabase.rpc('create_notification', {
        p_user_id: product.user_id,
        p_type: 'verification',
        p_title: status === 'match' ? '✅ Produto compatível com ficha' : status === 'partial' ? '⚠️ Compatibilidade parcial' : '❌ Incompatibilidade detetada',
        p_message: `IA analisou seu "${product.product_type}" vs ficha "${ficha.nome_ficha}" — ${score}% compatível. ${analysis.summary || ''}`,
        p_metadata: { product_id: product.id, ficha_id: ficha.id, score, issues },
      });

      // Notify buyer (ficha owner)
      if (ficha.user_id !== product.user_id) {
        await supabase.rpc('create_notification', {
          p_user_id: ficha.user_id,
          p_type: 'verification',
          p_title: status === 'match' ? '✅ Produto compatível com sua ficha' : status === 'partial' ? '⚠️ Produto parcialmente compatível' : '❌ Produto não compatível',
          p_message: `IA encontrou produto "${product.product_type}" — ${score}% compatível com sua ficha "${ficha.nome_ficha}". ${analysis.summary || ''}`,
          p_metadata: { product_id: product.id, ficha_id: ficha.id, score, issues },
        });
      }

    }

    // Notify all admins once with summary
    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
    if (admins) {
      const summary = `Verificação IA concluída: ${results.length} ficha(s) analisada(s) para produto "${product.product_type}".`;
      for (const a of admins) {
        await supabase.rpc('create_notification', {
          p_user_id: a.user_id,
          p_type: 'verification_admin',
          p_title: '🤖 Verificação IA Produto/Ficha',
          p_message: summary,
          p_metadata: { product_id: product.id, results_count: results.length },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, verifications: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('verify-product-ficha error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
