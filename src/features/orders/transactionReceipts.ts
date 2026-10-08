import jsPDF from 'jspdf'
import { supabase } from '../../integrations/supabase/client'

export interface MarketplaceTransactionHistoryEvent {
  event_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_id: string | null
  actor_role: 'buyer' | 'seller' | 'driver' | 'admin' | 'system'
  metadata: Record<string, unknown>
  created_at: string
}

export interface MarketplaceTransactionReceipt {
  receipt_number: string
  validation_hash: string
  generated_at: string
  pre_order: {
    id: string
    status: string
    payment_status: string | null
    quantity: number
    unit_price: number | null
    total_price: number | null
    location: string
    created_at: string
  }
  product: { id: string; name: string; category: string | null; province_id: string | null; municipality_id: string | null }
  buyer: { id: string; name: string | null; email: string | null }
  seller: { id: string; name: string | null; email: string | null }
  order: null | { id: string; status: string; payment_status: string | null; total_price: number; transport_fee: number; paid_at: string | null; created_at: string }
  payment: null | { id: string; status: string; amount: number; currency: string; provider_id: string; purpose: string; provider_reference: string | null; created_at: string; succeeded_at: string | null }
  p2p: null | { id: string; status: string; amount: number; currency: string; payment_channel: string; transfer_reference: string | null; created_at: string; completed_at: string | null }
  freight: null | { id: string; status: string; driver_id: string | null; product_name: string; weight_kg: number; origin_label: string; destination_label: string; route_distance_km: number | null; route_duration_minutes: number | null; offered_price: number | null; driver_offered_price: number | null; currency: string; accepted_at: string | null; in_transit_at: string | null; delivered_at: string | null }
  history: MarketplaceTransactionHistoryEvent[]
}

export async function fetchMarketplaceTransactionHistory(preOrderId: string) {
  const { data, error } = await supabase.rpc('get_marketplace_transaction_history', { p_pre_order_id: preOrderId })
  if (error) throw error
  return (data ?? []) as MarketplaceTransactionHistoryEvent[]
}

export async function fetchMarketplaceTransactionReceipt(preOrderId: string) {
  const { data, error } = await supabase.rpc('get_marketplace_transaction_receipt', { p_pre_order_id: preOrderId })
  if (error) throw error
  return data as unknown as MarketplaceTransactionReceipt
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente', accepted: 'Aceite', rejected: 'Rejeitado', completed: 'Concluído',
  paid: 'Pago', unpaid: 'Não pago', created: 'Criado', processing: 'A processar',
  in_transit: 'Em trânsito', delivered: 'Entregue', cancelled: 'Cancelado',
  offered: 'Proposto', awaiting_driver: 'A aguardar motorista', expired: 'Expirado',
}

const eventLabels: Record<string, string> = {
  pre_order_created: 'Pré-compra criada',
  pre_order_status_changed: 'Estado da pré-compra alterado',
  payment_status_changed: 'Estado do pagamento alterado',
  order_created: 'Pedido criado',
  order_status_changed: 'Estado do pedido alterado',
  order_payment_status_changed: 'Estado do pagamento do pedido alterado',
  freight_created: 'Frete criado',
  freight_status_changed: 'Estado do frete alterado',
  driver_assigned: 'Motorista associado',
}

const actorLabels: Record<string, string> = {
  buyer: 'Comprador', seller: 'Vendedor', driver: 'Motorista', admin: 'Admin AgriLink', system: 'Sistema AgriLink',
}

const money = (value: number, currency = 'AOA') =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const dateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('pt-AO') : '—'

