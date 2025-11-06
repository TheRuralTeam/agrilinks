import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Minus, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const OrderSystem = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    company: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });

  const products = [
    { id: 1, name: "Arroz Branco Premium", price: 85000, unit: "saco 50kg", minQty: 100 },
    { id: 2, name: "Feijão Preto", price: 120000, unit: "saco 50kg", minQty: 50 },
    { id: 3, name: "Banana da Madeira", price: 45000, unit: "caixa 20kg", minQty: 80 },
    { id: 5, name: "Carne Bovina", price: 1800000, unit: "kg", minQty: 500 },
    { id: 6, name: "Milho em Grão", price: 65000, unit: "saco 50kg", minQty: 200 }
  ];

  const addToOrder = (product: any) => {
    const existingItem = orderItems.find(item => item.id === product.id);
    if (existingItem) {
      setOrderItems(orderItems.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + product.minQty }
          : item
      ));
    } else {
      setOrderItems([...orderItems, { ...product, quantity: product.minQty }]);
    }
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (product && newQuantity >= product.minQty) {
      setOrderItems(orderItems.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const removeFromOrder = (productId: number) => {
    setOrderItems(orderItems.filter(item => item.id !== productId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 0
    }).format(price);
  };

  const isMinimumMet = calculateTotal() >= 1000000;

  const handleSubmitOrder = () => {
    if (!isMinimumMet || !selectedDate || orderItems.length === 0) {
      return;
    }
    // Here you would typically send the order to your backend
    alert("Pedido enviado com sucesso! Entraremos em contato em breve.");
  };

  // Calculate date range (max 2 weeks from today)
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 14);

  return (
    <section id="pedidos" className="py-16 lg:py-24 bg-background-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Sistema de Pedidos
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Selecione produtos, quantidades e agende sua entrega.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Selection */}
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">
              Selecionar Produtos
            </h3>
            
            <div className="space-y-4 mb-8">
              {products.map((product) => (
                <Card key={product.id} className="p-4 border-card-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{product.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(product.price)}/{product.unit} • Mín: {product.minQty}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addToOrder(product)}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <Card className="p-6 border-card-border">
              <h4 className="text-xl font-semibold text-foreground mb-4">
                Resumo do Pedido
              </h4>
              
              {orderItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum produto selecionado
                </p>
              ) : (
                <div className="space-y-4">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity - item.minQty)}
                          disabled={item.quantity <= item.minQty}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-12 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity + item.minQty)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 ml-2"
                          onClick={() => removeFromOrder(item.id)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-xl font-bold text-primary">
                        {formatPrice(calculateTotal())}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isMinimumMet ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-success" />
                          <Badge variant="default" className="bg-success text-success-foreground">
                            Valor mínimo atingido
                          </Badge>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-warning" />
                          <Badge variant="outline" className="border-warning text-warning">
                            Faltam {formatPrice(1000000 - calculateTotal())}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Order Form */}
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">
              Informações do Pedido
            </h3>
            
            <Card className="p-6 border-card-border">
              <div className="space-y-6">
                {/* Customer Information */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="company">Empresa *</Label>
                    <Input
                      id="company"
                      placeholder="Nome da sua empresa"
                      value={customerInfo.company}
                      onChange={(e) => setCustomerInfo({...customerInfo, company: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact">Nome do Contato *</Label>
                    <Input
                      id="contact"
                      placeholder="Seu nome completo"
                      value={customerInfo.contact}
                      onChange={(e) => setCustomerInfo({...customerInfo, contact: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        placeholder="+244 xxx xxx xxx"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@empresa.com"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Endereço de Entrega *</Label>
                    <Textarea
                      id="address"
                      placeholder="Endereço completo para entrega"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    />
                  </div>
                </div>

                {/* Delivery Date */}
                <div>
                  <Label>Data de Entrega *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < today || date > maxDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo de 2 semanas após o pedido
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Instruções especiais ou observações sobre o pedido..."
                    value={customerInfo.notes}
                    onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={handleSubmitOrder}
                  disabled={!isMinimumMet || !selectedDate || orderItems.length === 0 || !customerInfo.company || !customerInfo.contact}
                >
                  Enviar Pedido
                </Button>
                
                {(!isMinimumMet || !selectedDate || orderItems.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center">
                    Complete todas as informações obrigatórias para enviar o pedido
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrderSystem;