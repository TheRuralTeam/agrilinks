import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import AdminPaymentRecipients from "../components/admin/AdminPaymentRecipients";
import { supabase } from "../integrations/supabase/client";
import { ADMIN_BANK_ACCESS_TOKEN_KEY } from "../lib/adminBankAccess";

const ADMIN_EMAILS = {
  claudio: "claudiohenriques@agrilink.ao",
  moises: "m.lucamba@agrilink.ao",
} as const;

export default function AdminPaymentMethods() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState<"claudio" | "moises" | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [codeClaudio, setCodeClaudio] = useState("");
  const [codeMoises, setCodeMoises] = useState("");
  const [claudioApproved, setClaudioApproved] = useState(false);
  const [moisesApproved, setMoisesApproved] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);

  const invokeGate = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-bank-coordinates-gate", { body });
    if (error) throw error;
    if (!data) throw new Error("Resposta de segurança vazia.");
    return data as Record<string, any>;
  }, []);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const token = sessionStorage.getItem(ADMIN_BANK_ACCESS_TOKEN_KEY);
      if (!token) {
        if (active) setChecking(false);
        return;
      }
      try {
        const result = await invokeGate({ action: "status", access_token: token });
        if (!active) return;
        if (result.authorized === true) setAccessGranted(true);
        else sessionStorage.removeItem(ADMIN_BANK_ACCESS_TOKEN_KEY);
      } catch {
        if (active) sessionStorage.removeItem(ADMIN_BANK_ACCESS_TOKEN_KEY);
      } finally {
        if (active) setChecking(false);
      }
    };
    void check();
    return () => { active = false; };
  }, [invokeGate]);

  const startChallenge = async () => {
    setStarting(true);
    try {
      const result = await invokeGate({ action: "start" });
      setChallengeId(String(result.challenge_id || ""));
      setIpAddress(String(result.ip_address || ""));
      setExpiresAt(String(result.expires_at || ""));
      setClaudioApproved(false);
      setMoisesApproved(false);
      setCodeClaudio("");
      setCodeMoises("");
      toast.success("Pedido criado. Os dois códigos foram colocados na fila de envio.");
    } catch (error) {
      console.error("admin bank gate start:", error);
      toast.error("Não foi possível iniciar a verificação. Nenhum acesso foi concedido.");
    } finally {
      setStarting(false);
    }
  };

  const verifyCode = async (recipient: "claudio" | "moises") => {
    const code = recipient === "claudio" ? codeClaudio.trim() : codeMoises.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Introduz o código de seis dígitos recebido por email.");
      return;
    }
    setVerifying(recipient);
    try {
      const result = await invokeGate({ action: "verify", challenge_id: challengeId, recipient, code });
      if (recipient === "claudio") setClaudioApproved(true);
      else setMoisesApproved(true);
      if (result.fully_authorized === true && typeof result.access_token === "string") {
        sessionStorage.setItem(ADMIN_BANK_ACCESS_TOKEN_KEY, result.access_token);
        setAccessGranted(true);
        toast.success("Autorização dupla confirmada. Acesso concedido durante 20 minutos.");
      } else {
        toast.success("Código validado. Falta a aprovação do outro responsável.");
      }
    } catch (error) {
      console.error("admin bank gate verify:", error);
      toast.error(error instanceof Error ? error.message : "Código inválido ou expirado.");
    } finally {
      setVerifying(null);
    }
  };

  const clearAccess = () => {
    sessionStorage.removeItem(ADMIN_BANK_ACCESS_TOKEN_KEY);
    setAccessGranted(false);
    setChallengeId("");
    setClaudioApproved(false);
    setMoisesApproved(false);
    setCodeClaudio("");
    setCodeMoises("");
  };

  const expiresLabel = expiresAt
    ? new Intl.DateTimeFormat("pt-AO", { hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt))
    : "";

  return (
    <main className="min-h-screen bg-[#F7F9F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#E3EAE4] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/admindashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
            </Button>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#47724F]">
              <Landmark className="h-4 w-4" /> Administração financeira restrita
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17251A]">Coordenadas bancárias</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Área protegida por autorização dupla, validação do IP público e sessão temporária vinculada ao dispositivo.
            </p>
          </div>
          {accessGranted && <Button variant="outline" onClick={clearAccess}>Terminar acesso protegido</Button>}
        </header>

        {checking ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">A validar a autorização de segurança…</CardContent></Card>
        ) : accessGranted ? (
          <AdminPaymentRecipients />
        ) : (
          <Card className="mx-auto max-w-2xl border-[#DCE7DE] shadow-sm">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#26723D]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <CardTitle>Verificação de acesso em duas etapas administrativas</CardTitle>
              <CardDescription>
                O acesso exige dois códigos independentes, enviados aos dois responsáveis. Ambos têm de aprovar o mesmo pedido, no mesmo IP e dispositivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!challengeId ? (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    O servidor irá observar o IP público da ligação. A autorização será recusada se o IP ou o dispositivo mudar durante a validação.
                  </div>
                  <Button className="w-full" onClick={startChallenge} disabled={starting}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> {starting ? "A iniciar verificação…" : "Solicitar códigos de acesso"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-[#DCE7DE] bg-white p-3 text-sm">
                    <div className="font-semibold text-[#1D3825]">IP público observado pelo servidor</div>
                    <div className="mt-1 font-mono text-base">{ipAddress || "Não disponível"}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Os códigos expiram às {expiresLabel || "—"}. A sessão autorizada dura 20 minutos.</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="claudio-code">Código de {ADMIN_EMAILS.claudio}</Label>
                      {claudioApproved && <span className="text-xs font-semibold text-green-700">Aprovado</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input id="claudio-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codeClaudio} onChange={(e) => setCodeClaudio(e.target.value.replace(/\D/g, "").slice(0,6))} disabled={claudioApproved} placeholder="000000" />
                      <Button onClick={() => verifyCode("claudio")} disabled={verifying !== null || claudioApproved}>{verifying === "claudio" ? "A validar…" : "Validar"}</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="moises-code">Código de {ADMIN_EMAILS.moises}</Label>
                      {moisesApproved && <span className="text-xs font-semibold text-green-700">Aprovado</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input id="moises-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codeMoises} onChange={(e) => setCodeMoises(e.target.value.replace(/\D/g, "").slice(0,6))} disabled={moisesApproved} placeholder="000000" />
                      <Button onClick={() => verifyCode("moises")} disabled={verifying !== null || moisesApproved}>{verifying === "moises" ? "A validar…" : "Validar"}</Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-[#EEF5EF] p-3 text-sm text-[#31583B]">
                    <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    Os dois responsáveis devem validar os respetivos códigos. Um código isolado não concede acesso.
                  </div>
                  <Button variant="outline" className="w-full" onClick={startChallenge} disabled={starting}>
                    {starting ? "A solicitar…" : "Cancelar e gerar novos códigos"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
