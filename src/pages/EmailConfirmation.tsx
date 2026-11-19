import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Input } from "../components/ui/input";
import agrilinkLogo from "../assets/LogoAgriLinkOfficiallNoBackground.png";
import { toast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/ui/Loader";

const RESEND_COOLDOWN = 60;

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const { user, logout, refreshProfile, resendSignupConfirmation } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Conta já libertada: não faz queuedido ficar nesta etapa
  useEffect(() => {
    if (user && Boolean(user.email_confirmed_at)) {
      refreshProfile();
      navigate("/app", { replace: true });
    }
  }, [user, navigate, refreshProfile]);

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
      if (queryEmail) setEmail(queryEmail);
      else if (user?.email) setEmail(user.email);
    };
    loadEmail();
  }, [user?.email]);

  const handleSend = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      toast({
        title: "Insira o email",
        description: "Informe o email utilizado no registo.",
        variant: "destructive",
      });
      return;
    }

    if (countdown > 0 || sending) return;

    setSending(true);

    try {
      const { error } = await resendSignupConfirmation(cleanEmail);
      if (error) throw error;

      setQueued(true);
      setCountdown(RESEND_COOLDOWN);

      toast({
        title: "Pedido de confirmação registado",
        description:
          "O pedido foi colocado na fila de envio. Verifique a caixa de entrada e a pasta de spam.",
      });
    } catch (err: any) {
      console.error("[AgriLink] Falha ao reenviar confirmação de conta:", err);

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
          <img src={agrilinkLogo} alt="AgriLink" className="h-10 mx-auto" />
          <CardTitle className="flex items-center justify-center gap-2">
            {queued ? (
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
          {queued ? (
            <p className="text-sm text-muted-foreground text-center">
              O pedido de confirmação para <strong>{email}</strong> foi colocado na fila de envio.
              Assim que a mensagem for processada, abra o link para confirmar a conta.
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
                    <Loader compact className="mr-2 [&_svg]:text-primary-foreground" />
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

          {queued && (
            <Button variant="outline" className="w-full" onClick={handleSend} disabled={sending || countdown > 0}>
              {countdown > 0 ? `Novo pedido em ${countdown}s` : "Pedir novo email de confirmação"}
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