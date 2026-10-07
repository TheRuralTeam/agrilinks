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
}

async function imageData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

export async function downloadTechnicalSheetPdf(product: TechnicalSheetPdfProduct) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const green = [44, 134, 59] as const;
  const ink = [17, 23, 20] as const;
  const muted = [100, 116, 105] as const;
  const rule = [225, 237, 226] as const;

  doc.setFillColor(...green);
  doc.rect(0, 0, pageWidth, 5, "F");

  const logo = await imageData(agrilinkLogo);
  if (logo) {
    try { doc.addImage(logo, "PNG", 18, 13, 37, 12, undefined, "FAST"); }
    catch { doc.setTextColor(...green); doc.setFontSize(15); doc.setFont("helvetica","bold"); doc.text("AgriLink",18,22); }
  } else {
    doc.setTextColor(...green); doc.setFontSize(15); doc.setFont("helvetica","bold"); doc.text("AgriLink",18,22);
  }

  doc.setTextColor(...muted);
  doc.setFontSize(8);
  doc.setFont("helvetica","bold");
  doc.text("DOCUMENTO DE FICHA TÉCNICA", pageWidth - 18, 18, { align: "right" });

  doc.setTextColor(...ink);
  doc.setFontSize(22);
  doc.setFont("helvetica","bold");
  doc.text(product.product_type || "Produto agrícola", 18, 42);

  const location=[product.municipality_id,product.province_id].filter(Boolean).join(" — ") || "Localização não indicada";
  doc.setTextColor(...muted);
  doc.setFontSize(10);
  doc.setFont("helvetica","normal");
  doc.text(location,18,49);

  doc.setDrawColor(...rule);
  doc.line(18,55,pageWidth-18,55);

  const rows=[
    ["Fornecedor",product.farmer_name || "Não indicado"],
    ["Quantidade disponível",product.quantity != null ? `${product.quantity.toLocaleString("pt-AO")} kg` : "Não indicada"],
    ["Data de colheita",product.harvest_date ? new Date(product.harvest_date).toLocaleDateString("pt-AO") : "Não indicada"],
    ["Preço",product.price != null ? `${product.price.toLocaleString("pt-AO",{minimumFractionDigits:2,maximumFractionDigits:2})} Kz/kg` : "Não indicado"],
    ["Região",location],
    ["Contacto",product.contact || "Não indicado"],
    ["Acesso logístico",product.logistics_access || "Não indicado"],
  ];
  let y=68;
  rows.forEach(([label,value])=>{
    doc.setFillColor(247,250,247);
    doc.roundedRect(18,y-7,pageWidth-36,13,2,2,"F");
    doc.setTextColor(...muted); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text(label.toUpperCase(),24,y);
    doc.setTextColor(...ink); doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text(String(value),75,y,{maxWidth:pageWidth-101});
    y+=16;
  });

  if (product.description) {
    y+=4;
    doc.setTextColor(...green); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text("DESCRIÇÃO",18,y); y+=7;
    doc.setTextColor(...ink); doc.setFont("helvetica","normal"); doc.setFontSize(10);
    const lines=doc.splitTextToSize(product.description,pageWidth-36);
    doc.text(lines,18,y);
    y+=Math.min(lines.length*5,42)+8;
  }

  doc.setDrawColor(...rule);
  doc.line(18,pageHeight-31,pageWidth-18,pageHeight-31);
  if (logo) { try { doc.addImage(logo,"PNG",18,pageHeight-24,28,9,undefined,"FAST"); } catch {} }
  doc.setTextColor(...green); doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("Conexão de mercado",pageWidth-18,pageHeight-20,{align:"right"});
  doc.setTextColor(...muted); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text(`Gerado em ${new Date().toLocaleString("pt-AO")}`,pageWidth-18,pageHeight-14,{align:"right"});
  doc.text(`Ficha ${product.id.slice(0,8)}`,18,pageHeight-12);

  const safe=(product.product_type||"produto").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"produto";
  doc.save(`agrilink-ficha-tecnica-${safe}-${product.id.slice(0,8)}.pdf`);
}
