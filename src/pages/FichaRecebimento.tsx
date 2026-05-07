import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Phone,
  FileText,
  Package,
  Building2,
  Truck,
  X,
  Plus,
  CheckCircle2,
} from "lucide-react";

mapboxgl.accessToken =
  "pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA";

const STEPS = [
  { id: 0, label: "Neg├│cio", icon: Building2 },
  { id: 1, label: "Produto", icon: Package },
  { id: 2, label: "Entrega", icon: Truck },
  { id: 3, label: "Contacto", icon: Phone },
  { id: 4, label: "Resumo", icon: FileText },
];

const FichaRecebimento = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    nomeFicha: "",
    tipoNegocio: "",
    produto: "",
    qualidade: "",
    embalagem: "",
    transporte: "",
    locaisEntrega: [] as {
      descricao: string;
      coordenadas: { lat: number; lng: number } | null;
    }[],
    telefone: "",
    descricaoFinal: "",
    observacoes: "",
  });

  const [localTemp, setLocalTemp] = useState({
    descricao: "",
    coordenadas: null as { lat: number; lng: number } | null,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Init map when step 2 is active
  useEffect(() => {
    if (step !== 2) return;
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      if (mapRef.current) {
        mapRef.current.resize();
        return;
      }
      try {
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [13.235, -8.838],
          zoom: 10,
        });
        map.on("error", () => setMapError("Erro ao carregar o mapa."));
        map.on("click", (e) => {
          const coords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
          setLocalTemp((prev) => ({ ...prev, coordenadas: coords }));
          if (markerRef.current) {
            markerRef.current.setLngLat([coords.lng, coords.lat]);
          } else {
            markerRef.current = new mapboxgl.Marker({ color: "#2D7D3A" })
              .setLngLat([coords.lng, coords.lat])
              .addTo(map);
          }
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        mapRef.current = map;
      } catch {
        setMapError("N├úo foi poss├¡vel inicializar o mapa.");
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleAddLocal = () => {
    if (localTemp.descricao && localTemp.coordenadas) {
      setFormData((prev) => ({
        ...prev,
        locaisEntrega: [...prev.locaisEntrega, localTemp],
      }));
      setLocalTemp({ descricao: "", coordenadas: null });
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      toast.success("Local adicionado!");
    } else {
      toast.error("Preencha a descri├º├úo e clique no mapa para marcar o local.");
    }
  };

  const removeLocal = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      locaisEntrega: prev.locaisEntrega.filter((_, i) => i !== index),
    }));
  };

  const canAdvance = () => {
    switch (step) {
      case 0:
        return formData.nomeFicha.trim() && formData.tipoNegocio;
      case 1:
        return formData.produto;
      case 2:
        return true; // delivery locations are optional
      case 3:
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error("Utilizador n├úo autenticado!");
        setLoading(false);
        return;
      }
      const { data: insertedFicha, error } = await supabase.from("fichas_recebimento").insert([
        {
          user_id: user.id,
          nome_ficha: formData.nomeFicha,
          tipo_negocio: formData.tipoNegocio,
          produto: formData.produto,
          qualidade: formData.qualidade,
          embalagem: formData.embalagem,
          transporte: formData.transporte,
          locais_entrega: formData.locaisEntrega,
          telefone: formData.telefone,
          descricao_final: formData.descricaoFinal,
          observacoes: formData.observacoes,
        },
      ]).select('id').single();
      if (error) throw error;

      // Trigger AI verification against existing products (fire-and-forget)
      if (insertedFicha?.id) {
        supabase.functions.invoke('verify-product-ficha', {
          body: { ficha_id: insertedFicha.id },
        }).catch((e) => console.error('verify error', e));
      }

      toast.success("Ficha de recebimento criada com sucesso!");
      navigate(-1);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar ficha.");
    } finally {
      setLoading(false);
    }
  };

  const T = {
    green: "#2D7D3A",
    greenLight: "#4CAF50",
    greenPale: "#E8F5E9",
    charcoal: "#1C2B1E",
    muted: "#6B7C6E",
    border: "#D4E8D1",
    earth: "#7B4F2E",
    gold: "#C8860A",
    cream: "#FAFAF7",
    white: "#FFFFFF",
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Nome da Ficha *
              </Label>
              <Input
                placeholder="Ex.: Milho Premium Luanda"
                value={formData.nomeFicha}
                onChange={(e) => setFormData({ ...formData, nomeFicha: e.target.value })}
                className="h-12 text-base"
                style={{ borderColor: T.border }}
              />
              <p className="text-xs mt-1.5" style={{ color: T.muted }}>
                D├¬ um nome descritivo para identificar facilmente esta ficha.
              </p>
            </div>
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Tipo de Neg├│cio *
              </Label>
              <Select
                value={formData.tipoNegocio}
                onValueChange={(v) => setFormData({ ...formData, tipoNegocio: v })}
              >
                <SelectTrigger className="h-12 text-base" style={{ borderColor: T.border }}>
                  <SelectValue placeholder="Selecione o tipo de neg├│cio" />
                </SelectTrigger>
                <SelectContent>
                  {["Restaurante", "Bar", "Supermercado", "Minimercado", "Armaz├®m", "Mercado Informal", "Hotel", "F├íbrica", "Exporta├º├úo", "Distribui├º├úo"].map((t) => (
                    <SelectItem key={t.toLowerCase()} value={t.toLowerCase()}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Produto Principal *
              </Label>
              <Select
                value={formData.produto}
                onValueChange={(v) => setFormData({ ...formData, produto: v })}
              >
                <SelectTrigger className="h-12 text-base" style={{ borderColor: T.border }}>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Batata", "Mandioca", "Inhame", "Alface", "Couve", "Espinafre",
                    "Manga", "Banana", "Laranja", "Milho", "Feij├úo", "Arroz",
                    "Trigo", "Carne Bovina", "Carne Su├¡na", "Frango", "Peixe",
                  ].map((p) => (
                    <SelectItem key={p.toLowerCase()} value={p.toLowerCase()}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                  Padr├Áes de Qualidade
                </Label>
                <Input
                  placeholder="Ex.: Fresco, sem defeitos"
                  value={formData.qualidade}
                  onChange={(e) => setFormData({ ...formData, qualidade: e.target.value })}
                  className="h-12"
                  style={{ borderColor: T.border }}
                />
              </div>
              <div>
                <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                  Embalagem
                </Label>
                <Select
                  value={formData.embalagem}
                  onValueChange={(v) => setFormData({ ...formData, embalagem: v })}
                >
                  <SelectTrigger className="h-12" style={{ borderColor: T.border }}>
                    <SelectValue placeholder="Tipo de embalagem" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { v: "saco30", l: "Saco 30kg" },
                      { v: "saco50", l: "Saco 50kg" },
                      { v: "saco1t", l: "Saco 1 ton" },
                      { v: "cesta10", l: "Cesta 10kg" },
                      { v: "caixa20", l: "Caixa 20kg" },
                      { v: "vacuo", l: "Embalagem a v├ícuo" },
                      { v: "granel", l: "A granel" },
                    ].map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Transporte Preferido
              </Label>
              <Select
                value={formData.transporte}
                onValueChange={(v) => setFormData({ ...formData, transporte: v })}
              >
                <SelectTrigger className="h-12" style={{ borderColor: T.border }}>
                  <SelectValue placeholder="Selecione o transporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proprio">Pr├│prio</SelectItem>
                  <SelectItem value="terceiros">Terceiros</SelectItem>
                  <SelectItem value="agrilink">Via AgriLink</SelectItem>
                  <SelectItem value="combinar">A combinar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Descri├º├úo do Local
              </Label>
              <Input
                placeholder="Ex.: Armaz├®m Viana, Luanda Sul"
                value={localTemp.descricao}
                onChange={(e) => setLocalTemp({ ...localTemp, descricao: e.target.value })}
                className="h-12"
                style={{ borderColor: T.border }}
              />
            </div>

            <p className="text-xs" style={{ color: T.muted }}>
              Clique no mapa para seleccionar a localiza├º├úo exacta.
            </p>

            {mapError ? (
              <div
                className="w-full h-64 rounded-xl flex items-center justify-center text-sm"
                style={{ background: T.greenPale, color: T.muted, border: `1px solid ${T.border}` }}
              >
                {mapError}
              </div>
            ) : (
              <div
                ref={mapContainerRef}
                className="w-full rounded-xl overflow-hidden"
                style={{ height: 280, border: `1.5px solid ${T.border}` }}
              />
            )}

            {localTemp.coordenadas && (
              <p className="text-xs font-mono" style={{ color: T.green }}>
                Coordenadas: {localTemp.coordenadas.lat.toFixed(5)},{" "}
                {localTemp.coordenadas.lng.toFixed(5)}
              </p>
            )}

            <Button
              type="button"
              onClick={handleAddLocal}
              className="w-full h-11"
              style={{ background: T.green, color: T.white }}
            >
              <Plus size={16} className="mr-2" />
              Adicionar Local de Entrega
            </Button>

            {formData.locaisEntrega.length > 0 && (
              <div className="space-y-2 mt-3">
                <Label className="text-xs font-bold" style={{ color: T.charcoal }}>
                  Locais adicionados ({formData.locaisEntrega.length})
                </Label>
                {formData.locaisEntrega.map((local, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: T.greenPale, border: `1px solid ${T.border}` }}
                  >
                    <MapPin size={16} style={{ color: T.green, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: T.charcoal }}>
                        {local.descricao}
                      </p>
                      <p className="text-[11px] font-mono" style={{ color: T.muted }}>
                        {local.coordenadas?.lat.toFixed(4)}, {local.coordenadas?.lng.toFixed(4)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeLocal(i)}
                      className="p-1 rounded-full hover:bg-white/50 transition"
                    >
                      <X size={14} style={{ color: T.muted }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Telefone para Contacto
              </Label>
              <Input
                type="tel"
                placeholder="+244 999 999 999"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="h-12 text-base"
                style={{ borderColor: T.border }}
              />
            </div>
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Descri├º├úo Final
              </Label>
              <Textarea
                placeholder="Descreva requisitos adicionais para o fornecedor..."
                value={formData.descricaoFinal}
                onChange={(e) => setFormData({ ...formData, descricaoFinal: e.target.value })}
                rows={4}
                style={{ borderColor: T.border }}
              />
            </div>
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Observa├º├Áes
              </Label>
              <Textarea
                placeholder="Informa├º├Áes complementares, links ├║teis..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                style={{ borderColor: T.border }}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium" style={{ color: T.muted }}>
              Revise os dados antes de submeter.
            </p>

            {[
              { label: "Nome da Ficha", value: formData.nomeFicha },
              { label: "Tipo de Neg├│cio", value: formData.tipoNegocio },
              { label: "Produto", value: formData.produto },
              { label: "Qualidade", value: formData.qualidade || "ÔÇö" },
              { label: "Embalagem", value: formData.embalagem || "ÔÇö" },
              { label: "Transporte", value: formData.transporte || "ÔÇö" },
              { label: "Telefone", value: formData.telefone || "ÔÇö" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between items-center py-2.5 px-1"
                style={{ borderBottom: `1px solid ${T.border}` }}
              >
                <span className="text-sm" style={{ color: T.muted }}>
                  {item.label}
                </span>
                <span className="text-sm font-semibold capitalize" style={{ color: T.charcoal }}>
                  {item.value}
                </span>
              </div>
            ))}

            {formData.locaisEntrega.length > 0 && (
              <div>
                <p className="text-sm font-bold mb-2" style={{ color: T.charcoal }}>
                  Locais de Entrega ({formData.locaisEntrega.length})
                </p>
                {formData.locaisEntrega.map((local, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg mb-1.5"
                    style={{ background: T.greenPale }}
                  >
                    <MapPin size={14} style={{ color: T.green }} />
                    <span className="text-sm" style={{ color: T.charcoal }}>
                      {local.descricao}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {formData.descricaoFinal && (
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: T.charcoal }}>
                  Descri├º├úo Final
                </p>
                <p className="text-sm" style={{ color: T.muted }}>
                  {formData.descricaoFinal}
                </p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen" style={{ background: T.cream }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{
          background: T.white,
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          style={{ color: T.charcoal }}
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold" style={{ color: T.charcoal }}>
            Nova Ficha de Recebimento
          </h1>
          <p className="text-xs" style={{ color: T.muted }}>
            Passo {step + 1} de {STEPS.length}
          </p>
        </div>
      </header>

      {/* Step indicators */}
      <div className="px-4 py-4" style={{ background: T.white }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => i <= step && setStep(i)}
                  className="flex flex-col items-center gap-1 transition-all"
                  disabled={i > step}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isDone
                        ? T.green
                        : isActive
                        ? T.greenPale
                        : "#f0f0f0",
                      border: isActive ? `2px solid ${T.green}` : "none",
                    }}
                  >
                    {isDone ? (
                      <Check size={16} color={T.white} />
                    ) : (
                      <Icon
                        size={16}
                        color={isActive ? T.green : T.muted}
                      />
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold"
                    style={{
                      color: isActive ? T.green : isDone ? T.charcoal : T.muted,
                    }}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-1"
                    style={{
                      background: i < step ? T.green : T.border,
                      transition: "background 0.3s",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-lg mx-auto pb-32">
        <Card
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}
        >
          <CardContent className="p-5 pt-6">{renderStepContent()}</CardContent>
        </Card>
      </div>

      {/* Bottom navigation buttons */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 flex gap-3"
        style={{
          background: T.white,
          borderTop: `1px solid ${T.border}`,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
        }}
      >
        {step > 0 && (
          <Button
            variant="outline"
            className="flex-1 h-12 text-sm font-bold"
            onClick={() => setStep(step - 1)}
            style={{ borderColor: T.border, color: T.charcoal }}
          >
            <ArrowLeft size={16} className="mr-2" />
            Anterior
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            className="flex-1 h-12 text-sm font-bold"
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
            style={{
              background: canAdvance() ? T.green : T.border,
              color: T.white,
            }}
          >
            Pr├│ximo
            <ArrowRight size={16} className="ml-2" />
          </Button>
        ) : (
          <Button
            className="flex-1 h-12 text-sm font-bold"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: `linear-gradient(135deg, ${T.green}, ${T.greenLight})`,
              color: T.white,
            }}
          >
            {loading ? (
              "Salvando..."
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-2" />
                Submeter Ficha
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FichaRecebimento;