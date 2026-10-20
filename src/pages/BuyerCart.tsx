import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { ArrowLeft, CalendarDays, FileText, Minus, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../hooks/use-toast";
import { readBuyerCart, writeBuyerCart, type BuyerCartItem } from "../features/marketplace/buyerCart";
import { supabase } from "../integrations/supabase/client";

const money = (value: number) => new Intl.NumberFormat("pt-AO", {
  style: "currency", currency: "AOA", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const weightKgForItem = (item: BuyerCartItem) => {
  if (item.unit.toLowerCase() === "kg") return item.quantity;
  if (item.unit.toLowerCase() === "tonelada") return item.quantity * 1000;
  return item.package_weight_kg == null ? null : item.package_weight_kg * item.quantity;
};

type CreatedCartOrder = {
  cart_order_id: string;
  status: string;
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: string;
    requested_delivery_date: string;
  }>;
  idempotent_replay?: boolean;
};

export default function BuyerCart() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [items, setItems] = useState<BuyerCartItem[]>([]);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(localDate());
  const [freightPreference, setFreightPreference] = useState<"single_quote_requested" | "separate_deliveries">("single_quote_requested");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(uuid);

  useEffect(() => {
    if (user?.id) setItems(readBuyerCart(user.id));
  }, [user?.id]);

  const persist = useCallback((next: BuyerCartItem[]) => {
    setItems(next);
    if (user?.id) writeBuyerCart(user.id, next);
  }, [user?.id]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), [items]);
  const totalWeight = useMemo(() => items.reduce((sum, item) => sum + (weightKgForItem(item) ?? 0), 0), [items]);
  const weightItemsKnown = items.filter((item) => weightKgForItem(item) != null).length;

  const updateQuantity = (productId: string, value: number) => {
    persist(items.map((item) => item.product_id !== productId ? item : {
      ...item, quantity: Math.max(item.minimum_quantity, Math.min(item.available_quantity, Math.floor(value || item.minimum_quantity))),
    }));
    setIdempotencyKey(uuid());
  };
  const removeItem = (productId: string) => { persist(items.filter((item) => item.product_id !== productId)); setIdempotencyKey(uuid()); };

  const generateProforma = (created?: CreatedCartOrder, sourceItems: BuyerCartItem[] = items, proformaFreightPreference: "single_quote_requested" | "separate_deliveries" = freightPreference) => {
    const sourceTotalWeight = sourceItems.reduce((sum, item) => sum + (weightKgForItem(item) ?? 0), 0);
    const sourceKnownWeightItems = sourceItems.filter((item) => weightKgForItem(item) != null).length;
    if (!sourceItems.length) {
      toast({ title: "Carrinho vazio", description: "Adicione produtos antes de gerar a proforma." });
      return;
    }
    const actualLines = created?.items?.map((line) => {
      const product = sourceItems.find((item) => item.product_id === line.product_id);
      return { product, quantity: Number(line.quantity), unitPrice: Number(line.unit_price), lineTotal: Number(line.total_price) };
    }).filter((line) => line.product);
    const lines = actualLines?.length ? actualLines : sourceItems.map((product) => ({
      product, quantity: product.quantity, unitPrice: product.unit_price, lineTotal: product.quantity * product.unit_price,
    }));
    const productsTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const left = 15;
    const right = 195;
    let y = 18;
    doc.setFillColor(31, 105, 49);
    doc.roundedRect(left, 10, 180, 24, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("AgriLink", left + 4, 24);
    doc.setFontSize(14);
    doc.text("FACTURA PROFORMA", right - 4, 20, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Proposta comercial de compra agrupada", right - 4, 27, { align: "right" });
    y = 43;
    doc.setTextColor(30, 40, 32); doc.setFontSize(9);
    const issueDate = localDate();
    const meta = [
      `Referência: ${created?.cart_order_id ?? `RASCUNHO-${issueDate.replace(/-/g, "")}`}`,
      `Emissão: ${issueDate}`,
      `Entrega solicitada: ${deliveryDate || "A combinar"}`,
      `Preferência logística: ${proformaFreightPreference === "single_quote_requested" ? "Solicitada cotação de frete único AgriLink (sujeita a confirmação)" : "Entregas separadas"}`,
      `Local de entrega: ${deliveryLocation || "A indicar"}`,
    ];
    meta.forEach((line, index) => doc.text(line, left, y + index * 6));
    y += 30;
    doc.setFont("helvetica", "bold"); doc.text("CLIENTE / COMPRADOR", left, y); y += 6;
    doc.setFont("helvetica", "normal");
    [
      userProfile?.full_name || "Nome não indicado",
      user?.email || "",
      userProfile?.phone || "",
      userProfile?.identity_document ? `Documento de identificação: ${userProfile.identity_document}` : "",
    ].filter(Boolean).forEach((line) => { doc.text(String(line), left, y); y += 5; });
    y += 5;
    doc.setFont("helvetica", "bold"); doc.text("DETALHE DOS PRODUTOS", left, y); y += 7;
    doc.setFillColor(235, 243, 236); doc.rect(left, y - 4, 180, 8, "F");
    doc.setFontSize(8);
    doc.text("Produto / fornecedor", left + 2, y + 1);
    doc.text("Quantidade", 112, y + 1, { align: "right" });
    doc.text("Preço unitário", 151, y + 1, { align: "right" });
    doc.text("Subtotal", right - 2, y + 1, { align: "right" });
    y += 9;
    for (const line of lines) {
      const product = line.product!;
      const productText = doc.splitTextToSize(product.product_name, 65);
      const sellerText = doc.splitTextToSize(`Fornecedor: ${product.seller_name}`, 65);
      const details = [...productText, ...sellerText, `Peso/embalagem: ${product.package_weight_kg == null ? "não indicado" : `${product.package_weight_kg} kg`}`];
      const height = Math.max(8, details.length * 4);
      if (y + height > 260) { doc.addPage(); y = 18; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(35, 45, 38);
      doc.text(details, left + 2, y);
      doc.text(`${line.quantity} ${product.unit}`, 112, y, { align: "right" });
      doc.text(money(line.unitPrice), 151, y, { align: "right" });
      doc.text(money(line.lineTotal), right - 2, y, { align: "right" });
      y += height + 3;
      doc.setDrawColor(225, 231, 226); doc.line(left, y - 1, right, y - 1);
    }
    y += 6;
    if (y > 260) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(45, 55, 48);
    doc.text(`Subtotal dos produtos: ${money(productsTotal)}`, right, y, { align: "right" }); y += 7;
    doc.text("Frete: a calcular e confirmar pela AgriLink/operador logístico", right, y, { align: "right" }); y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(31, 105, 49);
    doc.text(`TOTAL ESTIMADO DOS PRODUTOS: ${money(productsTotal)}`, right, y, { align: "right" }); y += 10;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(85, 92, 87);
    const notes = [
      `Peso total indicado: ${sourceKnownWeightItems === sourceItems.length ? `${sourceTotalWeight.toLocaleString("pt-AO")} kg` : `${sourceTotalWeight.toLocaleString("pt-AO")} kg de itens com peso de embalagem conhecido; peso completo por confirmar`}.`,
      "A data é uma solicitação do comprador e só fica confirmada após validação do fornecedor e da logística.",
      proformaFreightPreference === "single_quote_requested" ? "Foi solicitada uma cotação de frete único para esta encomenda. O valor só será incluído após a equipa logística confirmar a viabilidade, o preço e a aceitação do comprador; o frete não está calculado neste documento." : "Foi seleccionada a preferência por entregas separadas. As cargas podem sair de origens diferentes e chegar em momentos diferentes, conforme acordo logístico.",
      "Os preços apresentados são os preços unitários observados ao gerar este documento. A aceitação do fornecedor, o stock, o frete, os impostos aplicáveis e o total final devem ser confirmados antes do pagamento.",
      "Documento pro-forma para referência comercial; não é factura fiscal nem comprovativo de pagamento.",
      created ? `Checkout agrupado: ${created.cart_order_id}. Cada linha mantém o seu estado de aceitação e pagamento no histórico de compras.` : "Rascunho sem encomenda submetida.",
    ];
    notes.forEach((note) => {
      const wrapped = doc.splitTextToSize(note, 180);
      if (y + wrapped.length * 4 > 276) { doc.addPage(); y = 18; }
      doc.text(wrapped, left, y); y += wrapped.length * 4 + 3;
    });
    doc.setDrawColor(31, 105, 49); doc.line(left, 284, right, 284);
    doc.setFontSize(8); doc.setTextColor(31, 105, 49);
    doc.text("AgriLink · Conectar produtores, compradores e logística", left, 289);
    const fileRef = created?.cart_order_id ? created.cart_order_id.slice(0, 8) : issueDate.replace(/-/g, "");
    doc.save(`AgriLink-Proforma-${fileRef}.pdf`);
  };

  const submitSingleItem = async (item: BuyerCartItem) => {
    if (!user?.id) { navigate("/login", { state: { from: "/carrinho" } }); return; }
    if (String(userProfile?.user_type ?? "").toLowerCase() !== "comprador") {
      toast({ title: "Área exclusiva para compradores", description: "Entre com uma conta de comprador para finalizar a encomenda.", variant: "destructive" });
      return;
    }
    if (!userProfile?.identity_document?.trim()) {
      toast({ title: "Complete o seu perfil", description: "É necessário preencher o documento de identificação antes de criar pré-compras.", variant: "destructive" });
      navigate("/perfil");
      return;
    }
    if (!deliveryLocation.trim() || deliveryLocation.trim().length < 3) {
      toast({ title: "Local de entrega obrigatório", description: "Indique a zona, município ou endereço de entrega.", variant: "destructive" });
      return;
    }
    if (!deliveryDate || deliveryDate < localDate()) {
      toast({ title: "Data inválida", description: "Escolha hoje ou uma data futura para a entrega solicitada.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_marketplace_cart_order", {
        p_items: [{ product_id: item.product_id, quantity: item.quantity }],
        p_delivery_location: deliveryLocation.trim(),
        p_requested_delivery_date: deliveryDate,
        p_delivery_lat: null,
        p_delivery_lng: null,
        p_idempotency_key: uuid(),
        p_freight_preference: "separate_deliveries",
      });
      if (error) throw new Error(error.message || "Não foi possível submeter a compra individual.");
      const created = (Array.isArray(data) ? data[0] : data) as CreatedCartOrder;
      if (!created?.cart_order_id || !Array.isArray(created.items) || created.items.length !== 1) {
        throw new Error("O servidor não confirmou a compra individual.");
      }
      const remaining = items.filter((line) => line.product_id !== item.product_id);
      persist(remaining);
      setIdempotencyKey(uuid());
      toast({ title: "Compra individual submetida", description: "Este produto tem uma referência própria. A aceitação, o frete e a entrega serão confirmados separadamente." });
      try { generateProforma(created, [item], "separate_deliveries"); } catch (pdfError) {
        console.error("[AgriLink] Compra individual criada, mas o PDF não foi gerado:", pdfError);
        toast({ title: "Compra submetida; PDF indisponível", description: "A compra foi registada e pode ser consultada no histórico.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Não foi possível submeter a compra individual", description: error?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCart = async () => {
    if (!user?.id) { navigate("/login", { state: { from: "/carrinho" } }); return; }
    if (String(userProfile?.user_type ?? "").toLowerCase() !== "comprador") {
      toast({ title: "Área exclusiva para compradores", description: "Entre com uma conta de comprador para finalizar a encomenda.", variant: "destructive" });
      return;
    }
    if (!userProfile?.identity_document?.trim()) {
      toast({ title: "Complete o seu perfil", description: "É necessário preencher o documento de identificação antes de criar pré-compras.", variant: "destructive" });
      navigate("/perfil");
      return;
    }
    if (!items.length) { toast({ title: "Carrinho vazio", description: "Adicione pelo menos um produto." }); return; }
    if (!deliveryLocation.trim() || deliveryLocation.trim().length < 3) {
      toast({ title: "Local de entrega obrigatório", description: "Indique a zona, município ou endereço de entrega.", variant: "destructive" });
      return;
    }
    if (!deliveryDate || deliveryDate < localDate()) {
      toast({ title: "Data inválida", description: "Escolha hoje ou uma data futura para a entrega solicitada.", variant: "destructive" });
      return;
    }
    const invalid = items.find((item) => item.quantity < item.minimum_quantity || item.quantity > item.available_quantity || !Number.isInteger(item.quantity));
    if (invalid) {
      toast({ title: "Revise as quantidades", description: `${invalid.product_name}: mínimo ${invalid.minimum_quantity} e stock indicado ${invalid.available_quantity} ${invalid.unit}.`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_marketplace_cart_order", {
        p_items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        p_delivery_location: deliveryLocation.trim(),
        p_requested_delivery_date: deliveryDate,
        p_delivery_lat: null,
        p_delivery_lng: null,
        p_idempotency_key: idempotencyKey,
        p_freight_preference: freightPreference,
      });
      if (error) {
        const raw = [error.message, error.details, error.hint].filter(Boolean).join(" ");
        if (raw.includes("INSUFFICIENT_STOCK")) throw new Error("O stock de um dos produtos mudou. Actualize o carrinho e tente novamente.");
        if (raw.includes("MIN_ORDER_QUANTITY")) throw new Error("Uma das quantidades está abaixo do mínimo de compra definido pelo fornecedor.");
        if (raw.includes("PRODUCT_NOT_AVAILABLE")) throw new Error("Um dos produtos deixou de estar disponível.");
        if (raw.includes("SELLER_CANNOT_BUY_OWN_PRODUCT")) throw new Error("Não pode comprar um produto publicado pela sua própria conta.");
        if (raw.includes("PRODUCT_ORIGIN_COORDINATES_REQUIRED")) throw new Error("Um dos produtos ainda não tem coordenadas de origem válidas para criar a pré-compra.");
        if (raw.includes("INVALID_DELIVERY_DATE")) throw new Error("A data solicitada já passou. Escolha outra data.");
        throw new Error(error.message || "Não foi possível submeter o carrinho.");
      }
      const created = (Array.isArray(data) ? data[0] : data) as CreatedCartOrder;
      if (!created?.cart_order_id || !Array.isArray(created.items) || !created.items.length) {
        throw new Error("A resposta do servidor não confirmou a encomenda agrupada.");
      }
      try { persist([]); } catch (storageError) { console.error("[AgriLink] Não foi possível limpar o carrinho local após a compra:", storageError); }
      toast({ title: "Encomenda submetida", description: "Foi criada uma encomenda agrupada. Cada produto continua sujeito à aceitação do respectivo fornecedor; o frete e pagamento serão confirmados depois." });
      setIdempotencyKey(uuid());
      navigate("/minhas-compras");
      try {
        generateProforma(created);
      } catch (pdfError) {
        console.error("[AgriLink] A encomenda foi criada, mas o PDF pro-forma não foi gerado:", pdfError);
        toast({ title: "Compra submetida; PDF indisponível", description: "A encomenda foi registada. Consulte o histórico de compras; a falha do PDF não anulou a submissão.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Não foi possível finalizar a compra", description: error?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return (
    <div className="mx-auto max-w-xl p-6"><Card><CardContent className="p-6 text-center">
      <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-bold">Inicie sessão para comprar</h1>
      <p className="my-3 text-sm text-muted-foreground">O carrinho está associado à sua conta de comprador neste dispositivo.</p>
      <Button onClick={() => navigate("/login", { state: { from: "/carrinho" } })}>Iniciar sessão</Button>
    </CardContent></Card></div>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")} aria-label="Voltar ao marketplace"><ArrowLeft /></Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="h-6 w-6 text-primary" /> Carrinho de compras</h1>
            <p className="text-sm text-muted-foreground">Agrupe produtos ou submeta cada artigo separadamente.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/minhas-compras")}>Histórico de compras</Button>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">O seu carrinho está vazio</h2>
          <p className="max-w-md text-sm text-muted-foreground">Explore o marketplace para adicionar produtos. Pode submetê-los em conjunto ou comprar cada produto separadamente.</p>
          <Button onClick={() => navigate("/app")}>Explorar produtos</Button>
        </CardContent></Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
          <section className="space-y-3">
            {items.map((item) => (
              <Card key={item.product_id}>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{item.product_name}</h2>
                    <p className="text-sm text-muted-foreground">Fornecedor: {item.seller_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.province}, {item.municipality} · Colheita: {item.harvest_date || "Data não indicada"}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span>Preço unitário: <strong>{money(item.unit_price)} / {item.unit}</strong></span>
                      <span>Stock indicado: {item.available_quantity} {item.unit}</span>
                      <span>Peso/embalagem: {item.package_weight_kg == null ? "Não indicado" : `${item.package_weight_kg} kg`}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">Subtotal: {money(item.quantity * item.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <div className="flex items-center rounded-lg border">
                      <Button variant="ghost" size="icon" disabled={item.quantity <= item.minimum_quantity} onClick={() => updateQuantity(item.product_id, item.quantity - 1)} aria-label="Diminuir quantidade"><Minus className="h-4 w-4" /></Button>
                      <span className="min-w-14 text-center text-sm font-semibold">{item.quantity} {item.unit}</span>
                      <Button variant="ghost" size="icon" disabled={item.quantity >= item.available_quantity} onClick={() => updateQuantity(item.product_id, item.quantity + 1)} aria-label="Aumentar quantidade"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo: {item.minimum_quantity} {item.unit}</p>
                    <Button variant="outline" size="sm" disabled={submitting} onClick={() => submitSingleItem(item)}>Comprar separadamente</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" aria-label={`Remover ${item.product_name} do carrinho`} onClick={() => removeItem(item.product_id)}><Trash2 className="mr-1 h-4 w-4" /> Remover</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Como prefere organizar o frete?</CardTitle><CardDescription>Escolha a preferência para a equipa logística avaliar.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <input type="radio" name="freight-preference" className="mt-1 accent-green-700" checked={freightPreference === "single_quote_requested"} onChange={() => { setFreightPreference("single_quote_requested"); setIdempotencyKey(uuid()); }} />
                  <span className="space-y-1">
                    <span className="block font-medium">Solicitar um frete único AgriLink</span>
                    <span className="block text-sm text-muted-foreground">A AgriLink tentará coordenar uma cotação única para esta encomenda/fatura. Só será cobrado após a logística confirmar viabilidade e preço e o cliente aceitar.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <input type="radio" name="freight-preference" className="mt-1 accent-green-700" checked={freightPreference === "separate_deliveries"} onChange={() => { setFreightPreference("separate_deliveries"); setIdempotencyKey(uuid()); }} />
                  <span className="space-y-1">
                    <span className="block font-medium">Entregas/fretes separados</span>
                    <span className="block text-sm text-muted-foreground">Cada fornecedor pode estar numa origem diferente e as cargas podem chegar em datas distintas, conforme acordo com a logística e aceitação do comprador.</span>
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">A preferência não garante consolidação: dependem da localização dos fornecedores, peso/volume, disponibilidade de transporte e destino. O frete só entra no total depois de cotação confirmada.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Entrega e calendário</CardTitle><CardDescription>Destino e data solicitada para a encomenda. As datas finais dependem da logística.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cart-delivery-location">Local de entrega *</Label>
                  <Input id="cart-delivery-location" value={deliveryLocation} onChange={(event) => { setDeliveryLocation(event.target.value); setIdempotencyKey(uuid()); }} placeholder="Ex.: Viana, Luanda, zona/bairro" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cart-delivery-date">Data solicitada de entrega *</Label>
                  <Input id="cart-delivery-date" type="date" min={localDate()} value={deliveryDate} onChange={(event) => { setDeliveryDate(event.target.value); setIdempotencyKey(uuid()); }} required />
                  <p className="text-xs text-muted-foreground">A data só fica confirmada após aceitação do fornecedor e validação logística.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Resumo da compra</CardTitle><CardDescription>{items.reduce((total, item) => total + item.quantity, 0).toLocaleString("pt-AO")} unidade(s) solicitada(s) · {items.length} produto(s) · {new Set(items.map((item) => item.seller_name)).size} fornecedor(es)</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => <div key={item.product_id} className="flex justify-between gap-3 text-sm"><span className="min-w-0">{item.quantity} {item.unit} × {item.product_name}</span><span className="shrink-0 font-medium">{money(item.quantity * item.unit_price)}</span></div>)}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm"><span>Subtotal estimado</span><strong>{money(subtotal)}</strong></div>
                  <div className="mt-2 flex justify-between gap-3 text-sm text-muted-foreground"><span>Frete</span><span>A calcular</span></div>
                  <div className="mt-2 flex justify-between gap-3 text-sm text-muted-foreground"><span>Peso conhecido</span><span>{totalWeight.toLocaleString("pt-AO")} kg{weightItemsKnown < items.length ? " + peso por confirmar" : ""}</span></div>
                  <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total estimado*</span><span>{money(subtotal)}</span></div>
                  <p className="mt-2 text-xs text-muted-foreground">* Não inclui frete nem impostos não calculados pelo sistema. O total final depende da aceitação e confirmação dos fornecedores.</p>
                </div>
                <Button className="w-full" variant="outline" onClick={() => generateProforma()}><FileText className="mr-2 h-4 w-4" /> Gerar pro-forma PDF</Button>
                <Button className="w-full" disabled={submitting || !items.length} onClick={submitCart}>
                  <Truck className="mr-2 h-4 w-4" /> {submitting ? "A submeter encomenda..." : "Submeter compra agrupada"}
                </Button>
              </CardContent>
            </Card>
            <div className="flex gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>Uma submissão cria uma referência de encomenda e várias linhas de pré-compra. A aceitação e o pagamento continuam a ser controlados por produto/fornecedor, sem juntar pagamentos que o sistema ainda não suporta.</span>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
