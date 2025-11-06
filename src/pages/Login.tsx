import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tractor, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background from-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <p className="text-lg text-muted-foreground">
            Conectando produtores diretamente a grandes compradores
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Agricultor/Agente */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Tractor className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Agricultor/Agente</CardTitle>
              <CardDescription>
                Publique seus produtos agrícolas e conecte-se com grandes compradores
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate('/cadastro')}
                >
                  Fazer Cadastro
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/publicar-produto')}
                >
                  Publicar Produto
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Equipa AgriLink (Admin) */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-secondary/10 rounded-full w-fit">
                <BarChart3 className="h-8 w-8 text-secondary" />
              </div>
              <CardTitle className="text-2xl">Equipa AgriLink</CardTitle>
              <CardDescription>
                Acesse o dashboard administrativo e gerencie os produtos publicados
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button 
                size="lg" 
                variant="secondary"
                className="w-full"
                onClick={() => navigate('/dashboard')}
              >
                Ver Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            MVP AgriLink B2B - Wireframe desenvolvido no Lovable
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;