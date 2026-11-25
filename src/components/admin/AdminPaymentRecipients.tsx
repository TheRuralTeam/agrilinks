import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, CircleAlert, History, Landmark, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { adminBankRpc } from "../../lib/adminBankAccess";

type PaymentChannel = "bank_transfer" | "multicaixa_express" | "unitel_money" | "afrimoney" | "paypay";

interface PaymentRecipient {
  id: string;
  display_name: string;
  channel: PaymentChannel;
  bank_name: string | null;
  account_identifier: string;
  account_holder: string;
  instructions: string | null;
  currency: string;
  active: boolean;
  verified_at: string | null;
  verified_by: string | null;
  max_amount: number | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RecipientAuditEvent {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  event_type: string;
  occurred_at: string;
  details: Record<string, unknown> | null;
}

interface RecipientForm {
  display_name: string;
  channel: PaymentChannel;
  bank_name: string;
  account_identifier: string;
  account_holder: string;
  instructions: string;
  max_amount: string;
  sort_order: string;
}

const EMPTY_FORM: RecipientForm = {
  display_name: "",
  channel: "bank_transfer",
  bank_name: "",
  account_identifier: "",
  account_holder: "",
  instructions: "",
  max_amount: "",
  sort_order: "100",
};

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  bank_transfer: "Transferência bancária",
  multicaixa_express: "Multicaixa Express",
  unitel_money: "Unitel Money",
  afrimoney: "Afrimoney",
  paypay: "PayPay",
};

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

