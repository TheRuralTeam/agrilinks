 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
 import { Progress } from '../ui/progress';
 import { 
   Handshake, Star, Truck, CreditCard, TrendingUp, 
   Clock, CheckCircle2, Package
 } from 'lucide-react';
 
 interface TrustMetricsProps {
   completedNegotiations: number;
   averageRating: number;
   totalReviews: number;
   deliveryRate: number;
   paymentRate: number;
   responseTime: string;
   onTimeDelivery: number;
   repeatBuyerRate: number;
 }
 
 export const TrustMetrics: React.FC<TrustMetricsProps> = ({
   completedNegotiations,
   averageRating,
   totalReviews,
   deliveryRate,
   paymentRate,
   responseTime,
   onTimeDelivery,
   repeatBuyerRate
 }) => {
   const renderStars = (rating: number) => {
     return Array.from({ length: 5 }, (_, i) => (
       <Star
         key={i}
         className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-[#B8860B] fill-[#B8860B]' : 'text-gray-200'}`}
       />
     ));
   };
 
   return (
     <Card className="border border-border bg-white">
       <CardHeader className="pb-4">
         <CardTitle className="text-lg font-semibold text-[#0a1628] flex items-center gap-2">
           <TrendingUp className="h-5 w-5 text-[#B8860B]" />
           Métricas de Confiança
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-6">
         {/* Main Stats Grid */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="text-center p-4 bg-[#0a1628]/5 rounded-xl">
             <Handshake className="h-6 w-6 mx-auto text-[#0a1628] mb-2" />
             <p className="text-2xl font-bold text-[#0a1628]">{completedNegotiations}</p>
             <p className="text-xs text-muted-foreground">Negociações Concluídas</p>
           </div>
           
           <div className="text-center p-4 bg-[#B8860B]/10 rounded-xl">
             <div className="flex justify-center gap-0.5 mb-2">
               {renderStars(averageRating)}
             </div>
             <p className="text-2xl font-bold text-[#0a1628]">{averageRating.toFixed(1)}</p>
             <p className="text-xs text-muted-foreground">{totalReviews} Avaliações</p>
           </div>
           
           <div className="text-center p-4 bg-green-50 rounded-xl">
             <Truck className="h-6 w-6 mx-auto text-green-600 mb-2" />
             <p className="text-2xl font-bold text-green-600">{deliveryRate}%</p>
             <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
           </div>
           
           <div className="text-center p-4 bg-blue-50 rounded-xl">
             <CreditCard className="h-6 w-6 mx-auto text-blue-600 mb-2" />
             <p className="text-2xl font-bold text-blue-600">{paymentRate}%</p>
             <p className="text-xs text-muted-foreground">Taxa de Pagamento</p>
           </div>
         </div>
         
         {/* Progress Metrics */}
         <div className="space-y-4">
           <div>
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2 text-sm">
                 <Clock className="h-4 w-4 text-muted-foreground" />
                 <span className="text-muted-foreground">Tempo de Resposta</span>
               </div>
               <span className="text-sm font-medium text-[#0a1628]">{responseTime}</span>
             </div>
           </div>
           
           <div>
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2 text-sm">
                 <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                 <span className="text-muted-foreground">Entregas no Prazo</span>
               </div>
               <span className="text-sm font-medium text-[#0a1628]">{onTimeDelivery}%</span>
             </div>
             <Progress value={onTimeDelivery} className="h-2" />
           </div>
           
           <div>
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2 text-sm">
                 <Package className="h-4 w-4 text-muted-foreground" />
                 <span className="text-muted-foreground">Compradores Recorrentes</span>
               </div>
               <span className="text-sm font-medium text-[#0a1628]">{repeatBuyerRate}%</span>
             </div>
             <Progress value={repeatBuyerRate} className="h-2" />
           </div>
         </div>
       </CardContent>
     </Card>
   );
 };