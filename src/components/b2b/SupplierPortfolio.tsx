 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
 import { Badge } from '../ui/badge';
 import { Button } from '../ui/button';
 import { 
   Package, Factory, Award, Truck, Clock, 
   Boxes, DollarSign, Image, Eye
 } from 'lucide-react';
 
 export interface PortfolioProduct {
   id: string;
   name: string;
   sku: string;
   unit: string;
   moq: number;
   prices: { minQty: number; price: number }[];
   stock: number;
   leadTime: string;
   photo?: string;
 }
 
 interface SupplierPortfolioProps {
   products: PortfolioProduct[];
   productionCapacity: string;
   certifications: string[];
   logistics: string[];
   onViewProduct?: (productId: string) => void;
 }
 
 export const SupplierPortfolio: React.FC<SupplierPortfolioProps> = ({
   products,
   productionCapacity,
   certifications,
   logistics,
   onViewProduct
 }) => {
   return (
     <div className="space-y-6">
       {/* Capacity & Certifications */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
         <Card className="border border-border bg-white">
           <CardContent className="p-5">
             <div className="flex items-center gap-3">
               <div className="h-12 w-12 rounded-xl bg-[#0a1628]/10 flex items-center justify-center">
                 <Factory className="h-6 w-6 text-[#0a1628]" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground">Capacidade Produtiva</p>
                 <p className="text-lg font-bold text-[#0a1628]">{productionCapacity}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="border border-border bg-white">
           <CardContent className="p-5">
             <div className="flex items-start gap-3">
               <div className="h-12 w-12 rounded-xl bg-[#B8860B]/10 flex items-center justify-center shrink-0">
                 <Award className="h-6 w-6 text-[#B8860B]" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground mb-2">Certificações</p>
                 <div className="flex flex-wrap gap-1">
                   {certifications.map((cert, index) => (
                     <Badge key={index} variant="outline" className="text-xs border-[#B8860B]/30 text-[#B8860B]">
                       {cert}
                     </Badge>
                   ))}
                 </div>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="border border-border bg-white">
           <CardContent className="p-5">
             <div className="flex items-start gap-3">
               <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                 <Truck className="h-6 w-6 text-green-600" />
               </div>
               <div>
                 <p className="text-xs text-muted-foreground mb-2">Logística</p>
                 <div className="flex flex-wrap gap-1">
                   {logistics.map((item, index) => (
                     <Badge key={index} variant="outline" className="text-xs border-green-200 text-green-700">
                       {item}
                     </Badge>
                   ))}
                 </div>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
       
       {/* Products Portfolio */}
       <Card className="border border-border bg-white">
         <CardHeader className="pb-4">
           <CardTitle className="text-lg font-semibold text-[#0a1628] flex items-center gap-2">
             <Package className="h-5 w-5 text-[#B8860B]" />
             Portfólio de Produtos
             <Badge className="ml-auto bg-[#0a1628] text-white">{products.length} produtos</Badge>
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-4">
             {products.map((product) => (
               <div 
                 key={product.id} 
                 className="flex gap-4 p-4 border border-border rounded-xl hover:border-[#B8860B]/30 transition-colors"
               >
                 {/* Product Image */}
                 <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                   {product.photo ? (
                     <img src={product.photo} alt={product.name} className="h-full w-full object-cover" />
                   ) : (
                     <Image className="h-8 w-8 text-gray-300" />
                   )}
                 </div>
                 
                 {/* Product Info */}
                 <div className="flex-1 min-w-0">
                   <div className="flex items-start justify-between gap-2">
                     <div>
                       <h4 className="font-semibold text-[#0a1628] truncate">{product.name}</h4>
                       <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                     </div>
                     <Button 
                       variant="outline" 
                       size="sm"
                       className="shrink-0"
                       onClick={() => onViewProduct?.(product.id)}
                     >
                       <Eye className="h-4 w-4 mr-1" />
                       Ver
                     </Button>
                   </div>
                   
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                     <div>
                       <p className="text-xs text-muted-foreground">Unidade</p>
                       <p className="text-sm font-medium text-[#0a1628]">{product.unit}</p>
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">MOQ</p>
                       <p className="text-sm font-medium text-[#0a1628]">{product.moq.toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">Estoque</p>
                       <p className="text-sm font-medium text-green-600">{product.stock.toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">Lead Time</p>
                       <p className="text-sm font-medium text-[#0a1628]">{product.leadTime}</p>
                     </div>
                   </div>
                   
                   {/* Volume Prices */}
                   <div className="mt-3 flex flex-wrap gap-2">
                     {product.prices.map((priceInfo, index) => (
                       <div key={index} className="px-2 py-1 bg-[#B8860B]/10 rounded text-xs">
                         <span className="text-muted-foreground">≥{priceInfo.minQty}: </span>
                         <span className="font-bold text-[#B8860B]">{priceInfo.price.toLocaleString()} Kz</span>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             ))}
           </div>
         </CardContent>
       </Card>
     </div>
   );
 };