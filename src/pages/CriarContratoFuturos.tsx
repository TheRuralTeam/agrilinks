import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSignature, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCanAct } from '@/hooks/useCanAct'
import { T, FONT } from '@/lib/brand'
import { PRODUCT_CATEGORIES } from '@/lib/productCategories'

const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: T.mid, marginBottom: 6, display: 'block',
  fontFamily: FONT, letterSpacing: '0.02em',
}
const field: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 10, border: `1px solid ${T.rule}`,
  padding: '0 12px', fontSize: 14, color: T.ink, background: T.white,
  outline: 'none', fontFamily: FONT,
}

const CriarContratoFuturos = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { requireAct } = useCanAct()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    product_name: '',
    quantity: '',
    unit: 'kg',
    quality_specs: '',
    packaging: '',
    transport: '',
    delivery_date: '',
    proposed_price: '',
    province_id: '',
    municipality_id: '',
    delivery_location: '',
    description: '',
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireAct('criar um contrato de futuros')) return
    if (!form.product_name || !form.quantity || !form.delivery_date || !form.proposed_price) {
      toast.error('Preencha produto, quantidade, prazo de entrega e preço proposto.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.from('futures_contracts').insert({
        buyer_id: user!.id,
        product_name: form.product_name,
        quantity: Number(form.quantity),
        unit: form.unit,
        quality_specs: form.quality_specs || null,
        packaging: form.packaging || null,
        transport: form.transport || null,
        delivery_date: form.delivery_date,
        proposed_price: Number(form.proposed_price),
        province_id: form.province_id || null,
        municipality_id: form.municipality_id || null,
        delivery_location: form.delivery_location || null,
        description: form.description || null,
        status: 'pending_match',
      }).select('id').single()
      if (error) throw error

      toast.success('Pedido submetido. A AgriLink está a procurar produtores compatíveis.')
      supabase.functions.invoke('match-futures-contract', { body: { contract_id: data.id } })
        .catch(() => {})
      navigate('/contratos-futuros')
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível criar o contrato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 90 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 30, background: T.white,
        borderBottom: `1px solid ${T.rule}`, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: 0 }}>Criar Contrato de Futuros</h1>
          <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Especifique o produto que deseja receber no futuro</p>
        </div>
      </header>

      <form onSubmit={submit} style={{ maxWidth: 680, margin: '0 auto', padding: 16, display: 'grid', gap: 16 }}>
        <section style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: 16, padding: 16, display: 'grid', gap: 14 }}>
          <div>
            <label style={label}>Produto *</label>
            <select style={field} value={form.product_name} onChange={e => set('product_name', e.target.value)}>
              <option value="">Seleccione o produto/categoria</option>
              {PRODUCT_CATEGORIES.map(c => (
                <option key={c.id} value={c.label}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Quantidade *</label>
              <input style={field} type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="Ex.: 5000" />
            </div>
            <div>
              <label style={label}>Unidade</label>
              <select style={field} value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="kg">kg</option>
                <option value="ton">tonelada</option>
                <option value="caixa">caixa</option>
                <option value="saco">saco</option>
              </select>
            </div>
          </div>
          <div>
            <label style={label}>Especificações de qualidade</label>
            <textarea style={{ ...field, height: 90, padding: 12, resize: 'vertical' }}
              value={form.quality_specs} onChange={e => set('quality_specs', e.target.value)}
              placeholder="Calibre, grau de maturação, humidade, certificações..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Embalagem</label>
              <input style={field} value={form.packaging} onChange={e => set('packaging', e.target.value)} placeholder="Ex.: caixas de 20 kg" />
            </div>
            <div>
              <label style={label}>Transporte</label>
              <input style={field} value={form.transport} onChange={e => set('transport', e.target.value)} placeholder="Ex.: camião refrigerado" />
            </div>
          </div>
        </section>

        <section style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: 16, padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Prazo de entrega *</label>
              <input style={field} type="date" value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} />
            </div>
            <div>
              <label style={label}>Preço proposto (Kz, total) *</label>
              <input style={field} type="number" min="0" value={form.proposed_price} onChange={e => set('proposed_price', e.target.value)} placeholder="Ex.: 2500000" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Província</label>
              <input style={field} value={form.province_id} onChange={e => set('province_id', e.target.value)} placeholder="Ex.: Huambo" />
            </div>
            <div>
              <label style={label}>Município</label>
              <input style={field} value={form.municipality_id} onChange={e => set('municipality_id', e.target.value)} placeholder="Ex.: Caála" />
            </div>
          </div>
          <div>
            <label style={label}>Local de entrega</label>
            <input style={field} value={form.delivery_location} onChange={e => set('delivery_location', e.target.value)} placeholder="Endereço / armazém de recepção" />
          </div>
          <div>
            <label style={label}>Notas adicionais</label>
            <textarea style={{ ...field, height: 80, padding: 12, resize: 'vertical' }}
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </section>

        <button type="submit" disabled={loading} style={{
          height: 50, borderRadius: 12, border: 'none', background: T.green, color: T.white,
          fontWeight: 800, fontSize: 14, fontFamily: FONT, cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1,
        }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <FileSignature size={18} />}
          Submeter pedido de contrato
        </button>
        <p style={{ fontSize: 11, color: T.muted, textAlign: 'center', lineHeight: 1.6 }}>
          A AgriLink cruza o seu pedido com produtores disponíveis. Só depois de encontrada uma correspondência
          receberá a notificação para aceitar o contrato digital de futuros.
        </p>
      </form>
    </div>
  )
}

export default CriarContratoFuturos
