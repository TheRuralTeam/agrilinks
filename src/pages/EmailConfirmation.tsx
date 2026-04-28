import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import orbisLinkLogo from "@/assets/orbislink-logo.png";

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "pending" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const clearSensitiveAuthParamsFromUrl = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const hasSensitiveQuery =
      queryParams.has("access_token") ||
      queryParams.has("refresh_token") ||
      queryParams.has("provider_token") ||
      queryParams.has("code");

    const hasSensitiveHash =
      hashParams.has("access_token") ||
      hashParams.has("refresh_token") ||
      hashParams.has("provider_token") ||
      hashParams.has("code");

    if (hasSensitiveQuery || hasSensitiveHash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const isGoogleOauth = queryParams.get('oauth') === 'google';
        const isPendingView = queryParams.get('pending') === '1';
        const pendingEmail = queryParams.get('email');

        // Google OAuth callback should be handled at root route, not in email confirmation page.
        if (isGoogleOauth) {
          clearSensitiveAuthParamsFromUrl();
          navigate('/', { replace: true });
          return;
        }

        if (isPendingView) {
          setStatus("pending");
          setMessage(
            pendingEmail
              ? `Enviámos um link de confirmação para ${pendingEmail}. Abra o email e clique no link para ativar a sua conta.`
              : "Enviámos um link de confirmação para o seu email. Abra o email e clique no link para ativar a sua conta."
          );
          return;
        }

        // Verificar se há tokens na URL (hash ou query params)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const type = hashParams.get('type') || queryParams.get('type');

        // Remove tokens/codes from the URL bar as early as possible.
        clearSensitiveAuthParamsFromUrl();
        
        console.log("Email confirmation - type:", type, "has tokens:", !!accessToken);

        // Se temos tokens diretamente (formato antigo do Supabase)
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error("Erro ao definir sessão:", error);
            setStatus("error");
            setMessage("Erro na confirmação. O link pode ter expirado ou já foi usado.");
            return;
          }

          if (data?.session?.user) {
            // Atualizar email_verified na tabela public.users
            await supabase.rpc('sync_user_email_verified', { 
              p_user_id: data.session.user.id 
            });
            
            setStatus("success");
            setMessage("E-mail confirmado com sucesso! Você será redirecionado automaticamente.");
            setTimeout(() => navigate("/app"), 2000);
            return;
          }
        }

        // Tentar o método PKCE (formato mais novo)
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);

        if (error) {
          console.error("Erro no exchangeCodeForSession:", error);
          
          // Verificar se já existe uma sessão ativa
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            // Usuário já está logado, atualizar email_verified
            await supabase.rpc('sync_user_email_verified', { 
              p_user_id: sessionData.session.user.id 
            });
            
            setStatus("success");
            setMessage("E-mail confirmado! Você será redirecionado.");
            setTimeout(() => navigate("/app"), 2000);
            return;
          }
          
          setStatus("error");
          setMessage("Erro na confirmação. O link pode ter expirado ou já foi usado. Tente fazer login normalmente.");
          return;
        }

        // Se criou sessão via PKCE, está confirmado!
        if (data?.session?.user) {
          // Atualizar email_verified na tabela public.users
          await supabase.rpc('sync_user_email_verified', { 
            p_user_id: data.session.user.id 
          });
          
          setStatus("success");
          setMessage("E-mail confirmado com sucesso! Você será redirecionado automaticamente.");
          setTimeout(() => navigate("/app"), 2000);
          return;
        }

        // Caso inesperado: sem erro e sem usuário
        setStatus("error");
        setMessage(
          "Não foi possível confirmar sua conta. Tente fazer login manualmente."
        );
      } catch (err) {
        console.error("Erro inesperado:", err);
        setStatus("error");
        setMessage("Erro inesperado ao confirmar e-mail. Tente fazer login normalmente.");
      }
    };

    confirmEmail();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={orbisLinkLogo} alt="OrbisLink" className="h-16 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-primary">OrbisLink</h1>
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
                      Redirecionando para o app...
                    </p>
                  </div>
                </>
              )}

              {status === "pending" && (
                <>
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                  <div className="text-center space-y-4">
                    <p className="text-lg font-semibold text-primary">
                      Verifique o seu e-mail
                    </p>
                    <p className="text-muted-foreground">{message}</p>
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={() => navigate("/login")}
                        className="w-full"
                      >
                        Ir para Login
                      </Button>
                      <Button
                        onClick={() => navigate("/cadastro")}
                        variant="outline"
                        className="w-full"
                      >
                        Voltar ao Cadastro
                      </Button>
                    </div>
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
                      Ir para Login
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