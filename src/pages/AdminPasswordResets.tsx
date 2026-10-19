import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ShieldAlert, Search, Copy, Check, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

type Account = { id: string; full_name: string | null; email: string | null; phone: string | null; user_type: string | null; is_root_admin?: boolean | null; is_super_root?: boolean | null };

export default function AdminPasswordResets() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastPassword, setLastPassword] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("users").select("id,full_name,email,phone,user_type,is_root_admin").order("full_name");
        if (error) throw error;
        if (active) setAccounts((data ?? []) as Account[]);
      } catch (error: any) {
        toast.error(error?.message || "Não foi possível carregar os utilizadores.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return accounts.filter((account) => !term || [account.full_name, account.email, account.phone, account.user_type].some((v) => (v || "").toLocaleLowerCase().includes(term)));
  }, [accounts, query]);

  const resetPassword = async () => {
    if (!targetId) return toast.error("Seleccione o utilizador.");
    if (temporaryPassword.length < 12) return toast.error("A senha temporária deve ter pelo menos 12 caracteres.");
    if (!/[a-z]/.test(temporaryPassword) || !/[A-Z]/.test(temporaryPassword) || !/[0-9]/.test(temporaryPassword) || !/[^A-Za-z0-9]/.test(temporaryPassword)) {
      return toast.error("Use maiúsculas, minúsculas, números e um símbolo.");
    }
    const target = accounts.find((account) => account.id === targetId);
    if (!target) return toast.error("Utilizador não encontrado.");
    if (!window.confirm(`Vai substituir a senha de ${target.full_name || target.email || target.id} e exigir uma nova senha no próximo login. Continuar?`)) return;
    setSaving(true);
    setLastPassword("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-user-password", {
        body: { user_id: targetId, temporary_password: temporaryPassword },
      });
      if (error) {
        const details = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(details?.error || error.message);
      }
      if (!data?.success) throw new Error(data?.error || "Não foi possível redefinir a senha.");
      setLastPassword(temporaryPassword);
      setTemporaryPassword("");
      toast.success("Senha temporária definida. A troca será obrigatória no próximo login.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao redefinir a senha.");
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = async () => {
    if (!lastPassword) return;
    try {
      await navigator.clipboard.writeText(lastPassword);
      setCopied(true);
      toast.success("Senha copiada. Partilhe-a apenas por um canal seguro.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Seleccione a senha e copie-a manualmente.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F7] p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/admindashboard?tab=users")}><ArrowLeft className="h-4 w-4" /> Voltar aos utilizadores</Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Redefinir senhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina uma senha temporária e obrigue o utilizador a escolher outra ao entrar novamente.</p>
        </div>
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>A senha temporária dá acesso à conta. Entregue-a ao titular por um canal privado e seguro. Nunca envie senhas por grupos ou canais públicos. A senha não será enviada por email.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Nova senha temporária</CardTitle>
            <CardDescription>Disponível apenas para administradores com permissão de gestão de utilizadores. As contas Root/Super Root têm protecção adicional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-search">Procurar utilizador</Label>
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="account-search" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Nome, email, telefone ou tipo de conta" /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-select">Conta a redefinir</Label>
              <Select value={targetId} onValueChange={setTargetId} disabled={loading}>
                <SelectTrigger id="account-select"><SelectValue placeholder={loading ? "A carregar utilizadores…" : "Seleccione uma conta"} /></SelectTrigger>
                <SelectContent>
                  {filtered.map((account) => <SelectItem key={account.id} value={account.id}>{account.full_name || "Sem nome"} — {account.email || account.phone || account.id.slice(0, 8)}{account.is_root_admin ? " · Administrador" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              {loading && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> A carregar contas…</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="temporary-password">Senha temporária</Label>
              <Input id="temporary-password" type="password" autoComplete="new-password" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} minLength={12} placeholder="Mínimo 12 caracteres, incluindo maiúsculas, números e símbolo" />
              <p className="text-xs text-muted-foreground">Não reutilize senhas pessoais. O sistema não guarda a senha em texto simples; só a mostra aqui após a operação, para que possa entregá-la ao utilizador.</p>
            </div>
            <Button onClick={resetPassword} disabled={saving || loading || !targetId || !temporaryPassword} className="w-full sm:w-auto">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A redefinir…</> : <><KeyRound className="mr-2 h-4 w-4" /> Redefinir e exigir troca</>}
            </Button>
          </CardContent>
        </Card>
        {lastPassword && <Card className="border-emerald-200">
          <CardHeader><CardTitle className="text-base">Senha temporária criada</CardTitle><CardDescription>Copie-a agora e entregue-a ao titular por um canal seguro. Esta visualização desaparece ao sair ou actualizar a página.</CardDescription></CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input readOnly value={lastPassword} aria-label="Senha temporária criada" />
            <Button variant="outline" onClick={copyPassword} className="shrink-0">{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copiada" : "Copiar senha"}</Button>
          </CardContent>
        </Card>}
      </div>
    </div>
  );
}
