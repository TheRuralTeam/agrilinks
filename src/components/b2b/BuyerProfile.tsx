 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
 import { Badge } from '../ui/badge';
 import { 
   ShoppingCart, Package, Calendar, Wallet, 
   FileText, CreditCard, Tag
 } from 'lucide-react';
 
 interface BuyerProfileProps {
   categories: string[];
   monthlyVolume: string;
   purchaseFrequency: string;
   budgetRange: string;
   preferredIncoterms: string[];
   paymentTerms: string[];
 }
 
 export const BuyerProfile: React.FC<BuyerProfileProps> = ({
   categories,
   monthlyVolume,
   purchaseFrequency,
   budgetRange,
   preferredIncoterms,
   paymentTerms
 }) => {
   return (
     <Card className="border border-border bg-white">
       <CardHeader className="pb-4">
         <CardTitle className="text-lg font-semibold text-[#0a1628] flex items-center gap-2">
           <ShoppingCart className="h-5 w-5 text-[#B8860B]" />
           Perfil de Compra
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-6">
         {/* Categories of Interest */}
         <div>
           <div className="flex items-center gap-2 mb-3">
             <Tag className="h-4 w-4 text-muted-foreground" />
             <span className="text-sm font-medium text-[#0a1628]">Categorias de Interesse</span>
           </div>
           <div className="flex flex-wrap gap-2">
             {categories.map((category, index) => (
               <Badge 
                 key={index} 
                 variant="outline" 
                 className="bg-[#0a1628]/5 border-[#0a1628]/20 text-[#0a1628]"
               >
                 {category}
               </Badge>
             ))}
           </div>
         </div>
         
         {/* Volume & Frequency Grid */}
         <div className="grid grid-cols-2 gap-4">
           <div className="p-4 bg-gray-50 rounded-xl">
             <Package className="h-5 w-5 text-[#0a1628] mb-2" />
             <p className="text-xs text-muted-foreground">Volume Mensal</p>
             <p className="text-lg font-bold text-[#0a1628]">{monthlyVolume}</p>
           </div>
           
           <div className="p-4 bg-gray-50 rounded-xl">
             <Calendar className="h-5 w-5 text-[#0a1628] mb-2" />
             <p className="text-xs text-muted-foreground">Frequência de Compra</p>
             <p className="text-lg font-bold text-[#0a1628]">{purchaseFrequency}</p>
           </div>
         </div>
         
         {/* Budget Range */}
         <div className="p-4 bg-[#B8860B]/10 rounded-xl">
           <div className="flex items-center gap-2 mb-2">
             <Wallet className="h-5 w-5 text-[#B8860B]" />
             <span className="text-sm font-medium text-[#0a1628]">Faixa de Orçamento</span>
           </div>
           <p className="text-xl font-bold text-[#0a1628]">{budgetRange}</p>
         </div>
         
         {/* Incoterms */}
         <div>
           <div className="flex items-center gap-2 mb-3">
             <FileText className="h-4 w-4 text-muted-foreground" />
             <span className="text-sm font-medium text-[#0a1628]">Incoterms Preferidos</span>
           </div>
           <div className="flex flex-wrap gap-2">
             {preferredIncoterms.map((term, index) => (
               <Badge 
                 key={index} 
                 className="bg-[#0a1628] text-white"
               >
                 {term}
               </Badge>
             ))}
           </div>
         </div>
         
         {/* Payment Terms */}
         <div>
           <div className="flex items-center gap-2 mb-3">
             <CreditCard className="h-4 w-4 text-muted-foreground" />
             <span className="text-sm font-medium text-[#0a1628]">Condições de Pagamento</span>
           </div>
           <div className="flex flex-wrap gap-2">
             {paymentTerms.map((term, index) => (
               <Badge 
                 key={index} 
                 variant="outline"
                 className="border-[#B8860B]/30 text-[#B8860B]"
               >
                 {term}
               </Badge>
             ))}
           </div>
         </div>
       </CardContent>
     </Card>
   );
 };