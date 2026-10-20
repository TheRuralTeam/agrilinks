import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ShoppingBag, CreditCard, Clock3, CheckCircle2, AlertCircle, MapPin, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../integrations/supabase/client'
import { toast } from '../hooks/use-toast'
import {
  getMarketplaceCheckoutSummary,
  getMarketplacePaymentRecipients,
  createAuthorizedRecipientPaymentIntent,
  submitAuthorizedRecipientPaymentProof,
  type MarketplaceCheckoutSummary,
  type AuthorizedPaymentRecipient,
} from '../features/marketplace/marketplaceCheckoutService'

type Purchase = {
  id: string
  product_id: string
  cart_order_id: string | null
  requested_delivery_date: string | null
  quantity: number
  location: string | null
  status: string
  payment_status: string | null
  total_price: number | null
  created_at: string
  product_name: string
}
type CheckoutState = {
  summary: MarketplaceCheckoutSummary | null
  recipients: AuthorizedPaymentRecipient[]
  loading: boolean
  error: string | null
}
type PaymentDraft = { intentId: string; recipientName: string; accountIdentifier: string; channel: string; accountHolder: string; instructions: string | null }

const money = (amount: number, currency = 'AOA') =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)

const purchaseStatus = (status: string) => ({
  pending: 'A aguardar resposta do fornecedor',
  aguardando: 'A aguardar resposta do fornecedor',
  accepted: 'Aceite — pagamento pendente',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  completed: 'Concluída',
  delivered: 'Entregue',
  processing: 'Em preparação',
  shipped: 'Em transporte',
}[status] || status)

const paymentStatus = (status: string | null) => ({
  unpaid: 'Pagamento por iniciar',
  pending: 'Pagamento em validação',
  paid: 'Pago',
  failed: 'Pagamento não concluído',
  refunded: 'Reembolsado',
}[status || 'unpaid'] || status || 'Não iniciado')

