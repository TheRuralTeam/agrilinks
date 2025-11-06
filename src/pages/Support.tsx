import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  HelpCircle, 
  MessageCircle, 
  Phone, 
  Mail, 
  FileText, 
  Users,
  Package,
  MapPin,
  Bell,
  Settings,
  Send
} from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

const Support = () => {
  const { user, userProfile } = useAuth()
  const whatsappNumber = "922317574"
  const whatsappMessage = "Olá! Preciso de ajuda com o AgriLink."
  
  const [showMessageForm, setShowMessageForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messageForm, setMessageForm] = useState({
    name: userProfile?.full_name || '',
    email: userProfile?.email || user?.email || '',
    phone: userProfile?.phone || '',
    message: ''
  })

  const openWhatsApp = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
    window.open(url, '_blank')
  }

  const sendSupportMessage = async () => {
    if (!messageForm.message.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, escreva uma mensagem",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('notify-support', {
        body: messageForm
      })

      if (error) throw error

      toast({
        title: "Mensagem enviada!",
        description: "Nossa equipe foi notificada e entrará em contato em breve.",
      })

      setMessageForm(prev => ({...prev, message: ''}))
      setShowMessageForm(false)
    } catch (error: any) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const faqs = [
    {
      question: "Como faço para publicar meu primeiro produto?",
      answer: "Para publicar um produto, toque no botão circular '+' na tela inicial ou vá até 'Perfil' > 'Publicar Produto'. Preencha todas as informações obrigatórias: tipo do produto, quantidade, data de colheita, preço e localização. Lembre-se que o produto deve ser publicado no mínimo 1 mês antes da colheita."
    },
    {
      question: "Por que não consigo publicar meu produto?",
      answer: "Verifique se: 1) Você está logado na sua conta, 2) Preencheu todos os campos obrigatórios, 3) A data de colheita está pelo menos 1 mês no futuro, 4) Sua conta está verificada. Se o problema persistir, entre em contato conosco."
    },
    {
      question: "Como funciona o sistema de notificações?",
      answer: "Você receberá notificações quando: alguém demonstrar interesse nos seus produtos, receber mensagens da equipe AgriLink, seus produtos forem visualizados, ou houver atualizações importantes do sistema."
    },
    {
      question: "Como posso verificar minha conta?",
      answer: "Após o cadastro, você receberá uma confirmação por email ou SMS (dependendo do método escolhido). Clique no link de verificação ou insira o código recebido para ativar completamente sua conta."
    },
    {
      question: "Posso editar ou remover meus produtos?",
      answer: "Sim! Vá até 'Perfil' > 'Meus Produtos'. Lá você pode editar informações ou remover produtos que não estão mais disponíveis. Produtos removidos não aparecerão mais no feed."
    },
    {
      question: "Como funciona a localização no mapa?",
      answer: "Quando você publica um produto, pode marcar sua localização no mapa. Compradores podem encontrar produtos próximos a eles navegando pelo mapa interativo na aba 'Mapa'."
    },
    {
      question: "Qual é a política de qualidade dos produtos?",
      answer: "Todos os produtos devem atender aos padrões de qualidade estabelecidos. Informações falsas ou produtos fora dos padrões podem resultar na remoção do anúncio e suspensão da conta."
    },
    {
      question: "Como entro em contato com compradores interessados?",
      answer: "Você receberá notificações quando alguém demonstrar interesse. As informações de contato serão compartilhadas através do sistema de mensagens interno ou notificações."
    }
  ]

  const quickActions = [
    {
      title: "Como Publicar Produtos",
      description: "Guia passo a passo para sua primeira publicação",
      icon: Package,
      color: "bg-primary/10 text-primary"
    },
    {
      title: "Gerenciar Localização",
      description: "Aprenda a usar o mapa e marcar localizações",
      icon: MapPin,
      color: "bg-business/10 text-business"
    },
    {
      title: "Configurar Notificações",
      description: "Personalize suas notificações e alertas",
      icon: Bell,
      color: "bg-accent/10 text-accent"
    },
    {
      title: "Configurações da Conta",
      description: "Edite seu perfil e configurações de privacidade",
      icon: Settings,
      color: "bg-secondary/10 text-secondary"
    }
  ]

  return (
    <div className="pb-20 bg-background min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-primary">Central de Ajuda</h1>
          <p className="text-sm text-muted-foreground">Encontre respostas e entre em contato conosco</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Contact Cards */}
        <div className="grid grid-cols-1 gap-4">
          <Card 
            className="shadow-soft border-card-border cursor-pointer hover:shadow-medium transition-all"
            onClick={openWhatsApp}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">WhatsApp Oficial</h3>
                  <p className="text-sm text-muted-foreground">Fale diretamente com nossa equipe</p>
                  <p className="text-primary font-medium">922-317-574</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-card-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-sm text-muted-foreground">Para questões mais detalhadas</p>
                  <p className="text-primary">suporte@agrilink.ao</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Guias Rápidos</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Card key={index} className="shadow-soft border-card-border cursor-pointer hover:shadow-medium transition-all">
                <CardContent className="p-4 text-center">
                  <div className={`p-3 rounded-full mx-auto mb-2 w-fit ${action.color}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-sm mb-1">{action.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Perguntas Frequentes
          </h2>
          
          <Card className="shadow-soft border-card-border">
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="px-4">
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="font-medium">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground leading-relaxed pb-4">
                        {faq.answer}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Additional Help */}
        <Card className="shadow-soft border-card-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Não encontrou o que procura?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nossa equipe está sempre pronta para ajudar! Entre em contato conosco através do WhatsApp ou envie uma mensagem pelo sistema interno.
            </p>
            
            <div className="flex flex-col gap-2">
              <Button onClick={openWhatsApp} className="w-full">
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar no WhatsApp
              </Button>
              
              <Button variant="outline" className="w-full" onClick={() => setShowMessageForm(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Enviar Mensagem Interna
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="shadow-soft border-card-border">
          <CardContent className="p-4 text-center">
            <div className="space-y-2">
              <h3 className="font-semibold text-primary">AgriLink</h3>
              <p className="text-xs text-muted-foreground">
                Conectando agricultores e mercados em Angola
              </p>
              <p className="text-xs text-muted-foreground">
                Versão 1.0.0
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Mensagem */}
      {showMessageForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Enviar Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={messageForm.name}
                  onChange={(e) => setMessageForm(prev => ({...prev, name: e.target.value}))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={messageForm.email}
                  onChange={(e) => setMessageForm(prev => ({...prev, email: e.target.value}))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input
                  id="phone"
                  value={messageForm.phone}
                  onChange={(e) => setMessageForm(prev => ({...prev, phone: e.target.value}))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={messageForm.message}
                  onChange={(e) => setMessageForm(prev => ({...prev, message: e.target.value}))}
                  placeholder="Descreva seu problema ou dúvida..."
                  className="min-h-[100px]"
                  required
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={sendSupportMessage} className="flex-1" disabled={loading}>
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {loading ? 'Enviando...' : 'Enviar'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowMessageForm(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Support