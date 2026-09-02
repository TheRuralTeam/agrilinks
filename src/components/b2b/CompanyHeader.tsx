 import React from 'react';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { 
   BadgeCheck, Shield, Building2, MapPin, Calendar,
   Award, Crown, Star
 } from 'lucide-react';
 
 export type CompanyTier = 'bronze' | 'silver' | 'gold' | 'enterprise';
 export type UserType = 'agricultor' | 'comprador' | 'agente' | 'motorista';
 
 interface CompanyHeaderProps {
   name: string;
   logo?: string | null;
   sector: string;
   location: string;
   memberSince: string;
   isVerified: boolean;
   tier: CompanyTier;
   userType: UserType;
 }
 
 const tierConfig: Record<CompanyTier, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
   bronze: {
     label: 'Bronze',
     color: 'text-amber-700',
     bg: 'bg-amber-100 border-amber-200',
     icon: <Award className="h-3.5 w-3.5" />
   },
   silver: {
     label: 'Silver',
     color: 'text-slate-500',
     bg: 'bg-slate-100 border-slate-200',
     icon: <Award className="h-3.5 w-3.5" />
   },
   gold: {
     label: 'Gold',
     color: 'text-[#B8860B]',
     bg: 'bg-[#B8860B]/10 border-[#B8860B]/30',
     icon: <Crown className="h-3.5 w-3.5" />
   },
   enterprise: {
     label: 'Enterprise',
     color: 'text-[#0a1628]',
     bg: 'bg-[#0a1628]/10 border-[#0a1628]/30',
     icon: <Crown className="h-3.5 w-3.5" />
   }
 };
 
 export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
   name,
   logo,
   sector,
   location,
   memberSince,
   isVerified,
   tier,
   userType
 }) => {
   const tierInfo = tierConfig[tier];
   const userTypeLabel = userType === 'comprador' ? 'Comprador' : userType === 'motorista' ? 'Motorista' : 'Fornecedor';
   
   return (
     <div className="bg-white border-b border-border">
       {/* Tier Banner */}
       <div className={`h-2 ${tier === 'gold' || tier === 'enterprise' ? 'bg-gradient-to-r from-[#B8860B] to-[#D4AF37]' : tier === 'silver' ? 'bg-gradient-to-r from-slate-400 to-slate-300' : 'bg-gradient-to-r from-amber-600 to-amber-400'}`} />
       
       <div className="p-6">
         <div className="flex items-start gap-6">
           {/* Company Logo */}
           <Avatar className="h-24 w-24 rounded-xl border-2 border-border shadow-soft">
             <AvatarImage src={logo || ''} className="object-cover" />
             <AvatarFallback className="rounded-xl bg-[#0a1628] text-white text-2xl font-bold">
               {name?.charAt(0)?.toUpperCase() || 'C'}
             </AvatarFallback>
           </Avatar>
           
           <div className="flex-1 min-w-0">
             {/* Company Name & Verification */}
             <div className="flex items-center gap-2 flex-wrap">
               <h1 className="text-2xl font-bold text-[#0a1628] truncate">{name}</h1>
               {isVerified && (
                 <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                   <BadgeCheck className="h-3.5 w-3.5" />
                   <span>Verificado</span>
                 </div>
               )}
             </div>
             
             {/* Badges Row */}
             <div className="flex items-center gap-2 mt-2 flex-wrap">
               <Badge className={`${tierInfo.bg} ${tierInfo.color} border font-semibold`}>
                 {tierInfo.icon}
                 <span className="ml-1">{tierInfo.label}</span>
               </Badge>
               
               <Badge variant="outline" className="border-[#0a1628]/20 text-[#0a1628]">
                 <Building2 className="h-3 w-3 mr-1" />
                 {userTypeLabel}
               </Badge>
               
               <Badge variant="outline" className="border-border text-muted-foreground">
                 <Shield className="h-3 w-3 mr-1" />
                 KYC Aprovado
               </Badge>
             </div>
             
             {/* Meta Info */}
             <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
               <div className="flex items-center gap-1">
                 <Building2 className="h-4 w-4" />
                 <span>{sector}</span>
               </div>
               <div className="flex items-center gap-1">
                 <MapPin className="h-4 w-4" />
                 <span>{location}</span>
               </div>
               <div className="flex items-center gap-1">
                 <Calendar className="h-4 w-4" />
                 <span>Membro desde {memberSince}</span>
               </div>
             </div>
           </div>
         </div>
       </div>
     </div>
   );
 };