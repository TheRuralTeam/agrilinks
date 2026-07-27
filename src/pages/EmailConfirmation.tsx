import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import orbisLinkLogo from "@/assets/orbislink-logo.png";
import { OtpVerificationModal } from "@/components/OtpVerificationModal";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const { user, userProfile, refreshProfile, logout } = useAuth();
  const [status, setStatus] = useState<"ready" | "success">("ready");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; fullName: string } | null>(null);

  // Conta já libertada: não faz sentido ficar nesta etapa
  useEffect(() => {
    if (user && userProfile?.email_verified === true) {
      navigate("/app", { replace: true });
    }
  }, [user, userProfile, navigate]);

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

  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast({ title: "Insira o email", description: "Informe o email usado no cadastro.", variant: "destructive" });
      return;
    }

    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp-email", {
        body: { email: cleanEmail },
      });
      if (error) throw error;

      setPendingUser({
        id: data?.user_id || "",
        email: cleanEmail,
        fullName: data?.full_name || "Utilizador AgriLink",
      });
      setOtpOpen(true);
      toast({ title: "Código enviado", description: "Verifique o email enviado por contacto@agrilink.ao." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar código", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setResending(false);
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
            <CardTitle className="text-center">Confirmar email com código</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              {status === "success" ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-primary">Email confirmado!</p>
                    <p className="text-muted-foreground">Agora pode entrar na plataforma AgriLink.</p>
                  </div>
                </>
              ) : (
                <>
                  <Mail className="h-16 w-16 text-primary" />
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-foreground">Receba um código OTP real no seu email</p>
                    <p className="text-muted-foreground">
                      Enviaremos um código de 6 dígitos por contacto@agrilink.ao para concluir a confirmação.
                    </p>
                  </div>
                  <div className="w-full space-y-3">
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="email usado no cadastro"
                    />
                    <Button onClick={handleResend} disabled={resending} className="w-full">
                      {resending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar...</>
                      ) : "Enviar código de confirmação"}
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                      Voltar para Login
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingUser && (
        <OtpVerificationModal
          isOpen={otpOpen}
          onClose={() => setOtpOpen(false)}
          email={pendingUser.email}
          userId={pendingUser.id}
          fullName={pendingUser.fullName}
          onSuccess={() => {
            setOtpOpen(false);
            setStatus("success");
            setTimeout(() => navigate("/login"), 1400);
          }}
        />
      )}
    </div>
  );
};

export default EmailConfirmation;