function addWrapped(doc: jsPDF, value: string, x: number, y: number, width: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(value, width) as string[]
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

export async function downloadMarketplaceTransactionReceipt(preOrderId: string) {
  const receipt = await fetchMarketplaceTransactionReceipt(preOrderId)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 16
  const width = 210 - margin * 2
  let y = 18

  const section = (title: string) => {
    if (y > 255) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(25)
    doc.text(title, margin, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('AgriLink', margin, y); y += 7
  doc.setFontSize(12); doc.text('Comprovante de Operação / Pedido', margin, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Nº ${receipt.receipt_number}`, margin, y)
  doc.text(`Gerado em ${dateTime(receipt.generated_at)}`, 126, y); y += 7
  doc.line(margin, y, 210 - margin, y); y += 8

  section('Pré-compra e produto')
  y = addWrapped(doc, `Produto: ${receipt.product.name}`, margin, y, width)
  y = addWrapped(doc, `Quantidade: ${receipt.pre_order.quantity}`, margin, y, width)
  y = addWrapped(doc, `Preço unitário: ${receipt.pre_order.unit_price == null ? '—' : money(Number(receipt.pre_order.unit_price))}`, margin, y, width)
  y = addWrapped(doc, `Total: ${receipt.pre_order.total_price == null ? '—' : money(Number(receipt.pre_order.total_price))}`, margin, y, width)
  y = addWrapped(doc, `Estado: ${statusLabels[receipt.pre_order.status] ?? receipt.pre_order.status}`, margin, y, width)
  y = addWrapped(doc, `Pagamento: ${statusLabels[receipt.pre_order.payment_status ?? ''] ?? receipt.pre_order.payment_status ?? '—'}`, margin, y, width)
  y = addWrapped(doc, `Destino: ${receipt.pre_order.location || '—'}`, margin, y, width); y += 3

  section('Participantes')
  y = addWrapped(doc, `Comprador: ${receipt.buyer.name ?? '—'}`, margin, y, width)
  y = addWrapped(doc, `Vendedor: ${receipt.seller.name ?? '—'}`, margin, y, width)
  y += 3

  if (receipt.payment) {
    section('Pagamento')
    y = addWrapped(doc, `Estado: ${statusLabels[receipt.payment.status] ?? receipt.payment.status}`, margin, y, width)
    y = addWrapped(doc, `Valor: ${money(Number(receipt.payment.amount), receipt.payment.currency)}`, margin, y, width)
    y = addWrapped(doc, `Provedor: ${receipt.payment.provider_id}`, margin, y, width)
    y = addWrapped(doc, `Referência: ${receipt.payment.provider_reference ?? '—'}`, margin, y, width); y += 3
  }

  if (receipt.p2p) {
    section('Pagamento P2P')
    y = addWrapped(doc, `Operação: ${receipt.p2p.id}`, margin, y, width)
    y = addWrapped(doc, `Canal: ${receipt.p2p.payment_channel}`, margin, y, width)
    y = addWrapped(doc, `Estado: ${statusLabels[receipt.p2p.status] ?? receipt.p2p.status}`, margin, y, width)
    y = addWrapped(doc, `Referência: ${receipt.p2p.transfer_reference ?? '—'}`, margin, y, width); y += 3
  }

  if (receipt.freight) {
    section('Logística')
    y = addWrapped(doc, `Estado: ${statusLabels[receipt.freight.status] ?? receipt.freight.status}`, margin, y, width)
    y = addWrapped(doc, `Origem: ${receipt.freight.origin_label}`, margin, y, width)
    y = addWrapped(doc, `Destino: ${receipt.freight.destination_label}`, margin, y, width)
    y = addWrapped(doc, `Distância: ${receipt.freight.route_distance_km == null ? '—' : Number(receipt.freight.route_distance_km).toFixed(1) + ' km'}`, margin, y, width)
    y = addWrapped(doc, `Tempo estimado: ${receipt.freight.route_duration_minutes == null ? '—' : Math.round(receipt.freight.route_duration_minutes / 60) + ' h'}`, margin, y, width)
    y = addWrapped(doc, `Motorista associado: ${receipt.freight.driver_id ?? '—'}`, margin, y, width)
    y = addWrapped(doc, `Entrega concluída em: ${dateTime(receipt.freight.delivered_at)}`, margin, y, width); y += 3
  }

  section('Histórico transacional')
  for (const event of receipt.history) {
    if (y > 268) { doc.addPage(); y = 18 }
    const label = eventLabels[event.event_type] ?? event.event_type
    y = addWrapped(doc, `${dateTime(event.created_at)} · ${label} · ${actorLabels[event.actor_role] ?? event.actor_role}`, margin, y, width, 4.5)
    if (event.from_status || event.to_status) {
      y = addWrapped(doc, `${event.from_status ? (statusLabels[event.from_status] ?? event.from_status) : '—'} → ${event.to_status ? (statusLabels[event.to_status] ?? event.to_status) : '—'}`, margin + 4, y, width - 4, 4.5)
    }
    y += 1
  }

  if (y > 250) { doc.addPage(); y = 18 }
  section('Validação')
  y = addWrapped(doc, 'Documento gerado a partir dos registos transacionais da AgriLink.', margin, y, width)
  y = addWrapped(doc, `Hash de validação: ${receipt.validation_hash}`, margin, y, width, 4.5)
  doc.setFontSize(8); doc.setTextColor(90)
  addWrapped(doc, 'O comprovante não substitui um documento bancário ou fiscal emitido pelo respetivo prestador. O estado apresentado é o estado registado pela AgriLink.', margin, y + 5, width, 4)
  doc.save(`${receipt.receipt_number}.pdf`)
}