const AdminPaymentRecipients = () => {
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [auditEvents, setAuditEvents] = useState<RecipientAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRecipient | null>(null);
  const [form, setForm] = useState<RecipientForm>(EMPTY_FORM);

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    const [recipientsResult, auditResult] = await Promise.all([
      adminBankRpc("admin_list_payment_recipients"),
      (supabase as any).rpc("admin_list_payment_recipient_audit", { p_recipient_id: null, p_limit: 50 }),
    ]);
    if (recipientsResult.error) {
      toast.error("Não foi possível carregar as coordenadas bancárias.");
      console.error("admin_list_payment_recipients:", recipientsResult.error);
      setLoading(false);
      return;
    }
    setRecipients((recipientsResult.data ?? []) as PaymentRecipient[]);
    if (auditResult.error) {
      console.error("admin_list_payment_recipient_audit:", auditResult.error);
    } else {
      setAuditEvents((auditResult.data ?? []) as RecipientAuditEvent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRecipients(); }, [loadRecipients]);

  const activeCount = useMemo(() => recipients.filter((item) => item.active && !item.archived_at).length, [recipients]);
  const pendingCount = useMemo(() => recipients.filter((item) => !item.verified_at && !item.archived_at).length, [recipients]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (recipient: PaymentRecipient) => {
    setEditing(recipient);
    setForm({
      display_name: recipient.display_name,
      channel: recipient.channel,
      bank_name: recipient.bank_name ?? "",
      account_identifier: recipient.account_identifier,
      account_holder: recipient.account_holder,
      instructions: recipient.instructions ?? "",
      max_amount: recipient.max_amount == null ? "" : String(recipient.max_amount),
      sort_order: String(recipient.sort_order ?? 100),
    });
    setDialogOpen(true);
  };

  const saveRecipient = async () => {
    if (!form.display_name.trim() || !form.account_identifier.trim() || !form.account_holder.trim()) {
      toast.error("Preencha o nome, a coordenada e o titular da conta.");
      return;
    }
    const maxAmount = form.max_amount.trim() ? Number(form.max_amount) : null;
    const sortOrder = Number(form.sort_order || 100);
    if ((maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount <= 0)) || !Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error("Verifique o limite máximo e a ordem de apresentação.");
      return;
    }

    setSaving(true);
    const args = {
      p_display_name: form.display_name.trim(),
      p_channel: form.channel,
      p_account_identifier: form.account_identifier.trim(),
      p_account_holder: form.account_holder.trim(),
      p_bank_name: form.bank_name.trim() || null,
      p_instructions: form.instructions.trim() || null,
      p_max_amount: maxAmount,
      p_sort_order: sortOrder,
    };
    const { error } = editing
      ? await (supabase as any).rpc("admin_update_payment_recipient", { p_recipient_id: editing.id, ...args })
      : await (supabase as any).rpc("admin_create_payment_recipient", args);
    setSaving(false);
    if (error) {
      console.error("save payment recipient:", error);
      toast.error(error.message?.includes("duplicate key") ? "Esta coordenada já está registada." : "Não foi possível guardar a conta.");
      return;
    }
    toast.success(editing ? "Coordenadas atualizadas." : "Conta bancária adicionada.");
    setDialogOpen(false);
    await loadRecipients();
  };

  const runAction = async (
    recipient: PaymentRecipient,
    action: "verify" | "activate" | "deactivate" | "archive",
  ) => {
    if (action === "archive" && !window.confirm("Arquivar esta conta? O histórico de pagamentos será preservado.")) return;
    const rpc = {
      verify: "admin_verify_payment_recipient",
      activate: "admin_set_payment_recipient_active",
      deactivate: "admin_set_payment_recipient_active",
      archive: "admin_archive_payment_recipient",
    }[action];
    const args = action === "activate" || action === "deactivate"
      ? { p_recipient_id: recipient.id, p_active: action === "activate" }
      : { p_recipient_id: recipient.id };
    const { error } = await (supabase as any).rpc(rpc, args);
    if (error) {
      console.error(rpc, error);
      toast.error(error.message?.includes("RECIPIENT_MUST_BE_VERIFIED")
        ? "Verifique a conta antes de a ativar."
        : "Não foi possível concluir a operação.");
      return;
    }
    toast.success({
      verify: "Conta verificada. A ativação continua a ser uma ação separada.",
      activate: "Conta ativada e disponível para o checkout.",
      deactivate: "Conta desativada.",
      archive: "Conta arquivada; os registos históricos foram preservados.",
    }[action]);
    await loadRecipients();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#47724F]">
            <Landmark className="h-4 w-4" /> Gestão de recebimentos
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#17251A]">Métodos de pagamento P2P</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configure as contas oficiais que recebem os pagamentos do marketplace. Alterações não modificam instruções já associadas a pagamentos existentes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadRecipients()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar</Button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Adicionar conta</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Contas registadas</p><p className="mt-1 text-2xl font-bold">{recipients.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ativas no checkout</p><p className="mt-1 text-2xl font-bold text-emerald-700">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Aguardam verificação</p><p className="mt-1 text-2xl font-bold text-amber-700">{pendingCount}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border bg-white py-14 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar contas...</div>
      ) : recipients.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center"><Landmark className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Ainda não existem contas registadas</p><p className="mt-1 text-sm text-muted-foreground">Adicione uma conta para disponibilizar transferência bancária no checkout depois da verificação.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {recipients.map((recipient) => (
            <Card key={recipient.id} className={recipient.archived_at ? "opacity-70" : ""}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">{recipient.display_name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{CHANNEL_LABELS[recipient.channel]} · {recipient.currency}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {recipient.archived_at ? <Badge variant="secondary">Arquivada</Badge>
                    : recipient.active ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativa</Badge>
                    : recipient.verified_at ? <Badge variant="outline">Verificada · Inativa</Badge>
                    : <Badge variant="outline" className="border-amber-300 text-amber-800">Pendente de verificação</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recipient.bank_name && <div><p className="text-xs text-muted-foreground">Banco</p><p className="break-words text-sm font-medium">{recipient.bank_name}</p></div>}
                  <div><p className="text-xs text-muted-foreground">Coordenada</p><p className="break-all font-mono text-sm font-semibold">{recipient.account_identifier}</p></div>
                  <div><p className="text-xs text-muted-foreground">Titular</p><p className="break-words text-sm font-medium">{recipient.account_holder}</p></div>
                  {recipient.max_amount != null && <div><p className="text-xs text-muted-foreground">Limite por pagamento</p><p className="text-sm font-medium">{recipient.max_amount.toLocaleString("pt-AO")} Kz</p></div>}
                  <div><p className="text-xs text-muted-foreground">Última atualização</p><p className="text-sm">{formatDate(recipient.updated_at)}</p></div>
                  {recipient.verified_at && <div><p className="text-xs text-muted-foreground">Verificada em</p><p className="text-sm">{formatDate(recipient.verified_at)}</p></div>}
                </div>
                {recipient.instructions && <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{recipient.instructions}</p>}
                {!recipient.archived_at && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => openEdit(recipient)}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar</Button>
                    {!recipient.verified_at && <Button size="sm" variant="outline" onClick={() => void runAction(recipient, "verify")}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verificar</Button>}
                    {recipient.verified_at && !recipient.active && <Button size="sm" onClick={() => void runAction(recipient, "activate")}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Ativar</Button>}
                    {recipient.active && <Button size="sm" variant="outline" onClick={() => void runAction(recipient, "deactivate")}><ToggleLeft className="mr-1.5 h-3.5 w-3.5" /> Desativar</Button>}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void runAction(recipient, "archive")}><Archive className="mr-1.5 h-3.5 w-3.5" /> Arquivar</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Uma conta só aparece no checkout quando está verificada e ativa. O comprovativo submetido pelo comprador não confirma automaticamente a entrada do dinheiro.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Histórico de alterações</CardTitle>
          <p className="text-sm text-muted-foreground">Registo de criação, edição, verificação, ativação, desativação e arquivo das contas.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não existem alterações administrativas registadas.</p>
          ) : auditEvents.map((event) => (
            <div key={event.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{({
                  "payment_recipient.created": "Conta adicionada",
                  "payment_recipient.updated": "Coordenadas editadas",
                  "payment_recipient.verified": "Conta verificada",
                  "payment_recipient.activated": "Conta ativada",
                  "payment_recipient.deactivated": "Conta desativada",
                  "payment_recipient.archived": "Conta arquivada",
                } as Record<string, string>)[event.action] ?? event.action}</p>
                <p className="text-xs text-muted-foreground">Por {event.actor_name}</p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{formatDate(event.occurred_at)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar coordenadas bancárias" : "Adicionar método de pagamento"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="recipient-name">Nome apresentado</Label><Input id="recipient-name" value={form.display_name} onChange={(event) => setForm((value) => ({ ...value, display_name: event.target.value }))} placeholder="Ex.: Transferência bancária — AgriLink" /></div>
            <div className="space-y-2"><Label htmlFor="recipient-channel">Método</Label><select id="recipient-channel" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.channel} onChange={(event) => setForm((value) => ({ ...value, channel: event.target.value as PaymentChannel }))}>{Object.entries(CHANNEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="recipient-bank">Banco / instituição</Label><Input id="recipient-bank" value={form.bank_name} onChange={(event) => setForm((value) => ({ ...value, bank_name: event.target.value }))} placeholder="Nome do banco" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="recipient-account">IBAN / número / identificador</Label><Input id="recipient-account" value={form.account_identifier} onChange={(event) => setForm((value) => ({ ...value, account_identifier: event.target.value }))} autoComplete="off" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="recipient-holder">Titular da conta</Label><Input id="recipient-holder" value={form.account_holder} onChange={(event) => setForm((value) => ({ ...value, account_holder: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="recipient-instructions">Instruções para o comprador</Label><Textarea id="recipient-instructions" value={form.instructions} onChange={(event) => setForm((value) => ({ ...value, instructions: event.target.value }))} rows={3} /></div>
            <div className="space-y-2"><Label htmlFor="recipient-limit">Limite máximo (Kz, opcional)</Label><Input id="recipient-limit" type="number" min="0" value={form.max_amount} onChange={(event) => setForm((value) => ({ ...value, max_amount: event.target.value }))} placeholder="Sem limite" /></div>
            <div className="space-y-2"><Label htmlFor="recipient-order">Ordem de apresentação</Label><Input id="recipient-order" type="number" min="0" step="1" value={form.sort_order} onChange={(event) => setForm((value) => ({ ...value, sort_order: event.target.value }))} /></div>
          </div>
          {editing && <p className="text-xs text-muted-foreground">Se alterar o banco, o IBAN, o método ou o titular, a conta será desativada e terá de ser verificada novamente.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveRecipient()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Guardar alterações" : "Adicionar conta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AdminPaymentRecipients;
