import React, { useState, useEffect } from "react";
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
import agrilinkLogo from '@/assets/agrilink-logo.png'

mapboxgl.accessToken =
  "pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA";

const FichaRecebimento = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nomeFicha: "",
    tipoNegocio: "",
    produto: "",
    qualidade: "",
    embalagem: "",
    transporte: "",
    locaisEntrega: [],
    telefone: "",
    descricaoFinal: "",
  });

  const [localTemp, setLocalTemp] = useState({ descricao: "", coordenadas: null });
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Inicializar mapa Mapbox
  useEffect(() => {
    // Check for WebGL support first
    if (!mapboxgl.supported({ failIfMajorPerformanceCaveat: true } as any)) {
      setMapError('Seu navegador/dispositivo não suporta WebGL suficiente para o mapa.');
      return;
    }

    try {
      const mapbox = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.235, -8.838], // Luanda
        zoom: 10,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
      });

      mapbox.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Erro ao carregar o mapa.');
      });

      mapbox.on('click', (e) => {
        const coords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        setLocalTemp((prev) => ({ ...prev, coordenadas: coords }));

        // Adicionar ou mover marcador
        if (marker) {
          marker.setLngLat([coords.lng, coords.lat]);
        } else {
          const newMarker = new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat([coords.lng, coords.lat])
            .addTo(mapbox);
          setMarker(newMarker);
        }
      });

      setMap(mapbox);
      return () => mapbox.remove();
    } catch (err) {
      console.error('Erro ao inicializar Mapbox:', err);
      setMapError('Não foi possível inicializar o mapa.');
    }
  }, []);

  const handleAddLocal = () => {
    if (localTemp.descricao && localTemp.coordenadas) {
      setFormData((prev) => ({
        ...prev,
        locaisEntrega: [...prev.locaisEntrega, localTemp],
      }));
      setLocalTemp({ descricao: "", coordenadas: null });
      if (marker) marker.remove();
      setMarker(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Ficha criada:", formData);
    alert("Ficha de recebimento criada com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* AppBar fixa */}
      <div className="fixed top-0 left-0 right-0 bg-white/60 backdrop-blur-md shadow-md z-50 p-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
          <img src={agrilinkLogo} alt="AgriLink" className="h-12" />

          </div>
        <h1 className="font-semibold text-lg">📦 Ficha de Recebimento</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
        >
          Voltar
        </Button>
      </div>

      {/* Conteúdo principal */}
      <div className="pt-20 p-4 md:p-8">
        <Card className="max-w-4xl mx-auto shadow-md border-0 mt-20">
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              Criar nova Ficha Técnica de Recebimento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Personalize como e onde deseja receber seus produtos. Defina qualidade,
              embalagem e locais de entrega exatos no mapa.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome e Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome da Ficha</Label>
                  <Input
                    placeholder="Ex.: Milho Premium"
                    value={formData.nomeFicha}
                    onChange={(e) =>
                      setFormData({ ...formData, nomeFicha: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Tipo de Negócio</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData({ ...formData, tipoNegocio: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de negócio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurante">Restaurante</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="supermercado">Supermercado</SelectItem>
                      <SelectItem value="minimercado">Minimercado</SelectItem>
                      <SelectItem value="armazem">Armazém</SelectItem>
                      <SelectItem value="mercado-informal">
                        Mercado Informal
                      </SelectItem>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="fabrica">Fábrica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Produto */}
              <div>
                <Label>Produto</Label>
                <Select
                  onValueChange={(value) =>
                    setFormData({ ...formData, produto: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto principal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__tuber" disabled>🌾 Tubérculos</SelectItem>
                    <SelectItem value="batata">Batata</SelectItem>
                    <SelectItem value="mandioca">Mandioca</SelectItem>
                    <SelectItem value="inhame">Inhame</SelectItem>

                    <SelectItem value="__verduras" disabled>🥬 Verduras</SelectItem>
                    <SelectItem value="alface">Alface</SelectItem>
                    <SelectItem value="couve">Couve</SelectItem>
                    <SelectItem value="espinafre">Espinafre</SelectItem>

                    <SelectItem value="__frutas" disabled>🍎 Frutas</SelectItem>
                    <SelectItem value="manga">Manga</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="laranja">Laranja</SelectItem>

                    <SelectItem value="__graos" disabled>🌾 Grãos</SelectItem>
                    <SelectItem value="milho">Milho</SelectItem>
                    <SelectItem value="feijao">Feijão</SelectItem>
                    <SelectItem value="arroz">Arroz</SelectItem>
                    <SelectItem value="trigo">Trigo</SelectItem>

                    <SelectItem value="__carnes" disabled>🥩 Carnes</SelectItem>
                    <SelectItem value="carne-bovina">Carne Bovina</SelectItem>
                    <SelectItem value="carne-suína">Carne Suína</SelectItem>
                    <SelectItem value="frango">Frango</SelectItem>
                    <SelectItem value="peixe">Peixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Qualidade e Embalagem */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Padrões de Qualidade</Label>
                  <Input
                    placeholder="Ex.: Fresco, Amarelo, Sem Poeira"
                    value={formData.qualidade}
                    onChange={(e) =>
                      setFormData({ ...formData, qualidade: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Tipo de Embalagem</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData({ ...formData, embalagem: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a embalagem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saco30">Saco de 30kg</SelectItem>
                      <SelectItem value="saco50">Saco de 50kg</SelectItem>
                      <SelectItem value="saco1t">Saco de 1 tonelada</SelectItem>
                      <SelectItem value="cesta10">Cesta de 10kg</SelectItem>
                      <SelectItem value="caixa20">Caixa de 20kg</SelectItem>
                      <SelectItem value="embalagem-vacuo">
                        Embalagem a vácuo
                      </SelectItem>
                      <SelectItem value="granel">A granel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Locais de Entrega */}
              <div className="space-y-2">
                <Label>Locais de Entrega Preferidos</Label>
                <p className="text-sm text-muted-foreground">
                  Adicione locais e marque-os no mapa. Pode criar vários pontos de
                  recepção.
                </p>

                <Input
                  placeholder="Descrição do local (Ex.: Armazém Central - Portão 3)"
                  value={localTemp.descricao}
                  onChange={(e) =>
                    setLocalTemp({ ...localTemp, descricao: e.target.value })
                  }
                />

                {mapError ? (
                  <div className="w-full h-64 rounded-lg border flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
                    {mapError}
                  </div>
                ) : (
                  <div id="map" className="w-full h-64 rounded-lg border" />
                )}

                <Button type="button" className="mt-2" onClick={handleAddLocal}>
                  Adicionar Local
                </Button>

                {formData.locaisEntrega.length > 0 && (
                  <ul className="text-sm mt-2 list-disc list-inside">
                    {formData.locaisEntrega.map((local, index) => (
                      <li key={index}>
                        {local.descricao} —{" "}
                        <span className="text-muted-foreground">
                          ({local.coordenadas.lat.toFixed(4)},{" "}
                          {local.coordenadas.lng.toFixed(4)})
                        </span>
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
                  onChange={(e) =>
                    setFormData({ ...formData, telefone: e.target.value })
                  }
                />
              </div>

              {/* Descrição final */}
              <div>
                <Label>Descrição Final</Label>
                <Textarea
                  placeholder="Ex.: Preferimos Milho totalmente fresco, amarelo e sem poeira..."
                  value={formData.descricaoFinal}
                  onChange={(e) =>
                    setFormData({ ...formData, descricaoFinal: e.target.value })
                  }
                />
              </div>

              <div className="bg-gray-100 p-4 rounded-lg text-sm text-gray-600">
                <p>
                  O AgriLink localizará produtores que cumpram os requisitos desta
                  ficha. Caso não existam, notificaremos a empresa e sugeriremos
                  produtores com padrões semelhantes.
                </p>
              </div>

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Salvar Ficha de Recebimento
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FichaRecebimento;