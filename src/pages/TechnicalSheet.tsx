import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Printer, Phone, MapPin, Calendar, Package, DollarSign, Truck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

// Mock data - em produção viria do banco de dados
const mockProducts: { [key: string]: any } = {
  "1": {
    produto: "Milho Branco",
    regiao: "Huambo – Cachiungo",
    agricultor: "Cooperativa Boa Colheita",
    quantidade: 120,
    dataColheita: "Outubro 2025",
    precoProvavel: 210,
    logistica: "Estrada de terra batida, acesso médio",
    contato: "+244 xxx xxx xxx"
  },
  "2": {
    produto: "Feijão Vermelho",
    regiao: "Malanje – Cacuso",
    agricultor: "João Manuel Silva",
    quantidade: 80,
    dataColheita: "Novembro 2025",
    precoProvavel: 350,
    logistica: "Estrada alcatroada, acesso fácil",
    contato: "+244 yyy yyy yyy"
  }
};

const TechnicalSheet = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const product = id ? mockProducts[id] : null;

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Produto não encontrado</CardTitle>
            <CardDescription>
              A ficha técnica solicitada não existe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // Em produção, implementaria exportação real para PDF
    alert("Funcionalidade de exportação PDF será implementada com backend");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - escondido na impressão */}
      <div className="print:hidden p-4 border-b">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Ficha Técnica</h1>
              <p className="text-muted-foreground">Produto #{id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button onClick={handleExportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Technical Sheet Content */}
      <div className="p-4 print:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="print:shadow-none print:border-none">
            <CardHeader className="text-center pb-6">
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-primary mb-2">AgriLink B2B</h1>
                <p className="text-muted-foreground">Ficha Técnica do Produto</p>
              </div>
              <Separator />
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Product Title */}
              <div className="text-center">
                <h2 className="text-4xl font-bold text-primary mb-2">
                  {product.produto}
                </h2>
                <p className="text-xl text-muted-foreground">
                  {product.regiao}
                </p>
              </div>

              {/* Main Info Grid */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* Agricultor */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Agricultor/Cooperativa</h3>
                      <p className="text-muted-foreground">{product.agricultor}</p>
                    </div>
                  </div>

                  {/* Quantidade */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Quantidade Disponível</h3>
                      <p className="text-2xl font-bold text-primary">{product.quantidade} toneladas</p>
                    </div>
                  </div>

                  {/* Data de Colheita */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Data de Colheita</h3>
                      <p className="text-muted-foreground">{product.dataColheita}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Preço */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Preço Provável</h3>
                      <p className="text-2xl font-bold text-primary">{product.precoProvavel} Kz/kg</p>
                    </div>
                  </div>

                  {/* Localização */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Região</h3>
                      <p className="text-muted-foreground">{product.regiao}</p>
                    </div>
                  </div>

                  {/* Contato */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Contato</h3>
                      <p className="text-muted-foreground font-mono">{product.contato}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logística */}
              <div className="bg-muted/50 p-6 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Acesso Logístico</h3>
                    <p className="text-muted-foreground">{product.logistica}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <Separator />
              <div className="text-center text-sm text-muted-foreground">
                <p>🔹 Esta ficha pode ser impressa ou enviada para compradores B2B</p>
                <p className="mt-2">
                  <strong>AgriLink B2B</strong> - Conectando produtores a grandes compradores
                </p>
                <p className="mt-1">
                  Data de geração: {new Date().toLocaleDateString('pt-AO')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TechnicalSheet;