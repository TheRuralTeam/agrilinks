import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SimpleLeafletMap from "../components/SimpleLeafletMap";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { supabase } from "../integrations/supabase/client";
import { AGRICULTURAL_PRODUCT_GROUPS, AGRICULTURAL_PRODUCTS } from "../lib/agriculturalProducts";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { toast } from "sonner";
import { useCanAct } from "../hooks/useCanAct";
import { useAuth } from "../contexts/AuthContext";
import IdentityActionDialog from "../components/IdentityActionDialog";
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
  ChevronsUpDown,
} from "lucide-react";

const STEPS = [
  { id: 0, label: "Negócio", icon: Building2 },
  { id: 1, label: "Produto", icon: Package },
  { id: 2, label: "Entrega", icon: Truck },
  { id: 3, label: "Contacto", icon: Phone },
  { id: 4, label: "Resumo", icon: FileText },
];

const FichaRecebimento = () => {
  const navigate = useNavigate();
  const { userProfile, refreshProfile } = useAuth();
  const { requireAct } = useCanAct();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    nomeFicha: "",
    tipoNegocio: "",
    produtos: [{ key: crypto.randomUUID(), produto: "", quantidade: "", unidade: "kg", qualidade: "", embalagem: "", transporte: "", detalhes: "" }],
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
  const [mapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [openProductPicker, setOpenProductPicker] = useState<string | null>(null);

  const handleAddLocal = () => {
    if (localTemp.descricao && localTemp.coordenadas) {
      setFormData((prev) => ({
        ...prev,
        locaisEntrega: [...prev.locaisEntrega, localTemp],
      }));
      setLocalTemp({ descricao: "", coordenadas: null });
      toast.success("Local adicionado!");
    } else {
      toast.error("Preencha a descrição e clique no mapa para marcar o local.");
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
        return formData.produtos.length > 0 && formData.produtos.every((item) => AGRICULTURAL_PRODUCTS.includes(item.produto as (typeof AGRICULTURAL_PRODUCTS)[number]))
          && new Set(formData.produtos.map((item) => item.produto.trim().toLocaleLowerCase("pt-AO"))).size === formData.produtos.length;
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
        toast.error("Inicie sessão para criar uma ficha de recebimento.");
        setLoading(false);
        return;
      }
      if (!requireAct("criar uma ficha de recebimento")) {
        setLoading(false);
        return;
      }

      const payload = formData.produtos.map((item) => ({
        user_id: user.id,
        nome_ficha: formData.nomeFicha.trim(),
        tipo_negocio: formData.tipoNegocio,
        produto: item.produto.trim(),
        qualidade: item.qualidade.trim(),
        embalagem: item.embalagem,
        transporte: item.transporte,
        locais_entrega: formData.locaisEntrega,
        telefone: formData.telefone.trim(),
        descricao_final: [
          item.quantidade.trim() ? `Quantidade pretendida: ${item.quantidade.trim()} ${item.unidade}` : "",
          item.detalhes.trim() ? `Especificações adicionais para ${item.produto.trim()}: ${item.detalhes.trim()}` : "",
          formData.descricaoFinal.trim() ? `Requisitos gerais do pedido: ${formData.descricaoFinal.trim()}` : "",
        ].filter(Boolean).join("\n\n"),
        observacoes: formData.observacoes.trim(),
      }));
      const { data: insertedFichas, error } = await supabase
        .from("fichas_recebimento")
        .insert(payload)
        .select("id");
      if (error) throw error;

      // Cada produto tem a sua ficha e especificações próprias.
      // A verificação é iniciada individualmente, sem bloquear a submissão do grupo.
      for (const ficha of insertedFichas || []) {
        void supabase.functions.invoke("verify-product-ficha", {
          body: { ficha_id: ficha.id },
        }).catch((e) => console.error("Erro ao verificar ficha:", e));
      }

      toast.success(`${payload.length} ficha(s) criada(s) no grupo “${formData.nomeFicha.trim()}”.`);
      navigate(-1);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar ficha.");
    } finally {
      setLoading(false);
    }
  };

  const T = {
    green: "#2c863b",
    greenLight: "#2c863b",
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
                Dê um nome descritivo para identificar facilmente esta ficha.
              </p>
            </div>
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Tipo de Negócio *
              </Label>
              <Select
                value={formData.tipoNegocio}
                onValueChange={(v) => setFormData({ ...formData, tipoNegocio: v })}
              >
                <SelectTrigger className="h-12 text-base" style={{ borderColor: T.border }}>
                  <SelectValue placeholder="Selecione o tipo de negócio" />
                </SelectTrigger>
                <SelectContent>
                  {["Restaurante", "Bar", "Supermercado", "Minimercado", "Armazém", "Mercado Informal", "Hotel", "Fábrica", "Exportação", "Distribuição"].map((t) => (
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
            <div className="rounded-xl border p-3 text-sm" style={{ background: T.greenPale, borderColor: T.border, color: T.charcoal }}>
              Adicione todos os produtos que pretende comprar. Cada produto terá a sua própria ficha, qualidade, embalagem e transporte, mas ficará organizado no mesmo grupo para a equipa AgriLink.
            </div>
            {formData.produtos.map((item, index) => {
              const updateProduct = (field: "produto" | "quantidade" | "unidade" | "qualidade" | "embalagem" | "transporte" | "detalhes", value: string) => {
                setFormData((prev) => ({ ...prev, produtos: prev.produtos.map((product) => product.key === item.key ? { ...product, [field]: value } : product) }));
              };
              const selectedNames = formData.produtos.filter((p) => p.key !== item.key).map((p) => p.produto.trim().toLocaleLowerCase("pt-AO"));
              const query = item.produto.trim().toLocaleLowerCase("pt-AO");
              const matches = AGRICULTURAL_PRODUCT_GROUPS.map((group) => ({
                ...group,
                products: group.products.filter((name) => name.toLocaleLowerCase("pt-AO").includes(query) && !selectedNames.includes(name.toLocaleLowerCase("pt-AO"))),
              })).filter((group) => group.products.length > 0);
              return (
                <div key={item.key} className="space-y-4 rounded-2xl border p-4" style={{ borderColor: T.border, background: T.white }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold" style={{ color: T.charcoal }}>Produto {index + 1}</p>
                      <p className="text-xs" style={{ color: T.muted }}>Especificações independentes</p>
                    </div>
                    {formData.produtos.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormData((prev) => ({ ...prev, produtos: prev.produtos.filter((p) => p.key !== item.key) }))} aria-label={`Remover produto ${index + 1}`}>
                        <X size={15} className="mr-1" /> Remover
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Produto *</Label>
                    <Popover open={openProductPicker === item.key} onOpenChange={(open) => setOpenProductPicker(open ? item.key : null)}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={openProductPicker === item.key}
                          aria-label={`Selecionar produto ${index + 1}`}
                          className="h-12 w-full justify-between text-left text-base font-normal"
                          style={{ borderColor: T.border, color: item.produto ? T.charcoal : T.muted }}
                        >
                          <span className="truncate">{item.produto || "Selecione um produto do campo"}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" style={{ zIndex: 1200 }}>
                        <Command>
                          <CommandInput placeholder="Pesquisar produto..." aria-label="Pesquisar no catálogo de produtos" />
                          <CommandList>
                            <CommandEmpty>Nenhum produto encontrado no catálogo agrícola.</CommandEmpty>
                            {AGRICULTURAL_PRODUCT_GROUPS.map((group) => {
                              const availableProducts = group.products.filter((name) =>
                                !formData.produtos.some((other) => other.key !== item.key && other.produto === name)
                              );
                              if (availableProducts.length === 0) return null;
                              return (
                                <CommandGroup key={group.label} heading={group.label}>
                                  {availableProducts.map((name) => (
                                    <CommandItem
                                      key={name}
                                      value={name}
                                      onSelect={() => {
                                        updateProduct("produto", name);
                                        setOpenProductPicker(null);
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${item.produto === name ? "opacity-100" : "opacity-0"}`} />
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              );
                            })}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedNames.includes(item.produto.trim().toLocaleLowerCase("pt-AO")) && item.produto.trim() && (
                      <p className="mt-1 text-xs text-red-600">Este produto já foi seleccionado. Escolha outro.</p>
                    )}
                    <p className="mt-1.5 text-xs" style={{ color: T.muted }}>
                      Seleccione no botão. A pesquisa mostra apenas produtos do catálogo agrícola da AgriLink.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Quantidade pretendida</Label>
                      <Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Ex.: 500" value={item.quantidade} onChange={(e) => updateProduct("quantidade", e.target.value)} className="h-12" style={{ borderColor: T.border }} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Unidade</Label>
                      <Select value={item.unidade} onValueChange={(v) => updateProduct("unidade", v)}>
                        <SelectTrigger className="h-12" style={{ borderColor: T.border }}><SelectValue placeholder="Unidade de medida" /></SelectTrigger>
                        <SelectContent>
                          {[{v:"kg",l:"Quilogramas (kg)"},{v:"t",l:"Toneladas (t)"},{v:"sacos",l:"Sacos"},{v:"caixas",l:"Caixas"},{v:"unidades",l:"Unidades"},{v:"litros",l:"Litros"},{v:"cestos",l:"Cestos"},{v:"molhos",l:"Molhos"}].map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Padrões de qualidade</Label>
                      <Input placeholder="Ex.: calibre, maturação, frescura…" value={item.qualidade} onChange={(e) => updateProduct("qualidade", e.target.value)} className="h-12" style={{ borderColor: T.border }} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Embalagem</Label>
                      <Select value={item.embalagem} onValueChange={(v) => updateProduct("embalagem", v)}>
                        <SelectTrigger className="h-12" style={{ borderColor: T.border }}><SelectValue placeholder="Tipo de embalagem" /></SelectTrigger>
                        <SelectContent>
                          {[{v:"saco10",l:"Saco 10 kg"},{v:"saco25",l:"Saco 25 kg"},{v:"saco30",l:"Saco 30 kg"},{v:"saco50",l:"Saco 50 kg"},{v:"saco1t",l:"Saco de 1 tonelada"},{v:"cesta10",l:"Cesta 10 kg"},{v:"caixa5",l:"Caixa 5 kg"},{v:"caixa10",l:"Caixa 10 kg"},{v:"caixa20",l:"Caixa 20 kg"},{v:"vacuo",l:"Embalagem a vácuo"},{v:"rede",l:"Rede"},{v:"garrafa",l:"Garrafa"},{v:"bidon",l:"Bidão"},{v:"granel",l:"A granel"},{v:"outro",l:"Outra (indicar nas observações)"}].map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Especificações adicionais deste produto</Label>
                    <Textarea rows={3} placeholder="Ex.: milho seco, humidade máxima, calibre, maturação, origem ou certificação…" value={item.detalhes} onChange={(e) => updateProduct("detalhes", e.target.value)} style={{ borderColor: T.border }} />
                  </div>
                  <div>
                    <Label className="mb-2 block text-sm font-bold" style={{ color: T.charcoal }}>Transporte preferido</Label>
                    <Select value={item.transporte} onValueChange={(v) => updateProduct("transporte", v)}>
                      <SelectTrigger className="h-12" style={{ borderColor: T.border }}><SelectValue placeholder="Selecione o transporte" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proprio">Transporte próprio</SelectItem>
                        <SelectItem value="terceiros">Transportadora / terceiros</SelectItem>
                        <SelectItem value="agrilink">Via AgriLink</SelectItem>
                        <SelectItem value="combinar">A combinar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="h-12 w-full" style={{ borderColor: T.border, color: T.green }} onClick={() => setFormData((prev) => ({ ...prev, produtos: [...prev.produtos, { key: crypto.randomUUID(), produto: "", quantidade: "", unidade: "kg", qualidade: "", embalagem: "", transporte: "", detalhes: "" }] }))}>
              <Plus size={16} className="mr-2" /> Adicionar outro produto
            </Button>
            <p className="text-xs" style={{ color: T.muted }}>Pode adicionar vários produtos. Cada ficha será guardada separadamente e todas ficarão agrupadas pelo nome desta solicitação.</p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-bold mb-2 block" style={{ color: T.charcoal }}>
                Descrição do Local
              </Label>
              <Input
                placeholder="Ex.: Armazém Viana, Luanda Sul"
                value={localTemp.descricao}
                onChange={(e) => setLocalTemp({ ...localTemp, descricao: e.target.value })}
                className="h-12"
                style={{ borderColor: T.border }}
              />
            </div>

            <p className="text-xs" style={{ color: T.muted }}>
              Clique no mapa para seleccionar a localização exacta.
            </p>

            {mapError ? (
              <div
                className="w-full h-64 rounded-xl flex items-center justify-center text-sm"
                style={{ background: T.greenPale, color: T.muted, border: `1px solid ${T.border}` }}
              >
                {mapError}
              </div>
            ) : (
              <div className="w-full rounded-xl overflow-hidden" style={{ height: 280, border: `1.5px solid ${T.border}` }}>
                <SimpleLeafletMap
                  center={{ lat: -8.838, lng: 13.235 }}
                  zoom={10}
                  height={280}
                  onClick={(c) => setLocalTemp((prev) => ({ ...prev, coordenadas: c }))}
                  markers={localTemp.coordenadas ? [{ lat: localTemp.coordenadas.lat, lng: localTemp.coordenadas.lng, color: '#2c863b' }] : []}
                  clickMarkerColor="#2c863b"
                />
              </div>
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
                Descrição Final
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
                Observações
              </Label>
              <Textarea
                placeholder="Informações complementares, links úteis..."
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
              { label: "Tipo de Negócio", value: formData.tipoNegocio },
              { label: "Quantidade de produtos", value: String(formData.produtos.length) },
              { label: "Telefone", value: formData.telefone || "—" },
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

            <div className="space-y-2">
              <p className="text-sm font-extrabold" style={{ color: T.charcoal }}>Produtos e especificações</p>
              {formData.produtos.map((item, index) => (
                <div key={item.key} className="rounded-xl border p-3" style={{ borderColor: T.border, background: T.greenPale }}>
                  <p className="text-sm font-bold capitalize" style={{ color: T.charcoal }}>{index + 1}. {item.produto || "Produto por definir"}</p>
                  <p className="mt-1 text-xs" style={{ color: T.muted }}>Quantidade: {item.quantidade ? `${item.quantidade} ${item.unidade}` : "A combinar"} · Qualidade: {item.qualidade || "A combinar"} · Embalagem: {item.embalagem || "A combinar"} · Transporte: {item.transporte || "A combinar"}</p>
                  {item.detalhes && <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: T.muted }}>{item.detalhes}</p>}
                </div>
              ))}
            </div>
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
                  Descrição Final
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
            Próximo
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
