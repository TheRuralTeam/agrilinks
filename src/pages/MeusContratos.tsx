import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileSignature, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { useGuestGate } from '../contexts/GuestGateContext'
import { generateContractPdf } from '../lib/contractPdf'
import { T, FONT } from '../lib/brand'

interface Contract {
  id: string
  source_type: string
  product_name: string
  quantity: number | null
  unit: string | null
  price: number | null
  currency: string | null
  delivery_terms: string | null
  conditions: string | null
  status: string
  buyer_id: string | null
  supplier_id: string | null
  driver_id: string | null
  agent_id: string | null
  approved_at: string | null
  created_at: string
}

const STATUS: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  pending_admin: { label: 'Aguarda aprovação do Admin', color: '#B07D0A', bg: '#FBF3E4', Icon: Clock },
  approved: { label: 'Aprovado — disponível', color: T.green, bg: T.g50, Icon: CheckCircle2 },
  rejected: { label: 'Rejeitado', color: '#8B2E2E', bg: '#FBECEC', Icon: XCircle },
}

const MeusContratos = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isGuest } = useGuestGate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return }
      const { data } = await (supabase.from('digital_contracts' as any) as any)
        .select('*')
        .order('created_at', { ascending: false })
      const list = (data || []) as Contract[]
      setContracts(list)

      const ids = Array.from(new Set(list.flatMap(c => [c.buyer_id, c.supplier_id, c.driver_id, c.agent_id]).filter(Boolean))) as string[]
      if (ids.length) {
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', ids)
        setNames(Object.fromEntries((users || []).map(u => [u.id, u.full_name])))
      }
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 140 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20, background: T.white,
        borderBottom: `1px solid ${T.rule}`, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mid, display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: T.ink, margin: 0 }}>Meus contratos</h1>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '22px 18px' }}>
        {isGuest ? (
          <EmptyState
            title="Modo de teste"
            text="Os contratos digitais só existem para contas reais. Cria a tua conta para pedir e descarregar contratos."
          />
        ) : loading ? (
          <p style={{ color: T.muted, fontSize: 14 }}>A carregar…</p>
        ) : contracts.length === 0 ? (
          <EmptyState
            title="Ainda sem contratos"
            text="Pede a geração de um contrato digital a partir de uma ficha de recebimento ou de um produto publicado."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contracts.map(c => {
              const st = STATUS[c.status] || STATUS.pending_admin
              return (
                <div key={c.id} style={{
                  background: T.white, border: `1px solid ${T.rule}`, borderRadius: 16,
                  padding: 16, boxShadow: `0 1px 4px ${T.shadow}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, background: T.g50, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FileSignature size={18} color={T.green} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{c.product_name}</div>
                      <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>
                        {c.quantity ? `${c.quantity} ${c.unit || 'kg'}` : 'Quantidade a definir'}
                        {c.price ? ` · ${Number(c.price).toLocaleString('pt-PT')} ${c.currency || 'Kz'}` : ''}
                      </div>
                      <div style={{
                        marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color,
                        fontSize: 11.5, fontWeight: 700,
                      }}>
                        <st.Icon size={13} /> {st.label}
                      </div>
                    </div>
                  </div>

                  {c.status === 'approved' && (
                    <button
                      onClick={() => generateContractPdf({
                        ...c,
                        buyer_name: c.buyer_id ? names[c.buyer_id] : null,
                        supplier_name: c.supplier_id ? names[c.supplier_id] : null,
                        driver_name: c.driver_id ? names[c.driver_id] : null,
                        agent_name: c.agent_id ? names[c.agent_id] : null,
                      })}
                      style={{
                        marginTop: 14, width: '100%', padding: '11px 16px', borderRadius: 12,
                        border: 'none', background: T.green, color: T.white,
                        fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <Download size={16} /> Descarregar contrato (PDF)
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

const EmptyState = ({ title, text }: { title: string; text: string }) => (
  <div style={{
    background: T.white, border: `1px dashed ${T.gBorder}`, borderRadius: 18,
    padding: '38px 22px', textAlign: 'center',
  }}>
    <FileSignature size={26} color={T.green} />
    <h2 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: T.ink, margin: '12px 0 6px' }}>{title}</h2>
    <p style={{ fontSize: 13.5, color: T.muted, margin: 0, lineHeight: 1.55 }}>{text}</p>
  </div>
)

export default MeusContratos
