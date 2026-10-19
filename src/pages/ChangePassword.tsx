import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 12) return toast.error("A nova senha deve ter pelo menos 12 caracteres.");
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return toast.error("Inclua maiúsculas, minúsculas, números e um símbolo.");
    if (password !== confirmPassword) return toast.error("As senhas não coincidem.");
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("complete-forced-password-change", { body: { new_password: password } });
      if (error) {
        const details = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(details?.error || error.message);
      }
      if (!data?.success) throw new Error(data?.error || "Não foi possível actualizar a senha.");
      await supabase.auth.signOut({ scope: "local" });
      toast.success("Senha actualizada. Entre novamente com a nova senha.");
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || "Falha ao actualizar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-screen flex items-center justify-center bg-background p-4">
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><ShieldCheck className="h-6 w-6 text-primary" /></div>
        <CardTitle className="text-2xl">Altere a sua senha</CardTitle>
        <CardDescription>Por segurança, o administrador redefiniu a sua senha. Tem de criar uma senha pessoal antes de continuar a utilizar o AgriLink.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="new-password" type="password" autoComplete="new-password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required /></div><p className="text-xs text-muted-foreground">Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.</p></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar nova senha</Label><div className="relative"><KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="confirm-password" type="password" autoComplete="new-password" className="pl-9" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} required /></div></div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "A actualizar…" : "Guardar nova senha"}</Button>
        </form>
      </CardContent>
    </Card>
  </main>;
}
