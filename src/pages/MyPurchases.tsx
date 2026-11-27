import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ShoppingBag, CreditCard, Clock3, CheckCircle2, AlertCircle, MapPin, RefreshCw, FileText } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../integrations/supabase/client'
import { toast } from '../hooks/use-toast'
import BuyerFreightTracking from '../components/BuyerFreightTracking'
import FreightDeliveryEvidenceViewer from '../components/FreightDeliveryEvidenceViewer'
import { downloadMarketplaceTransactionReceipt } from '../features/orders/transactionReceipts'
import {
  getMarketplaceCheckoutSummary,
  type MarketplaceCheckoutSummary,
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
type PurchaseFreightLoad = {
  id: string
  pre_order_id: string
  status: string
  origin_label: string | null
  destination_label: string | null
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  driver_id: string | null
  delivered_at: string | null
  buyer_receipt_confirmed_at: string | null
  created_at: string
}
type CheckoutState = {
  summary: MarketplaceCheckoutSummary | null
  loading: boolean
  error: string | null
}

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
  processing: 'Pagamento em validação',
  paid: 'Pago',
  failed: 'Pagamento não concluído',
  cancelled: 'Pagamento cancelado',
  expired: 'Tentativa expirada',
  refunded: 'Reembolsado',
}[status || 'unpaid'] || status || 'Não iniciado')

const checkoutReasonLabel = (reason: string | null | undefined) => ({
  WAITING_FREIGHT_QUOTE: 'A aguardar a proposta de transporte do motorista.',
  WAITING_FREIGHT_NEGOTIATION: 'O pagamento só será aberto depois de aprovares o preço do transporte proposto pelo motorista.',
  WAITING_PAYMENT_PROVIDER: 'A AgriLink ainda não configurou um meio de pagamento para esta compra.',
  WAITING_FREIGHT: 'A aguardar confirmação do transporte.',
}[reason || ''] || reason || 'O checkout ainda não está pronto. Aguarda a confirmação das condições.')

export default function MyPurchases() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()
  const { purchaseId } = useParams<{ purchaseId?: string }>()
  const purchaseHistoryPath = String(userProfile?.user_type ?? '').toLowerCase() === 'comprador' ? '/minhas-compras' : '/app'
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [freightLoadsByOrder, setFreightLoadsByOrder] = useState<Record<string, PurchaseFreightLoad>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<Record<string, CheckoutState>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deliveryEvidenceViewId, setDeliveryEvidenceViewId] = useState<string | null>(null)

  const loadPurchases = useCallback(async (quiet = false) => {
    if (!user?.id) {
      setPurchases([])
      setLoading(false)
      return
    }
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setLoadError(null)
    try {
      let purchasesQuery = (supabase as any)
        .from('pre_orders')
        .select('id,product_id,cart_order_id,requested_delivery_date,quantity,location,status,payment_status,total_price,created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
      if (purchaseId) purchasesQuery = purchasesQuery.eq('id', purchaseId)
      const { data, error } = await purchasesQuery.order('created_at', { ascending: false })
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
      const purchaseIds = rows.map((row) => row.id)
      if (purchaseIds.length > 0) {
        const { data: freightLoads, error: freightError } = await (supabase as any)
          .from('freight_loads')
          .select('id,pre_order_id,status,origin_label,destination_label,origin_lat,origin_lng,destination_lat,destination_lng,driver_id,delivered_at,buyer_receipt_confirmed_at,created_at')
          .in('pre_order_id', purchaseIds)
          .order('created_at', { ascending: false })
        if (freightError) {
          console.warn('[AgriLink] Não foi possível carregar o acompanhamento de frete.', freightError)
          setFreightLoadsByOrder({})
        } else {
          const latestByOrder: Record<string, PurchaseFreightLoad> = {}
          for (const load of (freightLoads || []) as PurchaseFreightLoad[]) {
            if (!latestByOrder[load.pre_order_id]) latestByOrder[load.pre_order_id] = load
          }
          setFreightLoadsByOrder(latestByOrder)
        }
      } else {
        setFreightLoadsByOrder({})
      }
      setPurchases(rows.map((row) => ({ ...row, product_name: productNames[row.product_id] || 'Produto' })) as Purchase[])
    } catch (error: any) {
      const message = 'Não foi possível consultar o histórico de compras. Verifique a ligação e tente novamente.'
      setLoadError(message)
      toast({ title: 'Não foi possível carregar as compras', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [purchaseId, user?.id])

  useEffect(() => { void loadPurchases() }, [loadPurchases])

  useEffect(() => {
    let refreshTimer: number | undefined
    const refreshOnReturn = () => {
      if (document.visibilityState === 'hidden') return
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => void loadPurchases(true), 250)
    }

    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
    }
  }, [loadPurchases])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadPurchases(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadPurchases]);

  const openPaymentOptions = async (purchase: Purchase) => {
    setCheckout((current) => ({ ...current, [purchase.id]: { summary: null, loading: true, error: null } }))
    try {
      const summary = await getMarketplaceCheckoutSummary(purchase.id)
      setCheckout((current) => ({
        ...current,
        [purchase.id]: {
          summary,
          loading: false,
          error: null,
        },
      }))
      if (!summary?.payment_ready) {
        toast({
          title: 'Pagamento ainda não disponível',
          description: checkoutReasonLabel(summary?.reason),
        })
      }
    } catch (error: any) {
      setCheckout((current) => ({
        ...current,
        [purchase.id]: {
          summary: null,
          loading: false,
          error: error?.message || 'Não foi possível consultar o pagamento.',
        },
      }))
      toast({
        title: 'Pagamento indisponível',
        description: error?.message || 'Não foi possível consultar o estado do checkout.',
        variant: 'destructive',
      })
    }
  }

  const confirmBuyerReceipt = async (load: PurchaseFreightLoad) => {
    setBusyId(load.id)
    try {
      const { error } = await (supabase as any).rpc('confirm_freight_receipt', {
        p_freight_load_id: load.id,
      })
      if (error) throw error
      toast({
        title: 'Recepção confirmada',
        description: 'A AgriLink registou a confirmação. A liquidação será processada conforme as regras da operação.',
      })
      await loadPurchases(true)
    } catch (error: any) {
      toast({
        title: 'Não foi possível confirmar a recepção',
        description: error?.message || 'Verifique o comprovativo de entrega e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const downloadReceipt = async (purchaseId: string) => {
    setBusyId(purchaseId)
    try {
      await downloadMarketplaceTransactionReceipt(purchaseId)
      toast({ title: 'Recibo preparado', description: 'O comprovativo da transacção foi gerado.' })
    } catch (error: any) {
      toast({
        title: 'Não foi possível gerar o recibo',
        description: error?.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">A carregar as tuas compras…</div>

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(purchaseId ? purchaseHistoryPath : '/perfil')} className="mb-2 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> {purchaseId ? (purchaseHistoryPath === '/minhas-compras' ? 'Voltar às minhas compras' : 'Voltar ao marketplace') : 'Voltar ao perfil'}
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">AgriLink · Área do comprador</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{purchaseId ? 'Finalizar compra' : 'As minhas compras'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{purchaseId ? 'Acompanhe esta compra individual. O pagamento só fica disponível após a confirmação do fornecedor e das condições de entrega.' : 'Consulta cada pré-compra individual, acompanha a confirmação do fornecedor e vê as instruções de pagamento autorizadas.'}</p>
        </div>
        <Button variant="outline" onClick={() => void loadPurchases(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><ShoppingBag className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{loadError ? '—' : purchases.length}</p><p className="text-xs text-muted-foreground">Compras no histórico</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{loadError ? '—' : purchases.filter((p) => p.status === 'accepted' && p.payment_status !== 'paid').length}</p><p className="text-xs text-muted-foreground">A aguardar pagamento</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{loadError ? '—' : purchases.filter((p) => p.payment_status === 'paid' || p.status === 'completed').length}</p><p className="text-xs text-muted-foreground">Pagas ou concluídas</p></div></CardContent></Card>
      </div>

      {loadError ? (
        <Card role="alert"><CardContent className="flex flex-col items-center py-10 text-center">
          <AlertCircle className="mb-3 h-9 w-9 text-destructive" />
          <h2 className="font-semibold">Não foi possível carregar as compras</h2>
          <p className="mt-2 max-w-md break-words text-sm text-muted-foreground">{loadError}</p>
          <Button className="mt-4" variant="outline" onClick={() => void loadPurchases(true)} disabled={refreshing}>{refreshing ? 'A actualizar…' : 'Tentar novamente'}</Button>
        </CardContent></Card>
      ) : purchases.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center"><ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">{purchaseId ? 'Compra não encontrada' : 'Ainda não tens compras'}</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{purchaseId ? 'Esta compra não existe, não pertence à tua conta ou já não está disponível.' : 'Quando enviares um pedido individual no marketplace, ele aparecerá aqui para acompanhares a resposta do fornecedor e o pagamento.'}</p><Button className="mt-4" onClick={() => navigate(purchaseId ? purchaseHistoryPath : '/app')}>{purchaseId ? (purchaseHistoryPath === '/minhas-compras' ? 'Voltar às minhas compras' : 'Voltar ao marketplace') : 'Explorar marketplace'}</Button></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => {
            const state = checkout[purchase.id]
            const canStartPayment = purchase.status === 'accepted' && ['unpaid', 'failed', null].includes(purchase.payment_status)
            return (
              <Card key={purchase.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><CardTitle className="text-base">{purchase.product_name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Compra #{purchase.id.slice(0, 8)} · {new Date(purchase.created_at).toLocaleDateString('pt-AO')}</p>{purchase.cart_order_id && <p className="mt-1 text-xs font-medium text-primary">Encomenda agrupada #{purchase.cart_order_id.slice(0, 8)}</p>}{purchase.requested_delivery_date && <p className="mt-1 text-xs text-muted-foreground">Entrega solicitada: {new Date(`${purchase.requested_delivery_date}T12:00:00`).toLocaleDateString('pt-AO')}</p>}</div>
                    <div className="flex flex-wrap items-center gap-2"><Badge variant={purchase.status === 'accepted' ? 'default' : 'outline'}>{purchaseStatus(purchase.status)}</Badge><Badge variant={purchase.payment_status === 'paid' ? 'default' : 'secondary'}>{paymentStatus(purchase.payment_status)}</Badge>{!purchaseId && <Button variant="outline" size="sm" onClick={() => navigate(`/pagamento/${purchase.id}`)}>Abrir compra</Button>}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {freightLoadsByOrder[purchase.id] && <BuyerFreightTracking load={freightLoadsByOrder[purchase.id]} />}
                  {freightLoadsByOrder[purchase.id] && (
                    <section className="space-y-3 rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">Comprovativo e recepção da entrega</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {freightLoadsByOrder[purchase.id].status === 'delivered'
                              ? freightLoadsByOrder[purchase.id].delivered_at
                                ? 'Entrega registada em ' + new Date(freightLoadsByOrder[purchase.id].delivered_at as string).toLocaleString('pt-AO')
                                : 'Entrega registada pelo motorista.'
                              : 'O comprovativo ficará disponível quando o motorista concluir a entrega.'}
                          </p>
                        </div>
                        <Badge variant={freightLoadsByOrder[purchase.id].buyer_receipt_confirmed_at ? 'default' : 'outline'}>
                          {freightLoadsByOrder[purchase.id].buyer_receipt_confirmed_at ? 'Recepção confirmada' : 'A aguardar recepção'}
                        </Badge>
                      </div>
                      {freightLoadsByOrder[purchase.id].status === 'delivered' && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeliveryEvidenceViewId(freightLoadsByOrder[purchase.id].id)}
                          >
                            <FileText className="mr-2 h-4 w-4" /> Ver comprovativo de entrega
                          </Button>
                          {!freightLoadsByOrder[purchase.id].buyer_receipt_confirmed_at ? (
                            <Button
                              size="sm"
                              disabled={busyId === freightLoadsByOrder[purchase.id].id}
                              onClick={() => void confirmBuyerReceipt(freightLoadsByOrder[purchase.id])}
                            >
                              {busyId === freightLoadsByOrder[purchase.id].id ? 'A confirmar…' : 'Confirmar recepção'}
                            </Button>
                          ) : (
                            <p className="self-center text-sm text-emerald-700">
                              Recepção confirmada em {new Date(freightLoadsByOrder[purchase.id].buyer_receipt_confirmed_at).toLocaleString('pt-AO')}.
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                  {purchase.payment_status === 'paid' && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === purchase.id}
                        onClick={() => void downloadReceipt(purchase.id)}
                      >
                        <FileText className="mr-2 h-4 w-4" /> Descarregar recibo da transacção
                      </Button>
                    </div>
                  )}
                  <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-semibold">{Number(purchase.quantity).toLocaleString('pt-AO')} unidades de venda</p></div>
                    <div><p className="text-xs text-muted-foreground">Total registado</p><p className="font-semibold">{money(Number(purchase.total_price || 0))}</p></div>
                    <div><p className="text-xs text-muted-foreground">Local de entrega</p><p className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5 shrink-0" />{purchase.location || 'A combinar'}</p></div>
                  </div>

                  {canStartPayment && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Próximo passo: confirmar o pagamento</p><p className="mt-1 text-sm text-muted-foreground">O produto e o frete são pagos exclusivamente à conta oficial da AgriLink. Não transfiras valores directamente para fornecedores ou motoristas.</p></div></div>
                      <Button className="mt-3" onClick={() => void openPaymentOptions(purchase)} disabled={state?.loading || busyId === purchase.id}><CreditCard className="mr-2 h-4 w-4" />{state?.loading ? 'A consultar…' : 'Consultar opções de pagamento'}</Button>
                      {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
                      {state?.summary && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Produtos</p><p className="font-semibold">{money(Number(state.summary.product_total || 0), state.summary.currency || 'AOA')}</p></div>
                            <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Transporte</p><p className="font-semibold">{money(Number(state.summary.freight_total || 0), state.summary.currency || 'AOA')}</p></div>
                            <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Total do checkout</p><p className="font-semibold">{money(Number(state.summary.total || 0), state.summary.currency || 'AOA')}</p></div>
                          </div>
                          {!state.summary.payment_ready && <p className="rounded-md border p-3 text-sm text-muted-foreground">{checkoutReasonLabel(state.summary.reason)}</p>}
                          {state.summary.payment_ready && (
                            <div className="space-y-2 rounded-md border bg-background p-3">
                              <div>
                                <p className="font-semibold">Pagamento centralizado na conta AgriLink</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  O checkout está elegível, mas o gateway oficial ainda não está activo. Nenhuma cobrança será iniciada e não serão apresentados IBANs ou números de terceiros. Aguarda a activação do meio de pagamento oficial da AgriLink.
                                </p>
                              </div>
                              <Button disabled>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Pagamento AgriLink indisponível
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {purchase.status === 'accepted' && purchase.payment_status === 'pending' && <p className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />Existe um pagamento pendente de confirmação. Não inicies outra transferência; consulta o estado novamente mais tarde ou contacta o suporte AgriLink.</p>}
                  {purchase.status === 'accepted' && purchase.payment_status === 'processing' && <p className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />O pagamento foi comunicado e está em validação pela AgriLink.</p>}
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
      {deliveryEvidenceViewId && (
        <FreightDeliveryEvidenceViewer
          freightLoadId={deliveryEvidenceViewId}
          onClose={() => setDeliveryEvidenceViewId(null)}
        />
      )}
    </main>
  )
}
