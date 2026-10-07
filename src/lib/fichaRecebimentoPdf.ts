import { jsPDF } from "jspdf";
import agrilinkLogo from "../assets/agrilink-logo.png";

export interface FichaRecebimentoPdf {
  id: string;
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
  nome_ficha: string;
  produto: string;
  tipo_negocio: string;
  qualidade?: string | null;
  embalagem?: string | null;
  transporte?: string | null;
  locais_entrega?: unknown;
  telefone?: string | null;
  descricao_final?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

async function toDataUrl(url: string) {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(b);
    });
  } catch { return null; }
}

export async function downloadFichaRecebimentoPdf(ficha: FichaRecebimentoPdf) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const green=[44,134,59] as const, ink=[17,23,20] as const, muted=[101,116,106] as const, rule=[225,237,226] as const;

  doc.setFillColor(...green); doc.rect(0,0,w,5,"F");
  const logo=await toDataUrl(agrilinkLogo);
  if (logo) { try { doc.addImage(logo,"PNG",18,12,36,12,undefined,"FAST"); } catch {} }
  else { doc.setTextColor(...green); doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("AgriLink",18,21); }

  doc.setTextColor(...muted); doc.setFont("helvetica","bold"); doc.setFontSize(8);
  doc.text("FICHA DE RECEBIMENTO",w-18,18,{align:"right"});
  doc.setTextColor(...ink); doc.setFontSize(21); doc.text(ficha.nome_ficha || "Ficha de recebimento",18,40);
  doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(...muted);
  doc.text(ficha.produto || "Produto não indicado",18,47);

  let y=58;
  const row=(label:string,value:string)=>{
    doc.setFillColor(247,250,247); doc.roundedRect(18,y-7,w-36,13,2,2,"F");
    doc.setTextColor(...muted); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text(label.toUpperCase(),24,y);
    doc.setTextColor(...ink); doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.text(value || "Não indicado",75,y,{maxWidth:w-101}); y+=16;
  };
  row("Tipo de negócio",ficha.tipo_negocio);
  row("Qualidade",ficha.qualidade || "");
  row("Embalagem",ficha.embalagem || "");
  row("Transporte",ficha.transporte || "");
  row("Telefone da ficha",ficha.telefone || ficha.user_phone || "");
  row("Cliente",ficha.user_name || "");
  row("Email",ficha.user_email || "");

  const places = Array.isArray(ficha.locais_entrega)
    ? ficha.locais_entrega.map((x:any)=>typeof x==="string"?x:[x?.label,x?.name,x?.location].filter(Boolean).join(" — ")).filter(Boolean).join(", ")
    : typeof ficha.locais_entrega==="string" ? ficha.locais_entrega : "";
  row("Locais de entrega",places);

  const section=(title:string,value?:string|null)=>{
    if (!value) return;
    y+=3; doc.setTextColor(...green); doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.text(title.toUpperCase(),18,y); y+=7;
    doc.setTextColor(...ink); doc.setFont("helvetica","normal"); doc.setFontSize(10);
    const lines=doc.splitTextToSize(String(value),w-36); doc.text(lines,18,y); y+=Math.min(50,lines.length*5)+5;
  };
  section("Descrição final",ficha.descricao_final);
  section("Observações",ficha.observacoes);

  doc.setDrawColor(...rule); doc.line(18,h-30,w-18,h-30);
  if (logo) { try { doc.addImage(logo,"PNG",18,h-24,28,9,undefined,"FAST"); } catch {} }
  doc.setTextColor(...green); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("Conexão de mercado",w-18,h-20,{align:"right"});
  doc.setTextColor(...muted); doc.setFont("helvetica","normal"); doc.setFontSize(7);
  doc.text(`Registo ${ficha.id.slice(0,8)} · Gerado em ${new Date().toLocaleString("pt-AO")}`,18,h-12);

  const safe=(ficha.nome_ficha||ficha.produto||"ficha").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"ficha";
  doc.save(`agrilink-ficha-${safe}-${ficha.id.slice(0,8)}.pdf`);
}
