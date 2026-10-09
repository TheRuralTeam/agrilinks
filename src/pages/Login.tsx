import React, { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, ArrowRight, CheckCircle2, Sprout, ShoppingCart, UserRound, PencilLine, Truck, ChevronLeft } from "lucide-react";
import agrilinkLogo from "../assets/agrilink-logo.png";
import { useAuth } from "../contexts/AuthContext";
import { sendConfirmationEmail } from "../features/auth/email";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, registerSimple, signInWithGoogle } = useAuth();
  const initialSignup = new URLSearchParams(location.search).get("mode") === "signup";

  const [mode, setMode] = useState<"login" | "signup">(initialSignup ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userType, setUserType] = useState<"agricultor" | "agente" | "comprador" | "motorista">("comprador");
  const [signupStep, setSignupStep] = useState<"profile" | "details">("profile");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  useEffect(() => {
    setMode(initialSignup ? "signup" : "login");
  }, [initialSignup]);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    if (next === "signup") setSignupStep("profile");
    navigate(next === "signup" ? "/login?mode=signup" : "/login", { replace: true });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        if (!email.trim() || !password) {
          toast.error("Informe o email e a senha.");
          return;
        }
        const { error } = await login(email.trim().toLowerCase(), password);
        if (error) return;
        navigate("/app", { replace: true });
        return;
      }

      if (!email.trim() || !phone.trim() || !password) {
        toast.error("Email, telefone e senha são obrigatórios.");
        return;
      }
      const { error } = await registerSimple({
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        user_type: userType,
      });
      if (error) {
        toast.error(error.message || "Não foi possível criar a conta.");
        return;
      }

      setConfirmationPending(true);
      toast.success("Conta criada. Verifique o seu email para confirmar o acesso.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendSignupConfirmation = async () => {
    if (!email.trim() || resendingConfirmation) return;
    setResendingConfirmation(true);
    try {
      await sendConfirmationEmail({ email: email.trim().toLowerCase(), next: "/app" });
      toast.success("Novo email de confirmação enviado. Verifique também a pasta de spam.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível enviar o email de confirmação. Tente novamente mais tarde.");
    } finally {
      setResendingConfirmation(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await signInWithGoogle("/app");
      if (error) toast.error(error.message || "Não foi possível iniciar com Google.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7FAF7] text-[#111714]">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[#123B1B] lg:flex lg:flex-col lg:justify-between p-12 xl:p-16">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#5EA66A]/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-[30rem] w-[30rem] rounded-full bg-[#D9A441]/10 blur-3xl" />

          <div className="relative z-10">
            <img src={agrilinkLogo} alt="AgriLink" className="h-16 w-auto object-contain object-left" />
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="mb-5 h-1 w-14 rounded-full bg-[#D9A441]" />
            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-white xl:text-6xl">
              Do campo ao mercado.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/75">
              A AgriLink conecta fornecedores, compradores, agentes e motoristas para tornar a comercialização agrícola mais simples, organizada e rastreável.
            </p>
            <div className="mt-10 grid gap-3">
              {["Publique e encontre oportunidades", "Organize pedidos e negociações", "Acompanhe logística e entregas"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-semibold text-white/90">
                  <CheckCircle2 className="h-5 w-5 text-[#8BCB91]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs font-medium text-white/45">AgriLink • Plataforma AgriTech</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-14 xl:px-20">
          <div className="w-full max-w-xl">
            <div className="mb-8 lg:hidden">
              <img src={agrilinkLogo} alt="AgriLink" className="h-12 w-auto object-contain object-left" />
            </div>

            <div className="mb-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#3E7C48]">Acesso à plataforma</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {confirmationPending ? "Confirme o seu email" : mode === "login" ? "Bem-vindo à AgriLink" : "Crie a sua conta"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#657367]">
                {confirmationPending
                  ? "Enviámos a confirmação para o seu email. Abra a mensagem e confirme a conta antes de iniciar sessão."
                  : mode === "login"
                    ? "Entre para gerir produtos, pedidos, logística e as suas operações."
                    : "Preencha os seus dados e escolha como pretende utilizar a AgriLink."}
              </p>
            </div>

            {confirmationPending ? (
              <div className="rounded-3xl border border-[#DDE9DE] bg-white p-6 shadow-[0_18px_50px_rgba(28,65,35,0.08)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF5EB] text-[#3E7C48]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">Confirmação pendente</p>
                    <p className="mt-1 text-sm leading-6 text-[#657367]">
                      O cadastro só fica concluído depois de confirmar este endereço. Abra o link enviado para <strong>{email.trim().toLowerCase()}</strong>; depois, volte aqui para entrar. Verifique também a pasta de spam.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendSignupConfirmation}
                  disabled={resendingConfirmation}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#DDE9DE] bg-white px-5 text-sm font-extrabold text-[#2F6F3A] disabled:opacity-60"
                >
                  {resendingConfirmation ? "A enviar confirmação..." : "Reenviar email de confirmação"}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmationPending(false); switchMode("login"); }}
                  className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F6F3A] px-5 text-sm font-extrabold text-white transition hover:bg-[#245A2E]"
                >
                  Ir para o login <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[#EAF1EA] p-1">
                  <button type="button" onClick={() => switchMode("login")} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${mode === "login" ? "bg-white text-[#245A2E] shadow-sm" : "text-[#718071]"}`}>
                    Entrar
                  </button>
                  <button type="button" onClick={() => switchMode("signup")} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${mode === "signup" ? "bg-white text-[#245A2E] shadow-sm" : "text-[#718071]"}`}>
                    Criar conta
                  </button>
                </div>

                {mode === "signup" && signupStep === "profile" ? (
                  <section aria-labelledby="profile-step-title" className="space-y-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#54815A]">Etapa 1 de 2 · Perfil</p>
                      <h3 id="profile-step-title" className="mt-2 text-xl font-extrabold tracking-tight text-[#1A2A1D]">Como pretende utilizar a AgriLink?</h3>
                      <p className="mt-2 text-sm leading-6 text-[#68766A]">Escolha o perfil que melhor descreve a sua actividade. Usaremos esta escolha para preparar a sua experiência na plataforma.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {([
                        { id: "agricultor", title: "Agricultor / Fornecedor", detail: "Publicar produtos e gerir ofertas", Icon: Sprout },
                        { id: "comprador", title: "Comprador", detail: "Procurar produtos e fazer pedidos", Icon: ShoppingCart },
                        { id: "agente", title: "Agente AgriLink", detail: "Apoiar fornecedores e operações", Icon: UserRound },
                        { id: "motorista", title: "Motorista", detail: "Receber serviços de transporte", Icon: Truck },
                      ] as const).map(({ id, title, detail, Icon }) => {
                        const selected = userType === id;
                        return (
                          <button key={id} type="button" aria-pressed={selected} onClick={() => setUserType(id)}
                            className={`group flex min-h-[112px] items-start gap-3 rounded-2xl border p-4 text-left transition duration-150 focus:outline-none focus:ring-4 focus:ring-[#4B8A55]/15 ${selected ? "border-[#367644] bg-[#F0F7F0] ring-1 ring-[#367644]" : "border-[#DDE6DE] bg-white hover:border-[#9BBBA0] hover:bg-[#FAFCFA]"}`}>
                            <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-[#2F6F3A] text-white" : "bg-[#F0F4F0] text-[#527458]"}`}><Icon size={19} strokeWidth={1.8} />{id === "agente" && <PencilLine size={10} strokeWidth={2} className="absolute -bottom-1 -right-1 rounded-sm bg-white p-[1px] text-[#527458]" aria-hidden="true" />}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-[#223326]">{title}</span>
                              <span className="mt-1 block text-xs leading-5 text-[#718071]">{detail}</span>
                            </span>
                            <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#2F6F3A] bg-[#2F6F3A]" : "border-[#C7D2C8]"}`}>{selected && <CheckCircle2 size={13} className="text-white" />}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => setSignupStep("details")} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2F6F3A] px-5 text-sm font-bold text-white transition hover:bg-[#245A2E] focus:outline-none focus:ring-4 focus:ring-[#4B8A55]/20">
                      Continuar com {userType === "agricultor" ? "Agricultor / Fornecedor" : userType === "comprador" ? "Comprador" : userType === "agente" ? "Agente AgriLink" : "Motorista"} <ArrowRight size={16} />
                    </button>
                  </section>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="mb-5 rounded-xl border border-[#E0E9E0] bg-[#F7FAF7] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#718071]">Etapa 2 de 2 · Dados da conta</p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#2B5732]">{userType === "agricultor" ? "Agricultor / Fornecedor" : userType === "comprador" ? "Comprador" : userType === "agente" ? "Agente AgriLink" : "Motorista"}</p>
                        <button type="button" onClick={() => setSignupStep("profile")} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2F6F3A] hover:underline"><ChevronLeft size={14} /> Alterar perfil</button>
                      </div>
                    </div>
                  )}
                  {mode === "signup" && (
                    <label className="block">
                      <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#657367]">Telefone</span>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A988B]" />
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+244 9XX XXX XXX" className="h-12 w-full rounded-2xl border border-[#DDE6DE] bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#4B8A55] focus:ring-4 focus:ring-[#4B8A55]/10" />
                      </div>
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#657367]">Email</span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A988B]" />
                      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="nome@exemplo.com" className="h-12 w-full rounded-2xl border border-[#DDE6DE] bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#4B8A55] focus:ring-4 focus:ring-[#4B8A55]/10" />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#657367]">Senha</span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A988B]" />
                      <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" className="h-12 w-full rounded-2xl border border-[#DDE6DE] bg-white pl-11 pr-12 text-sm outline-none transition focus:border-[#4B8A55] focus:ring-4 focus:ring-[#4B8A55]/10" />
                      <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#718071] hover:bg-[#F2F6F2]" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>


                  {mode === "login" && (
                    <div className="flex justify-end">
                      <Link to="/reset-password" className="text-xs font-bold text-[#3E7C48] hover:underline">Esqueci a senha</Link>
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F6F3A] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#2F6F3A]/15 transition hover:bg-[#245A2E] disabled:cursor-not-allowed disabled:opacity-60">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Entrar na AgriLink" : "Criar conta"}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>
                )}

                {mode === "login" && <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#E5ECE5]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#98A298]">ou</span>
                  <div className="h-px flex-1 bg-[#E5ECE5]" />
                </div>}

                {mode === "login" && <button type="button" onClick={handleGoogle} disabled={submitting} className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#DDE6DE] bg-white text-sm font-extrabold text-[#26352A] transition hover:bg-[#F7FAF7] disabled:opacity-60">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E4E8E4] text-xs font-black">G</span>
                  Continuar com Google
                </button>}
              </>
            )}

            <p className="mt-8 text-center text-xs leading-5 text-[#8A988B]">
              Ao continuar, aceita utilizar a AgriLink de acordo com os termos e políticas aplicáveis.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
