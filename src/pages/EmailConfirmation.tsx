import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import agrilinkLogo from "@/assets/agrilink-logo.png";

const EmailConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // Primeiro, deixe o Supabase processar a URL (hash ou query) e criar a sessão
        const { data: sessionData, error: sessionError } = await supabase.auth.getSessionFromUrl({ storeSession: true });

        if (sessionError) {
          console.warn('getSessionFromUrl error:', sessionError);
        }

        // Se o Supabase criou uma sessão, consideramos a confirmação como bem sucedida
        if (sessionData?.session?.user) {
          setStatus('success');
          setMessage('E-mail confirmado com sucesso! Você será redirecionado automaticamente.');
          setTimeout(() => navigate('/app'), 3000);
          return;
        }

        // Fallback: alguns links podem expor o token no fragmento/hash ou na query como token/access_token
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const accessToken = hashParams.get('access_token') || url.searchParams.get('access_token') || url.searchParams.get('token') || hashParams.get('token');
        const type = url.searchParams.get('type') || hashParams.get('type');
        const email = url.searchParams.get('email') || hashParams.get('email') || undefined;

        if (!accessToken) {
          setStatus('error');
          setMessage('Link de confirmação inválido. Token não encontrado.');
          return;
        }

        // Tentar verificar via verifyOtp usando token extraído
        const payload: any = {
          token: accessToken,
          type: type === 'recovery' ? 'recovery' : 'signup',
        };
        if (email) payload.email = email;

        const { error } = await supabase.auth.verifyOtp(payload);
        if (error) {
          console.error('Erro ao confirmar e-mail (verifyOtp):', error);
          setStatus('error');
          setMessage(error.message || 'Erro ao confirmar e-mail. O link pode ter expirado.');
          return;
        }

        // Sucesso - verificar se a sessão foi criada
        const { data: checkSession } = await supabase.auth.getSession();
        if (checkSession.session) {
          setStatus('success');
          setMessage('E-mail confirmado com sucesso! Você será redirecionado automaticamente.');
          setTimeout(() => navigate('/app'), 3000);
        } else {
          setStatus('error');
          setMessage('E-mail confirmado, mas não foi possível estabelecer a sessão. Tente fazer login manualmente.');
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
        setStatus('error');
        setMessage('Erro inesperado ao confirmar e-mail.');
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={agrilinkLogo} alt="AgriLink" className="h-16 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-primary">AgriLink</h1>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-center">Confirmação de E-mail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              {status === "loading" && (
                <>
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                  <p className="text-center text-muted-foreground">
                    Confirmando seu e-mail...
                  </p>
                </>
              )}

              {status === "success" && (
                <>
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-green-600">
                      E-mail confirmado!
                    </p>
                    <p className="text-muted-foreground">{message}</p>
                    <p className="text-sm text-muted-foreground">
                      Redirecionando para o login...
                    </p>
                  </div>
                </>
              )}

              {status === "error" && (
                <>
                  <XCircle className="h-16 w-16 text-destructive" />
                  <div className="text-center space-y-4">
                    <p className="text-lg font-semibold text-destructive">
                      Erro na confirmação
                    </p>
                    <p className="text-muted-foreground">{message}</p>
                    <Button
                      onClick={() => navigate("/login")}
                      className="w-full"
                    >
                      Voltar ao Login
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmation;