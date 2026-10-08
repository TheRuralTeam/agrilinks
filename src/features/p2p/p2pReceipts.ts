import jsPDF from 'jspdf'
import { supabase } from '../../integrations/supabase/client'

export type P2PActorRole = 'buyer' | 'p2p_beneficiary' | 'seller' | 'admin' | 'system'

export interface P2PHistoryEvent {
  event_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_id: string | null
  actor_role: P2PActorRole
  metadata: Record<string, unknown>
  created_at: string
}

export interface P2PReceipt {
  receipt_number: string
  validation_hash: string
  generated_at: string
  operation: {
    id: string
    status: string
    amount: number
    currency: string
    payment_channel: string
    transfer_reference: string | null
    created_at: string
    accepted_at: string | null
    submitted_at: string | null
    completed_at: string | null
    expires_at: string
  }
  purchase: {
    pre_order_id: string
    product_id: string
    product_type: string
    quantity: number
    unit_price: number | null
    total_price: number
    location: string
  }
  actors: {
    buyer: { id: string; name: string | null; email: string | null }
    seller: { id: string; name: string | null; email: string | null }
    p2p_beneficiary: { id: string; name: string | null; email: string | null }
  }
  history: P2PHistoryEvent[]
}

export async function fetchP2PTransactionHistory(orderId: string) {
  const { data, error } = await supabase.rpc('get_p2p_transaction_history', {
    p_p2p_order_id: orderId,
  })
  if (error) throw error
  return (data ?? []) as P2PHistoryEvent[]
}

export async function fetchP2PTransactionReceipt(orderId: string) {
  const { data, error } = await supabase.rpc('get_p2p_transaction_receipt', {
    p_p2p_order_id: orderId,
  })
  if (error) throw error
  return data as unknown as P2PReceipt
}

const labels: Record<string, string> = {
  matching: 'À procura de beneficiário',
  offered: 'Oferta disponível',
  payment_pending: 'A aguardar pagamento',
  payment_submitted: 'Pagamento comunicado',
  payment_detected: 'Pagamento detectado',
  under_review: 'Em revisão',
  completed: 'Concluída',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  disputed: 'Em disputa',
  refunded: 'Reembolsada',
}

const actorLabels: Record<string, string> = {
  buyer: 'Comprador',
  seller: 'Vendedor',
  p2p_beneficiary: 'Agente P2P AgriLink',
  admin: 'Admin AgriLink',
  system: 'Sistema AgriLink',
}

const eventLabels: Record<string, string> = {
  created: 'Operação criada',
  matching_started: 'Matching iniciado',
  beneficiary_offered: 'Oferta enviada ao beneficiário',
  beneficiary_accepted: 'Beneficiário aceitou a operação',
  payment_submitted: 'Pagamento comunicado',
  beneficiary_confirmed: 'Beneficiário confirmou recebimento',
  payment_detected: 'Pagamento detectado',
  admin_completed: 'Pagamento validado pela administração',
  completed: 'Operação concluída',
  expired: 'Operação expirada',
  dispute_opened: 'Disputa aberta',
  dispute_resolved: 'Disputa resolvida',
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const dateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('pt-AO') : '—'

const addWrapped = (doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5) => {
  const lines = doc.splitTextToSize(text, width) as string[]
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

export async function downloadP2PTransactionReceipt(orderId: string) {
  const receipt = await fetchP2PTransactionReceipt(orderId)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 16
  const width = 210 - margin * 2
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('AgriLink', margin, y)
  y += 7
  doc.setFontSize(12)
  doc.text('Comprovante de Operação P2P', margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Nº ${receipt.receipt_number}`, margin, y)
  doc.text(`Gerado em ${dateTime(receipt.generated_at)}`, 130, y)
  y += 7

  doc.setDrawColor(180)
  doc.line(margin, y, 210 - margin, y)
  y += 8

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
  }

  section('Operação')
  y = addWrapped(doc, `ID: ${receipt.operation.id}`, margin, y, width)
  y = addWrapped(doc, `Estado: ${labels[receipt.operation.status] ?? receipt.operation.status}`, margin, y, width)
  y = addWrapped(doc, `Montante: ${money(Number(receipt.operation.amount), receipt.operation.currency)}`, margin, y, width)
  y = addWrapped(doc, `Canal: ${receipt.operation.payment_channel}`, margin, y, width)
  y = addWrapped(doc, `Referência: ${receipt.operation.transfer_reference ?? 'Não informada'}`, margin, y, width)
  y += 3

  section('Pedido / pré-compra')
  y = addWrapped(doc, `Produto: ${receipt.purchase.product_type}`, margin, y, width)
  y = addWrapped(doc, `Quantidade: ${receipt.purchase.quantity}`, margin, y, width)
  y = addWrapped(doc, `Total do pedido: ${money(Number(receipt.purchase.total_price), receipt.operation.currency)}`, margin, y, width)
  y = addWrapped(doc, `Pré-compra: ${receipt.purchase.pre_order_id}`, margin, y, width)
  y += 3

  section('Participantes')
  y = addWrapped(doc, `Comprador: ${receipt.actors.buyer.name ?? '—'}`, margin, y, width)
  y = addWrapped(doc, `Vendedor: ${receipt.actors.seller.name ?? '—'}`, margin, y, width)
  y = addWrapped(doc, `Agente P2P: ${receipt.actors.p2p_beneficiary.name ?? '—'}`, margin, y, width)
  y += 3

  section('Linha do tempo')
  for (const event of receipt.history) {
    const line = `${dateTime(event.created_at)} · ${eventLabels[event.event_type] ?? event.event_type} · ${actorLabels[event.actor_role] ?? event.actor_role}`
    y = addWrapped(doc, line, margin, y, width, 4.5)
    if (event.to_status) {
      y = addWrapped(doc, `Estado: ${labels[event.to_status] ?? event.to_status}`, margin + 4, y, width - 4, 4.5)
    }
    y += 1
    if (y > 270) {
      doc.addPage()
      y = 18
    }
  }

  if (y > 250) {
    doc.addPage()
    y = 18
  }

  section('Validação')
  y = addWrapped(doc, 'Este comprovante foi gerado a partir do registo transacional da AgriLink.', margin, y, width)
  y = addWrapped(doc, `Hash de validação: ${receipt.validation_hash}`, margin, y, width, 4.5)
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(90)
  addWrapped(doc, 'Documento informativo da operação. A validação financeira definitiva depende do estado registado no sistema AgriLink.', margin, y, width, 4)

  doc.save(`${receipt.receipt_number}.pdf`)
}
