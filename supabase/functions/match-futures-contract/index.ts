import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { contract_id } = await req.json()
    if (!contract_id) throw new Error('contract_id em falta')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: contract, error: cErr } = await supabase
      .from('futures_contracts')
      .select('*')
      .eq('id', contract_id)
      .single()
    if (cErr || !contract) throw new Error('Contrato não encontrado')

    // Cruzar com produtores disponíveis: produto, quantidade, prazo e (se possível) província
    let query = supabase
      .from('products')
      .select('id, user_id, product_type, quantity, price, harvest_date, province_id, municipality_id, farmer_name')
      .eq('status', 'active')
      .ilike('product_type', `%${contract.product_name}%`)
      .gte('quantity', contract.quantity)
      .lte('harvest_date', contract.delivery_date)

    if (contract.province_id) query = query.eq('province_id', contract.province_id)

    let { data: matches } = await query.limit(5)

    // Fallback sem filtro de província
    if (!matches || matches.length === 0) {
      const { data: fallback } = await supabase
        .from('products')
        .select('id, user_id, product_type, quantity, price, harvest_date, province_id, municipality_id, farmer_name')
        .eq('status', 'active')
        .ilike('product_type', `%${contract.product_name}%`)
        .gte('quantity', contract.quantity)
        .lte('harvest_date', contract.delivery_date)
        .limit(5)
      matches = fallback ?? []
    }

    if (!matches || matches.length === 0) {
      await supabase.from('futures_contracts').update({
        status: 'no_match',
        match_notes: 'Nenhum produtor disponível cumpre as especificações neste momento.',
      }).eq('id', contract_id)

      await supabase.rpc('create_notification', {
        p_user_id: contract.buyer_id,
        p_type: 'contract',
        p_title: 'Contrato de Futuros em análise',
        p_message: `Ainda não encontrámos um produtor para "${contract.product_name}". A AgriLink continua a procurar.`,
        p_metadata: { contract_id },
      })

      return new Response(JSON.stringify({ matched: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const best = matches[0]

    await supabase.from('futures_contracts').update({
      producer_id: best.user_id,
      product_id: best.id,
      agreed_price: contract.proposed_price,
      status: 'matched',
      match_notes: `Correspondência encontrada: ${best.product_type} (${best.quantity} kg) de ${best.farmer_name}.`,
    }).eq('id', contract_id)

    await supabase.rpc('create_notification', {
      p_user_id: contract.buyer_id,
      p_type: 'contract',
      p_title: 'Produtor encontrado para o seu Contrato de Futuros',
      p_message: `Encontrámos um produtor capaz de fornecer ${contract.quantity} ${contract.unit} de ${contract.product_name} até ${contract.delivery_date}. Aceite o contrato digital para avançar.`,
      p_metadata: { contract_id, action: 'accept_futures_contract' },
    })

    await supabase.rpc('create_admin_notifications', {
      p_type: 'contract',
      p_title: 'Contrato de Futuros com correspondência',
      p_message: `Contrato de ${contract.product_name} associado a um produtor. Aguarda aceitação do comprador.`,
      p_metadata: { contract_id },
    })

    return new Response(JSON.stringify({ matched: true, producer_id: best.user_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
