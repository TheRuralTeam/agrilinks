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
  const { user, userProfile, logout, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Conta já libertada: não faz sentido ficar nesta etapa
  useEffect(() => {
    if (user && (Boolean(user.email_confirmed_at) || userProfile?.email_verified === true)) {
      refreshProfile();
      navigate("/app", { replace: true });
    }
  }, [user, userProfile, navigate, refreshProfile]);

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
      toast({
        title: "Insira o email",
        description: "Informe o email usado no cadastro.",
        variant: "destructive",
      });
      return;
    }

    if (countdown > 0 || sending) return;

    setSending(true);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/app`;

      console.log("[AgriLink] Enviando magic link:", {
        email: cleanEmail,
        redirect_to: redirectTo,
      });

      const { data, error } = await supabase.functions.invoke(
        "send-magic-link",
        {
          body: {
            email: cleanEmail,
            redirect_to: redirectTo,
          },
        },
      );

      console.log("[AgriLink] Resposta da Edge Function:", {
        data,
        error,
      });

      if (error) {
        const details = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(details?.error || details?.details || error.message || "Não foi possível enviar o link.");
      }

      if (!data) {
        throw new Error("A Edge Function não retornou nenhuma resposta.");
      }

      if (data.error) {
        console.error("[AgriLink] Erro retornado pela função:", data.error);
        throw new Error(data.error);
      }

      if (data.success !== true) {
        throw new Error(
          "O servidor não confirmou o envio do email.",
        );
      }

      setSent(true);
      setCountdown(RESEND_COOLDOWN);

      toast({
        title: "Link enviado",
        description:
          "Verifique a caixa de entrada e a pasta de spam do seu email.",
      });
    } catch (err: any) {
      console.error("[AgriLink] Falha ao enviar magic link:", err);

      toast({
        title: "Erro ao enviar link",
        description:
          err?.message ||
          "Não foi possível enviar o link. Tente novamente dentro de instantes.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={orbisLinkLogo} alt="OrbisLink" className="h-10 mx-auto" />
          <CardTitle className="flex items-center justify-center gap-2">
            {sent ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Link enviado
              </>
            ) : (
              <>
                <MailCheck className="h-5 w-5" />
                Confirme o seu email
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <p className="text-sm text-muted-foreground text-center">
              Enviámos um link de confirmação para <strong>{email}</strong>.
              Ele expira em 1 hora. Abra o email e confirme na página segura da AgriLink.
            </p>
          ) : (
            <>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleSend}
                disabled={sending || countdown > 0}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A enviar...
                  </>
                ) : countdown > 0 ? (
                  `Aguarde ${countdown}s`
                ) : (
                    "Enviar link de confirmação"
                )}
              </Button>
            </>
          )}

          {sent && (
            <Button variant="outline" className="w-full" onClick={handleSend} disabled={sending || countdown > 0}>
              {countdown > 0 ? `Reenviar link em ${countdown}s` : "Reenviar link de confirmação"}
            </Button>
          )}

          <Button variant="ghost" className="w-full" onClick={handleLogout}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmation;