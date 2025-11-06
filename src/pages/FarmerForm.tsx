import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { angolaProvinces } from "@/data/angola-locations";

const FarmerForm = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>();
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (date && date < addDays(new Date(), 30)) {
      toast({
        title: "Erro de validação",
        description: "Só pode publicar produtos com previsão mínima de 30 dias antes da colheita",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Produto publicado com sucesso!",
      description: "Seu produto foi registrado e será analisado pela equipa AgriLink.",
    });
    
    // Redirect after success
    setTimeout(() => navigate('/'), 2000);
  };

  const minDate = addDays(new Date(), 30);

  const availableMunicipalities = selectedProvince 
    ? angolaProvinces.find(p => p.id === selectedProvince)?.municipalities || []
    : [];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Publicar Produto</h1>
            <p className="text-muted-foreground">Formulário de publicação agrícola</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Produto</CardTitle>
            <CardDescription>
              Preencha todos os campos para publicar seu produto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Produto */}
              <div className="space-y-2">
                <Label htmlFor="produto">Produto 🌱</Label>
                <Select required>
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
                  </SelectContent>
                </Select>
              </div>

              {/* Fotografias do produto */}
              <div className="space-y-2">
                <Label htmlFor="fotos">Fotografias do produto 📸</Label>
                <Input
                  id="fotos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotos(e.target.files)}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Adicione até 3 fotos do seu produto (opcional)
                </p>
                {photos && photos.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {photos.length} foto(s) selecionada(s)
                  </div>
                )}
              </div>

              {/* Quantidade */}
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade prevista 📦 (toneladas)</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  step="0.1"
                  placeholder="Ex: 120"
                  required
                />
              </div>

              {/* Data de colheita */}
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
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Mínimo de 30 dias a partir de hoje
                </p>
              </div>

              {/* Preço */}
              <div className="space-y-2">
                <Label htmlFor="preco">Preço provável 💵 (Kz/kg)</Label>
                <Input
                  id="preco"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Ex: 210.50"
                  required
                />
              </div>

              {/* Província */}
              <div className="space-y-2">
                <Label>Província 🗺️</Label>
                <Select value={selectedProvince} onValueChange={(value) => {
                  setSelectedProvince(value);
                  setSelectedMunicipality(""); // Reset municipality when province changes
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

              {/* Município */}
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

              {/* Acesso logístico */}
              <div className="space-y-2">
                <Label>Acesso logístico 🚛</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Nível de acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facil">Fácil</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="dificil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Descreva as condições de acesso (ex: estrada alcatroada, terra batida, etc.)"
                  className="mt-2"
                />
              </div>

              {/* Nome do Agricultor */}
              <div className="space-y-2">
                <Label htmlFor="agricultor">Nome do Agricultor/Cooperativa 👨‍🌾</Label>
                <Input
                  id="agricultor"
                  placeholder="Ex: Cooperativa Boa Colheita"
                  required
                />
              </div>

              {/* Contato */}
              <div className="space-y-2">
                <Label htmlFor="contato">Contato 📞</Label>
                <Input
                  id="contato"
                  type="tel"
                  placeholder="Ex: +244 xxx xxx xxx"
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg">
                Publicar Produto
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmerForm;