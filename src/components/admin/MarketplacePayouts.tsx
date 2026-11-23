import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Loader2, RefreshCw, ShieldCheck, UploadCloud, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../integrations/supabase/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

type PayoutStatus =
  | "awaiting_beneficiary_verification"
  | "awaiting_manual_payout"
  | "processing"
  | "paid"
  | "failed"
  | "blocked"
  | "cancelled";

interface Payout {
  id: string;
  recipient_user_id: string;
  payment_allocation_id: string;
  payout_type: "seller" | "driver" | string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  beneficiary_id: string | null;
  payout_reference: string | null;
  proof_url: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

interface Beneficiary {
  id: string;
  user_id: string;
  channel: string;
  account_holder: string;
  masked_account_label: string;
  currency: string;
  status: "pending" | "verified" | "rejected" | "disabled";
  verified_at: string | null;
  created_at: string;
}

interface Recipient {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

const statusLabels: Record<PayoutStatus, string> = {
  awaiting_beneficiary_verification: "Aguarda beneficiário",
  awaiting_manual_payout: "Na fila de pagamento",
  processing: "Em processamento",
  paid: "Pago",
  failed: "Falhou",
  blocked: "Bloqueado",
  cancelled: "Cancelado",
};

const statusVariant: Record<PayoutStatus, "default" | "secondary" | "destructive" | "outline"> = {
  awaiting_beneficiary_verification: "outline",
  awaiting_manual_payout: "secondary",
  processing: "default",
  paid: "default",
  failed: "destructive",
  blocked: "destructive",
  cancelled: "outline",
};

const channelLabels: Record<string, string> = {
  bank_transfer: "Transferência bancária",
  multicaixa_express: "Multicaixa Express",
  unitel_money: "Unitel Money",
  afrimoney: "Afrimoney",
  paypay: "PayPay",
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: currency || "AOA", maximumFractionDigits: 2 }).format(amount);

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-AO") : "—";

const MarketplacePayouts = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [recipients, setRecipients] = useState<Record<string, Recipient>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Payout | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerUserId, setRegisterUserId] = useState("");
  const [channel, setChannel] = useState("bank_transfer");
  const [providerRef, setProviderRef] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [maskedLabel, setMaskedLabel] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const db = supabase as any;
      const [payoutResult, beneficiaryResult] = await Promise.all([
        db.from("marketplace_payouts").select("*").order("created_at", { ascending: false }).limit(250),
        db.from("marketplace_payout_beneficiaries")
          .select("id,user_id,channel,account_holder,masked_account_label,currency,status,verified_at,created_at")
          .order("created_at", { ascending: false }).limit(250),
      ]);
      if (payoutResult.error) throw payoutResult.error;
      if (beneficiaryResult.error) throw beneficiaryResult.error;
      const nextPayouts = (payoutResult.data ?? []) as Payout[];
      const nextBeneficiaries = (beneficiaryResult.data ?? []) as Beneficiary[];
      const userIds = [...new Set([...nextPayouts.map((p) => p.recipient_user_id), ...nextBeneficiaries.map((b) => b.user_id)])];
      let recipientMap: Record<string, Recipient> = {};
      if (userIds.length) {
        const { data, error } = await db.from("users").select("id,full_name,phone,email").in("id", userIds);
        if (error) throw error;
        recipientMap = Object.fromEntries(((data ?? []) as Recipient[]).map((user) => [user.id, user]));
      }
      setPayouts(nextPayouts);
      setBeneficiaries(nextBeneficiaries);
      setRecipients(recipientMap);
    } catch (error) {
      console.error("Marketplace payout administration load failed", error);
      toast.error("Não foi possível carregar os pagamentos do marketplace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    waiting: payouts.filter((p) => p.status === "awaiting_beneficiary_verification").length,
    queue: payouts.filter((p) => p.status === "awaiting_manual_payout").length,
    processing: payouts.filter((p) => p.status === "processing").length,
    paid: payouts.filter((p) => p.status === "paid").length,
  }), [payouts]);

  const registerBeneficiary = async () => {
    if (!registerUserId || !providerRef.trim() || !accountHolder.trim() || !maskedLabel.trim()) {
      toast.error("Preencha todos os dados do beneficiário.");
      return;
    }
    setBusyId(registerUserId);
    try {
      const { error } = await (supabase as any).rpc("admin_register_marketplace_payout_beneficiary", {
        p_user_id: registerUserId,
        p_channel: channel,
        p_provider_beneficiary_ref: providerRef.trim(),
        p_account_holder: accountHolder.trim(),
        p_masked_account_label: maskedLabel.trim(),
      });
      if (error) throw error;
      toast.success("Beneficiário registado para verificação.");
      setRegisterOpen(false);
      setProviderRef("");
      setAccountHolder("");
      setMaskedLabel("");
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível registar o beneficiário.");
    } finally {
      setBusyId(null);
    }
  };

  const reviewBeneficiary = async (beneficiary: Beneficiary, decision: "verified" | "rejected" | "disabled") => {
    setBusyId(beneficiary.id);
    try {
      const { error } = await (supabase as any).rpc("admin_review_marketplace_payout_beneficiary", {
        p_beneficiary_id: beneficiary.id,
        p_decision: decision,
        p_reason: decision === "rejected" ? decisionReason.trim() || null : null,
      });
      if (error) throw error;
      toast.success(decision === "verified" ? "Beneficiário verificado. Pagamentos elegíveis enviados para a fila." : "Estado do beneficiário actualizado.");
      setDecisionReason("");
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível actualizar o beneficiário.");
    } finally {
      setBusyId(null);
    }
  };

  const transition = async (payout: Payout, action: string) => {
    if (action === "paid" && (!proofFile || !payoutReference.trim())) {
      toast.error("Anexe o comprovativo bancário e indique a referência da transferência.");
      return;
    }
    if (action === "failed" && !failureReason.trim()) {
      toast.error("Indique o motivo da falha.");
      return;
    }
    setBusyId(payout.id);
    try {
      let proofPath: string | null = null;
      if (action === "paid" && proofFile) {
        const safeExtension = proofFile.name.split(".").pop()?.toLowerCase() || "pdf";
        const allowed = ["pdf", "jpg", "jpeg", "png", "webp"];
        if (!allowed.includes(safeExtension) || proofFile.size > 8 * 1024 * 1024) {
          throw new Error("Comprovativo inválido. Use PDF/JPG/PNG/WEBP até 8 MB.");
        }
        proofPath = `${payout.id}/${crypto.randomUUID()}.${safeExtension}`;
        const { error: uploadError } = await supabase.storage.from("marketplace-payout-proofs").upload(proofPath, proofFile, {
          contentType: proofFile.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const { error } = await (supabase as any).rpc("admin_transition_marketplace_payout", {
        p_payout_id: payout.id,
        p_action: action,
        p_payout_reference: action === "paid" ? payoutReference.trim() : null,
        p_proof_url: proofPath,
        p_failure_reason: action === "failed" ? failureReason.trim() : null,
      });
      if (error) throw error;
      toast.success(action === "paid" ? "Pagamento registado com comprovativo." : "Estado do pagamento actualizado.");
      setSelected(null);
      setPayoutReference("");
      setFailureReason("");
      setProofFile(null);
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível actualizar o pagamento.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("marketplace-payout-proofs").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o comprovativo.");
      return;
    }
    window.location.assign(data.signedUrl);
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pagamentos do marketplace</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Verificação de beneficiários e controlo das liquidações separadas de fornecedores e motoristas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button onClick={() => setRegisterOpen(true)}>Registar beneficiário</Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Liquidação manual.</strong> Esta área não executa transferências bancárias. Confirme a saída no portal/extracto bancário antes de registar o pagamento como concluído. Nunca introduza IBAN, PIN ou OTP nesta aplicação; use apenas a referência tokenizada do PSP/vault.</div></div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Aguardam beneficiário", totals.waiting],
          ["Na fila manual", totals.queue],
          ["Em processamento", totals.processing],
          ["Pagos", totals.paid],
        ].map(([label, value]) => (
          <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Fila de liquidações</CardTitle></CardHeader>
        <CardContent>
          {payouts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não existem pagamentos de fornecedores ou motoristas.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">Destinatário</th><th className="p-3">Tipo</th><th className="p-3">Valor</th><th className="p-3">Estado</th><th className="p-3">Criado</th><th className="p-3">Acção</th></tr></thead>
                <tbody>
                  {payouts.map((payout) => {
                    const recipient = recipients[payout.recipient_user_id];
                    return <tr key={payout.id} className="border-b last:border-0">
                      <td className="p-3"><div className="font-semibold">{recipient?.full_name || "Utilizador"}</div><div className="text-xs text-muted-foreground">{recipient?.phone || recipient?.email || payout.recipient_user_id}</div></td>
                      <td className="p-3">{payout.payout_type === "seller" ? "Fornecedor" : "Motorista"}</td>
                      <td className="p-3 font-semibold tabular-nums">{formatMoney(payout.amount, payout.currency)}</td>
                      <td className="p-3"><Badge variant={statusVariant[payout.status] || "outline"}>{statusLabels[payout.status] || payout.status}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(payout.created_at)}</td>
                      <td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelected(payout)}>Gerir</Button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Beneficiários</CardTitle></CardHeader>
        <CardContent>
          {beneficiaries.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum beneficiário registado.</p> : (
            <div className="space-y-3">
              {beneficiaries.map((beneficiary) => {
                const recipient = recipients[beneficiary.user_id];
                return <div key={beneficiary.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{recipient?.full_name || "Utilizador"}</div>
                    <div className="text-xs text-muted-foreground">{channelLabels[beneficiary.channel] || beneficiary.channel} · {beneficiary.account_holder} · {beneficiary.masked_account_label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Verificado: {formatDate(beneficiary.verified_at)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={beneficiary.status === "verified" ? "default" : beneficiary.status === "rejected" || beneficiary.status === "disabled" ? "destructive" : "outline"}>{beneficiary.status}</Badge>
                    {beneficiary.status === "pending" && <>
                      <Button size="sm" onClick={() => void reviewBeneficiary(beneficiary, "verified")} disabled={busyId === beneficiary.id}><CheckCircle2 className="mr-1 h-4 w-4" /> Verificar</Button>
                      <Button size="sm" variant="destructive" onClick={() => void reviewBeneficiary(beneficiary, "rejected")} disabled={busyId === beneficiary.id}>Rejeitar</Button>
                    </>}
                    {beneficiary.status === "verified" && <Button size="sm" variant="outline" onClick={() => void reviewBeneficiary(beneficiary, "disabled")} disabled={busyId === beneficiary.id}>Revogar</Button>}
                  </div>
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registar beneficiário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ID do utilizador destinatário</Label><Input value={registerUserId} onChange={(e) => setRegisterUserId(e.target.value)} placeholder="UUID do fornecedor ou motorista" /></div>
            <div><Label>Canal de pagamento</Label><Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(channelLabels).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Referência tokenizada do PSP/vault</Label><Input value={providerRef} onChange={(e) => setProviderRef(e.target.value)} autoComplete="off" /></div>
            <div><Label>Titular da conta</Label><Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></div>
            <div><Label>Identificador mascarado</Label><Input value={maskedLabel} onChange={(e) => setMaskedLabel(e.target.value)} placeholder="Ex.: Conta •••• 1234" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancelar</Button><Button onClick={() => void registerBeneficiary()} disabled={busyId === registerUserId}>Registar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {selected && <>
            <DialogHeader><DialogTitle>Gerir liquidação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3 text-sm"><div className="font-semibold">{recipients[selected.recipient_user_id]?.full_name || selected.recipient_user_id}</div><div>{selected.payout_type === "seller" ? "Fornecedor" : "Motorista"} · {formatMoney(selected.amount, selected.currency)}</div><div className="mt-1 text-muted-foreground">{statusLabels[selected.status]}</div></div>
              {selected.status === "awaiting_beneficiary_verification" && <p className="text-sm text-muted-foreground">Registe e verifique primeiro o beneficiário associado a este destinatário.</p>}
              {selected.status === "awaiting_manual_payout" && <div className="space-y-2"><Button className="w-full" onClick={() => void transition(selected, "processing")} disabled={busyId === selected.id}><Clock3 className="mr-2 h-4 w-4" /> Iniciar processamento manual</Button><Button className="w-full" variant="destructive" onClick={() => void transition(selected, "blocked")} disabled={busyId === selected.id}>Bloquear liquidação</Button></div>}
              {selected.status === "processing" && <>
                <div><Label>Referência bancária da transferência</Label><Input value={payoutReference} onChange={(e) => setPayoutReference(e.target.value)} /></div>
                <div><Label>Comprovativo bancário (PDF/JPG/PNG/WEBP, máximo 8 MB)</Label><Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setProofFile(e.target.files?.[0] || null)} /></div>
                <Button className="w-full" onClick={() => void transition(selected, "paid")} disabled={busyId === selected.id || !proofFile || !payoutReference.trim()}><FileCheck2 className="mr-2 h-4 w-4" /> Confirmar transferência efectuada</Button>
                <Button className="w-full" variant="destructive" onClick={() => void transition(selected, "blocked")} disabled={busyId === selected.id}>Bloquear liquidação</Button>
                <div className="border-t pt-3"><Label>Motivo de falha (se aplicável)</Label><Textarea value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Descreva a falha confirmada pelo banco/PSP." /><Button className="mt-2" variant="destructive" onClick={() => void transition(selected, "failed")} disabled={busyId === selected.id || !failureReason.trim()}>Registar falha</Button></div>
              </>}
              {selected.status === "failed" && <div className="space-y-2"><Button className="w-full" onClick={() => void transition(selected, "retry")} disabled={busyId === selected.id}>Recolocar na fila manual</Button><Button className="w-full" variant="destructive" onClick={() => void transition(selected, "blocked")} disabled={busyId === selected.id}>Bloquear liquidação</Button></div>}
              {selected.status === "blocked" && <Button className="w-full" onClick={() => void transition(selected, "unblock")} disabled={busyId === selected.id}>Desbloquear (beneficiário válido)</Button>}
              {selected.status === "paid" && <>
                <div className="rounded-lg border p-3 text-sm"><p><strong>Referência:</strong> {selected.payout_reference || "—"}</p><p><strong>Pago em:</strong> {formatDate(selected.paid_at)}</p></div>
                {selected.proof_url && <Button variant="outline" className="w-full" onClick={() => void downloadProof(selected.proof_url!)}><UploadCloud className="mr-2 h-4 w-4" /> Abrir comprovativo privado</Button>}
              </>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplacePayouts;
