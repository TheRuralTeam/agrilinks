import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  User, CreditCard, Mail, Lock, Eye, EyeOff,
  UserPlus, ShieldCheck, ArrowRight, Check, X, ChevronDown
} from "lucide-react";
import { getProvincesForCountry, getProvinceLabel, getMunicipalityLabel } from "@/data/country-locations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import orbisLinkLogo from "@/assets/orbislink-logo.png";
import { toast } from "@/hooks/use-toast";
import { CountryPhoneInput, countries, Country } from "@/components/CountryPhoneInput";
import { changeLanguage, getSavedCountry } from "@/i18n";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado ao criar conta.";
};

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  // Greens
  g900: '#1A3D20',
  g700: '#1A5C24',
  g600: '#2D7D3A',
  g500: '#3D9A48',
  g400: '#4CAF50',
  g100: '#E8F5E9',
  g50:  '#F2FAF3',
  gBorder: '#C8E6CA',

  // Gold / Earth — primary accent
  gold:       '#A0722A',
  goldMid:    '#C9922A',
  goldDark:   '#7A5520',
  goldLight:  '#C9A96E',
  goldBg:     '#FDF8F0',
  goldPale:   '#FBF3E4',
  goldBorder: '#C9A96E',
  goldDeep:   '#8B6020',

  // Neutrals
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F8F5EF',
  white:  '#FFFFFF',
  rule:   '#E8E0D0',

  // Shadows
  shadow: '0 2px 16px rgba(160,114,42,0.10)',
  shadowLg: '0 8px 40px rgba(160,114,42,0.16)',
}

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
        height: '52px',
        width: '100%',
        borderRadius: '14px',
        border: `1.5px solid ${T.goldBorder}`,
        backgroundColor: disabled ? '#F5F0E8' : T.goldBg,
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
        e.currentTarget.style.borderColor = T.goldMid;
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(201,146,42,0.15)`;
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = T.goldBorder;
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
      style={{ color: T.goldLight, width: 18, height: 18 }}
    />
  </div>
);

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  height: '52px',
  borderRadius: '14px',
  border: `1.5px solid ${T.goldBorder}`,
  backgroundColor: T.goldBg,
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
      fontWeight: 900,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: T.mid,
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
  const { register, user } = useAuth();

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

  React.useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setErrorMessage("As senhas não coincidem."); return; }
    if (!email || !phone) return;
    if (wasReferred === 'sim' && !agentCodeValid) {
      setErrorMessage("Código de agente inválido. Verifique e tente novamente.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const fullPhone = `${selectedCountry.dialCode} ${phone}`;
      const { error, data } = await register({
        email, phone: fullPhone, password,
        full_name: fullName,
        identity_document: identityDocument,
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

      if (data?.user?.email_confirmed_at) {
        toast({ title: "Conta criada com sucesso!", description: "Bem-vindo ao AgriLink." });
        navigate('/app', { replace: true });
        return;
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique o seu email para ativar a conta.",
      });
      navigate(`/confirmar-email?pending=1&email=${encodeURIComponent(email)}`, { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const userTypeOptions = [
    { id: 'agricultor', label: 'Fornecedor', icon: '' },
    { id: 'agente', label: t('registration.agent'), icon: '' },
    { id: 'comprador', label: t('registration.buyer'), icon: '' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: T.canvas,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-8%', left: '-8%',
        width: '400px', height: '400px', borderRadius: '50%',
        filter: 'blur(80px)', opacity: 0.18,
        background: 'radial-gradient(circle, #C8E6CA, transparent)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-8%', right: '-8%',
        width: '480px', height: '480px', borderRadius: '50%',
        filter: 'blur(80px)', opacity: 0.12,
        background: 'radial-gradient(circle, #C9A96E, transparent)',
        pointerEvents: 'none',
      }} />

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: T.white,
            padding: '40px 48px',
            borderRadius: '28px',
            boxShadow: T.shadowLg,
            border: `1.5px solid ${T.goldBorder}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
          }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              <div style={{
                width: 64, height: 64,
                border: `4px solid ${T.goldPale}`,
                borderTopColor: T.goldMid,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <ShieldCheck style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                color: T.goldMid, width: 24, height: 24,
              }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 900, fontSize: 20, color: T.ink, margin: 0 }}>Criando Conta</p>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted, margin: '4px 0 0' }}>
                Aguarde um instante
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input:focus { border-color: ${T.goldMid} !important; box-shadow: 0 0 0 3px rgba(201,146,42,0.15) !important; }
        .field-group { animation: fadeUp 0.5s ease both; }
        .user-type-btn { transition: all 0.18s ease; cursor: pointer; }
        .user-type-btn:hover { transform: translateY(-2px); }
        .user-type-btn.selected { transform: translateY(-2px); }
        .submit-btn { transition: all 0.18s ease; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(45,125,58,0.3) !important; }
        .submit-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div style={{ width: '100%', maxWidth: 680, position: 'relative', zIndex: 10, animation: 'fadeUp 0.6s ease both' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={orbisLinkLogo} alt="AgriLink" style={{ height: 72, margin: '0 auto 12px', display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ height: 1, width: 32, backgroundColor: T.goldBorder }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.gold }}>
              AgriLink Platform
            </span>
            <div style={{ height: 1, width: 32, backgroundColor: T.goldBorder }} />
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: T.white,
          borderRadius: 28,
          border: `1.5px solid ${T.goldBorder}`,
          boxShadow: T.shadowLg,
          overflow: 'hidden',
        }}>
          {/* Card Header */}
          <div style={{
            padding: '32px 36px 24px',
            borderBottom: `1px solid ${T.rule}`,
            background: `linear-gradient(135deg, ${T.goldPale} 0%, ${T.white} 60%)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: T.goldBg,
                border: `1.5px solid ${T.goldBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserPlus style={{ color: T.gold, width: 20, height: 20 }} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: T.ink, margin: 0, lineHeight: 1.2 }}>
                  {t('registration.infoTitle') || 'Criar Conta'}
                </h1>
                <p style={{ fontSize: 13, color: T.muted, margin: '4px 0 0', fontWeight: 500 }}>
                  Preencha os dados para se registar na plataforma
                </p>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div style={{ padding: '32px 36px 40px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {errorMessage && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #FECACA',
                  color: '#B91C1C',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <X style={{ width: 16, height: 16, flexShrink: 0 }} />
                  {errorMessage}
                </div>
              )}

              {/* User Type Selector */}
              <div className="field-group" style={{ animationDelay: '0.05s' }}>
                <FieldLabel>{t('registration.userType') || 'Tipo de Conta'}</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {userTypeOptions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`user-type-btn${userType === opt.id ? ' selected' : ''}`}
                      onClick={() => setUserType(opt.id)}
                      style={{
                        padding: '14px 8px',
                        borderRadius: 14,
                        border: `1.5px solid ${userType === opt.id ? T.goldMid : T.goldBorder}`,
                        backgroundColor: userType === opt.id ? T.goldPale : T.goldBg,
                        cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        boxShadow: userType === opt.id ? `0 4px 16px rgba(201,146,42,0.20)` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{opt.icon}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 800,
                        color: userType === opt.id ? T.goldDark : T.mid,
                        letterSpacing: '0.02em',
                      }}>
                        {opt.label}
                      </span>
                      {userType === opt.id && (
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          backgroundColor: T.goldMid,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check style={{ color: T.white, width: 12, height: 12 }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2-col grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px 24px' }}>

                {/* Full Name */}
                <div className="field-group" style={{ animationDelay: '0.08s' }}>
                  <FieldLabel>{t('registration.fullName') || 'Nome Completo'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                    <input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder={t('registration.fullNamePlaceholder') || 'Nome completo'}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {/* Identity Doc */}
                <div className="field-group" style={{ animationDelay: '0.1s' }}>
                  <FieldLabel>{t('registration.identityDocument') || 'Documento de Identidade'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <CreditCard style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                    <input
                      value={identityDocument}
                      onChange={e => setIdentityDocument(e.target.value)}
                      placeholder="000000000AA000"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="field-group" style={{ animationDelay: '0.12s' }}>
                  <FieldLabel>Email</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="field-group" style={{ animationDelay: '0.14s' }}>
                  <FieldLabel>{t('registration.phone') || 'Telefone'}</FieldLabel>
                  <CountryPhoneInput
                    value={phone}
                    onChange={setPhone}
                    selectedCountry={selectedCountry}
                    onCountryChange={handleCountryChange}
                  />
                </div>

                {/* Province — native select */}
                <div className="field-group" style={{ animationDelay: '0.16s' }}>
                  <FieldLabel>{provinceLabel || 'Província'}</FieldLabel>
                  <NativeSelect
                    value={selectedProvince}
                    onChange={v => { setSelectedProvince(v); setSelectedMunicipality(""); }}
                    placeholder={t('registration.selectProvince') || 'Selecionar província'}
                    options={availableProvinces}
                  />
                </div>

                {/* Municipality — native select */}
                <div className="field-group" style={{ animationDelay: '0.18s' }}>
                  <FieldLabel>{municipalityLabel || 'Município'}</FieldLabel>
                  <NativeSelect
                    value={selectedMunicipality}
                    onChange={setSelectedMunicipality}
                    placeholder={t('registration.selectMunicipality') || 'Selecionar município'}
                    options={availableMunicipalities}
                    disabled={!selectedProvince}
                  />
                </div>

                {/* Password */}
                <div className="field-group" style={{ animationDelay: '0.20s' }}>
                  <FieldLabel>{t('registration.password') || 'Senha'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: '48px' }}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {showPassword
                        ? <EyeOff style={{ color: T.goldLight, width: 18, height: 18 }} />
                        : <Eye style={{ color: T.goldLight, width: 18, height: 18 }} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="field-group" style={{ animationDelay: '0.22s' }}>
                  <FieldLabel>{t('registration.confirmPassword') || 'Confirmar Senha'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: '48px' }}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {showConfirmPassword
                        ? <EyeOff style={{ color: T.goldLight, width: 18, height: 18 }} />
                        : <Eye style={{ color: T.goldLight, width: 18, height: 18 }} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Agent Referral */}
              <div className="field-group" style={{
                animationDelay: '0.24s',
                padding: '20px 22px',
                borderRadius: 18,
                border: `1.5px solid ${T.goldBorder}`,
                backgroundColor: T.goldPale,
              }}>
                <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.goldDark, margin: '0 0 14px' }}>
                  Foi indicado por um agente AgriLink?
                </p>
                <div style={{ display: 'flex', gap: 20 }}>
                  {(['nao', 'sim'] as const).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <div
                        onClick={() => setWasReferred(v)}
                        style={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: `2px solid ${wasReferred === v ? T.goldMid : T.goldLight}`,
                          backgroundColor: wasReferred === v ? T.goldMid : T.white,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {wasReferred === v && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: T.white }} />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.mid }}>
                        {v === 'nao' ? 'Não' : 'Sim'}
                      </span>
                    </label>
                  ))}
                </div>

                {wasReferred === 'sim' && (
                  <div style={{ marginTop: 16 }}>
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
                          height: '48px',
                          width: '100%',
                          borderRadius: '12px',
                          border: `1.5px solid ${agentCodeValid === false ? '#FECACA' : agentCodeValid === true ? T.gBorder : T.goldBorder}`,
                          backgroundColor: T.white,
                          color: T.ink,
                          fontSize: 16,
                          letterSpacing: '0.18em',
                          fontWeight: 800,
                          paddingLeft: '16px',
                          paddingRight: '44px',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                        {validatingCode
                          ? <div style={{ width: 18, height: 18, border: `2.5px solid ${T.goldBorder}`, borderTopColor: T.goldMid, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          : agentCodeValid === true
                            ? <Check style={{ color: '#16a34a', width: 20, height: 20 }} />
                            : agentCodeValid === false
                              ? <X style={{ color: '#dc2626', width: 20, height: 20 }} />
                              : null}
                      </div>
                    </div>
                    {agentCodeValid === false && (
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Código inválido
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="submit-btn"
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 16,
                  border: 'none',
                  background: loading ? T.muted : `linear-gradient(135deg, ${T.g600} 0%, ${T.g500} 100%)`,
                  color: T.white,
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(45,125,58,0.25)',
                  letterSpacing: '0.02em',
                }}
              >
                {loading ? 'Criando Conta...' : 'Finalizar Registo'}
                <ArrowRight style={{ width: 20, height: 20 }} />
              </button>

              <p style={{ textAlign: 'center', fontSize: 14, color: T.muted, fontWeight: 500, margin: 0 }}>
                Já tem uma conta?{' '}
                <Link to="/login" style={{ color: T.g600, fontWeight: 900, textDecoration: 'none' }}>
                  Faça Login
                </Link>
              </p>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.faint }}>
          © 2025 AgriLink Lda • Produção Sustentável
        </p>
      </div>
    </div>
  );
};

export default Registration;