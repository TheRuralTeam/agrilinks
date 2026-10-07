import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, User as UserIcon, CreditCard, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../integrations/supabase/client";
import { toast } from "../hooks/use-toast";
import { CountryPhoneInput, countries, Country } from "../components/CountryPhoneInput";
import { getProvincesForCountry, getProvinceLabel, getMunicipalityLabel } from "../data/country-locations";
import { getSavedCountry } from "../i18n/index";

const T = {
  g700: "#1A5C24", g600: "#2D7D3A", g500: "#3D9A48",
  gold: "#A0722A", goldMid: "#C9922A", goldBorder: "#C9A96E",
  goldBg: "#FDF8F0", goldPale: "#FBF3E4",
  ink: "#111714", mid: "#3D4D40", muted: "#758A79", faint: "#A8BAA9",
  canvas: "#F8F5EF", white: "#FFFFFF", rule: "#E8E0D0",
};

const inputStyle: React.CSSProperties = {
  height: 52, width: "100%", borderRadius: 14,
  border: `1.5px solid ${T.goldBorder}`, backgroundColor: T.goldBg,
  color: T.ink, fontSize: 15, paddingLeft: 44, paddingRight: 16,
  outline: "none", fontFamily: "inherit",
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{
    display: "block", fontSize: 10, fontWeight: 900,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: T.mid, marginBottom: 6, marginLeft: 2,
  }}>{children}</label>
);

const NativeSelect = ({ value, onChange, placeholder, options, disabled }: any) => (
  <div style={{ position: "relative" }}>
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        height: 52, width: "100%", borderRadius: 14,
        border: `1.5px solid ${T.goldBorder}`,
        backgroundColor: disabled ? "#F5F0E8" : T.goldBg,
        color: value ? T.ink : T.muted, fontSize: 15,
        paddingLeft: 16, paddingRight: 40,
        appearance: "none", outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1, fontFamily: "inherit",
      }}
    >
      <option value="" disabled hidden>{placeholder}</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
    <ChevronDown style={{
      position: "absolute", right: 12, top: "50%",
      transform: "translateY(-50%)", color: T.gold, width: 18, height: 18,
      pointerEvents: "none",
    }} />
  </div>
);

