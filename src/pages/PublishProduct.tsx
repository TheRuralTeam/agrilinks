import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Package, Calendar, DollarSign, Hash, MapPin, User, Upload, X } from 'lucide-react';
import { angolaProvinces } from '@/data/angola-locations';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import agrilinkLogo from '@/assets/agrilink-logo.png'

import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';

const PublishProduct = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    product_type: '',
    quantity: '',
    harvest_date: '',
    price: '',
    province_id: userProfile?.province_id || '',
    municipality_id: userProfile?.municipality_id || '',
    farmer_name: userProfile?.full_name || '',
    contact: userProfile?.phone || userProfile?.email || '',
    description: '',
    logistics_access: 'sim'
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapboxToken] = useState('pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA');
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Check for WebGL support to avoid runtime crash
    if (!mapboxgl.supported({ failIfMajorPerformanceCaveat: true } as any)) {
      setMapError('Seu navegador/dispositivo não suporta WebGL suficiente para exibir o mapa.');
      return;
    }

    try {
      mapboxgl.accessToken = mapboxToken;
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.234, -8.839],
        zoom: 6,
        attributionControl: false,
      });

      mapRef.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Erro ao carregar o mapa. Tente novamente.');
      });

      mapRef.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        setLocation({ lng, lat });

        // Remove marcador anterior
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Cria novo marcador
        markerRef.current = new mapboxgl.Marker({ color: 'red' })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!);
      });
    } catch (err) {
      console.error('Error initializing Mapbox:', err);
      setMapError('Não foi possível inicializar o mapa.');
    }

    return () => {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [mapContainer, mapboxToken]);

  if (userProfile?.user_type === 'comprador') {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">
              Compradores não podem publicar produtos. Esta funcionalidade é apenas para agricultores e agentes.
            </p>
            <Button onClick={() => navigate('/app')} className="w-full">
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length < 3) {
      toast({ title: "Imagens insuficientes", description: "Você precisa adicionar pelo menos 3 imagens do produto", variant: "destructive" });
      return;
    }
    if (files.length > 10) {
      toast({ title: "Muitas imagens", description: "Você pode adicionar no máximo 10 imagens", variant: "destructive" });
      return;
    }
    setSelectedImages(files);
    setImagePreviews(files.map(file => URL.createObjectURL(file)));
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Você precisa estar logado para publicar um produto", variant: "destructive" });
      return;
    }

    if (selectedImages.length < 3) {
      toast({ title: "Imagens obrigatórias", description: "Você precisa adicionar pelo menos 3 imagens do produto", variant: "destructive" });
      return;
    }

    const harvestDate = new Date(formData.harvest_date);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 30);
    if (harvestDate < minDate) {
      toast({ title: "Erro de validação", description: "Só pode publicar produtos com previsão mínima de 30 dias antes da colheita", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('product-photos').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

     const { error } = await supabase.from('products').insert({
  user_id: user.id,
  product_type: formData.product_type,
  quantity: parseFloat(formData.quantity),
  harvest_date: formData.harvest_date,
  price: parseFloat(formData.price),
  province_id: formData.province_id,
  municipality_id: formData.municipality_id,
  farmer_name: formData.farmer_name,
  contact: formData.contact,
  description: formData.description,
  logistics_access: formData.logistics_access as 'sim' | 'nao' | 'parcial',
  status: 'active',
  photos: uploadedUrls,
  location_lat: location?.lat || null,
  location_lng: location?.lng || null
});


      if (error) throw error;

      toast({ title: "Produto publicado!", description: "Seu produto foi publicado com sucesso e já está visível para compradores." });
      navigate('/perfil');
    } catch (error: any) {
      console.error('Erro ao publicar produto:', error);
      toast({ title: "Erro ao publicar produto", description: error.message || "Ocorreu um erro ao publicar o produto. Verifique os campos e tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const availableMunicipalities = angolaProvinces.find(p => p.id === formData.province_id)?.municipalities || [];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
       <div className="fixed top-0 left-0 right-0 bg-white/60 backdrop-blur-md shadow-md z-50 p-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
          <img src={agrilinkLogo} alt="AgriLink" className="h-12" />

          </div>
        <h1 className="font-semibold text-lg">📦 Publicar Produto</h1>
       <Button
  variant="ghost"
  size="sm"
  className="border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100"
  onClick={() => navigate(-1)}
>
  Voltar
</Button>

      </div>
         
        

<Card className="shadow-strong border-0 mt-20">
          <CardHeader className="bg-background">
            <CardTitle className="text-xl text-primary flex items-center gap-3">
              <Package className="h-6 w-6" />
              Informações do Produto
            </CardTitle>
          </CardHeader>

        <CardContent className="p-6">
  <form
    onSubmit={(e) => {
      e.preventDefault(); // impede reload no mobile
      handleSubmit(e);
    }}
    noValidate
    autoComplete="off"
    className="space-y-6"
  >
    {/* Tipo de produto */}
    <div className="space-y-2">
      <Label htmlFor="product_type">Tipo de Produto</Label>
      <div className="relative">
        <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id="product_type"
          value={formData.product_type}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, product_type: e.target.value }))
          }
          placeholder="Ex: Milho, Feijão, Tomate..."
          className="pl-10"
          required
        />
      </div>
    </div>

    {/* Quantidade e preço */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantidade (kg)</Label>
        <div className="relative">
          <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="quantity"
            type="number"
            min="1"
            value={formData.quantity}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, quantity: e.target.value }))
            }
            placeholder="1000"
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Preço por Tonelada ou cesta (Kz)</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, price: e.target.value }))
            }
            placeholder="150.00"
            className="pl-10"
            required
          />
        </div>
      </div>
    </div>

    {/* Data de colheita */}
    <div className="space-y-2">
      <Label htmlFor="harvest_date">Data de Colheita Prevista</Label>
      <div className="relative">
        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id="harvest_date"
          type="date"
          value={formData.harvest_date}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, harvest_date: e.target.value }))
          }
          className="pl-10"
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        * A colheita deve ser prevista para pelo menos 30 dias a partir de hoje
      </p>
    </div>

    {/* Descrição */}
    <div className="space-y-2">
      <Label htmlFor="description">Descrição do Produto</Label>
      <Textarea
        id="description"
        value={formData.description}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, description: e.target.value }))
        }
        placeholder="Descreva seu produto: qualidade, variedade, métodos de cultivo, certificações..."
        className="min-h-[100px]"
      />
    </div>

    {/* Localização */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Província</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
          <Select
            value={formData.province_id}
            onValueChange={(value) => {
              setFormData((prev) => ({
                ...prev,
                province_id: value,
                municipality_id: "",
              }));
            }}
            required
          >
            <SelectTrigger className="pl-10">
              <SelectValue placeholder="Selecione a província" />
            </SelectTrigger>
            <SelectContent>
              {angolaProvinces.map((province) => (
                <SelectItem key={province.id} value={province.id}>
                  {province.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Município</Label>
        <Select
          value={formData.municipality_id}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, municipality_id: value }))
          }
          required
          disabled={!formData.province_id}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                formData.province_id
                  ? "Selecione o município"
                  : "Primeiro selecione a província"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableMunicipalities.map((municipality) => (
              <SelectItem key={municipality.id} value={municipality.id}>
                {municipality.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    {/* Localização no mapa */}
    <div className="space-y-2 mt-4">
      <Label>Localização no Mapa</Label>
      <p className="text-xs text-muted-foreground">
        Clique no mapa para definir a localização exata do produto.
      </p>
      {mapError ? (
        <div className="w-full h-64 rounded-lg overflow-hidden border border-border flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
          {mapError}
        </div>
      ) : (
        <div
          ref={mapContainer}
          className="w-full h-64 rounded-lg overflow-hidden border border-border"
        />
      )}
    </div>

    {/* Nome e contato (auto preenchido) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="farmer_name">Nome do Produtor</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="farmer_name"
            value={formData.farmer_name || userProfile?.full_name || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, farmer_name: e.target.value }))
            }
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact">Contato</Label>
        <Input
          id="contact"
          value={formData.contact || userProfile?.phone || userProfile?.email || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, contact: e.target.value }))
          }
          placeholder="Telefone ou email"
          required
        />
      </div>
    </div>

    {/* Logística */}
    <div className="space-y-2">
      <Label>Acesso à Logística</Label>
      <Select
        value={formData.logistics_access}
        onValueChange={(value) =>
          setFormData((prev) => ({ ...prev, logistics_access: value }))
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sim">Sim - Tenho transporte</SelectItem>
          <SelectItem value="parcial">Parcial - Preciso de apoio</SelectItem>
          <SelectItem value="nao">Não - Preciso de transporte</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Upload de fotos */}
    <div className="space-y-2">
      <Label htmlFor="photos">Fotos do Produto (mínimo 3, máximo 10) *</Label>
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="hidden"
        />
        <label htmlFor="photos" className="cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Clique para selecionar imagens</p>
            <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP</p>
          </div>
        </label>
      </div>

      {imagePreviews.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-4">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedImages.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedImages.length} {selectedImages.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
        </p>
      )}
    </div>

    {/* Botão de envio */}
    <Button
      type="button" // evita submit automático
      onClick={(e) => {
        e.preventDefault();
        handleSubmit(e);
      }}
      className="w-full bg-primary hover:bg-primary-hover"
      size="lg"
      disabled={loading}
    >
      {loading ? "Publicando..." : "Publicar Produto"}
    </Button>
  </form>
</CardContent>

        </Card>
      </div>
    </div>
  );
};

export default PublishProduct;
