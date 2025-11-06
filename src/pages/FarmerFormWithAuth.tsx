import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft, Package, Upload, LogOut } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { angolaProvinces } from "@/data/angola-locations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FarmerFormWithAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userProfile, logout } = useAuth();
  const [date, setDate] = useState<Date>();
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [productType, setProductType] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [logisticsAccess, setLogisticsAccess] = useState<string>("");
  const [farmerName, setFarmerName] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (date && date < addDays(new Date(), 30)) {
      toast({
        title: "Erro de validação",
        description: "Só pode publicar produtos com previsão mínima de 30 dias antes da colheita",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para publicar um produto",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload photos to Supabase Storage if any
      let photoUrls: string[] = [];
      if (photos && photos.length > 0) {
        for (let i = 0; i < Math.min(photos.length, 3); i++) {
          const file = photos[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('product-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;
          
          const { data: urlData } = supabase.storage
            .from('product-photos')
            .getPublicUrl(fileName);
          
          if (urlData) {
            photoUrls.push(urlData.publicUrl);
          }
        }
      }

      // Insert product into database
      const { error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          product_type: productType,
          quantity: parseInt(quantity),
          harvest_date: date?.toISOString(),
          price: parseFloat(price),
          province_id: selectedProvince,
          municipality_id: selectedMunicipality,
          logistics_access: logisticsAccess as 'sim' | 'nao' | 'parcial',
          farmer_name: farmerName,
          contact: contact,
          photos: photoUrls.length > 0 ? photoUrls : null,
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Produto publicado com sucesso!",
        description: "Seu produto foi registrado e será analisado pela equipa AgriLink.",
      });
      
      // Reset form
      setDate(undefined);
      setPhotos(null);
      setSelectedProvince("");
      setSelectedMunicipality("");
      setProductType("");
      setQuantity("");
      setPrice("");
      setLogisticsAccess("");
      setFarmerName("");
      setContact("");
      
    } catch (error: any) {
      toast({
        title: "Erro ao publicar produto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const minDate = addDays(new Date(), 30);

  const availableMunicipalities = selectedProvince 
    ? angolaProvinces.find(p => p.id === selectedProvince)?.municipalities || []
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Publicar Produto</h1>
              <p className="text-primary-foreground/80">
                Bem-vindo, {userProfile?.full_name || user?.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-medium border-card-border">
            <CardHeader className="bg-gradient-card">
              <CardTitle className="flex items-center gap-3">
                <Package className="h-6 w-6 text-primary" />
                Dados do Produto
              </CardTitle>
              <CardDescription>
                Preencha todos os campos para publicar seu produto agrícola
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="produto">Produto 🌱</Label>
                  <Select value={productType} onValueChange={setProductType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="milho">Milho</SelectItem>
                      <SelectItem value="feijao">Feijão</SelectItem>
                      <SelectItem value="batata">Batata</SelectItem>
                      <SelectItem value="mandioca">Mandioca</SelectItem>
                      <SelectItem value="arroz">Arroz</SelectItem>
                      <SelectItem value="soja">Soja</SelectItem>
                      <SelectItem value="cafe">Café</SelectItem>
                      <SelectItem value="banana">Banana</SelectItem>
                      <SelectItem value="tomate">Tomate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fotos">Fotografias do produto 📸</Label>
                  <div className="relative">
                    <Upload className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      id="fotos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setPhotos(e.target.files)}
                      className="cursor-pointer pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adicione até 3 fotos do seu produto (opcional)
                  </p>
                  {photos && photos.length > 0 && (
                    <div className="text-sm text-success">
                      ✓ {photos.length} foto(s) selecionada(s)
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade prevista (kg)</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      min="1000"
                      step="100"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Ex: 50000"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 1.000 kg
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preco">Preço provável (Kz/kg)</Label>
                    <Input
                      id="preco"
                      type="number"
                      min="1"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Ex: 210.50"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data estimada da colheita 📅</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={(date) => date < minDate}
                        initialFocus
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 30 dias a partir de hoje
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Província 🗺️</Label>
                    <Select value={selectedProvince} onValueChange={(value) => {
                      setSelectedProvince(value);
                      setSelectedMunicipality("");
                    }} required>
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label>Município 📍</Label>
                    <Select 
                      value={selectedMunicipality} 
                      onValueChange={setSelectedMunicipality} 
                      required
                      disabled={!selectedProvince}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedProvince ? "Selecione o município" : "Primeiro selecione a província"} />
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

                <div className="space-y-2">
                  <Label>Acesso logístico 🚛</Label>
                  <Select value={logisticsAccess} onValueChange={setLogisticsAccess} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Nível de acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Fácil - Estrada alcatroada</SelectItem>
                      <SelectItem value="parcial">Médio - Terra batida em bom estado</SelectItem>
                      <SelectItem value="nao">Difícil - Acesso limitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agricultor">Nome do Agricultor/Cooperativa</Label>
                    <Input
                      id="agricultor"
                      value={farmerName}
                      onChange={(e) => setFarmerName(e.target.value)}
                      placeholder="Ex: Cooperativa Boa Colheita"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contato">Contato 📞</Label>
                    <Input
                      id="contato"
                      type="tel"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Ex: +244 xxx xxx xxx"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary-hover" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'Publicando...' : 'Publicar Produto'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FarmerFormWithAuth;