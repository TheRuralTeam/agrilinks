import React, { useRef, useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import agrilinkLogo from '@/assets/agrilink-logo.png';
import orbisLinkLogo from '@/assets/orbislink-logo.png';

mapboxgl.accessToken = "pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA";

const FichaRecebimento = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nomeFicha: "",
    tipoNegocio: "",
    produto: "",
    qualidade: "",
    embalagem: "",
    transporte: "",
    locaisEntrega: [] as { descricao: string; coordenadas: { lat: number; lng: number } | null }[],
    telefone: "",
    descricaoFinal: "",
    observacoes: "",
  });

  const [localTemp, setLocalTemp] = useState({ descricao: "", coordenadas: null as { lat: number; lng: number } | null });
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Inicializar mapa Mapbox
  useEffect(() => {
    if (!mapboxgl.supported()) {
      setMapError('Seu navegador/dispositivo não suporta WebGL suficiente para o mapa.');
      return;
    }

    try {
      const mapbox = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.235, -8.838],
        zoom: 10,
      });

      mapbox.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Erro ao carregar o mapa.');
      });

      mapbox.on('click', (e) => {
        const coords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        setLocalTemp(prev => ({ ...prev, coordenadas: coords }));

        if (markerRef.current) {
          markerRef.current.setLngLat([coords.lng, coords.lat]);
        } else {
          const newMarker = new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat([coords.lng, coords.lat])
            .addTo(mapbox);
          markerRef.current = newMarker;
        }
      });

      mapRef.current = mapbox;
      return () => mapbox.remove();
    } catch (err) {
      console.error('Erro ao inicializar Mapbox:', err);
      setMapError('Não foi possível inicializar o mapa.');
    }
  }, []);

  const handleAddLocal = () => {
    if (localTemp.descricao && localTemp.coordenadas) {
      setFormData(prev => ({
        ...prev,
        locaisEntrega: [...prev.locaisEntrega, localTemp],
      }));
      setLocalTemp({ descricao: "", coordenadas: null });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = null;
    }
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // Pega o usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert('Usuário não autenticado!');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('fichas_recebimento')
      .insert([{
        user_id: user.id, // ✅ envia o ID do usuário autenticado
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
      }]);

    if (error) throw error;

    alert('Ficha de recebimento criada com sucesso!');
    setFormData({
      nomeFicha: "",
      tipoNegocio: "",
      produto: "",
      qualidade: "",
      embalagem: "",
      transporte: "",
      locaisEntrega: [],
      telefone: "",
      descricaoFinal: "",
      observacoes: "",
    });
    navigate(-1);
  } catch (err) {
    console.error(err);
    alert('Erro ao salvar ficha. Veja o console.');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-md z-50 p-4 flex justify-between items-center border-b border-[#B8860B]/30">
        <div className="flex items-center gap-2">
          <img src={orbisLinkLogo} alt="OrbisLink" className="h-12" />
        </div>
        <h1 className="font-semibold text-lg text-[#0a1628]">📦 Ficha de Recebimento</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="border-[#B8860B] text-[#B8860B] hover:bg-[#B8860B] hover:text-white"
        >
          Voltar
        </Button>
      </div>

      <div className="pt-20 p-4 md:p-8">
        <Card className="max-w-4xl mx-auto shadow-md border border-[#B8860B]/30 mt-20 bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#0a1628]">Criar nova Ficha Técnica de Recebimento</CardTitle>
            <p className="text-sm text-[#0a1628]/70 mt-2">
              Personalize como e onde deseja receber seus produtos. Defina qualidade, embalagem e locais de entrega exatos no mapa.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campos do formulário */}
              {/* Nome da ficha */}
              <div>
                <Label>Nome da Ficha</Label>
                <Input
                  placeholder="Ex.: Milho Premium"
                  value={formData.nomeFicha}
                  onChange={(e) => setFormData({ ...formData, nomeFicha: e.target.value })}
                />
              </div>

              {/* Tipo de negócio */}
              <div>
                <Label>Tipo de Negócio</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, tipoNegocio: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo de negócio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurante">Restaurante</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="supermercado">Supermercado</SelectItem>
                    <SelectItem value="minimercado">Minimercado</SelectItem>
                    <SelectItem value="armazem">Armazém</SelectItem>
                    <SelectItem value="mercado-informal">Mercado Informal</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="fabrica">Fábrica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Produto */}
              <div>
                <Label>Produto</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, produto: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto principal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="batata">Batata</SelectItem>
                    <SelectItem value="mandioca">Mandioca</SelectItem>
                    <SelectItem value="inhame">Inhame</SelectItem>
                    <SelectItem value="alface">Alface</SelectItem>
                    <SelectItem value="couve">Couve</SelectItem>
                    <SelectItem value="espinafre">Espinafre</SelectItem>
                    <SelectItem value="manga">Manga</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="laranja">Laranja</SelectItem>
                    <SelectItem value="milho">Milho</SelectItem>
                    <SelectItem value="feijao">Feijão</SelectItem>
                    <SelectItem value="arroz">Arroz</SelectItem>
                    <SelectItem value="trigo">Trigo</SelectItem>
                    <SelectItem value="carne-bovina">Carne Bovina</SelectItem>
                    <SelectItem value="carne-suína">Carne Suína</SelectItem>
                    <SelectItem value="frango">Frango</SelectItem>
                    <SelectItem value="peixe">Peixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Qualidade e embalagem */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Padrões de Qualidade</Label>
                  <Input
                    placeholder="Ex.: Fresco, Amarelo, Sem Poeira"
                    value={formData.qualidade}
                    onChange={(e) => setFormData({ ...formData, qualidade: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tipo de Embalagem</Label>
                  <Select onValueChange={(value) => setFormData({ ...formData, embalagem: value })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a embalagem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saco30">Saco de 30kg</SelectItem>
                      <SelectItem value="saco50">Saco de 50kg</SelectItem>
                      <SelectItem value="saco1t">Saco de 1 tonelada</SelectItem>
                      <SelectItem value="cesta10">Cesta de 10kg</SelectItem>
                      <SelectItem value="caixa20">Caixa de 20kg</SelectItem>
                      <SelectItem value="embalagem-vacuo">Embalagem a vácuo</SelectItem>
                      <SelectItem value="granel">A granel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Locais de entrega */}
              <div className="space-y-2">
                <Label>Locais de Entrega Preferidos</Label>
                <Input
                  placeholder="Descrição do local"
                  value={localTemp.descricao}
                  onChange={(e) => setLocalTemp({ ...localTemp, descricao: e.target.value })}
                />
                {mapError ? (
                  <div className="w-full h-64 rounded-lg border flex items-center justify-center text-sm text-muted-foreground bg-muted/30">{mapError}</div>
                ) : (
                  <div id="map" className="w-full h-64 rounded-lg border" />
                )}
                <Button type="button" className="mt-2" onClick={handleAddLocal}>Adicionar Local</Button>
                {formData.locaisEntrega.length > 0 && (
                  <ul className="text-sm mt-2 list-disc list-inside">
                    {formData.locaisEntrega.map((local, index) => (
                      <li key={index}>
                        {local.descricao} — ({local.coordenadas?.lat.toFixed(4)}, {local.coordenadas?.lng.toFixed(4)})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Telefone */}
              <div>
                <Label>Telefone para Contato</Label>
                <Input
                  type="tel"
                  placeholder="+244 999 999 999"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>

              {/* Descrição final */}
              <div>
                <Label>Descrição Final</Label>
                <Textarea
                  placeholder="Ex.: Preferimos Milho totalmente fresco..."
                  value={formData.descricaoFinal}
                  onChange={(e) => setFormData({ ...formData, descricaoFinal: e.target.value })}
                />
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Ex.: Links úteis, informações adicionais..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full bg-[#B8860B] hover:bg-[#B8860B]/90 text-white font-bold" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Ficha de Recebimento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FichaRecebimento;