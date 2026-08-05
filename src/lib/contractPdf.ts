import jsPDF from 'jspdf'
import { PRIMARY_GREEN } from '@/lib/brand'

export interface ContractPdfData {
  id: string
  product_name: string
  quantity?: number | null
  unit?: string | null
  price?: number | null
  currency?: string | null
  delivery_terms?: string | null
  conditions?: string | null
  buyer_name?: string | null
  supplier_name?: string | null
  approved_at?: string | null
  created_at?: string | null
  source_type?: string
}

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/** Gera e descarrega o contrato digital AgriLink em PDF. */
export function generateContractPdf(c: ContractPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const [gr, gg, gb] = hexToRgb(PRIMARY_GREEN)
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  let y = 0

  // Cabeçalho
  doc.setFillColor(gr, gg, gb)
  doc.rect(0, 0, W, 84, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('AgriLink', M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Contrato Digital de Fornecimento Agro-Alimentar', M, 60)

  y = 120
  doc.setTextColor(17, 23, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('1. Identificação do contrato', M, y)

  const line = (label: string, value: string) => {
    y += 20
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(90, 105, 93)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(17, 23, 20)
    doc.text(String(value || '—'), M + 170, y, { maxWidth: W - M * 2 - 170 })
  }

  line('Referência', c.id)
  line('Origem', c.source_type === 'ficha' ? 'Ficha técnica de recebimento' : 'Publicação de produto')
  line('Data de emissão', new Date(c.approved_at || c.created_at || Date.now()).toLocaleDateString('pt-PT'))

  y += 34
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(17, 23, 20)
  doc.text('2. Partes envolvidas', M, y)
  line('Comprador', c.buyer_name || 'A designar')
  line('Fornecedor / Produtor', c.supplier_name || 'A designar')
  line('Intermediária', 'AgriLink (agrilink.ao)')

  y += 34
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(17, 23, 20)
  doc.text('3. Objecto da negociação', M, y)
  line('Produto', c.product_name)
  line('Quantidade', c.quantity ? `${c.quantity} ${c.unit || 'kg'}` : '—')
  line('Preço acordado', c.price ? `${Number(c.price).toLocaleString('pt-PT')} ${c.currency || 'Kz'}` : 'A negociar')
  line('Condições de entrega', c.delivery_terms || '—')

  y += 34
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(17, 23, 20)
  doc.text('4. Condições gerais', M, y)
  y += 18
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 72, 62)
  const body = c.conditions?.trim() || [
    'a) As partes comprometem-se a cumprir as quantidades, especificações de qualidade e prazos acordados.',
    'b) O comprador assume o compromisso de pagamento do valor acordado nos termos definidos.',
    'c) O incumprimento por qualquer das partes pode originar penalizações contratuais definidas entre as partes.',
    'd) A AgriLink actua como intermediária e garante do registo digital deste contrato.',
    'e) Este documento foi validado por um administrador AgriLink antes da sua emissão.',
  ].join('\n')
  const lines = doc.splitTextToSize(body, W - M * 2)
  doc.text(lines, M, y)
  y += lines.length * 14 + 40

  // Assinaturas
  doc.setDrawColor(200, 214, 202)
  doc.line(M, y, M + 190, y)
  doc.line(W - M - 190, y, W - M, y)
  y += 14
  doc.setFontSize(9); doc.setTextColor(120, 135, 122)
  doc.text('Comprador', M, y)
  doc.text('Fornecedor / Produtor', W - M - 190, y)

  // Rodapé
  const H = doc.internal.pageSize.getHeight()
  doc.setFontSize(8); doc.setTextColor(150, 165, 152)
  doc.text('Documento gerado electronicamente pela plataforma AgriLink · agrilink.ao', M, H - 32)
  doc.text('O texto legal final deve ser revisto juridicamente antes de vinculação definitiva.', M, H - 20)

  doc.save(`contrato-agrilink-${c.id.slice(0, 8)}.pdf`)
}
