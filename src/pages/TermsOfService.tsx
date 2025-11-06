import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Shield, AlertTriangle, Calendar, MapPin, Scale, Truck } from 'lucide-react'

const TermsOfService = () => {
  const navigate = useNavigate()

  const terms = [
    {
      icon: Calendar,
      title: "Prazo de Publicação",
      description: "Produtos devem ser anunciados com no mínimo 1 mês de antecedência à colheita",
      details: "Esta regra garante planejamento adequado e evita anúncios de produtos já colhidos."
    },
    {
      icon: Shield,
      title: "Critérios de Qualidade",
      description: "Todos os produtos devem obedecer aos padrões de qualidade estabelecidos",
      details: "AgriLink reserva-se o direito de verificar e remover produtos que não atendam aos critérios."
    },
    {
      icon: MapPin,
      title: "Informações Claras",
      description: "Tipo, quantidade, localização e data prevista de entrega devem ser informados",
      details: "Informações incompletas ou incorretas podem resultar na remoção do anúncio."
    },
    {
      icon: Truck,
      title: "Logística e Entrega",
      description: "AgriLink pode agendar entregas de acordo com a disponibilidade logística",
      details: "Coordenação de entregas será feita respeitando prazos e capacidades regionais."
    },
    {
      icon: Scale,
      title: "Responsabilidade",
      description: "O agricultor é totalmente responsável pela veracidade das informações",
      details: "Informações falsas ou enganosas resultarão em suspensão ou exclusão da conta."
    },
    {
      icon: AlertTriangle,
      title: "Penalidades",
      description: "Violações dos termos podem resultar em suspensão ou banimento",
      details: "AgriLink monitora ativamente o cumprimento destes termos para manter a qualidade da plataforma."
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4 text-white">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold">Termos de Publicidade AgriLink</h1>
          </div>

          <Card className="shadow-strong border-0">
            <CardHeader className="bg-gradient-primary text-primary-foreground">
              <CardTitle className="text-xl flex items-center gap-3">
                <Shield className="h-6 w-6" />
                Condições para Publicação de Produtos Agrícolas
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    Ao utilizar a plataforma AgriLink para publicar produtos agrícolas, você concorda 
                    com os seguintes termos e condições. Estes termos garantem a qualidade, 
                    transparência e confiabilidade de todos os anúncios na plataforma.
                  </p>
                </div>

                <Separator />

                <div className="grid gap-6">
                  {terms.map((term, index) => {
                    const Icon = term.icon
                    return (
                      <div key={index} className="space-y-3">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <h3 className="font-semibold text-lg">{term.title}</h3>
                            <p className="text-foreground">{term.description}</p>
                            <p className="text-sm text-muted-foreground">{term.details}</p>
                          </div>
                        </div>
                        {index < terms.length - 1 && <Separator />}
                      </div>
                    )
                  })}
                </div>

                <Separator />

                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-warning-foreground">Importante</h4>
                      <p className="text-sm text-muted-foreground">
                        O não cumprimento destes termos resultará em ações que podem incluir 
                        remoção de anúncios, suspensão temporária ou banimento permanente da conta. 
                        A AgriLink reserva-se o direito de tomar as medidas necessárias para 
                        manter a integridade da plataforma.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-6">
                  <Button
                    onClick={() => navigate('/cadastro')}
                    className="flex-1 bg-primary hover:bg-primary-hover"
                  >
                    Aceitar e Fazer Cadastro
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/publicar-produto')}
                    className="flex-1"
                  >
                    Aceitar e Publicar Produto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-white/80 text-sm">
            <p>© 2024 AgriLink. Todos os direitos reservados.</p>
            <p>Plataforma B2B de Produtos Alimentares em Grande Escala</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService