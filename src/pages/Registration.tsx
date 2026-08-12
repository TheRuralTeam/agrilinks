import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  User, CreditCard, Mail, Lock, Eye, EyeOff,
  ArrowRight, Check, X, ChevronDown, ArrowLeft
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTractor, faUserTie, faBuildingColumns } from "@fortawesome/free-solid-svg-icons";
import { getProvincesForCountry, getProvinceLabel, getMunicipalityLabel } from "@/data/country-locations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import orbisLinkLogo from "@/assets/orbislink-logo.png";
import autenticar from '@/assets/autenticar.jpg'

// Imagem partilhada com o ecrã de Login para manter a mesma identidade visual.
// Para trocar por vídeo: substituir o <img> do painel esquerdo por um <video autoPlay muted loop playsInline>.
import { toast } from "@/hooks/use-toast";
import { CountryPhoneInput, countries, Country } from "@/components/CountryPhoneInput";
import { changeLanguage, getSavedCountry } from "@/i18n";
import { OtpVerificationModal } from "@/components/OtpVerificationModal";

// ─── Design Tokens ────────────────────────────────────────────────────────────
import { T } from '@/lib/brand';

// ─── Native Select (fixes mobile scroll-to-top bug) ──────────────────────────
const NativeSelect = ({
  value, onChange, placeholder, options, disabled = false
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { id: string; name: string }[];
  disabled?: boolean;
}) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      required
      style={{
        height: '50px',
        width: '100%',
        borderRadius: '14px',
        border: `1px solid ${T.rule}`,
        backgroundColor: disabled ? '#FAFAF8' : T.white,
        color: value ? T.ink : T.muted,
        fontSize: '15px',
        paddingLeft: '16px',
        paddingRight: '40px',
        appearance: 'none',
        WebkitAppearance: 'none',
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'inherit',
        fontWeight: value ? '500' : '400',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = T.g600;
        e.currentTarget.style.boxShadow = `0 0 0 4px rgba(45,125,58,0.10)`;
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = T.rule;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <option value="" disabled hidden>{placeholder}</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
    <ChevronDown
      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      style={{ color: T.muted, width: 16, height: 16 }}
    />
  </div>
);

// ─── Shared input style (mais leve: menos borda, menos sombra) ───────────────
const inputStyle: React.CSSProperties = {
  height: '50px',
  borderRadius: '14px',
  border: `1px solid ${T.rule}`,
  backgroundColor: T.white,
  color: T.ink,
  fontSize: '15px',
  paddingLeft: '44px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label
    style={{
      display: 'block',
      fontSize: '10px',
      fontWeight: 800,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: T.muted,
      marginBottom: '6px',
      marginLeft: '2px',
    }}
  >
    {children}
  </label>
);

// ─── Component ────────────────────────────────────────────────────────────────
const Registration = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register, login, signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try { await signInWithGoogle(); } finally { setGoogleLoading(false); }
  };

  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [userType, setUserType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [identityDocument, setIdentityDocument] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [wasReferred, setWasReferred] = useState<'nao' | 'sim'>('nao');
  const [agentCode, setAgentCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [agentCodeValid, setAgentCodeValid] = useState<boolean | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; full_name: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    const savedCode = getSavedCountry();
    return countries.find(c => c.code === savedCode) || countries[0];
  });

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    setSelectedProvince("");
    setSelectedMunicipality("");
    changeLanguage(country.code);
  };

  const availableProvinces = getProvincesForCountry(selectedCountry.code);
  const provinceLabel = getProvinceLabel(selectedCountry.code);
  const municipalityLabel = getMunicipalityLabel(selectedCountry.code);
  const availableMunicipalities = availableProvinces.find(p => p.id === selectedProvince)?.municipalities || [];

  const validateAgentCode = async (code: string) => {
    if (!code || code.length !== 6) { setAgentCodeValid(null); return; }
    setValidatingCode(true);
    try {
      const { data, error } = await supabase.rpc('validate_agent_code', { p_code: code });
      if (error) throw error;
      setAgentCodeValid(data === true);
    } catch { setAgentCodeValid(false); }
    finally { setValidatingCode(false); }
  };

  const steps = [
    { title: 'Perfil', hint: 'Quem és tu na plataforma' },
    { title: 'Contacto', hint: 'Como te encontramos' },
    { title: 'Segurança', hint: 'Protege a tua conta' },
  ];

  const validateCurrentStep = () => {
    if (currentStep === 0 && (!userType || !fullName.trim() || !identityDocument.trim())) {
      setErrorMessage('Preencha o tipo de conta, nome completo e documento.');
      return false;
    }
    if (currentStep === 1 && (!email.trim() || !phone.trim() || !selectedProvince || !selectedMunicipality)) {
      setErrorMessage('Preencha email, telefone, província e município.');
      return false;
    }
    if (currentStep === 2) {
      if (password.length < 6) {
        setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas não coincidem.');
        return false;
      }
      if (wasReferred === 'sim' && !agentCodeValid) {
        setErrorMessage('Código de agente inválido. Verifique e tente novamente.');
        return false;
      }
    }
    setErrorMessage('');
    return true;
  };

  const goToNextStep = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep(step => Math.min(step + 1, steps.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < steps.length - 1) {
      goToNextStep();
      return;
    }
    if (!validateCurrentStep()) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const fullPhone = `${selectedCountry.dialCode} ${phone}`;
      const { error, data } = await register({
        email: cleanEmail, phone: fullPhone, password,
        full_name: cleanName,
        identity_document: identityDocument.trim(),
        user_type: userType as "agricultor" | "agente" | "comprador",
        province_id: selectedProvince,
        municipality_id: selectedMunicipality,
        referred_by_agent_id: wasReferred === 'sim' && agentCode ? agentCode.toUpperCase() : null,
      });
      if (error) {
        setErrorMessage(error.message?.includes('already registered')
          ? "Este email já está registrado. Tente fazer login."
          : error.message || "Não foi possível criar a conta.");
        return;
      }

      const newUserId = data?.user?.id;
      if (newUserId) {
        // Enviar link mágico de confirmação por email (Resend · no-reply@agrilink.ao)
        const { error: linkErr } = await supabase.functions.invoke('send-magic-link', {
          body: {
            email: cleanEmail,
            full_name: cleanName,
            redirect_to: `${window.location.origin}/auth/callback?next=/app`,
          },
        });
        if (linkErr) {
          toast({
            title: "Conta criada",
            description: "Não conseguimos enviar o link agora. Podes reenviá-lo no próximo passo.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Link de confirmação enviado!",
            description: `Enviámos um link para ${cleanEmail}. Clica nele para confirmares a conta.`,
          });
        }
        navigate(`/confirmar-email?email=${encodeURIComponent(cleanEmail)}`, { replace: true });
      } else {
        toast({ title: "Conta criada com sucesso!", description: "Faz login para continuar." });
        navigate('/login', { replace: true });
      }
    } catch (error: any) {
      setErrorMessage(error?.message || "Erro inesperado ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const userTypeOptions = [
    { id: 'agricultor', label: 'Fornecedor', icon: faTractor },
    { id: 'agente', label: t('registration.agent'), icon: faUserTie },
    { id: 'comprador', label: t('registration.buyer'), icon: faBuildingColumns },
  ];

  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input:focus { border-color: ${T.g600} !important; box-shadow: 0 0 0 4px rgba(45,125,58,0.10) !important; }
        .field-group { animation: fadeUp 0.45s ease both; }
        .user-type-btn { transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease; cursor: pointer; }
        .user-type-btn:hover { transform: translateY(-2px); }
        .submit-btn { transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .submit-btn:active:not(:disabled) { transform: scale(0.98); }
        .progress-track { height: 4px; border-radius: 999px; background: ${T.rule}; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 999px; background: ${T.g600}; transition: width 0.35s ease; }
      `}</style>

      {/* ── Painel esquerdo: imagem/vídeo da plataforma + mensagem conceitual ── */}
      <div className="relative lg:w-2/5 h-64 sm:h-80 lg:h-auto overflow-hidden">
        <img
          src={autenticar}
          alt="Produtores e compradores conectados pela AgriLink"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to bottom, rgba(26, 92, 36, 0.35), ${T.g900} 96%)` }}
        />
        <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-14">
          <div className="max-w-md animate-in fade-in slide-in-from-left-6 duration-700">
            <div className="h-1 w-10 mb-6 rounded-full" style={{ backgroundColor: T.goldL }} />
            <h2 className="text-3xl lg:text-4xl font-black mb-4 leading-tight text-white">
              A tua produção, ligada ao mundo
            </h2>
            <p className="text-sm lg:text-base font-medium text-white/85 leading-relaxed">
              Junta-te a milhares de fornecedores, agentes e compradores que já negoceiam
              todos os dias na maior rede agrícola digital de Angola.
            </p>
          </div>
        </div>
      </div>

      {/* ── Painel direito: formulário, mais leve e espaçoso ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 lg:py-16 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 rounded-full blur-3xl opacity-[0.07] pointer-events-none" style={{ backgroundColor: T.g400 }} />

        {/* Overlay de loading, discreto */}
        {loading && (
          <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 40, height: 40,
                border: `3px solid ${T.rule}`,
                borderTopColor: T.g600,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: T.ink, margin: 0 }}>A criar a tua conta…</p>
            </div>
          </div>
        )}

        <div className="w-full max-w-md relative z-10" style={{ animation: 'fadeUp 0.5s ease both' }}>

          {/* Logo, maior, sem legenda */}
          <div className="mb-10 flex justify-center lg:justify-start">
            <img
              src={orbisLinkLogo}
              alt="AgriLink"
              style={{ height: 104, display: 'block', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.08))' }}
            />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              Cria a tua conta
            </h1>
            <p style={{ fontSize: 14, color: T.muted, margin: '8px 0 0', fontWeight: 500 }}>
              Leva menos de dois minutos. Começa por nos dizer quem és.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {errorMessage && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 14,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <X style={{ width: 15, height: 15, flexShrink: 0 }} />
                {errorMessage}
              </div>
            )}

            {/* Progresso leve: barra + rótulo do passo atual, sem caixas pesadas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>
                  {steps[currentStep].title}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>
                  Passo {currentStep + 1} de {steps.length}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <p style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>{steps[currentStep].hint}</p>
            </div>

            {currentStep === 0 && (
              <div className="field-group flex flex-col gap-5">
                <div>
                  <FieldLabel>{t('registration.userType') || 'Tipo de Conta'}</FieldLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {userTypeOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`user-type-btn${userType === opt.id ? ' selected' : ''}`}
                        onClick={() => setUserType(opt.id)}
                        style={{
                          padding: '14px 6px',
                          borderRadius: 14,
                          border: `1px solid ${userType === opt.id ? T.g600 : T.rule}`,
                          backgroundColor: userType === opt.id ? T.g50 : T.white,
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        }}
                      >
                        <FontAwesomeIcon icon={opt.icon} style={{ color: userType === opt.id ? T.g700 : T.muted, fontSize: 18 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: userType === opt.id ? T.g700 : T.mid }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>{t('registration.fullName') || 'Nome Completo'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('registration.fullNamePlaceholder') || 'Nome completo'} style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <FieldLabel>{t('registration.identityDocument') || 'Documento de Identidade'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <CreditCard style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input value={identityDocument} onChange={e => setIdentityDocument(e.target.value)} placeholder="000000000AA000" style={inputStyle} required />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="field-group flex flex-col gap-5">
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <FieldLabel>{t('registration.phone') || 'Telefone'}</FieldLabel>
                  <CountryPhoneInput value={phone} onChange={setPhone} selectedCountry={selectedCountry} onCountryChange={handleCountryChange} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <FieldLabel>{provinceLabel || 'Província'}</FieldLabel>
                    <NativeSelect value={selectedProvince} onChange={v => { setSelectedProvince(v); setSelectedMunicipality(""); }} placeholder={t('registration.selectProvince') || 'Selecionar província'} options={availableProvinces} />
                  </div>
                  <div>
                    <FieldLabel>{municipalityLabel || 'Município'}</FieldLabel>
                    <NativeSelect value={selectedMunicipality} onChange={setSelectedMunicipality} placeholder={t('registration.selectMunicipality') || 'Selecionar município'} options={availableMunicipalities} disabled={!selectedProvince} />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="field-group flex flex-col gap-5">
                <div>
                  <FieldLabel>{t('registration.password') || 'Senha'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, paddingRight: '48px' }} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {showPassword ? <EyeOff style={{ color: T.muted, width: 17, height: 17 }} /> : <Eye style={{ color: T.muted, width: 17, height: 17 }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <FieldLabel>{t('registration.confirmPassword') || 'Confirmar Senha'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, paddingRight: '48px' }} required />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {showConfirmPassword ? <EyeOff style={{ color: T.muted, width: 17, height: 17 }} /> : <Eye style={{ color: T.muted, width: 17, height: 17 }} />}
                    </button>
                  </div>
                </div>

                <div style={{ paddingTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: T.ink, margin: '0 0 12px' }}>
                    Foi indicado por um agente AgriLink?
                  </p>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {(['nao', 'sim'] as const).map(v => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <div
                          onClick={() => setWasReferred(v)}
                          style={{
                            width: 18, height: 18, borderRadius: '50%',
                            border: `2px solid ${wasReferred === v ? T.g600 : T.rule}`,
                            backgroundColor: wasReferred === v ? T.g600 : T.white,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {wasReferred === v && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: T.white }} />}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.mid }}>
                          {v === 'nao' ? 'Não' : 'Sim'}
                        </span>
                      </label>
                    ))}
                  </div>

                  {wasReferred === 'sim' && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          placeholder="Código de 6 dígitos"
                          value={agentCode}
                          onChange={e => {
                            const val = e.target.value.toUpperCase().slice(0, 6);
                            setAgentCode(val);
                            if (val.length === 6) validateAgentCode(val);
                            else setAgentCodeValid(null);
                          }}
                          style={{
                            height: '46px',
                            width: '100%',
                            borderRadius: '12px',
                            border: `1px solid ${agentCodeValid === false ? '#FECACA' : agentCodeValid === true ? T.g600 : T.rule}`,
                            backgroundColor: T.white,
                            color: T.ink,
                            fontSize: 15,
                            letterSpacing: '0.16em',
                            fontWeight: 700,
                            paddingLeft: '16px',
                            paddingRight: '44px',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                          {validatingCode
                            ? <div style={{ width: 16, height: 16, border: `2px solid ${T.rule}`, borderTopColor: T.g600, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            : agentCodeValid === true
                              ? <Check style={{ color: '#16a34a', width: 18, height: 18 }} />
                              : agentCodeValid === false
                                ? <X style={{ color: '#dc2626', width: 18, height: 18 }} />
                                : null}
                        </div>
                      </div>
                      {agentCodeValid === false && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 6 }}>
                          Código inválido
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ações */}
            <div style={{ display: 'flex', gap: 10 }}>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={() => { setErrorMessage(''); setCurrentStep(step => step - 1); }}
                  style={{ width: 52, height: 52, borderRadius: 999, border: `1px solid ${T.rule}`, background: T.white, color: T.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowLeft style={{ width: 18, height: 18 }} />
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="submit-btn"
                style={{
                  flex: 1, height: 52, borderRadius: 999, border: 'none',
                  backgroundColor: loading ? T.muted : T.g600,
                  color: T.white, fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? 'A criar conta…' : currentStep === steps.length - 1 ? 'Criar conta' : 'Continuar'}
                <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Divisor */}
            <div className="flex items-center">
              <div style={{ flex: 1, height: 1, backgroundColor: T.rule }} />
              <span style={{ padding: '0 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.faint }}>
                Ou
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: T.rule }} />
            </div>

            {/* Google Sign-up */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={googleLoading}
              style={{
                width: '100%', height: 50, borderRadius: 999,
                border: `1px solid ${T.rule}`, backgroundColor: T.white,
                color: T.ink, fontSize: 14, fontWeight: 700,
                cursor: googleLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              {googleLoading ? 'A conectar…' : 'Continuar com Google'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: T.muted, fontWeight: 500, margin: 0 }}>
              Já tem uma conta?{' '}
              <Link to="/login" style={{ color: T.g600, fontWeight: 700, textDecoration: 'none' }}>
                Faça Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Registration;