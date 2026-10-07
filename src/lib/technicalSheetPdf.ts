import { jsPDF } from "jspdf";
import agrilinkLogo from "../assets/agrilink-logo.png";

export interface TechnicalSheetPdfProduct {
  id: string;
  product_type: string;
  province_id: string | null;
  municipality_id: string | null;
  farmer_name: string | null;
  quantity: number | null;
  harvest_date: string | null;
  price: number | null;
  logistics_access: string | null;
  contact: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  category?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

async function imageData(source: string): Promise<string | null> {
  try {
    const response = await fetch(source);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const cleanFilePart = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "produto";

const addWrapped = (doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5) => {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

export async function downloadTechnicalSheetPdf(product: TechnicalSheetPdfProduct) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const green = [44, 134, 59] as const;
  const ink = [17, 23, 20] as const;
  const muted = [99, 115, 103] as const;
  const rule = [225, 237, 226] as const;
  const soft = [247, 251, 247] as const;
  const margin = 18;
  const logo = await imageData(agrilinkLogo);

  doc.setFillColor(...green);
  doc.rect(0, 0, pageWidth, 5, "F");

  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 12, 38, 12, undefined, "FAST");
    } catch {
      doc.setTextColor(...green);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("AgriLink", margin, 21);
    }
  } else {
    doc.setTextColor(...green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("AgriLink", margin, 21);
  }

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DOCUMENTO DE FICHA TÉCNICA", pageWidth - margin, 18, { align: "right" });

  let y = 42;
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  y = addWrapped(doc, product.product_type || "Produto agrícola", margin, y, pageWidth - margin * 2, 7);

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  y = addWrapped(doc, [product.municipality_id, product.province_id].filter(Boolean).join(" — ") || "Localização não indicada", margin, y + 2, pageWidth - margin * 2, 5);
  y += 3;
  doc.setDrawColor(...rule);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  const info = [
    ["Fornecedor / produtor", product.farmer_name || "Não indicado"],
    ["Categoria", product.category || "Não indicada"],
    ["Quantidade disponível", product.quantity != null ? `${Number(product.quantity).toLocaleString("pt-AO")} kg` : "Não indicada"],
    ["Data de colheita", product.harvest_date ? new Date(product.harvest_date).toLocaleDateString("pt-AO") : "Não indicada"],
    ["Preço", product.price != null ? `${Number(product.price).toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz/kg` : "Não indicado"],
    ["Contacto", product.contact || "Não indicado"],
    ["Acesso logístico", product.logistics_access || "Não indicado"],
    ["Estado", product.status || "Não indicado"],
    ["Criado em", product.created_at ? new Date(product.created_at).toLocaleString("pt-AO") : "—"],
    ["Atualizado em", product.updated_at ? new Date(product.updated_at).toLocaleString("pt-AO") : "—"],
  ];

  for (const [label, value] of info) {
    const rowHeight = 13;
    doc.setFillColor(...soft);
    doc.roundedRect(margin, y - 7, pageWidth - margin * 2, rowHeight, 2, 2, "F");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), margin + 6, y);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(String(value), margin + 58, y, { maxWidth: pageWidth - margin * 2 - 64 });
    y += rowHeight + 3;
  }

  if (product.location_lat != null && product.location_lng != null) {
    y += 2;
    doc.setTextColor(...green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("COORDENADAS DE ORIGEM", margin, y);
    y += 6;
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${Number(product.location_lat).toFixed(6)}, ${Number(product.location_lng).toFixed(6)}`, margin, y);
    y += 9;
  }

  if (product.description) {
    doc.setTextColor(...green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("DESCRIÇÃO", margin, y);
    y += 6;
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    y = addWrapped(doc, product.description.trim(), margin, y, pageWidth - margin * 2, 5);
  }

  const footerY = pageHeight - 28;
  doc.setDrawColor(...rule);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, footerY + 5, 29, 9, undefined, "FAST");
    } catch {}
  }

  doc.setTextColor(...green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Conexão de mercado", pageWidth - margin, footerY + 10, { align: "right" });

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Ficha ${product.id.slice(0, 8)} · Gerado em ${new Date().toLocaleString("pt-AO")}`, pageWidth - margin, footerY + 16, { align: "right" });

  const safe = cleanFilePart(product.product_type || "produto");
  doc.save(`agrilink-ficha-tecnica-${safe}-${product.id.slice(0, 8)}.pdf`);
}
