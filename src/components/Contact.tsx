import { useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone, faEnvelope, faLocationDot, faClock, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const contactMessage = [
        formData.company ? "Empresa: " + formData.company : "",
        formData.subject ? "Assunto: " + formData.subject : "",
        formData.message,
      ].filter(Boolean).join("\n\n");
      const { error } = await supabase.rpc("submit_public_contact", {
        p_name: formData.name,
        p_email: formData.email,
        p_phone: formData.phone,
        p_message: contactMessage,
      });
      if (error) {
        if (error.message?.includes("CONTACT_RATE_LIMITED")) {
          throw new Error("Já recebemos uma mensagem deste email nos últimos minutos. Aguarde antes de enviar outra.");
        }
        throw error;
      }
      toast.success("Mensagem recebida pela AgriLink.", {
        description: "A nossa equipa de suporte recebeu o pedido e fará o acompanhamento.",
      });
    setFormData({
      name: "",
      company: "",
      email: "",
      phone: "",
      subject: "",
      message: ""
    });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    }
  };

  const contactInfo = [
    {
      icon: faPhone,
      title: "Telefone",
      content: "+244 922 717 574 / 935 358 417",
      description: "Seg-Sex: 8h às 18h"
    },
    {
      icon: faEnvelope,
      title: "Email",
      content: "contacts.agrilink@gmail.com",
      description: "Respondemos em até 24h"
    },
    {
      icon: faLocationDot,
      title: "Endereço",
      content: "Luanda, Angola",
      description: "Zona Industrial"
    },
    {
      icon: faClock,
      title: "Horário",
      content: "8h às 18h",
      description: "Segunda a Sexta"
    }
  ];

  return (
    <section id="contato" className="py-16 lg:py-24 bg-background-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Entre em Contato
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Estamos aqui para ajudar com suas necessidades de compra em grande escala.
            Entre em contato conosco para mais informações.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-8">
              Informações de Contato
            </h3>
            
            <div className="space-y-6 mb-8">
              {contactInfo.map((info, index) => {
                return (
                  <Card key={index} className="p-6 border-card-border hover:shadow-medium transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-primary rounded-lg">
                        <FontAwesomeIcon icon={info.icon} className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-foreground mb-1">
                          {info.title}
                        </h4>
                        <p className="text-primary font-medium mb-1">
                          {info.content}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Support Hours */}
            <Card className="p-6 bg-gradient-card border-card-border">
              <h4 className="text-lg font-semibold text-foreground mb-4">
                Suporte Especializado
              </h4>
              <p className="text-muted-foreground mb-4">
                Nossa equipe de especialistas está disponível para:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  Consultas sobre produtos e preços
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  Planejamento de pedidos grandes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  Informações sobre logística
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  Suporte técnico da plataforma
                </li>
              </ul>
            </Card>
          </div>

          {/* Contact Form */}
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-8">
              Envie sua Mensagem
            </h3>
            
            <Card className="p-6 border-card-border">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Empresa *</Label>
                    <Input
                      id="company"
                      placeholder="Nome da empresa"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      placeholder="+244 xxx xxx xxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Assunto *</Label>
                  <Select value={formData.subject} onValueChange={(value) => setFormData({...formData, subject: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o assunto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info-produtos">Informações sobre Produtos</SelectItem>
                      <SelectItem value="novo-pedido">Novo Pedido</SelectItem>
                      <SelectItem value="parcerias">Parcerias</SelectItem>
                      <SelectItem value="suporte">Suporte Técnico</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="message">Mensagem *</Label>
                  <Textarea
                    id="message"
                    placeholder="Descreva sua necessidade ou dúvida..."
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
                  Enviar Mensagem
                </Button>
              </form>
            </Card>

            {/* Emergency Contact */}
            <Card className="mt-6 p-4 bg-gradient-card border-card-border">
              <div className="text-center">
                <h4 className="font-semibold text-foreground mb-2">
                  Precisa de atendimento urgente?
                </h4>
                <p className="text-muted-foreground text-sm mb-3">
                  Para questões urgentes de pedidos em andamento
                </p>
                <Button variant="accent" size="sm">
                  <FontAwesomeIcon icon={faPhone} className="h-4 w-4" />
                  Ligar Agora
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