export default function MyPurchases() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [checkout, setCheckout] = useState<Record<string, CheckoutState>>({})
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, string>>({})
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({})
  const [proofReferences, setProofReferences] = useState<Record<string, string>>({})
  const [proofNotes, setProofNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadPurchases = useCallback(async (quiet = false) => {
    if (!user?.id) {
      setPurchases([])
      setLoading(false)
      return
    }
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('pre_orders')
        .select('id,product_id,cart_order_id,requested_delivery_date,quantity,location,status,payment_status,total_price,created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as Purchase[]
      const productIds: string[] = [...new Set<string>(rows.map((row) => String(row.product_id)).filter(Boolean))]
      let productNames: Record<string, string> = {}
      if (productIds.length) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id,product_type')
          .in('id', productIds)
        if (productsError) throw productsError
        productNames = Object.fromEntries((products ?? []).map((product) => [product.id, product.product_type || 'Produto']))
      }
      setPurchases(rows.map((row) => ({ ...row, product_name: productNames[row.product_id] || 'Produto' })) as Purchase[])
    } catch (error: any) {
      toast({ title: 'Não foi possível carregar as compras', description: error?.message || 'Tenta novamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => { void loadPurchases() }, [loadPurchases])

  const openPaymentOptions = async (purchase: Purchase) => {
    setCheckout((current) => ({ ...current, [purchase.id]: { summary: null, recipients: [], loading: true, error: null } }))
    try {
      const [summary, recipients] = await Promise.all([
        getMarketplaceCheckoutSummary(purchase.id),
        getMarketplacePaymentRecipients(purchase.id),
      ])
      setCheckout((current) => ({
        ...current,
        [purchase.id]: {
          summary,
          recipients: recipients ?? [],
          loading: false,
          error: null,
        },
      }))
      if (!recipients?.length || !summary?.payment_ready) {
        toast({
          title: 'Pagamento ainda não disponível',
          description: summary?.reason || 'A AgriLink ainda não tem instruções de pagamento activas para esta compra.',
        })
      }
    } catch (error: any) {
      setCheckout((current) => ({ ...current, [purchase.id]: { summary: null, recipients: [], loading: false, error: error?.message || 'Não foi possível consultar o pagamento.' } }))
      toast({ title: 'Pagamento indisponível', description: error?.message || 'Não foi possível consultar as opções de pagamento.', variant: 'destructive' })
    }
  }

  const createPayment = async (purchase: Purchase) => {
    const state = checkout[purchase.id]
    const recipientId = selectedRecipients[purchase.id]
    if (!recipientId || !state?.summary?.payment_ready) return
    setBusyId(purchase.id)
    try {
      const intent = await createAuthorizedRecipientPaymentIntent(purchase.id, recipientId)
      const recipient = state.recipients.find((item) => item.id === recipientId)
      setPaymentDrafts((current) => ({
        ...current,
        [purchase.id]: {
          intentId: intent.intent_id,
          recipientName: intent.recipient_name,
          accountIdentifier: intent.account_identifier,
          channel: recipient?.channel || 'Canal autorizado',
          accountHolder: recipient?.account_holder || intent.recipient_name,
          instructions: recipient?.instructions || null,
        },
      }))
      toast({ title: 'Instruções de pagamento preparadas', description: 'Usa os dados apresentados e comunica a transferência quando terminares.' })
      await loadPurchases(true)
    } catch (error: any) {
      toast({ title: 'Não foi possível preparar o pagamento', description: error?.message || 'Verifica se a compra continua elegível.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  const submitProof = async (purchaseId: string) => {
    const draft = paymentDrafts[purchaseId]
    const reference = proofReferences[purchaseId]?.trim()
    if (!draft || !reference) {
      toast({ title: 'Falta a referência', description: 'Introduz a referência real da transferência para comunicar o pagamento.', variant: 'destructive' })
      return
    }
    setBusyId(purchaseId)
    try {
      await submitAuthorizedRecipientPaymentProof(draft.intentId, reference, proofNotes[purchaseId]?.trim() || undefined)
      toast({ title: 'Pagamento comunicado', description: 'A operação foi enviada para validação. O estado será actualizado após confirmação.' })
      setPaymentDrafts((current) => {
        const next = { ...current }
        delete next[purchaseId]
        return next
      })
      await loadPurchases(true)
    } catch (error: any) {
      toast({ title: 'Não foi possível comunicar o pagamento', description: error?.message || 'Confirma a referência e tenta novamente.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">A carregar as tuas compras…</div>

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/perfil')} className="mb-2 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao perfil
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">AgriLink · Área do comprador</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">As minhas compras</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Consulta as pré-compras, acompanha a confirmação do fornecedor e vê as instruções de pagamento disponíveis para cada compra.</p>
        </div>
        <Button variant="outline" onClick={() => void loadPurchases(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><ShoppingBag className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{purchases.length}</p><p className="text-xs text-muted-foreground">Compras no histórico</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{purchases.filter((p) => p.status === 'accepted' && p.payment_status !== 'paid').length}</p><p className="text-xs text-muted-foreground">A aguardar pagamento</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{purchases.filter((p) => p.payment_status === 'paid' || p.status === 'completed').length}</p><p className="text-xs text-muted-foreground">Pagas ou concluídas</p></div></CardContent></Card>
      </div>

      {purchases.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center"><ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">Ainda não tens compras</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Quando enviares uma pré-compra no marketplace, ela aparecerá aqui para acompanhares a resposta do fornecedor e o pagamento.</p><Button className="mt-4" onClick={() => navigate('/app')}>Explorar marketplace</Button></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => {
            const state = checkout[purchase.id]
            const draft = paymentDrafts[purchase.id]
            const canStartPayment = purchase.status === 'accepted' && (purchase.payment_status === 'unpaid' || !purchase.payment_status)
            return (
              <Card key={purchase.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><CardTitle className="text-base">{purchase.product_name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Compra #{purchase.id.slice(0, 8)} · {new Date(purchase.created_at).toLocaleDateString('pt-AO')}</p>{purchase.cart_order_id && <p className="mt-1 text-xs font-medium text-primary">Encomenda agrupada #{purchase.cart_order_id.slice(0, 8)}</p>}{purchase.requested_delivery_date && <p className="mt-1 text-xs text-muted-foreground">Entrega solicitada: {new Date(`${purchase.requested_delivery_date}T12:00:00`).toLocaleDateString('pt-AO')}</p>}</div>
                    <div className="flex flex-wrap gap-2"><Badge variant={purchase.status === 'accepted' ? 'default' : 'outline'}>{purchaseStatus(purchase.status)}</Badge><Badge variant={purchase.payment_status === 'paid' ? 'default' : 'secondary'}>{paymentStatus(purchase.payment_status)}</Badge></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-semibold">{Number(purchase.quantity).toLocaleString('pt-AO')} unidades de venda</p></div>
                    <div><p className="text-xs text-muted-foreground">Total registado</p><p className="font-semibold">{money(Number(purchase.total_price || 0))}</p></div>
                    <div><p className="text-xs text-muted-foreground">Local de entrega</p><p className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5 shrink-0" />{purchase.location || 'A combinar'}</p></div>
                  </div>

                  {canStartPayment && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Próximo passo: confirmar o pagamento</p><p className="mt-1 text-sm text-muted-foreground">As instruções são mostradas apenas quando existe um destinatário de pagamento autorizado e o checkout confirma que esta compra está pronta.</p></div></div>
                      <Button className="mt-3" onClick={() => void openPaymentOptions(purchase)} disabled={state?.loading || busyId === purchase.id}><CreditCard className="mr-2 h-4 w-4" />{state?.loading ? 'A consultar…' : 'Consultar opções de pagamento'}</Button>
                      {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
                      {state?.summary && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Produtos</p><p className="font-semibold">{money(Number(state.summary.product_total || 0), state.summary.currency || 'AOA')}</p></div>
                            <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Transporte</p><p className="font-semibold">{money(Number(state.summary.freight_total || 0), state.summary.currency || 'AOA')}</p></div>
                            <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Total do checkout</p><p className="font-semibold">{money(Number(state.summary.total || 0), state.summary.currency || 'AOA')}</p></div>
                          </div>
                          {!state.summary.payment_ready && <p className="rounded-md border p-3 text-sm text-muted-foreground">{state.summary.reason || 'O checkout ainda não está pronto. Aguarda a confirmação das condições de pagamento e/ou transporte.'}</p>}
                          {state.summary.payment_ready && state.recipients.length === 0 && <p className="rounded-md border p-3 text-sm text-muted-foreground">O checkout está calculado, mas não há destinatários autorizados disponíveis. Não transfiras dinheiro para dados recebidos fora da AgriLink.</p>}
                          {state.summary.payment_ready && state.recipients.length > 0 && (
                            <div className="space-y-3 rounded-md border bg-background p-3">
                              <Label>Escolhe o método e destinatário autorizado</Label>
                              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRecipients[purchase.id] || ''} onChange={(event) => setSelectedRecipients((current) => ({ ...current, [purchase.id]: event.target.value }))}>
                                <option value="">Seleccionar opção</option>
                                {state.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.display_name} · {recipient.channel.replace(/_/g, ' ')}</option>)}
                              </select>
                              <Button onClick={() => void createPayment(purchase)} disabled={!selectedRecipients[purchase.id] || busyId === purchase.id || Boolean(paymentDrafts[purchase.id])}>{busyId === purchase.id ? 'A preparar…' : paymentDrafts[purchase.id] ? 'Instruções já geradas' : 'Gerar instruções seguras'}</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {draft && (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div><p className="font-semibold">Instruções de pagamento</p><p className="text-sm text-muted-foreground">Método: {draft.channel.replace(/_/g, ' ')}</p><p className="mt-1 text-sm">Destinatário: <strong>{draft.recipientName}</strong></p><p className="text-sm">Titular: <strong>{draft.accountHolder}</strong></p><p className="mt-1 break-all font-mono text-sm">{draft.accountIdentifier}</p>{draft.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{draft.instructions}</p>}</div>
                      <p className="text-sm text-muted-foreground">Confirma o nome e os dados no canal de pagamento escolhido. Depois da transferência, regista a referência abaixo. A compra só será marcada como paga após validação.</p>
                      <div><Label>Referência real da transferência</Label><Input value={proofReferences[purchase.id] || ''} onChange={(event) => setProofReferences((current) => ({ ...current, [purchase.id]: event.target.value }))} placeholder="Referência / comprovativo da operação" /></div>
                      <div><Label>Nota opcional</Label><Textarea value={proofNotes[purchase.id] || ''} onChange={(event) => setProofNotes((current) => ({ ...current, [purchase.id]: event.target.value }))} placeholder="Informação adicional para a validação" rows={2} /></div>
                      <Button onClick={() => void submitProof(purchase.id)} disabled={!proofReferences[purchase.id]?.trim() || busyId === purchase.id}>{busyId === purchase.id ? 'A enviar…' : 'Comunicar pagamento'}</Button>
                    </div>
                  )}

                  {purchase.status === 'accepted' && purchase.payment_status === 'pending' && !draft && <p className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />Existe um pagamento pendente de confirmação. Não inicies outra transferência; consulta o estado novamente mais tarde ou contacta o suporte AgriLink.</p>}
                  {purchase.status === 'accepted' && purchase.payment_status === 'processing' && !draft && <p className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />O pagamento foi comunicado e está em validação pela AgriLink.</p>}
                  {purchase.status !== 'accepted' && purchase.payment_status !== 'paid' && (
                    <p className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />{purchase.status === 'pending' || purchase.status === 'aguardando' ? 'O fornecedor ainda não aceitou a pré-compra. Não é necessário pagar nesta fase.' : 'Consulta o estado acima. Não efectues pagamentos adicionais sem instruções oficiais na plataforma.'}</p>
                  )}
                  {purchase.payment_status === 'paid' && <p className="flex items-center gap-2 rounded-md border border-emerald-200 p-3 text-sm"><CheckCircle2 className="h-4 w-4" />Pagamento confirmado pela AgriLink.</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
