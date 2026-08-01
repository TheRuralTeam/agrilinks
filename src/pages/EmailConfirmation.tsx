import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import orbisLinkLogo from "@/assets/orbislink-logo.png";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const RESEND_COOLDOWN = 60;

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Conta já libertada: não faz sentido ficar nesta etapa
  useEffect(() => {
    if (user && userProfile?.email_verified === true) {
      navigate("/app", { replace: true });
    }
  }, [user, userProfile, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    const loadEmail = async () => {
      const query = new URLSearchParams(window.location.search);
      const queryEmail = query.get("email");
      if (queryEmail) {
        setEmail(queryEmail);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.email) setEmail(data.session.user.email);
    };
    loadEmail();
  }, []);

  const handleSend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast({ title: "Insira o email", description: "Informe o email usado no cadastro.", variant: "destructive" });
      return;
    }
    if (countdown > 0 || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: {
          email: cleanEmail,
          redirect_to: `${window.location.origin}/auth/callback?next=/app`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setSent(true);
      setCountdown(RESEND_COOLDOWN);
      toast({
        title: "Link enviado",
        description: "Verifique a caixa de entrada (e o spam) do seu email.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar link",
        description: err?.message || "Tente novamente dentro de instantes.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={orbisLinkLogo} alt="AgriLink" className="h-16 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-primary">AgriLink</h1>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-center">Confirmar o seu email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              {sent ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-foreground">
                      Enviámos um link de confirmação para o teu email
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Clica nele para continuares. O link expira em 1 hora e só pode ser usado uma vez.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <MailCheck className="h-16 w-16 text-primary" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-foreground">Confirmação por link seguro</p>
                    <p className="text-muted-foreground text-sm">
                      Enviamos um link único por no-reply@agrilink.ao. Não precisa de digitar nenhum código.
                    </p>
                  </div>
                </>
              )}

              <div className="w-full space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email usado no cadastro"
                />
                <Button onClick={handleSend} disabled={sending || countdown > 0} className="w-full">
                  {sending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar...</>
                  ) : countdown > 0 ? (
                    `Reenviar link em ${countdown}s`
                  ) : sent ? (
                    "Reenviar link de confirmação"
                  ) : (
                    "Enviar link de confirmação"
                  )}
                </Button>
                {user ? (
                  <Button
                    variant="outline"
                    onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
                    className="w-full"
                  >
                    Sair e usar outra conta
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                    Voltar para Login
                  </Button>
                )}
                <p className="text-xs text-center text-muted-foreground">
                  A conta permanece apenas em modo de visualização até clicar no link de confirmação.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmation;
