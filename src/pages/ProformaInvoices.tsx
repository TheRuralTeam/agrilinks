import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import { ArrowLeft, Plus, Trash2, Receipt, Download, Loader2, PackageCheck, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../hooks/use-toast";

type Product = { id: string; product_type: string; quantity: number; sale_unit: string | null; price: number; status: string };
type Line = { key: string; product_id: string; product_name: string; unit: string; quantity: string; unit_price: string; available_quantity: number };
type Invoice = {
  id: string; invoice_number: string; issue_date: string; valid_until: string | null; expected_delivery_date: string | null;
  customer_name: string; customer_email: string | null; customer_phone: string | null; customer_tax_id: string | null;
  delivery_location: string | null; sourcing_reference: string | null; payment_terms: string | null; notes: string | null;
  freight_amount: number; products_subtotal: number; grand_total: number; items: Line[]; created_at: string;
};
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(roundMoney(value));
const today = () => new Date().toISOString().slice(0, 10);
const makeKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ProformaInvoices = () => {
  const { user, isAdmin, isRootAdmin, isSuperRoot, loading: authLoading } = useAuth();
  const canManageProformas = isAdmin || isRootAdmin || isSuperRoot;
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [validUntil, setValidUntil] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [sourcingReference, setSourcingReference] = useState("");
  const [freight, setFreight] = useState("0");
  const [paymentTerms, setPaymentTerms] = useState("A definir entre as partes");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    if (!user || !canManageProformas) return;
    setLoading(true);
    try {
      // A equipa administrativa pode emitir propostas com qualquer produto activo do catálogo.
      const productResult = await supabase
        .from("products")
        .select("id, product_type, quantity, sale_unit, price, status, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (productResult.error) throw productResult.error;
      setProducts((productResult.data ?? []) as Product[]);

      // Uma falha no histórico não deve impedir o catálogo de aparecer.
      const invoiceResult = await (supabase as any)
        .from("proforma_invoices")
        .select("*")
        .eq("issuer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (invoiceResult.error) {
        console.error("Erro ao carregar histórico de proformas:", invoiceResult.error);
        toast({ title: "Produtos carregados; histórico indisponível", description: "Não foi possível carregar as facturas anteriores.", variant: "destructive" });
      } else {
        setInvoices((invoiceResult.data ?? []) as Invoice[]);
      }
      const initialProductId = searchParams.get("product");
      if (initialProductId && productResult.data?.some((p) => p.id === initialProductId)) {
        const p = productResult.data.find((item) => item.id === initialProductId)!;
        setLines((current) => current.length ? current : [{ key: makeKey(), product_id: p.id, product_name: p.product_type, unit: p.sale_unit || "kg", quantity: "1", unit_price: String(p.price ?? 0), available_quantity: Number(p.quantity ?? 0) }]);
      }
    } catch (error) {
      console.error("Erro ao carregar facturas proforma:", error);
      toast({ title: "Não foi possível carregar os dados", description: "Confirme a ligação e as permissões do Supabase.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, canManageProformas, searchParams]);

  useEffect(() => { void loadData(); }, [loadData]);

  const addLine = () => setLines((current) => [...current, { key: makeKey(), product_id: "", product_name: "", unit: "kg", quantity: "1", unit_price: "", available_quantity: 0 }]);
  const changeProduct = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId);
    setLines((current) => current.map((line) => line.key !== key ? line : {
      ...line, product_id: productId, product_name: product?.product_type ?? "", unit: product?.sale_unit || "kg",
      unit_price: product ? String(product.price ?? 0) : "", available_quantity: Number(product?.quantity ?? 0),
    }));
  };
  const changeLine = (key: string, field: "quantity" | "unit_price" | "unit", value: string) =>
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  const validLines = useMemo(() => lines.map((line) => ({ ...line, qty: Number(line.quantity), price: Number(line.unit_price) }))
    .filter((line) => line.product_id && Number.isFinite(line.qty) && line.qty > 0 && Number.isFinite(line.price) && line.price >= 0), [lines]);
  const subtotal = roundMoney(validLines.reduce((sum, line) => sum + roundMoney(line.qty * line.price), 0));
  const freightAmount = Number(freight);
  const total = roundMoney(subtotal + (Number.isFinite(freightAmount) && freightAmount >= 0 ? freightAmount : 0));

  const createPdf = (invoice: Invoice) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const left = 15; const pageWidth = 180;
    let y = 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(39, 105, 49);
    doc.text("AgriLink", left, y);
    doc.setFontSize(15); doc.setTextColor(25, 35, 28); doc.text("FACTURA PROFORMA", 195, y, { align: "right" });
    y += 8; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 100, 92);
    doc.text("Conexão de mercado", left, y);
    y += 8; doc.setDrawColor(210, 220, 212); doc.line(left, y, 195, y); y += 8;
    doc.setTextColor(30, 40, 32); doc.setFontSize(10);
    const metadata = [
      `Número: ${invoice.invoice_number}`, `Emissão: ${invoice.issue_date}`,
      `Validade: ${invoice.valid_until || "Não definida"}`, `Entrega prevista: ${invoice.expected_delivery_date || "A combinar"}`,
    ];
    metadata.forEach((line, index) => doc.text(line, left + (index % 2) * 92, y + Math.floor(index / 2) * 6));
    y += 18; doc.setFont("helvetica", "bold"); doc.text("CLIENTE / DESTINATÁRIO", left, y); y += 6;
    doc.setFont("helvetica", "normal");
    [invoice.customer_name, invoice.customer_email, invoice.customer_phone, invoice.customer_tax_id ? `NIF: ${invoice.customer_tax_id}` : ""].filter(Boolean).forEach((value) => { doc.text(String(value), left, y); y += 5; });
    y += 3; doc.setFont("helvetica", "bold"); doc.text("PRODUTOS E SERVIÇOS", left, y); y += 6;
    doc.setFillColor(239, 245, 240); doc.rect(left, y - 4, pageWidth, 8, "F");
    doc.setFontSize(8); doc.text("Produto", left + 2, y + 1); doc.text("Qtd.", 105, y + 1, { align: "right" });
    doc.text("Un.", 120, y + 1); doc.text("Preço unitário", 153, y + 1, { align: "right" }); doc.text("Subtotal", 193, y + 1, { align: "right" }); y += 9;
    (invoice.items ?? []).forEach((item) => {
      if (y > 260) { doc.addPage(); y = 18; }
      const qty = Number(item.quantity); const price = Number(item.unit_price);
      doc.setFont("helvetica", "normal");
      const productLines = doc.splitTextToSize(item.product_name || "Produto", 82);
      doc.text(productLines, left + 2, y);
      doc.text(qty.toLocaleString("pt-AO"), 105, y, { align: "right" }); doc.text(item.unit || "—", 120, y);
      doc.text(money(price), 153, y, { align: "right" }); doc.text(money(qty * price), 193, y, { align: "right" });
      y += Math.max(7, productLines.length * 4);
    });
    y += 4; doc.setDrawColor(210, 220, 212); doc.line(115, y, 195, y); y += 7;
    doc.text(`Subtotal dos produtos: ${money(Number(invoice.products_subtotal))}`, 195, y, { align: "right" }); y += 6;
    doc.text(`Frete: ${money(Number(invoice.freight_amount))}`, 195, y, { align: "right" }); y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(39, 105, 49);
    doc.text(`TOTAL: ${money(Number(invoice.grand_total))}`, 195, y, { align: "right" }); y += 10;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 48, 42);
    const extra = [
      invoice.delivery_location ? `Local de entrega: ${invoice.delivery_location}` : "",
      invoice.sourcing_reference ? `Referência sourcing/ficha técnica: ${invoice.sourcing_reference}` : "",
      invoice.payment_terms ? `Condições de pagamento: ${invoice.payment_terms}` : "",
      invoice.notes ? `Observações: ${invoice.notes}` : "",
    ].filter(Boolean);
    extra.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, pageWidth);
      if (y + wrapped.length * 5 > 275) { doc.addPage(); y = 18; }
      doc.text(wrapped, left, y); y += wrapped.length * 5 + 2;
    });
    doc.setFontSize(8); doc.setTextColor(110, 120, 112);
    doc.text("Documento comercial de proposta. Não constitui comprovativo de pagamento.", left, 286);
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const saveInvoice = async () => {
    if (!user || !canManageProformas) {
      toast({ title: "Acesso reservado", description: "Só os administradores podem emitir facturas proforma.", variant: "destructive" });
      return;
    }
    if (!customerName.trim()) { toast({ title: "Indique o cliente", description: "O nome do cliente é obrigatório.", variant: "destructive" }); return; }
    if (validLines.length === 0 || validLines.length !== lines.length) { toast({ title: "Revise os produtos", description: "Seleccione produtos válidos e indique quantidades e preços não negativos.", variant: "destructive" }); return; }
    if (!Number.isFinite(freightAmount) || freightAmount < 0) { toast({ title: "Frete inválido", description: "O frete deve ser zero ou um valor positivo.", variant: "destructive" }); return; }
    if (validUntil && validUntil < issueDate) { toast({ title: "Validade inválida", description: "A validade não pode anteceder a data de emissão.", variant: "destructive" }); return; }
    if (deliveryDate && deliveryDate < issueDate) { toast({ title: "Entrega inválida", description: "A data prevista de entrega não pode anteceder a emissão.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const invoiceNumber = `PF-${issueDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const items = validLines.map((line) => ({
        product_id: line.product_id, product_name: line.product_name, unit: line.unit,
        quantity: String(line.qty), unit_price: String(line.price), available_quantity: line.available_quantity,
      }));
      const record = {
        issuer_id: user.id, invoice_number: invoiceNumber, issue_date: issueDate, valid_until: validUntil || null,
        expected_delivery_date: deliveryDate || null, customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null, customer_phone: customerPhone.trim() || null,
        customer_tax_id: customerTaxId.trim() || null, delivery_location: deliveryLocation.trim() || null,
        sourcing_reference: sourcingReference.trim() || null, payment_terms: paymentTerms.trim() || null,
        notes: notes.trim() || null, freight_amount: freightAmount, products_subtotal: subtotal,
        grand_total: total, items, currency: "AOA", status: "issued",
      };
      const { data, error } = await (supabase as any).from("proforma_invoices").insert(record).select("*").single();
      if (error) throw error;
      const saved = data as Invoice;
      setInvoices((current) => [saved, ...current].slice(0, 50));
      createPdf(saved);
      toast({ title: "Factura proforma emitida", description: `${invoiceNumber} guardada e PDF preparado.` });
    } catch (error: any) {
      console.error("Erro ao emitir proforma:", error);
      toast({ title: "Não foi possível emitir", description: error?.message?.includes("proforma_invoices") ? "A migração SQL do módulo ainda precisa de ser aplicada ao Supabase." : (error?.message || "Tente novamente."), variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (authLoading) return <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> A verificar permissões…</div>;

  if (!canManageProformas) return <main className="mx-auto max-w-2xl px-4 py-12"><Card><CardHeader><CardTitle>Acesso reservado a administradores</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>A emissão de facturas proforma é uma função administrativa da AgriLink.</p><Button variant="outline" onClick={() => window.history.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button></CardContent></Card></main>;

  if (loading) return <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> A carregar facturas e produtos…</div>;

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Receipt className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-semibold tracking-tight">Facturas proforma</h1><p className="mt-1 text-sm text-muted-foreground">Propostas comerciais para sourcing, produtos e fichas técnicas.</p></div>
      </div>
      <Button variant="outline" onClick={() => window.history.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
    </header>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">1. Dados da proposta</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Cliente / entidade destinatária *</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome da empresa ou cliente" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cliente@empresa.ao" /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+244 ..." /></div>
            <div className="space-y-2"><Label>NIF do cliente (opcional)</Label><Input value={customerTaxId} onChange={(e) => setCustomerTaxId(e.target.value)} placeholder="Número de identificação fiscal" /></div>
            <div className="space-y-2"><Label>Data de emissão</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Válida até</Label><Input type="date" min={issueDate} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            <div className="space-y-2"><Label>Data prevista de entrega</Label><Input type="date" min={issueDate} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Local de entrega</Label><Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Província, município e local de descarga" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Referência do pedido de sourcing / ficha técnica</Label><Input value={sourcingReference} onChange={(e) => setSourcingReference(e.target.value)} placeholder="ID ou referência do pedido (opcional)" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">2. Produtos e quantidades</CardTitle><Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="mr-1 h-4 w-4" /> Adicionar produto</Button></div></CardHeader>
          <CardContent className="space-y-4">
            {products.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Não existem produtos activos visíveis no catálogo. Verifique o estado das publicações e as permissões de leitura.</div>}
            {lines.map((line, index) => <div key={line.key} className="rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">Produto {index + 1}</span><Button type="button" variant="ghost" size="icon" aria-label="Remover produto" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label>Produto registado</Label><Select value={line.product_id} onValueChange={(value) => changeProduct(line.key, value)}><SelectTrigger><SelectValue placeholder="Seleccione um produto activo da plataforma" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_type} · {money(Number(p.price) || 0)}/{p.sale_unit || "kg"} · stock {Number(p.quantity).toLocaleString("pt-AO")}</SelectItem>)}</SelectContent></Select>{line.product_id && <p className="text-xs text-muted-foreground">Preço inicial carregado da publicação. Confirme o preço comercial desta proposta.</p>}</div>
                <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="0.001" step="any" value={line.quantity} onChange={(e) => changeLine(line.key, "quantity", e.target.value)} /></div>
                <div className="space-y-2"><Label>Unidade</Label><Select value={line.unit} onValueChange={(value) => changeLine(line.key, "unit", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["kg", "tonelada", "saco", "caixa", "unidade", "litro"].map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Preço unitário (Kz)</Label><Input type="number" min="0" step="any" value={line.unit_price} onChange={(e) => changeLine(line.key, "unit_price", e.target.value)} /></div>
                <div className="space-y-2"><Label>Subtotal</Label><div className="flex h-10 items-center rounded-md bg-muted px-3 text-sm font-semibold tabular-nums">{money(roundMoney(Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unit_price) || 0)))}</div></div>
              </div>
            </div>)}
            {lines.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground"><PackageCheck className="mx-auto mb-2 h-6 w-6" />Adicione um ou mais produtos para calcular a proposta.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">3. Logística e condições comerciais</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Frete total (Kz)</Label><Input type="number" min="0" step="any" value={freight} onChange={(e) => setFreight(e.target.value)} /></div>
            <div className="space-y-2"><Label>Condições de pagamento</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Ex.: pagamento após confirmação" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Observações e especificações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qualidade, embalagem, disponibilidade, condições de entrega e outras notas relevantes." rows={3} /></div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="lg:sticky lg:top-4">
          <CardHeader><CardTitle className="text-base">Resumo da factura</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Linhas válidas</span><span>{validLines.length}</span></div>
            <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Subtotal produtos</span><span className="text-right font-medium tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Frete</span><span className="text-right font-medium tabular-nums">{money(Number.isFinite(freightAmount) && freightAmount > 0 ? freightAmount : 0)}</span></div>
            <Separator />
            <div><p className="text-xs text-muted-foreground">Valor total da proposta</p><p className="mt-1 break-words text-2xl font-semibold tracking-tight text-primary tabular-nums">{money(total)}</p></div>
            <p className="text-xs leading-relaxed text-muted-foreground">Os totais são calculados automaticamente. O frete é adicionado uma única vez ao subtotal dos produtos.</p>
            <Button className="w-full" onClick={() => void saveInvoice()} disabled={saving || lines.length === 0 || validLines.length !== lines.length || !customerName.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Emitir e gerar PDF</Button>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm">Documento comercial</CardTitle></CardHeader><CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground"><p>O PDF identifica a proposta, os produtos, os subtotais, o frete, o total, a validade e as condições fornecidas.</p><p>A factura proforma é uma proposta comercial e não confirma pagamento nem substitui uma factura fiscal.</p></CardContent></Card>
      </aside>
    </div>

    <section className="space-y-3 pt-2">
      <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Histórico de proformas</h2></div>
      {invoices.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Ainda não existem facturas proforma emitidas nesta conta.</CardContent></Card> :
        <div className="space-y-3">{invoices.map((invoice) => <Card key={invoice.id}><CardContent className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-medium">{invoice.invoice_number}</p><p className="mt-1 text-xs text-muted-foreground">{invoice.customer_name} · {invoice.issue_date} · {(invoice.items ?? []).length} produto(s)</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className="font-semibold tabular-nums">{money(Number(invoice.grand_total))}</span><Button size="sm" variant="outline" onClick={() => createPdf(invoice)}><Download className="mr-1 h-4 w-4" /> PDF</Button></div></CardContent></Card>)}</div>}
    </section>
  </main>;
};

export default ProformaInvoices;
