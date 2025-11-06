import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, User, Phone, CreditCard, Mail, MapPin, Users, Lock, Eye, EyeOff, UserPlus } from "lucide-react";
import { angolaProvinces } from "@/data/angola-locations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import agrilinkLogo from "@/assets/agrilink-logo.png";

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const Registration = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
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

  // Validar código do agente usando RPC segura
  const validateAgentCode = async (code: string) => {
    if (!code || code.length !== 6) {
      setAgentCodeValid(null);
      return;
    }

    setValidatingCode(true);
    try {
      const { data, error } = await supabase.rpc('validate_agent_code', { p_code: code });
      if (error) throw error;
      setAgentCodeValid(data === true);
    } catch (error) {
      console.error('Erro ao validar código:', error);
      setAgentCodeValid(false);
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) return;
    if (!email || !phone) return;
    if (wasReferred === 'sim' && !agentCodeValid) {
      setErrorMessage("Código de agente inválido. Verifique e tente novamente.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await register({
        email,
        phone,
        password,
        full_name: fullName,
        identity_document: identityDocument,
        user_type: userType as "agricultor" | "agente" | "comprador",
        province_id: selectedProvince,
        municipality_id: selectedMunicipality,
        referred_by_agent_id: wasReferred === 'sim' && agentCode ? agentCode.toUpperCase() : null,
      });

      if (error) {
        setErrorMessage(error.message || "Não foi possível criar a conta. Verifique os dados e tente novamente.");
        return;
      }
      
      alert('Conta criada com sucesso! Você já pode fazer login.');
      navigate("/login");
    } catch (error: any) {
      setErrorMessage(error?.message || "Erro inesperado ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const availableMunicipalities =
    angolaProvinces.find((p) => p.id === selectedProvince)?.municipalities || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src={agrilinkLogo} alt="AgriLink" className="h-16 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-primary">Cadastro AgriLink</h1>
          <p className="text-primary/70">Crie sua conta na plataforma</p>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
              <Users className="h-5 w-5" />
              Informações de Cadastro
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Usuário */}
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                {isMobile() ? (
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-primary bg-background"
                    required
                  >
                    <option value="">Selecione o tipo de usuário</option>
                    <option value="agricultor">Agricultor</option>
                    <option value="agente">Agente</option>
                    <option value="comprador">Comprador</option>
                  </select>
                ) : (
                  <Select value={userType} onValueChange={setUserType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agricultor">Agricultor</SelectItem>
                      <SelectItem value="agente">Agente</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* BI */}
              <div className="space-y-2">
                <Label>Bilhete de Identidade</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={identityDocument}
                    onChange={(e) => setIdentityDocument(e.target.value)}
                    placeholder="000000000AA000"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label>Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+244 900 000 000"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Indicação por Agente */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                <Label className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Foi indicado por um agente?
                </Label>
                <RadioGroup value={wasReferred} onValueChange={(v) => setWasReferred(v as 'sim' | 'nao')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="nao" />
                    <Label htmlFor="nao" className="font-normal cursor-pointer">Não</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="sim" />
                    <Label htmlFor="sim" className="font-normal cursor-pointer">Sim</Label>
                  </div>
                </RadioGroup>

                {wasReferred === 'sim' && (
                  <div className="space-y-2 mt-3">
                    <Label>Código do Agente</Label>
                    <div className="relative">
                      <Input
                        value={agentCode}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setAgentCode(value);
                          if (value.length === 6) {
                            validateAgentCode(value);
                          } else {
                            setAgentCodeValid(null);
                          }
                        }}
                        placeholder="Digite o código de 6 caracteres"
                        className="uppercase"
                        maxLength={6}
                        required
                      />
                      {validatingCode && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>
                    {agentCodeValid === true && (
                      <p className="text-sm text-green-600">✓ Código válido</p>
                    )}
                    {agentCodeValid === false && (
                      <p className="text-sm text-destructive">✗ Código inválido</p>
                    )}
                  </div>
                )}
              </div>

              {/* Senhas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[["Senha", password, setPassword, showPassword, setShowPassword],
                  ["Confirmar Senha", confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword]
                ].map(([label, value, setter, show, setShow], i) => (
                  <div className="space-y-2" key={i}>
                    <Label>{label as string}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={show ? "text" : "password"}
                        value={value as string}
                        onChange={(e) => (setter as any)(e.target.value)}
                        placeholder={label as string}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => (setShow as any)(!show)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {password && confirmPassword && password !== confirmPassword && (
                <div className="text-destructive text-sm">As senhas não coincidem</div>
              )}

              {errorMessage && (
                <div className="text-destructive text-sm">{errorMessage}</div>
              )}

              {/* Localização */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Província */}
                <div className="space-y-2">
                  <Label>Província</Label>
                  {isMobile() ? (
                    <select
                      value={selectedProvince}
                      onChange={(e) => {
                        setSelectedProvince(e.target.value);
                        setSelectedMunicipality("");
                      }}
                      className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-primary bg-background"
                      required
                    >
                      <option value="">Selecione a província</option>
                      {angolaProvinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Select
                      value={selectedProvince}
                      onValueChange={(v) => {
                        setSelectedProvince(v);
                        setSelectedMunicipality("");
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a província" />
                      </SelectTrigger>
                      <SelectContent>
                        {angolaProvinces.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Município */}
                <div className="space-y-2">
                  <Label>Município</Label>
                  {isMobile() ? (
                    <select
                      value={selectedMunicipality}
                      onChange={(e) => setSelectedMunicipality(e.target.value)}
                      disabled={!selectedProvince}
                      className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-primary bg-background"
                      required
                    >
                      <option value="">
                        {selectedProvince
                          ? "Selecione o município"
                          : "Primeiro selecione a província"}
                      </option>
                      {availableMunicipalities.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Select
                      value={selectedMunicipality}
                      onValueChange={setSelectedMunicipality}
                      required
                      disabled={!selectedProvince}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedProvince
                              ? "Selecione o município"
                              : "Primeiro selecione a província"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMunicipalities.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Botão */}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover rounded-xl py-2 text-base font-medium"
                disabled={
                  loading ||
                  password !== confirmPassword ||
                  !userType ||
                  !selectedProvince ||
                  !selectedMunicipality ||
                  !email ||
                  !phone ||
                  (wasReferred === 'sim' && (!agentCodeValid || validatingCode))
                }
              >
                {loading ? "Criando conta..." : "Criar Conta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Button
            variant="link"
            className="text-primary"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Registration;
