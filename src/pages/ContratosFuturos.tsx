import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSignature, ShieldCheck, Plus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { useCanAct } from '../hooks/useCanAct'
import { T, FONT } from '../lib/brand'
import Loader from '../components/ui/Loader'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog'

type Contract = any

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending_match:  { label: 'Pendente',   bg: T.goldPale, color: T.gold },
  no_match:       { label: 'Em procura', bg: T.canvas,   color: T.muted },
  matched:        { label: 'Produtor encontrado', bg: T.g50, color: T.green },
  buyer_accepted: { label: 'Aceite pelo comprador', bg: T.g50, color: T.green },
  confirmed:      { label: 'Confirmado', bg: T.g100, color: T.green },
  fulfilled:      { label: 'Cumprido',   bg: T.g100, color: T.green },
  breached:       { label: 'Incumprido', bg: '#FDECEC', color: '#B23A3A' },
  cancelled:      { label: 'Cancelado',  bg: T.canvas,  color: T.muted },
}

const money = (v: number) => `${Number(v || 0).toLocaleString('pt-AO')} Kz`

const ContratosFuturos = () => {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const { requireAct } = useCanAct()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Contract | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState('')
  const [saving, setSaving] = useState(false)

  const isBuyer = userProfile?.user_type === 'comprador'

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('futures_contracts')
      .select('*')
      .or(`buyer_id.eq.${user.id},producer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    setContracts(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openTerms = (c: Contract) => {
    setActive(c); setAccepted(false); setSignature(userProfile?.full_name || '')
  }

  const acceptContract = async () => {
    if (!active) return
    if (!requireAct('aceitar o contrato')) return
    if (!accepted || signature.trim().length < 3) {
      toast.error('Confirme a leitura dos termos e assine com o seu nome completo.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('futures_contracts').update({
        status: 'buyer_accepted',
        terms_accepted_at: new Date().toISOString(),
        buyer_signature_name: signature.trim(),
      }).eq('id', active.id)
      if (error) throw error

      if (active.producer_id) {
        await supabase.rpc('create_notification', {
          p_user_id: active.producer_id,
          p_type: 'contract',
          p_title: 'Contrato de Futuros aceite pelo comprador',
          p_message: `O comprador aceitou o contrato de ${active.quantity} ${active.unit} de ${active.product_name}. Confirme para o tornar vinculativo.`,
          p_metadata: { contract_id: active.id },
        })
      }
      await supabase.rpc('create_admin_notifications', {
        p_type: 'contract',
        p_title: 'Contrato de Futuros aceite',
        p_message: `Contrato de ${active.product_name} aceite pelo comprador. Aguarda confirmação do produtor.`,
        p_metadata: { contract_id: active.id },
      })

      toast.success('Contrato digital aceite com sucesso.')
      setActive(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível aceitar o contrato.')
    } finally {
      setSaving(false)
    }
  }

  const producerConfirm = async (c: Contract) => {
    if (!requireAct('confirmar o contrato')) return
    const { error } = await supabase.from('futures_contracts').update({
      status: 'confirmed',
      producer_confirmed_at: new Date().toISOString(),
    }).eq('id', c.id)
    if (error) return toast.error(error.message)
    await supabase.rpc('create_notification', {
      p_user_id: c.buyer_id,
      p_type: 'contract',
      p_title: 'Contrato de Futuros confirmado',
      p_message: `O produtor confirmou o contrato de ${c.product_name}. O contrato está agora activo.`,
      p_metadata: { contract_id: c.id },
    })
    toast.success('Contrato confirmado.')
    load()
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
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: 0 }}>Contratos de Futuros</h1>
          <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Compromissos de compra e venda intermediados pela AgriLink</p>
        </div>
        {isBuyer && (
          <button onClick={() => navigate('/contratos-futuros/novo')} style={{
            height: 38, padding: '0 14px', borderRadius: 10, border: 'none',
            background: T.green, color: T.white, fontWeight: 700, fontSize: 12,
            fontFamily: FONT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={15} /> Novo
          </button>
        )}
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>
            <Loader compact label="A carregar contratos" />
          </div>
        ) : contracts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: T.muted, background: T.white, borderRadius: 16, border: `1px solid ${T.rule}` }}>
            <FileSignature size={30} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ fontSize: 13, margin: 0 }}>Ainda não existem contratos de futuros.</p>
          </div>
        ) : contracts.map(c => {
          const st = STATUS[c.status] || STATUS.pending_match
          const amIBuyer = c.buyer_id === user?.id
          return (
            <div key={c.id} style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>{c.product_name}</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                    {c.quantity} {c.unit} · entrega até {new Date(c.delivery_date).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color,
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>{st.label}</span>
              </div>

              <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: T.faint, fontWeight: 700, textTransform: 'uppercase' }}>Valor</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.green }}>{money(c.agreed_price ?? c.proposed_price)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.faint, fontWeight: 700, textTransform: 'uppercase' }}>Papel</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{amIBuyer ? 'Comprador' : 'Produtor'}</div>
                </div>
                {c.province_id && (
                  <div>
                    <div style={{ fontSize: 10, color: T.faint, fontWeight: 700, textTransform: 'uppercase' }}>Local</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{c.province_id}</div>
                  </div>
                )}
              </div>

              {c.match_notes && (
                <p style={{ fontSize: 12, color: T.mid, marginTop: 10, background: T.g50, padding: 10, borderRadius: 10 }}>
                  {c.match_notes}
                </p>
              )}

              {amIBuyer && c.status === 'matched' && (
                <button onClick={() => openTerms(c)} style={{
                  marginTop: 12, width: '100%', height: 44, borderRadius: 12, border: 'none',
                  background: T.green, color: T.white, fontWeight: 800, fontSize: 13, fontFamily: FONT,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <ShieldCheck size={17} /> Aceitar Contrato Digital de Futuros
                </button>
              )}

              {!amIBuyer && c.status === 'buyer_accepted' && (
                <button onClick={() => producerConfirm(c)} style={{
                  marginTop: 12, width: '100%', height: 44, borderRadius: 12, border: 'none',
                  background: T.green, color: T.white, fontWeight: 800, fontSize: 13, fontFamily: FONT,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <CheckCircle2 size={17} /> Confirmar contrato
                </button>
              )}

              {c.terms_accepted_at && (
                <p style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
                  Assinado digitalmente por {c.buyer_signature_name} em {new Date(c.terms_accepted_at).toLocaleString('pt-PT')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent style={{ fontFamily: FONT, maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: T.ink }}>
              Termos e Condições — Contrato Digital de Futuros
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div style={{ maxHeight: '55vh', overflowY: 'auto', fontSize: 13, color: T.mid, lineHeight: 1.7 }}>
              <p style={{ fontWeight: 700, color: T.ink }}>a) Produto, quantidade e especificações</p>
              <p>{active.product_name} — {active.quantity} {active.unit}. {active.quality_specs || 'Sem especificações adicionais.'} {active.packaging ? `Embalagem: ${active.packaging}.` : ''} {active.transport ? `Transporte: ${active.transport}.` : ''}</p>

              <p style={{ fontWeight: 700, color: T.ink }}>b) Preço acordado e forma de pagamento</p>
              <p>Valor total de {money(active.agreed_price ?? active.proposed_price)}, liquidado através da carteira AgriLink. O montante é bloqueado na aceitação e libertado ao produtor após confirmação da entrega.</p>

              <p style={{ fontWeight: 700, color: T.ink }}>c) Prazo de entrega/recepção</p>
              <p>A entrega deve ocorrer até {new Date(active.delivery_date).toLocaleDateString('pt-PT')} no local indicado: {active.delivery_location || active.municipality_id || active.province_id || 'a combinar'}.</p>

              <p style={{ fontWeight: 700, color: T.ink }}>d) Compromisso de pagamento</p>
              <p>Ao aceitar, o comprador assume o compromisso firme e irrevogável de pagar o valor acordado, desde que o produto entregue cumpra as especificações acima.</p>

              <p style={{ fontWeight: 700, color: T.ink }}>e) Penalizações por incumprimento</p>
              <p>O incumprimento por qualquer das partes (não entrega, entrega fora de especificação ou não pagamento) implica uma penalização de {active.penalty_percentage}% do valor do contrato a favor da parte lesada, sem prejuízo de outras responsabilidades legais aplicáveis.</p>

              <p style={{ fontWeight: 700, color: T.ink }}>f) Papel da AgriLink</p>
              <p>A AgriLink actua como intermediária e garante do contrato: valida as partes, retém o pagamento em custódia, regista o contrato digital e acompanha o cumprimento, podendo mediar litígios.</p>

              <p style={{ fontSize: 11, color: T.muted, background: T.canvas, padding: 10, borderRadius: 8 }}>
                Nota: este texto contratual deve ser revisto por assessoria jurídica antes de utilização em produção,
                por envolver compromissos financeiros reais entre as partes.
              </p>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ marginTop: 3 }} />
                <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
                  Li e aceito integralmente os termos e condições deste contrato digital de futuros.
                </span>
              </label>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.mid, display: 'block', marginBottom: 6 }}>Assinatura digital (nome completo)</label>
                <input value={signature} onChange={e => setSignature(e.target.value)} style={{
                  width: '100%', height: 42, borderRadius: 10, border: `1px solid ${T.rule}`,
                  padding: '0 12px', fontFamily: FONT, fontSize: 14, color: T.ink, outline: 'none',
                }} />
              </div>
            </div>
          )}

          <DialogFooter>
            <button onClick={() => setActive(null)} style={{
              height: 42, padding: '0 16px', borderRadius: 10, background: T.white,
              border: `1px solid ${T.rule}`, color: T.mid, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={acceptContract} disabled={saving || !accepted} style={{
              height: 42, padding: '0 18px', borderRadius: 10, border: 'none',
              background: T.green, color: T.white, fontWeight: 800, fontFamily: FONT,
              cursor: accepted && !saving ? 'pointer' : 'default', opacity: accepted && !saving ? 1 : 0.6,
            }}>
              {saving ? 'A processar...' : 'Confirmar e assinar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ContratosFuturos
