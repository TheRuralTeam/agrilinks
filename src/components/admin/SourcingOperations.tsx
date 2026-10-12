import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../integrations/supabase/client";
import { angolaProvinces } from "../../data/angola-locations";
import { SOURCING_AGRICULTURAL_PRODUCTS, SOURCING_UNITS } from "../../features/sourcing/sourcingCatalog";
import { Button } from "../ui/button";

type Request = {
  id: string;
  product_name: string;
  quantity: number;
  unit: string;
  delivery_date: string;
  delivery_province_id: string | null;
  delivery_municipality_id: string | null;
};
type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string;
  product_name: string;
  province_id: string | null;
  municipality_id: string | null;
  locality: string | null;
  source: string;
  verification_status: "unverified" | "contacted" | "confirmed" | "unavailable" | "rejected";
  verification_notes: string | null;
  verified_at: string | null;
};
type Quote = {
  id: string;
  sourcing_request_id: string;
  supplier_id: string;
  available_quantity: number;
  unit: string;
  unit_price: number | null;
  currency: string;
  availability_status: "not_checked" | "available" | "partially_available" | "unavailable";
  confirmation_status: "pending" | "confirmed" | "rejected" | "expired";
  expected_delivery_date: string | null;
  valid_until: string | null;
  quality_notes: string | null;
  confirmation_method: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
};
type SupplierForm = {
  company_name: string; contact_name: string; phone: string; product_name: string;
  province_id: string; municipality_id: string; locality: string; source: string;
};
type QuoteForm = {
  sourcing_request_id: string; supplier_id: string; available_quantity: string; unit: string;
  unit_price: string; availability_status: Quote["availability_status"]; expected_delivery_date: string;
  valid_until: string; quality_notes: string; confirmation_method: string; notes: string;
};

const emptySupplier: SupplierForm = {
  company_name: "", contact_name: "", phone: "", product_name: "", province_id: "",
  municipality_id: "", locality: "", source: "manual",
};
const emptyQuote: QuoteForm = {
  sourcing_request_id: "", supplier_id: "", available_quantity: "", unit: "kg", unit_price: "",
  availability_status: "not_checked", expected_delivery_date: "", valid_until: "",
  quality_notes: "", confirmation_method: "phone", notes: "",
};
const fieldClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const labelClass = "mb-1 block text-xs font-semibold text-gray-600";

function provinceName(id: string | null) {
  return angolaProvinces.find((province) => province.id === id)?.name ?? "Local não indicado";
}
function municipalityName(provinceId: string | null, municipalityId: string | null) {
  const province = angolaProvinces.find((item) => item.id === provinceId);
  return province?.municipalities.find((item) => item.id === municipalityId)?.name ?? "";
}
function unitLabel(value: string) {
  return SOURCING_UNITS.find((item) => item.value === value)?.label ?? value;
}

