import { jsPDF } from 'jspdf';
import agrilinkLogo from '../assets/agrilink-logo.png';

export interface FreightPdfLoad {
  id: string;
  qr_token: string;
  client_name?: string | null;
  product_name: string;
  weight_kg: number;
  origin_label: string;
  destination_label: string;
  pickup_date: string | null;
  offered_price: number | null;
  currency: string;
  status: string;
  notes?: string | null;
  route_distance_km?: number | null;
  route_duration_minutes?: number | null;
}

const GREEN: [number, number, number] = [44, 134, 59];
const MUTED: [number, number, number] = [100, 108, 102];
const INK: [number, number, number] = [25, 32, 27];

export const maskUuid = (id: string) => {
  const prefix = id.slice(0, 13);
  return prefix ? `${prefix}-****-****-****-************` : '************';
};

const statusLabel: Record<string, string> = {
  available: 'Disponível',
  open: 'Disponível',
  agendado: 'Agendada',
  accepted: 'Aceite',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const formatDate = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-AO')
    : 'Não definida';

const formatMoney = (value: number | null, currency: string) =>
  value == null
    ? '—'
    : `${new Intl.NumberFormat('pt-AO').format(value)} ${currency || 'Kz'}`;

const toDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('QR indisponível');
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o QR'));
    reader.readAsDataURL(blob);
  });
};

export const downloadFreightLoadPdf = async (load: FreightPdfLoad) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const scanUrl = `${window.location.origin}/cargas/scan/${encodeURIComponent(load.qr_token)}`;
  const safeClient = load.client_name?.trim() || 'Cliente não identificado';

  // Brand header
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageWidth, 7, 'F');

  try {
    const logoDataUrl = await toDataUrl(agrilinkLogo);
    doc.addImage(logoDataUrl, 'PNG', 20, 14, 26, 18);
  } catch {
    doc.setTextColor(...GREEN);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('AgriLink', 20, 27);
  }

  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.text('DOCUMENTO OPERACIONAL DE CARGA', pageWidth - 20, 20, { align: 'right' });

  doc.setTextColor(...INK);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('Cliente', 20, 43);
  doc.setFont(undefined, 'normal');
  doc.text(doc.splitTextToSize(safeClient, 100), 20, 49);

  // QR is a capability token, never the load payload.
  try {
    const qrDataUrl = await toDataUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=H&margin=12&data=${encodeURIComponent(scanUrl)}`,
    );
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 66, 29, 42, 42);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('SCAN · ACESSO AUTORIZADO', pageWidth - 45, 75, { align: 'center' });
  } catch {
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('QR indisponível', pageWidth - 45, 51, { align: 'center' });
  }

  doc.setDrawColor(220, 225, 221);
  doc.line(20, 84, pageWidth - 20, 84);

  doc.setTextColor(...GREEN);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('CARGA', 20, 94);

  doc.setTextColor(...INK);
  doc.setFontSize(21);
  doc.setFont(undefined, 'bold');
  const productLines = doc.splitTextToSize(load.product_name, pageWidth - 40);
  doc.text(productLines, 20, 104);

  let y = 104 + Math.max(1, productLines.length) * 9 + 7;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont(undefined, 'normal');
  doc.text(`ID: ${maskUuid(load.id)}`, 20, y);
  y += 10;

  const rows: Array<[string, string]> = [
    ['Estado', statusLabel[load.status] || load.status],
    ['Peso / quantidade', `${new Intl.NumberFormat('pt-AO').format(load.weight_kg)} kg`],
    ['Origem', load.origin_label],
    ['Destino', load.destination_label],
    ['Data de recolha', formatDate(load.pickup_date)],
    ['Frete proposto', formatMoney(load.offered_price, load.currency)],
    ['Rota estimada', load.route_distance_km != null ? `${load.route_distance_km.toFixed(1)} km` : '—'],
    ['Tempo estimado', load.route_duration_minutes != null ? `${load.route_duration_minutes} min` : '—'],
  ];

  doc.setFontSize(9.5);
  rows.forEach(([label, value]) => {
    doc.setTextColor(...MUTED);
    doc.setFont(undefined, 'bold');
    doc.text(label, 22, y);
    doc.setTextColor(...INK);
    doc.setFont(undefined, 'normal');
    const lines = doc.splitTextToSize(value || '—', 105);
    doc.text(lines, 82, y);
    y += Math.max(8, lines.length * 5.2);
  });

  if (load.notes) {
    y += 3;
    doc.setTextColor(...MUTED);
    doc.setFont(undefined, 'bold');
    doc.text('Observações', 22, y);
    y += 5;
    doc.setTextColor(...INK);
    doc.setFont(undefined, 'normal');
    const noteLines = doc.splitTextToSize(load.notes, pageWidth - 44);
    doc.text(noteLines, 22, y);
  }

  // Professional footer: brand mark + AgriLink positioning statement.
  doc.setDrawColor(220, 225, 221);
  doc.line(20, pageHeight - 31, pageWidth - 20, pageHeight - 31);

  try {
    const logoDataUrl = await toDataUrl(agrilinkLogo);
    doc.addImage(logoDataUrl, 'PNG', 20, pageHeight - 25, 16, 11);
  } catch {
    doc.setTextColor(...GREEN);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('AgriLink', 20, pageHeight - 18);
  }

  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.setFont(undefined, 'bold');
  doc.text('Conexão de mercado', pageWidth - 20, pageHeight - 19, { align: 'right' });

  doc.setTextColor(...MUTED);
  doc.setFont(undefined, 'normal');
  doc.text('O QR não contém os dados da carga. O acesso é validado pela AgriLink.', 20, pageHeight - 9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-AO')}`, pageWidth - 20, pageHeight - 9, { align: 'right' });

  const safeName = load.product_name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'carga';
  doc.save(`agrilink-carga-${safeName}-${load.id.slice(0, 8)}.pdf`);
};