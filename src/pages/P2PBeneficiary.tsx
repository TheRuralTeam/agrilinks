import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ShieldCheck, AlertTriangle, ArrowRight, WalletCards } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import { Checkbox } from '../components/ui/checkbox'
import { toast } from '../hooks/use-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  acceptP2PMatch,
  confirmP2PPaymentReceived,
  adminCompleteP2POrder,
  createP2POrder,
  fetchP2PPaymentAccount,
  setP2PBeneficiaryAvailability,
  fetchMyP2PAccounts,
  fetchMyP2PApplication,
  fetchMyP2PBeneficiary,
  fetchMyP2PMatches,
  fetchMyP2POrders,
  openP2PDispute,
  submitP2PPaymentProof,
  submitP2PBeneficiaryApplication,
  type P2PPaymentChannel,
  type P2PApplication,
  type P2PBeneficiary,
  type P2PAccount,
  type P2PMatch,
  type P2POrder,
} from '../features/p2p/p2pService'
import { supabase } from '../integrations/supabase/client'
import { downloadP2PTransactionReceipt, fetchP2PTransactionHistory, type P2PHistoryEvent } from '../features/p2p/p2pReceipts'
import { downloadMarketplaceTransactionReceipt } from '../features/orders/transactionReceipts'

const channels: { id: P2PPaymentChannel; label: string }[] = [
  { id: 'unitel_money', label: 'UNITEL Money' },
  { id: 'multicaixa_express', label: 'Multicaixa Express' },
  { id: 'bank_transfer', label: 'Transferência bancária' },
  { id: 'afrimoney', label: 'Afrimoney' },
  { id: 'paypay', label: 'PayPay' },
]

const statusLabel: Record<string, string> = {
  pending: 'Em análise',
  under_review: 'Em revisão',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  suspended: 'Suspensa',
  active: 'Activo',
  paused: 'Pausado',
  revoked: 'Revogado',
  matching: 'À procura de beneficiário',
  offered: 'Oferta disponível',
  payment_pending: 'A aguardar pagamento',
  payment_submitted: 'Pagamento comunicado',
  payment_detected: 'Pagamento recebido',
  under_review: 'Em revisão',
  completed: 'Concluída',
  disputed: 'Em disputa',
  expired: 'Expirada',
}

const money = (value: number, currency = 'AOA') =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

export default function P2PBeneficiaryPage() {
  const { user, isAdmin, isRootAdmin } = useAuth()
  const canReview = Boolean(isAdmin || isRootAdmin)
  const [application, setApplication] = useState<P2PApplication | null>(null)
  const [beneficiary, setBeneficiary] = useState<P2PBeneficiary | null>(null)
  const [accounts, setAccounts] = useState<P2PAccount[]>([])
  const [matches, setMatches] = useState<P2PMatch[]>([])
  const [orders, setOrders] = useState<P2POrder[]>([])
  const [adminApplications, setAdminApplications] = useState<P2PApplication[]>([])
  const [adminReviewOrders, setAdminReviewOrders] = useState<P2POrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [legalName, setLegalName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedChannels, setSelectedChannels] = useState<P2PPaymentChannel[]>(['unitel_money'])
  const [buyerPreOrders, setBuyerPreOrders] = useState<Array<{ id: string; total_price: number | null; product_id: string; status: string; payment_status: string | null }>>([])
  const [paymentChannel, setPaymentChannel] = useState<P2PPaymentChannel>('unitel_money')
  const [paymentAccount, setPaymentAccount] = useState<P2PAccount | null>(null)
  const [buyerP2POrders, setBuyerP2POrders] = useState<P2POrder[]>([])
  const [buyerProofOrderId, setBuyerProofOrderId] = useState<string | null>(null)
  const [buyerProofReference, setBuyerProofReference] = useState('')
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null)
  const [historyEvents, setHistoryEvents] = useState<P2PHistoryEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [app, ben] = await Promise.all([fetchMyP2PApplication(), fetchMyP2PBeneficiary()])
      setApplication(app)
      setBeneficiary(ben)
      const { data: preOrders, error: preOrderError } = await supabase.from('pre_orders').select('id,total_price,product_id,status,payment_status').eq('user_id', user?.id).eq('status', 'accepted').eq('payment_status', 'unpaid').is('deleted_at', null).order('created_at', { ascending: false }).limit(20)
      if (preOrderError) throw preOrderError
      setBuyerPreOrders((preOrders ?? []) as typeof buyerPreOrders)
      setBuyerP2POrders(await fetchMyP2POrders())
      if (ben) {
        const [acc, m, o] = await Promise.all([
          fetchMyP2PAccounts(ben.id),
          fetchMyP2PMatches(ben.id),
          fetchMyP2POrders(ben.id),
        ])
        setAccounts(acc)
        setMatches(m)
        setOrders(o)
      } else {
        setAccounts([])
        setMatches([])
        setOrders([])
      }
      if (canReview) {
        const { data, error } = await supabase
          .from('p2p_beneficiary_applications')
          .select('id,user_id,status,legal_name,phone,requested_channels,notes,rejection_reason,created_at,reviewed_at')
          .in('status', ['pending', 'under_review'])
          .order('created_at', { ascending: true })
        if (error) throw error
        setAdminApplications((data ?? []) as P2PApplication[])
        const { data: reviewOrders, error: reviewError } = await supabase.from('p2p_orders').select('*').in('status', ['payment_detected','under_review','disputed']).order('created_at', { ascending: true })
        if (reviewError) throw reviewError
        setAdminReviewOrders((reviewOrders ?? []) as P2POrder[])
      }
    } catch (error: any) {
      toast({ title: 'P2P', description: error?.message ?? 'Não foi possível carregar o módulo.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void refresh()
  }, [user, canReview])

  const activeOrders = useMemo(
    () => orders.filter((order) => !['completed', 'cancelled', 'expired', 'rejected', 'refunded'].includes(order.status)),
    [orders],
  )

  const toggleChannel = (channel: P2PPaymentChannel) => {
    setSelectedChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    )
  }

  const submitApplication = async () => {
    if (!legalName.trim() || selectedChannels.length === 0) return
    setBusy('application')
    try {
      await submitP2PBeneficiaryApplication({ legalName, phone, channels: selectedChannels, notes })
      toast({ title: 'Candidatura enviada', description: 'A equipa AgriLink irá verificar os dados antes da aprovação.' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Não foi possível enviar', description: error?.message ?? 'Verifique os dados e tente novamente.', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const setAvailability = async (status: 'online' | 'busy' | 'offline') => {
    setBusy('availability')
    try {
      await setP2PBeneficiaryAvailability(status)
      toast({ title: 'Disponibilidade actualizada' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Não foi possível actualizar', description: error?.message ?? 'Tente novamente.', variant: 'destructive' })
    } finally { setBusy(null) }
  }

  const startBuyerPayment = async (preOrderId: string) => {
    setBusy(preOrderId)
    try {
      const orderId = await createP2POrder(preOrderId, paymentChannel)
      toast({ title: 'Pagamento P2P criado', description: `Operação ${orderId.slice(0, 8)} criada. A AgriLink está a procurar um beneficiário.` })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Não foi possível iniciar', description: error?.message ?? 'A pré-compra ainda não está pronta para pagamento.', variant: 'destructive' })
    } finally { setBusy(null) }
  }

  const loadPaymentAccount = async (accountId: string) => {
    try { setPaymentAccount(await fetchP2PPaymentAccount(accountId)) }
    catch (error: any) { toast({ title: 'Dados de pagamento', description: error?.message ?? 'Não foi possível carregar os dados.', variant: 'destructive' }) }
  }

  const submitBuyerProof = async () => {
    if (!buyerProofOrderId || !buyerProofReference.trim()) return
    setBusy(buyerProofOrderId)
    try {
      await submitP2PPaymentProof(buyerProofOrderId, buyerProofReference)
      setBuyerProofOrderId(null)
      setBuyerProofReference('')
      toast({ title: 'Pagamento comunicado', description: 'A operação foi encaminhada para confirmação do beneficiário.' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Não foi possível comunicar o pagamento', description: error?.message ?? 'Tente novamente.', variant: 'destructive' })
    } finally { setBusy(null) }
  }

  const acceptMatch = async (matchId: string) => {
    setBusy(matchId)
    try {
      await acceptP2PMatch(matchId)
      toast({ title: 'Transacção aceite', description: 'A operação foi reservada para si. Consulte os dados do pagamento.' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Oferta indisponível', description: error?.message ?? 'Outro beneficiário pode ter aceite esta operação.', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const confirmReceived = async (orderId: string) => {
    setBusy(orderId)
    try {
      await confirmP2PPaymentReceived(orderId)
      toast({ title: 'Recebimento registado', description: 'O pagamento foi marcado como recebido e segue para validação.' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Confirmação bloqueada', description: error?.message ?? 'A operação já não está disponível.', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const showHistory = async (orderId: string) => {
    if (historyOrderId === orderId) {
      setHistoryOrderId(null)
      setHistoryEvents([])
      return
    }
    setHistoryLoading(true)
    try {
      setHistoryEvents(await fetchP2PTransactionHistory(orderId))
      setHistoryOrderId(orderId)
    } catch (error: any) {
      toast({ title: 'Histórico indisponível', description: error?.message ?? 'Não foi possível carregar o histórico.', variant: 'destructive' })
    } finally {
      setHistoryLoading(false)
    }
  }

  const downloadCompleteReceipt = async (preOrderId: string) => {
    setBusy(`order-pdf:${preOrderId}`)
    try {
      await downloadMarketplaceTransactionReceipt(preOrderId)
      toast({ title: 'Comprovante completo gerado', description: 'O PDF inclui pagamento, pedido, logística e histórico disponível.' })
    } catch (error: any) {
      toast({ title: 'Comprovante completo indisponível', description: error?.message ?? 'Não foi possível gerar o documento.', variant: 'destructive' })
    } finally { setBusy(null) }
  }

  const downloadReceipt = async (orderId: string) => {
    setBusy(`pdf:${orderId}`)
    try {
      await downloadP2PTransactionReceipt(orderId)
      toast({ title: 'Comprovante gerado', description: 'O PDF foi preparado com o histórico da operação.' })
    } catch (error: any) {
      toast({ title: 'Comprovante indisponível', description: error?.message ?? 'Não foi possível gerar o PDF.', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const submitDispute = async () => {
    if (!disputeOrderId || !disputeReason.trim()) return
    setBusy(disputeOrderId)
    try {
      await openP2PDispute(disputeOrderId, disputeReason)
      setDisputeOrderId(null)
      setDisputeReason('')
      toast({ title: 'Disputa aberta', description: 'A operação foi encaminhada para análise da AgriLink.' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Não foi possível abrir a disputa', description: error?.message ?? 'Tente novamente.', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const completeAdminOrder = async (orderId: string) => {
    setBusy(orderId)
    try {
      await adminCompleteP2POrder(orderId)
      toast({ title: 'Pagamento validado', description: 'A operação P2P foi concluída e a pré-compra ficou marcada como paga.' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Validação falhou', description: error?.message ?? 'A operação não pode ser concluída neste estado.', variant: 'destructive' })
    } finally { setBusy(null) }
  }

  const reviewApplication = async (item: P2PApplication, decision: 'approved' | 'rejected') => {
    setBusy(item.id)
    try {
      const { error } = await supabase.rpc('admin_review_p2p_beneficiary_application', {
        p_application_id: item.id,
        p_decision: decision,
        p_reason: decision === 'rejected' ? 'Candidatura não aprovada nesta revisão.' : null,
        p_per_transaction: 0,
        p_daily: 0,
        p_monthly: 0,
        p_simultaneous: 3,
      })
      if (error) throw error
      toast({ title: decision === 'approved' ? 'Beneficiário aprovado' : 'Candidatura rejeitada' })
      await refresh()
    } catch (error: any) {
      toast({ title: 'Revisão falhou', description: error?.message ?? 'Sem autorização ou dados inválidos.', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">A carregar operação P2P…</div>

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header className="border-b pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">AgriLink · Pagamentos</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">P2P AgriLink</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Rede de beneficiários oficiais verificados pela AgriLink para intermediar pagamentos quando não existe um PSP activo.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Controlo AgriLink</Badge>
        </div>
      </header>

      {!beneficiary && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tornar-se beneficiário oficial</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {application ? (
              <div className="flex items-start gap-3 rounded-md border p-4">
                {application.status === 'rejected' ? <AlertTriangle className="mt-0.5 h-5 w-5" /> : <Clock3 className="mt-0.5 h-5 w-5" />}
                <div>
                  <p className="font-medium">{statusLabel[application.status] ?? application.status}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {application.status === 'rejected'
                      ? application.rejection_reason ?? 'A candidatura não foi aprovada.'
                      : 'A candidatura está sujeita a verificação e aprovação administrativa. Nenhum pagamento pode ser recebido enquanto não houver aprovação.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Nome completo / denominação</Label><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Nome oficial" /></div>
                  <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+244 ..." /></div>
                </div>
                <div>
                  <Label>Canais de pagamento aceites</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {channels.map((channel) => (
                      <label key={channel.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                        <Checkbox checked={selectedChannels.includes(channel.id)} onCheckedChange={() => toggleChannel(channel.id)} />
                        {channel.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações úteis para a equipa de verificação." /></div>
                <Button onClick={submitApplication} disabled={busy === 'application' || !legalName.trim() || selectedChannels.length === 0}>
                  {busy === 'application' ? 'A enviar…' : 'Enviar candidatura'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Pagar uma pré-compra via P2P</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Escolha o canal. A AgriLink só encaminha a operação para beneficiários previamente verificados e activos.</p>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm md:w-80" value={paymentChannel} onChange={(e) => setPaymentChannel(e.target.value as P2PPaymentChannel)}>
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}
          </select>
          {buyerPreOrders.length === 0 ? <p className="text-sm text-muted-foreground">Não existem pré-compras aceites e ainda não pagas.</p> : buyerPreOrders.map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
              <div><p className="font-medium">{money(Number(order.total_price ?? 0))}</p><p className="text-xs text-muted-foreground">Pré-compra #{order.id.slice(0,8)} · pronta para pagamento</p></div>
              <Button onClick={() => void startBuyerPayment(order.id)} disabled={busy === order.id}>Iniciar pagamento P2P</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {buyerP2POrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Minhas operações P2P</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {buyerP2POrders.map((order) => (
              <div key={order.id} className="rounded-md border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div><p className="font-medium">{money(order.amount, order.currency)}</p><p className="text-xs text-muted-foreground">#{order.id.slice(0,8)} · {statusLabel[order.status] ?? order.status}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{statusLabel[order.status] ?? order.status}</Badge>
                    <Button variant="outline" size="sm" onClick={() => void showHistory(order.id)} disabled={historyLoading && historyOrderId !== order.id}>
                      {historyOrderId === order.id ? 'Ocultar histórico' : 'Histórico'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void downloadReceipt(order.id)} disabled={busy === `pdf:${order.id}`}>
                      {busy === `pdf:${order.id}` ? 'A gerar…' : 'Comprovante P2P'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void downloadCompleteReceipt(order.pre_order_id)} disabled={busy === `order-pdf:${order.pre_order_id}`}>
                      {busy === `order-pdf:${order.pre_order_id}` ? 'A gerar…' : 'Comprovante completo'}
                    </Button>
                  </div>
                </div>
                {order.status === 'payment_pending' && order.beneficiary_account_id && (
                  <div className="mt-3 rounded-md border p-3 text-sm">
                    <p className="font-medium">Dados oficiais para esta operação</p>
                    {paymentAccount?.id === order.beneficiary_account_id ? <><p>{paymentAccount.account_holder}</p><p>{paymentAccount.account_identifier}</p><p className="text-muted-foreground">{paymentAccount.instructions ?? 'Utilize apenas estes dados para efectuar o pagamento.'}</p></> : <Button variant="outline" className="mt-2" onClick={() => void loadPaymentAccount(order.beneficiary_account_id!)}>Mostrar dados verificados</Button>}
                    {buyerProofOrderId === order.id ? <div className="mt-3 space-y-2"><Input value={buyerProofReference} onChange={(e)=>setBuyerProofReference(e.target.value)} placeholder="Referência da transferência" /><div className="flex gap-2"><Button onClick={submitBuyerProof} disabled={!buyerProofReference.trim() || busy===order.id}>Comunicar pagamento</Button><Button variant="outline" onClick={()=>setBuyerProofOrderId(null)}>Cancelar</Button></div></div> : <Button className="mt-3" onClick={()=>setBuyerProofOrderId(order.id)}>Já efectuei o pagamento</Button>}
                  </div>
                )}
              </div>
              {historyOrderId === order.id && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Histórico da operação</p>
                  <div className="space-y-2">
                    {historyEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ainda não existem eventos registados.</p>
                    ) : historyEvents.map((event) => (
                      <div key={event.event_id} className="flex flex-col gap-1 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium">{event.event_type}</p>
                          <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString('pt-AO')}</p>
                        </div>
                        <Badge variant="outline">{event.actor_role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            ))}
          </CardContent>
        </Card>
      )}

      {beneficiary && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Estado</p><p className="mt-1 font-semibold">{statusLabel[beneficiary.status] ?? beneficiary.status}</p><p className="mt-1 text-xs text-muted-foreground">{beneficiary.availability_status === 'online' ? 'Disponível para matching' : 'Não disponível para novas ofertas'}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Conclusão</p><p className="mt-1 text-2xl font-semibold">{beneficiary.completion_rate.toFixed(1)}%</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Operações concluídas</p><p className="mt-1 text-2xl font-semibold">{beneficiary.completed_count}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Limite / operação</p><p className="mt-1 text-lg font-semibold">{beneficiary.per_transaction_limit ? money(beneficiary.per_transaction_limit) : 'Definido pela AgriLink'}</p></CardContent></Card>
          </section>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="h-4 w-4" /> Ofertas disponíveis</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {matches.length === 0 ? <p className="text-sm text-muted-foreground">Não existem ofertas compatíveis neste momento.</p> : matches.map((match) => (
                <div key={match.id} className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
                  <div><p className="font-medium">Transacção #{match.p2p_order_id.slice(0, 8)}</p><p className="text-sm text-muted-foreground">Score de matching {match.score.toFixed(1)} · disponível desde {new Date(match.offered_at).toLocaleString('pt-AO')}</p></div>
                  <Button onClick={() => acceptMatch(match.id)} disabled={busy === match.id}>Aceitar operação</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Disponibilidade para matching</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(['online','busy','offline'] as const).map((status) => (
                <Button key={status} variant={beneficiary.availability_status === status ? 'default' : 'outline'} disabled={busy === 'availability'} onClick={() => setAvailability(status)}>
                  {status === 'online' ? 'Disponível' : status === 'busy' ? 'Ocupado' : 'Offline'}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Operações P2P</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {activeOrders.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não existem operações activas.</p> : activeOrders.map((order) => (
                <div key={order.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div><p className="font-medium">{money(order.amount, order.currency)}</p><p className="text-xs text-muted-foreground">#{order.id.slice(0, 8)} · {statusLabel[order.status] ?? order.status} · {order.payment_channel}</p></div>
                    <Badge variant="outline">{statusLabel[order.status] ?? order.status}</Badge>
                  </div>
                  {order.status === 'payment_pending' && <><p className="mt-3 text-sm text-muted-foreground">A aguardar que o comprador envie o pagamento para os dados verificados da operação.</p>{order.beneficiary_account_id && <Button variant="outline" className="mt-3" onClick={() => void loadPaymentAccount(order.beneficiary_account_id!)}>Ver dados do recebimento</Button>}{paymentAccount?.id === order.beneficiary_account_id && <div className="mt-3 rounded-md border p-3 text-sm"><p className="font-medium">{paymentAccount.account_holder}</p><p>{paymentAccount.account_identifier}</p><p className="text-muted-foreground">{paymentAccount.instructions ?? 'Utilize apenas os dados apresentados nesta operação.'}</p></div>}</>}
                  {order.status === 'payment_submitted' && <Button className="mt-3" onClick={() => confirmReceived(order.id)} disabled={busy === order.id}><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar recebimento</Button>}
                  {['payment_submitted','payment_detected'].includes(order.status) && <Button variant="outline" className="ml-2 mt-3" onClick={() => setDisputeOrderId(order.id)}>Abrir disputa</Button>}
                </div>
              ))}
            </CardContent>
          </Card>

          {accounts.length > 0 && <Card><CardHeader><CardTitle className="text-base">Meios de recebimento verificados</CardTitle></CardHeader><CardContent className="space-y-2">{accounts.map((account) => <div key={account.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><span>{channels.find((item) => item.id === account.channel)?.label ?? account.channel}</span><span className="text-muted-foreground">{account.account_holder} · {account.account_identifier}</span></div>)}</CardContent></Card>}
        </>
      )}

      {canReview && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revisão administrativa</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {adminApplications.length === 0 ? <p className="text-sm text-muted-foreground">Não existem candidaturas pendentes.</p> : adminApplications.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
                <div><p className="font-medium">{item.legal_name}</p><p className="text-xs text-muted-foreground">{item.phone ?? 'Sem telefone'} · {item.requested_channels.join(', ')}</p></div>
                <div className="flex gap-2"><Button onClick={() => reviewApplication(item,'approved')} disabled={busy===item.id}>Aprovar</Button><Button variant="outline" onClick={() => reviewApplication(item,'rejected')} disabled={busy===item.id}>Rejeitar</Button></div>
              </div>
            ))}          <div className="mt-6 border-t pt-5">
            <p className="mb-3 text-sm font-medium">Operações que aguardam validação</p>
            {adminReviewOrders.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma operação aguarda revisão.</p> : adminReviewOrders.map((order) => (
              <div key={order.id} className="mb-2 flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
                <div><p className="font-medium">{money(order.amount, order.currency)}</p><p className="text-xs text-muted-foreground">#{order.id.slice(0,8)} · {statusLabel[order.status] ?? order.status} · referência: {order.transfer_reference ?? 'não informada'}</p></div>
                {order.status !== 'disputed' && <Button onClick={() => void completeAdminOrder(order.id)} disabled={busy === order.id}>Validar e concluir</Button>}
              </div>
            ))}
          </div>
          </CardContent>
        </Card>
      )}



      {disputeOrderId && (
        <Card><CardHeader><CardTitle className="text-base">Abrir disputa</CardTitle></CardHeader><CardContent className="space-y-3"><Label>Motivo</Label><Textarea value={disputeReason} onChange={(e)=>setDisputeReason(e.target.value)} placeholder="Descreva objectivamente o problema." /><div className="flex gap-2"><Button onClick={submitDispute} disabled={!disputeReason.trim()}>Encaminhar para análise</Button><Button variant="outline" onClick={()=>setDisputeOrderId(null)}>Cancelar</Button></div></CardContent></Card>
      )}
    </div>
  )
}
