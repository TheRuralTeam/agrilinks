import { jsPDF } from 'jspdf';

export interface FreightPdfLoad {
  id: string;
  qr_token: string;
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
  return prefix ? `${prefix}-••••-••••-••••-••••••••••••` : '••••••••••••';
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

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageWidth, 7, 'F');

  doc.setTextColor(...GREEN);
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.text('AgriLink', 20, 24);

  doc.setTextColor(...MUTED);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Documento operacional de carga', 20, 31);

  doc.setTextColor(...INK);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(load.product_name, 20, 48);

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`ID da carga: ${maskUuid(load.id)}`, 20, 56);

  doc.setDrawColor(220, 225, 221);
  doc.line(20, 62, pageWidth - 20, 62);

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

  let y = 76;
  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.setTextColor(...MUTED);
    doc.setFont(undefined, 'bold');
    doc.text(label, 22, y);
    doc.setTextColor(...INK);
    doc.setFont(undefined, 'normal');
    const lines = doc.splitTextToSize(value || '—', 105);
    doc.text(lines, 82, y);
    y += Math.max(9, lines.length * 5.5);
  });

  if (load.notes) {
    y += 4;
    doc.setTextColor(...MUTED);
    doc.setFont(undefined, 'bold');
    doc.text('Observações', 22, y);
    y += 6;
    doc.setTextColor(...INK);
    doc.setFont(undefined, 'normal');
    doc.text(doc.splitTextToSize(load.notes, pageWidth - 44), 22, y);
  }

  try {
    const qrDataUrl = await toDataUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=H&margin=12&data=${encodeURIComponent(scanUrl)}`,
    );
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 66, 16, 42, 42);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Ler QR para consultar', pageWidth - 45, 62, { align: 'center' });
    doc.text('detalhes autorizados', pageWidth - 45, 67, { align: 'center' });
  } catch {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('QR indisponível no momento', pageWidth - 45, 38, { align: 'center' });
  }

  doc.setDrawColor(220, 225, 221);
  doc.line(20, pageHeight - 26, pageWidth - 20, pageHeight - 26);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('O QR não contém os dados da carga. O acesso é validado pela AgriLink.', 20, pageHeight - 19);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-AO')}`, 20, pageHeight - 13);

  const safeName = load.product_name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'carga';
  doc.save(`agrilink-carga-${safeName}-${load.id.slice(0, 8)}.pdf`);
};