const CompletarPerfil = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, loading } = useAuth();
  const identityOnly = new URLSearchParams(location.search).get("required") === "identity";

  const [fullName, setFullName] = useState("");
  const [identityDocument, setIdentityDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [userType, setUserType] = useState<"agricultor" | "agente" | "comprador" | "motorista" | "">("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    () => countries.find(c => c.code === getSavedCountry()) || countries[0]
  );
  const [provinceId, setProvinceId] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadCapacity, setLoadCapacity] = useState("");

  const provinces = getProvincesForCountry(selectedCountry.code);
  const municipalities = provinces.find(p => p.id === provinceId)?.municipalities || [];

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (userProfile) {
      setFullName(userProfile.full_name || "");
      setIdentityDocument(userProfile.identity_document || "");
      setPhone(userProfile.phone || "");
      if (userProfile.user_type) setUserType(userProfile.user_type as any);
      if (userProfile.province_id) setProvinceId(userProfile.province_id);
      if (userProfile.municipality_id) setMunicipalityId(userProfile.municipality_id);
      // If profile already complete, redirect
      if (userProfile.user_type && userProfile.identity_document &&
          userProfile.province_id && userProfile.municipality_id) {
        navigate("/app", { replace: true });
      }
    }
  }, [user, userProfile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!identityDocument.trim()) {
      toast({ title: "Documento necessário", description: "Informe o número do Bilhete de Identidade ou NIF para continuar.", variant: "destructive" });
      return;
    }

    if (identityOnly) {
      setSaving(true);
      const { error } = await supabase.from("users").update({
        identity_document: identityDocument.trim(),
      } as any).eq("id", user.id);
      setSaving(false);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Identidade registada", description: "Pode continuar a operação na AgriLink." });
      navigate(-1);
      return;
    }

    if (userType === "motorista" && (!loadCapacity || Number(loadCapacity) <= 0)) {
      toast({ title: "Capacidade em falta", description: "Indique a capacidade de carga do veículo (kg).", variant: "destructive" });
      return;
    }

    setSaving(true);
    const fullPhone = phone.trim()
      ? (phone.startsWith("+") ? phone : `${selectedCountry.dialCode} ${phone}`)
      : null;

    const { error } = await supabase.from("users").update({
      full_name: fullName.trim() || userProfile?.full_name || "",
      identity_document: identityDocument.trim(),
      phone: fullPhone,
      province_id: provinceId || null,
      municipality_id: municipalityId || null,
      load_capacity_kg: userType === "motorista" && loadCapacity ? Number(loadCapacity) : null,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil atualizado", description: "Os dados foram guardados." });
    window.location.href = "/app";
  };


  return (
    <div style={{
      minHeight: "100vh", backgroundColor: T.canvas,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 480, backgroundColor: T.white,
        borderRadius: 24, padding: 28,
        border: `1px solid ${T.rule}`,
        boxShadow: "0 8px 40px rgba(160,114,42,0.10)",
      }}>
        <div style={{ marginBottom: 22 }}>
          <span style={{
            fontSize: 10, fontWeight: 900, letterSpacing: "0.22em",
            textTransform: "uppercase", color: T.gold,
          }}>AgriLink Platform</span>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: 26, color: T.ink, margin: "8px 0 6px",
          }}>{identityOnly ? "Identificação para continuar" : "Complete o seu Perfil"}</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>
            A identidade só é solicitada quando uma operação exige representação legal. Preencha o BI ou NIF agora; os restantes dados podem ser completados mais tarde.
          </p>
        </div>

        {identityOnly ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Label>Bilhete de Identidade ou NIF</Label>
            <div style={{ position: "relative" }}>
              <CreditCard style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.gold, width: 18, height: 18 }} />
              <input style={inputStyle} value={identityDocument} onChange={(e) => setIdentityDocument(e.target.value)} placeholder="Ex.: 006123456LA042" required autoFocus />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: T.muted }}>
            Este dado é solicitado apenas porque a operação atual exige identificação legal. A AgriLink não exige verificação de identidade para entrar e utilizar a plataforma.
          </p>
          <button type="submit" disabled={saving} style={{ width:"100%", height:54, borderRadius:16, border:"none", background:saving?T.muted:`linear-gradient(135deg, ${T.g600} 0%, ${T.g500} 100%)`, color:T.white, fontSize:16, fontWeight:900, cursor:saving?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {saving ? "A guardar…" : "Guardar e continuar"} <ArrowRight style={{ width:18,height:18 }} />
          </button>
        </form>
        ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Label>Nome Completo</Label>
            <div style={{ position: "relative" }}>
              <UserIcon style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.gold, width: 18, height: 18 }} />
              <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Documento de Identidade (BI / NIF)</Label>
            <div style={{ position: "relative" }}>
              <CreditCard style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.gold, width: 18, height: 18 }} />
              <input style={inputStyle} value={identityDocument} onChange={(e) => setIdentityDocument(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Telefone</Label>
            <CountryPhoneInput
              selectedCountry={selectedCountry}
              onCountryChange={setSelectedCountry}
              value={phone}
              onChange={setPhone}
            />
          </div>

          {userType === "motorista" && (
            <div>
              <Label>Capacidade de carga (kg)</Label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                value={loadCapacity}
                onChange={(e) => setLoadCapacity(e.target.value)}
                placeholder="Ex.: 8000"
              />
            </div>
          )}


          <div>
            <Label>{getProvinceLabel(selectedCountry.code) || "Província"}</Label>
            <NativeSelect
              value={provinceId}
              onChange={(v: string) => { setProvinceId(v); setMunicipalityId(""); }}
              placeholder="Selecione"
              options={provinces.map(p => ({ id: p.id, name: p.name }))}
            />
          </div>

          <div>
            <Label>{getMunicipalityLabel(selectedCountry.code) || "Município"}</Label>
            <NativeSelect
              value={municipalityId}
              onChange={setMunicipalityId}
              placeholder="Selecione"
              options={municipalities.map((m: any) => ({ id: m.id, name: m.name }))}
              disabled={!provinceId}
            />
          </div>

          <button
            type="submit" disabled={saving}
            style={{
              width: "100%", height: 54, borderRadius: 16, border: "none",
              background: saving ? T.muted : `linear-gradient(135deg, ${T.g600} 0%, ${T.g500} 100%)`,
              color: T.white, fontSize: 16, fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginTop: 8, letterSpacing: "0.02em",
              boxShadow: "0 4px 20px rgba(45,125,58,0.25)",
            }}>
            {saving ? "A guardar..." : "Guardar dados de identidade"}
            <ArrowRight style={{ width: 18, height: 18 }} />
          </button>
        </form>
 
        )}     </div>
    </div>
  );
};

export default CompletarPerfil;
