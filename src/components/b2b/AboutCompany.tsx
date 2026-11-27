 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
 import { Building2 } from 'lucide-react';
 
 interface AboutCompanyProps {
   description: string;
   foundedYear?: number;
   employees?: string;
   annualRevenue?: string;
 }
 
 export const AboutCompany: React.FC<AboutCompanyProps> = ({
   description,
   foundedYear,
   employees,
   annualRevenue
 }) => {
   return (
     <Card className="border border-border bg-white">
       <CardHeader className="pb-4">
         <CardTitle className="text-lg font-semibold text-[#111714] flex items-center gap-2">
           <Building2 className="h-5 w-5 text-[#2c863b]" />
           Sobre a Empresa
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-4">
         <p className="text-sm text-muted-foreground leading-relaxed">
           {description}
         </p>
         
         {(foundedYear || employees || annualRevenue) && (
           <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
             {foundedYear && (
               <div className="text-center">
                 <p className="text-2xl font-bold text-[#111714]">{foundedYear}</p>
                 <p className="text-xs text-muted-foreground">Fundação</p>
               </div>
             )}
             {employees && (
               <div className="text-center">
                 <p className="text-2xl font-bold text-[#111714]">{employees}</p>
                 <p className="text-xs text-muted-foreground">Colaboradores</p>
               </div>
             )}
             {annualRevenue && (
               <div className="text-center">
                 <p className="text-2xl font-bold text-[#2c863b]">{annualRevenue}</p>
                 <p className="text-xs text-muted-foreground">Faturação Anual</p>
               </div>
             )}
           </div>
         )}
       </CardContent>
     </Card>
   );
 };