export default function SourcingOperations({ requests, canManage }: { requests: Request[]; canManage: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuote);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySupplierId, setBusySupplierId] = useState<string | null>(null);
  const [verificationTargetId, setVerificationTargetId] = useState<string | null>(null);
  const [verificationEvidence, setVerificationEvidence] = useState("");
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [supplierResult, quoteResult] = await Promise.all([
        supabase.from("sourcing_supplier_leads").select("*").order("created_at", { ascending: false }),
        supabase.from("sourcing_supplier_quotes").select("*").order("created_at", { ascending: false }),
      ]);
      if (supplierResult.error) throw supplierResult.error;
      if (quoteResult.error) throw quoteResult.error;
      setSuppliers((supplierResult.data ?? []) as Supplier[]);
      setQuotes((quoteResult.data ?? []) as Quote[]);
    } catch (error) {
      console.error("[AgriLink Sourcing] Falha ao carregar fornecedores/cotações:", error);
      toast.error("Não foi possível carregar fornecedores e cotações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedRequest = requests.find((request) => request.id === quoteForm.sourcing_request_id);
  const eligibleSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.verification_status === "confirmed" && (!selectedRequest || supplier.product_name.trim().toLocaleLowerCase("pt-AO") === selectedRequest.product_name.trim().toLocaleLowerCase("pt-AO"))),
    [suppliers, selectedRequest],
  );
  const selectedProvince = angolaProvinces.find((province) => province.id === supplierForm.province_id);

  const saveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    if (!supplierForm.company_name.trim() || !supplierForm.phone.trim() || !supplierForm.product_name.trim()) {
      toast.error("Preencha a entidade, o contacto telefónico e o produto.");
      return;
    }
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("A sessão expirou. Inicie sessão novamente.");
      const { error } = await supabase.from("sourcing_supplier_leads").insert({
        company_name: supplierForm.company_name.trim(),
        contact_name: supplierForm.contact_name.trim() || null,
        phone: supplierForm.phone.trim(),
        product_name: supplierForm.product_name.trim(),
        province_id: supplierForm.province_id || null,
        municipality_id: supplierForm.municipality_id || null,
        locality: supplierForm.locality.trim() || null,
        source: supplierForm.source,
        created_by: authData.user.id,
      });
      if (error) throw error;
      toast.success("Fornecedor registado para validação. Ainda não está confirmado.");
      setSupplierForm(emptySupplier);
      setShowSupplierForm(false);
      await loadData();
    } catch (error) {
      console.error("[AgriLink Sourcing] Falha ao registar fornecedor:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível registar o fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  const verifySupplier = async (supplier: Supplier) => {
    if (!canManage) return;
    if (!verificationEvidence.trim()) {
      toast.error("Registe a evidência de verificação antes de confirmar.");
      return;
    }
    setBusySupplierId(supplier.id);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("A sessão expirou. Inicie sessão novamente.");
      const { error } = await supabase.from("sourcing_supplier_leads").update({
        verification_status: "confirmed",
        verification_notes: verificationEvidence.trim(),
        verified_at: new Date().toISOString(),
        verified_by: authData.user.id,
      }).eq("id", supplier.id);
      if (error) throw error;
      toast.success("Confirmação operacional registada.");
      setVerificationTargetId(null);
      setVerificationEvidence("");
      await loadData();
    } catch (error) {
      console.error("[AgriLink Sourcing] Falha ao confirmar fornecedor:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o fornecedor.");
    } finally {
      setBusySupplierId(null);
    }
  };

  const saveQuote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    const quantity = Number(quoteForm.available_quantity);
    const price = quoteForm.unit_price.trim() ? Number(quoteForm.unit_price) : null;
    if (!selectedRequest || !eligibleSuppliers.some((supplier) => supplier.id === quoteForm.supplier_id)) {
      toast.error("Selecione um pedido e um fornecedor confirmado.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || (price !== null && (!Number.isFinite(price) || price < 0))) {
      toast.error("A quantidade disponível deve ser positiva e o preço não pode ser negativo.");
      return;
    }
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("A sessão expirou. Inicie sessão novamente.");
      const { error } = await supabase.from("sourcing_supplier_quotes").insert({
        sourcing_request_id: quoteForm.sourcing_request_id,
        supplier_id: quoteForm.supplier_id,
        available_quantity: quantity,
        unit: quoteForm.unit,
        unit_price: price,
        availability_status: quoteForm.availability_status,
        expected_delivery_date: quoteForm.expected_delivery_date || null,
        valid_until: quoteForm.valid_until || null,
        quality_notes: quoteForm.quality_notes.trim() || null,
        confirmation_method: quoteForm.confirmation_method || null,
        notes: quoteForm.notes.trim() || null,
        created_by: authData.user.id,
      });
      if (error) throw error;
      toast.success("Cotação registada como pendente. Só será apresentada como confirmada após validação.");
      setQuoteForm(emptyQuote);
      setShowQuoteForm(false);
      await loadData();
    } catch (error) {
      console.error("[AgriLink Sourcing] Falha ao registar cotação:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível registar a cotação.");
    } finally {
      setSaving(false);
    }
  };

  const confirmQuote = async (quote: Quote) => {
    if (!canManage) return;
    if (!["available", "partially_available"].includes(quote.availability_status)) {
      toast.error("Registe primeiro a disponibilidade como disponível ou parcialmente disponível.");
      return;
    }
    if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) {
      toast.error("Esta cotação expirou. Registe uma nova cotação actualizada antes de confirmar a disponibilidade.");
      return;
    }
    setBusyQuoteId(quote.id);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("A sessão expirou. Inicie sessão novamente.");
      const { error } = await supabase.from("sourcing_supplier_quotes").update({
        confirmation_status: "confirmed",
        confirmed_by: authData.user.id,
        confirmed_at: new Date().toISOString(),
      }).eq("id", quote.id);
      if (error) throw error;
      toast.success("Disponibilidade confirmada e histórico guardado.");
      await loadData();
    } catch (error) {
      console.error("[AgriLink Sourcing] Falha ao confirmar cotação:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar a cotação.");
    } finally {
      setBusyQuoteId(null);
    }
  };

  const updateQuoteStatus = async (quote: Quote, status: "rejected" | "expired") => {
    if (!canManage) return;
    setBusyQuoteId(quote.id);
    try {
      const { error } = await supabase.from("sourcing_supplier_quotes").update({
        confirmation_status: status,
        confirmed_by: null,
        confirmed_at: null,
      }).eq("id", quote.id);
      if (error) throw error;
      toast.success(status === "rejected" ? "Cotação rejeitada." : "Cotação marcada como expirada.");
      await loadData();
    } catch (error) {
      console.error("[AgriLink Sourcing] Falha ao actualizar cotação:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível actualizar a cotação.");
    } finally {
      setBusyQuoteId(null);
    }
  };

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pesquisa e confirmação de fornecedores</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Registe contactos reais, documente a verificação e compare cotações. Publicações ou perfis não contam como stock confirmado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Actualizar</Button>
          <Button size="sm" onClick={() => setShowSupplierForm((value) => !value)} disabled={!canManage}><Plus className="mr-2 h-4 w-4" /> Registar fornecedor</Button>
          <Button size="sm" variant="outline" onClick={() => setShowQuoteForm((value) => !value)} disabled={!canManage || requests.length === 0 || eligibleSuppliers.length === 0}><Plus className="mr-2 h-4 w-4" /> Nova cotação</Button>
        </div>
      </div>

      {!canManage && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">A sua conta pode consultar esta secção, mas não tem permissão para alterar fornecedores ou cotações.</div>}

      {showSupplierForm && (
        <form onSubmit={saveSupplier} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3">
          <div><label className={labelClass}>Empresa / fornecedor *</label><input className={fieldClass} value={supplierForm.company_name} onChange={(e) => setSupplierForm({ ...supplierForm, company_name: e.target.value })} maxLength={160} required /></div>
          <div><label className={labelClass}>Pessoa de contacto</label><input className={fieldClass} value={supplierForm.contact_name} onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} maxLength={160} /></div>
          <div><label className={labelClass}>Telefone *</label><input className={fieldClass} type="tel" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} maxLength={40} required /></div>
          <div><label className={labelClass}>Produto agrícola *</label><select className={fieldClass} value={supplierForm.product_name} onChange={(e) => setSupplierForm({ ...supplierForm, product_name: e.target.value })} required><option value="">Seleccionar produto</option>{SOURCING_AGRICULTURAL_PRODUCTS.map((product) => <option key={product} value={product}>{product}</option>)}</select></div>
          <div><label className={labelClass}>Província</label><select className={fieldClass} value={supplierForm.province_id} onChange={(e) => setSupplierForm({ ...supplierForm, province_id: e.target.value, municipality_id: "" })}><option value="">Seleccionar província</option>{angolaProvinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</select></div>
          <div><label className={labelClass}>Município</label><select className={fieldClass} value={supplierForm.municipality_id} onChange={(e) => setSupplierForm({ ...supplierForm, municipality_id: e.target.value })} disabled={!selectedProvince}><option value="">Seleccionar município</option>{selectedProvince?.municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name}</option>)}</select></div>
          <div><label className={labelClass}>Localidade / mercado</label><input className={fieldClass} value={supplierForm.locality} onChange={(e) => setSupplierForm({ ...supplierForm, locality: e.target.value })} maxLength={180} /></div>
          <div><label className={labelClass}>Origem do contacto</label><select className={fieldClass} value={supplierForm.source} onChange={(e) => setSupplierForm({ ...supplierForm, source: e.target.value })}><option value="manual">Contacto directo</option><option value="marketplace">Marketplace</option><option value="referral">Referência</option><option value="field_visit">Visita de campo</option><option value="other">Outro</option></select></div>
          <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar contacto</Button></div>
        </form>
      )}

      {showQuoteForm && (
        <form onSubmit={saveQuote} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3">
          <div><label className={labelClass}>Pedido de compra *</label><select className={fieldClass} value={quoteForm.sourcing_request_id} onChange={(e) => { const request = requests.find((item) => item.id === e.target.value); setQuoteForm({ ...quoteForm, sourcing_request_id: e.target.value, supplier_id: "", unit: request?.unit ?? quoteForm.unit }); }} required><option value="">Seleccionar pedido</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.product_name} · {Number(request.quantity).toLocaleString("pt-AO")} {unitLabel(request.unit)} · {new Date(request.delivery_date).toLocaleDateString("pt-AO")}</option>)}</select></div>
          <div><label className={labelClass}>Fornecedor confirmado *</label><select className={fieldClass} value={quoteForm.supplier_id} onChange={(e) => setQuoteForm({ ...quoteForm, supplier_id: e.target.value })} required><option value="">Seleccionar fornecedor</option>{eligibleSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.company_name} · {supplier.product_name}</option>)}</select></div>
          <div><label className={labelClass}>Quantidade disponível *</label><input className={fieldClass} type="number" min="0.001" step="0.001" value={quoteForm.available_quantity} onChange={(e) => setQuoteForm({ ...quoteForm, available_quantity: e.target.value })} required /></div>
          <div><label className={labelClass}>Unidade do pedido</label><select className={fieldClass} value={quoteForm.unit} disabled={!selectedRequest} onChange={(e) => setQuoteForm({ ...quoteForm, unit: e.target.value })}>{selectedRequest ? <option value={selectedRequest.unit}>{unitLabel(selectedRequest.unit)}</option> : <option value="">Escolha primeiro o pedido</option>}</select></div>
          <div><label className={labelClass}>Preço por unidade (AOA)</label><input className={fieldClass} type="number" min="0" step="0.01" value={quoteForm.unit_price} onChange={(e) => setQuoteForm({ ...quoteForm, unit_price: e.target.value })} placeholder="A confirmar" /></div>
          <div><label className={labelClass}>Disponibilidade declarada</label><select className={fieldClass} value={quoteForm.availability_status} onChange={(e) => setQuoteForm({ ...quoteForm, availability_status: e.target.value as Quote["availability_status"] })}><option value="not_checked">Por verificar</option><option value="available">Disponível</option><option value="partially_available">Parcialmente disponível</option><option value="unavailable">Indisponível</option></select></div>
          <div><label className={labelClass}>Entrega prevista</label><input className={fieldClass} type="date" value={quoteForm.expected_delivery_date} onChange={(e) => setQuoteForm({ ...quoteForm, expected_delivery_date: e.target.value })} /></div>
          <div><label className={labelClass}>Cotação válida até</label><input className={fieldClass} type="date" min={new Date().toISOString().slice(0, 10)} value={quoteForm.valid_until} onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })} /></div>
          <div><label className={labelClass}>Método de confirmação</label><select className={fieldClass} value={quoteForm.confirmation_method} onChange={(e) => setQuoteForm({ ...quoteForm, confirmation_method: e.target.value })}><option value="phone">Telefone</option><option value="in_person">Presencial</option><option value="marketplace">Marketplace</option><option value="document">Documento / evidência</option><option value="other">Outro</option></select></div>
          <div className="md:col-span-3"><label className={labelClass}>Qualidade / especificações</label><textarea className={fieldClass} rows={2} maxLength={2000} value={quoteForm.quality_notes} onChange={(e) => setQuoteForm({ ...quoteForm, quality_notes: e.target.value })} /></div>
          <div className="md:col-span-3"><label className={labelClass}>Notas da equipa</label><textarea className={fieldClass} rows={2} maxLength={2000} value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} /></div>
          <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "A guardar…" : "Registar cotação"}</Button><Button type="button" variant="outline" onClick={() => setShowQuoteForm(false)}>Cancelar</Button></div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3"><h3 className="font-semibold">Fornecedores identificados ({suppliers.length})</h3><p className="text-xs text-gray-500">Os contactos não são apresentados publicamente.</p></div>
          {loading ? <div className="flex items-center gap-2 p-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />A carregar…</div> : suppliers.length === 0 ? <p className="p-5 text-sm text-gray-500">Ainda não existem fornecedores registados.</p> : (
            <div className="divide-y divide-gray-100">{suppliers.map((supplier) => (
              <div key={supplier.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-gray-900">{supplier.company_name}</p><p className="text-sm text-gray-600">{supplier.product_name} · {supplier.phone}</p><p className="text-xs text-gray-500">{[provinceName(supplier.province_id), municipalityName(supplier.province_id, supplier.municipality_id), supplier.locality].filter(Boolean).join(" · ")}</p></div><span className={supplier.verification_status === "confirmed" ? "rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700" : "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"}>{supplier.verification_status === "confirmed" ? "Confirmado pela equipa" : supplier.verification_status === "contacted" ? "Contactado" : supplier.verification_status === "unavailable" ? "Indisponível" : supplier.verification_status === "rejected" ? "Rejeitado" : "Por verificar"}</span></div>
                {supplier.verification_notes && <p className="text-xs text-gray-600">Verificação: {supplier.verification_notes}</p>}
                {canManage && supplier.verification_status !== "confirmed" && supplier.verification_status !== "rejected" && <Button size="sm" variant="outline" onClick={() => { setVerificationTargetId(supplier.id); setVerificationEvidence(""); }} disabled={busySupplierId === supplier.id}><ShieldCheck className="mr-2 h-4 w-4" />Registar verificação</Button>}
                {canManage && verificationTargetId === supplier.id && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><label className={labelClass}>Evidência da confirmação (obrigatória)</label><textarea className={fieldClass} rows={3} maxLength={2000} value={verificationEvidence} onChange={(event) => setVerificationEvidence(event.target.value)} placeholder="Ex.: contacto telefónico com o produtor em 12/10; confirmou cultura, localização e contacto." required /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void verifySupplier(supplier)} disabled={busySupplierId === supplier.id || !verificationEvidence.trim()}>{busySupplierId === supplier.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Confirmar fornecedor</Button><Button size="sm" variant="outline" onClick={() => { setVerificationTargetId(null); setVerificationEvidence(""); }}>Cancelar</Button></div></div>}
              </div>
            ))}</div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3"><h3 className="font-semibold">Cotações e disponibilidade ({quotes.length})</h3><p className="text-xs text-gray-500">A quantidade só conta como confirmada após validação da equipa.</p></div>
          {loading ? <div className="p-5 text-sm text-gray-500">A carregar…</div> : quotes.length === 0 ? <p className="p-5 text-sm text-gray-500">Ainda não existem cotações registadas.</p> : (
            <div className="divide-y divide-gray-100">{quotes.map((quote) => {
              const supplier = suppliers.find((item) => item.id === quote.supplier_id);
              const request = requests.find((item) => item.id === quote.sourcing_request_id);
              const isExpiredByDate = Boolean(quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10));
              const confirmed = quote.confirmation_status === "confirmed" && !isExpiredByDate;
              const expired = quote.confirmation_status === "expired" || isExpiredByDate;
              return <div key={quote.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-gray-900">{request?.product_name ?? "Pedido indisponível"} · {supplier?.company_name ?? "Fornecedor"}</p><p className="text-sm text-gray-600">{Number(quote.available_quantity).toLocaleString("pt-AO")} {unitLabel(quote.unit)}{quote.unit_price !== null ? " · " + Number(quote.unit_price).toLocaleString("pt-AO") + " " + quote.currency + "/" + unitLabel(quote.unit) : " · Preço por confirmar"}</p><p className="text-xs text-gray-500">Disponibilidade: {quote.availability_status.replace(/_/g, " ")}{quote.expected_delivery_date ? " · Entrega: " + new Date(quote.expected_delivery_date).toLocaleDateString("pt-AO") : ""}{quote.valid_until ? " · Válida até: " + new Date(quote.valid_until).toLocaleDateString("pt-AO") : ""}</p></div><span className={confirmed ? "rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700" : expired ? "rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700" : "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"}>{confirmed ? "Confirmada" : expired ? "Expirada" : quote.confirmation_status === "rejected" ? "Rejeitada" : "Pendente"}</span></div>
                {quote.quality_notes && <p className="text-xs text-gray-600">Qualidade: {quote.quality_notes}</p>}
                {quote.notes && <p className="text-xs text-gray-600">Notas: {quote.notes}</p>}
                {canManage && !confirmed && quote.confirmation_status === "pending" && <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void confirmQuote(quote)} disabled={busyQuoteId === quote.id || !["available", "partially_available"].includes(quote.availability_status) || Boolean(quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10))}>{busyQuoteId === quote.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmar disponibilidade</Button><Button size="sm" variant="outline" onClick={() => void updateQuoteStatus(quote, "rejected")} disabled={busyQuoteId === quote.id}>Rejeitar</Button>{quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10) && <Button size="sm" variant="outline" onClick={() => void updateQuoteStatus(quote, "expired")} disabled={busyQuoteId === quote.id}>Marcar expirada</Button>}</div>}
                {confirmed && <p className="flex items-center gap-1 text-xs font-medium text-green-700"><ShieldCheck className="h-3.5 w-3.5" />Confirmada em {quote.confirmed_at ? new Date(quote.confirmed_at).toLocaleString("pt-AO") : "data não disponível"}</p>}
                {isExpiredByDate && quote.confirmation_status !== "expired" && <p className="flex items-center gap-1 text-xs text-amber-700"><CircleAlert className="h-3.5 w-3.5" />Cotação fora da validade; não deve ser tratada como disponibilidade actual.</p>}{canManage && isExpiredByDate && quote.confirmation_status === "confirmed" && <Button size="sm" variant="outline" onClick={() => void updateQuoteStatus(quote, "expired")} disabled={busyQuoteId === quote.id}>Registar expiração no histórico</Button>}
              </div>;
            })}</div>
          )}
        </div>
      </div>
    </section>
  );
}
