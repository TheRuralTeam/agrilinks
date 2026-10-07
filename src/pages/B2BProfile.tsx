 import React, { useState, useEffect } from 'react';
 import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
 import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
 import { ArrowLeft, Building2, Briefcase, History } from 'lucide-react';
 import { supabase } from '../integrations/supabase/client';
 import { useAuth } from '../contexts/AuthContext';
 import { toast } from 'sonner';
 import { getProfileDisplayName, resolveAvatarUrl } from '../lib/profileDisplay';
 import { sanitizePublicProfile, isNeutralPublicView } from '../lib/publicData';
 import Loader from '../components/ui/Loader';
 
 import { CompanyHeader, CompanyTier, UserType } from '../components/b2b/CompanyHeader';
 import { TrustMetrics } from '../components/b2b/TrustMetrics';
 import { BuyerProfile } from '../components/b2b/BuyerProfile';
 import { SupplierPortfolio, PortfolioProduct } from '../components/b2b/SupplierPortfolio';
 import { AboutCompany } from '../components/b2b/AboutCompany';
 import { ActionButtons } from '../components/b2b/ActionButtons';
 
 import agrilinkLogo from '../assets/agrilink-logo.png';
 
 interface CompanyData {
   id: string;
   name: string;
   logo?: string | null;
   sector: string;
   location: string;
   memberSince: string;
   isVerified: boolean;
   tier: CompanyTier;
   userType: UserType;
   description: string;
   foundedYear?: number;
   employees?: string;
   annualRevenue?: string;
   phone?: string;
 }
 
 const B2BProfile = () => {
   const { id } = useParams<{ id: string }>();
   const navigate = useNavigate();
   const { user } = useAuth();
   const [loading, setLoading] = useState(true);
   const [companyData, setCompanyData] = useState<CompanyData | null>(null);
   const [products, setProducts] = useState<PortfolioProduct[]>([]);
 
  const trustMetrics = null;

  const buyerProfileData = {
    categories: [] as string[],
    monthlyVolume: '',
    purchaseFrequency: '',
    budgetRange: '',
    preferredIncoterms: [] as string[],
    paymentTerms: [] as string[]
  };

  const supplierData = {
    productionCapacity: '',
    certifications: [] as string[],
    logistics: [] as string[]
  };

  const fetchCompanyData = React.useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const determineTier = (): CompanyTier => {
        if (userData.is_root_admin) return 'enterprise';
        if (userData.verified) return 'gold';
        return 'bronze';
      };

      const publicUserData = isNeutralPublicView(user) ? sanitizePublicProfile(userData) : userData;
      const profileName = getProfileDisplayName((publicUserData as any) || userData);
      const safeLogo = resolveAvatarUrl((publicUserData as any)?.avatar_url || userData.avatar_url);

      setCompanyData({
        id: userData.id,
        name: profileName,
        logo: safeLogo,
        sector: userData.user_type === 'comprador' ? 'Agroindústria' : 'Produção Agrícola',
        location: [userData.municipality_id, userData.province_id].filter(Boolean).join(', ') || 'Localização não divulgada',
        memberSince: userData.created_at ? new Date(userData.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Data não disponível',
        isVerified: !!userData.verified,
        tier: determineTier(),
        userType: userData.user_type || 'comprador',
        description: (userData as any).bio || (userData as any).description || '',
        foundedYear: (userData as any).company_founded_year || undefined,
        employees: (userData as any).company_employees || undefined,
        annualRevenue: (userData as any).company_annual_revenue || undefined,
        phone: userData.phone
      });

      if (userData.user_type !== 'comprador') {
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(10);

        if (productsData) {
          const portfolioProducts: PortfolioProduct[] = productsData.map((p, index) => ({
            id: p.id,
            name: p.product_type,
            sku: `SKU-${String(index + 1).padStart(4, '0')}`,
            unit: 'kg',
            moq: Math.min(p.quantity, 100),
            prices: [
              { minQty: 100, price: p.price },
              { minQty: 500, price: Math.round(p.price * 0.95) },
              { minQty: 1000, price: Math.round(p.price * 0.90) }
            ],
            stock: p.quantity,
            leadTime: '3-5 dias',
            photo: p.photos?.[0]
          }));
          setProducts(portfolioProducts);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast.error('Erro ao carregar perfil da empresa');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

   useEffect(() => {
     if (id) {
       if (user?.id === id) {
         navigate('/perfil', { replace: true });
         return;
       }
       fetchCompanyData();
     }
   }, [id, user?.id, navigate, fetchCompanyData]);
 
   const handleStartChat = async () => {
     if (!user || !id) {
       toast.error('Faça login para iniciar uma conversa');
       return;
     }
 
     try {
       const { data: existingConv } = await supabase
         .from('conversations')
         .select('id')
         .or(`and(user_id.eq.${user.id},peer_user_id.eq.${id}),and(user_id.eq.${id},peer_user_id.eq.${user.id})`)
         .limit(1);
 
       if (existingConv && existingConv.length > 0) {
         navigate(`/messages/${existingConv[0].id}`);
         return;
       }
 
       const { data: newConv, error } = await supabase
         .from('conversations')
         .insert({
           user_id: user.id,
           peer_user_id: id,
           title: companyData?.name || 'Empresa',
           avatar: companyData?.logo,
           last_timestamp: new Date().toISOString(),
         })
         .select('id')
         .single();
 
       if (error) throw error;
       navigate(`/messages/${newConv.id}`);
     } catch (error) {
       console.error('Erro ao iniciar conversa:', error);
       toast.error('Erro ao iniciar conversa');
     }
   };
 
   const handleRFQ = () => {
     toast.info('Funcionalidade de RFQ em desenvolvimento');
   };
 
   const handleViewProduct = (productId: string) => {
     navigate(`/app`);
   };
 
   if (loading) {
     return <Loader />;
   }
 
   if (!companyData) {
     return (
       <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
         <p className="text-muted-foreground mb-4">Empresa não encontrada</p>
         <Button onClick={() => navigate(-1)}>Voltar</Button>
       </div>
     );
   }
 
   const isBuyer = companyData.userType === 'comprador';
 
   return (
     <div className="min-h-screen bg-white pb-24">
       {/* Header */}
       <header className="sticky top-0 z-20 bg-white border-b border-border px-4 py-3 flex items-center gap-4">
         <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
           <ArrowLeft className="h-5 w-5 text-[#111714]" />
         </Button>
         <img src={agrilinkLogo} alt="AgriLink" className="h-8" />
         <h1 className="text-lg font-semibold text-[#111714]">Perfil Institucional</h1>
       </header>
 
       {/* Company Header */}
       <CompanyHeader
         name={companyData.name}
         logo={companyData.logo}
         sector={companyData.sector}
         location={companyData.location}
         memberSince={companyData.memberSince}
         isVerified={companyData.isVerified}
         tier={companyData.tier}
         userType={companyData.userType}
       />
 
       {/* Main Content */}
       <div className="p-4 max-w-6xl mx-auto">
         <Tabs defaultValue="overview" className="w-full">
           <TabsList className="w-full grid grid-cols-2 mb-6 bg-[#f6f8f6]">
             <TabsTrigger value="overview" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#111714]">
               <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
               Visão Geral
             </TabsTrigger>
             <TabsTrigger value="commercial" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#111714]">
               <Briefcase className="h-4 w-4 mr-1 hidden sm:inline" />
               {isBuyer ? 'Perfil Compra' : 'Portfólio'}
             </TabsTrigger>
             <TabsTrigger value="history" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#111714]">
               <History className="h-4 w-4 mr-1 hidden sm:inline" />
               Histórico
             </TabsTrigger>
             <TabsTrigger value="documents" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#111714]">
               <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
               Documentos
             </TabsTrigger>
           </TabsList>
 
           {/* Overview Tab */}
           <TabsContent value="overview" className="space-y-6">
             <AboutCompany
               description={companyData.description || 'A empresa ainda não publicou uma descrição pública.'}
               foundedYear={companyData.foundedYear}
               employees={companyData.employees}
               annualRevenue={companyData.annualRevenue}
             />

             {trustMetrics ? <TrustMetrics {...trustMetrics} /> : (
               <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                 Ainda não existem métricas públicas publicadas para este perfil.
               </div>
             )}
           </TabsContent>
 
           {/* Commercial Tab */}
           <TabsContent value="commercial" className="space-y-6">
             {isBuyer ? (
               <BuyerProfile {...buyerProfileData} />
             ) : (
               <SupplierPortfolio
                 products={products}
                 productionCapacity={supplierData.productionCapacity}
                 certifications={supplierData.certifications}
                 logistics={supplierData.logistics}
                 onViewProduct={handleViewProduct}
               />
             )}
           </TabsContent>
 
           {/* History Tab */}
           <TabsContent value="history" className="space-y-6">
             <div className="text-center py-12 text-muted-foreground">
               <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
               <p>Histórico de transações disponível em breve</p>
             </div>
           </TabsContent>
 
           {/* Documents Tab */}
           <TabsContent value="documents" className="space-y-6">
             <div className="text-center py-12 text-muted-foreground">
               <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
               <p>Gestão de documentos disponível em breve</p>
             </div>
           </TabsContent>
         </Tabs>
       </div>
 
       {/* Fixed Action Buttons */}
        <Dialog open={rfqOpen} onOpenChange={(open) => { if (!open && !rfqLoading) setRfqOpen(false); }}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl border-[#DCE8DE] p-0 overflow-hidden">
            <div className="h-1.5 bg-[#2c863b]" />
            <form onSubmit={submitRFQ}>
              <div className="p-5 sm:p-6">
                <DialogHeader>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE8DE] bg-[#F4FAF5] p-2"><img src={agrilinkLogo} alt="AgriLink" className="h-full w-full object-contain" /></div>
                    <div><div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#2c863b]">AgriLink Sourcing</div><DialogTitle className="mt-1 text-lg">Solicitar cotação</DialogTitle></div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">Envie uma necessidade de compra para a equipa AgriLink. O perfil consultado será usado como referência operacional.</p>
                </DialogHeader>
                <div className="mt-5 space-y-4">
                  <div className="space-y-2"><Label htmlFor="rfq-product">Produto</Label><Input id="rfq-product" value={rfqForm.productName} onChange={(e) => setRfqForm(v => ({ ...v, productName: e.target.value }))} placeholder="Ex.: Milho branco" disabled={rfqLoading} /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="rfq-quantity">Quantidade (kg)</Label><Input id="rfq-quantity" type="number" min="1" step="0.01" value={rfqForm.quantity} onChange={(e) => setRfqForm(v => ({ ...v, quantity: e.target.value }))} placeholder="1000" disabled={rfqLoading} /></div>
                    <div className="space-y-2"><Label htmlFor="rfq-date">Data de entrega</Label><Input id="rfq-date" type="date" value={rfqForm.deliveryDate} onChange={(e) => setRfqForm(v => ({ ...v, deliveryDate: e.target.value }))} disabled={rfqLoading} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="rfq-description">Necessidade / especificações</Label><Textarea id="rfq-description" rows={5} value={rfqForm.description} onChange={(e) => setRfqForm(v => ({ ...v, description: e.target.value }))} placeholder="Qualidade, embalagem, localização de entrega, requisitos adicionais..." disabled={rfqLoading} className="resize-none" /></div>
                </div>
              </div>
              <DialogFooter className="border-t border-[#E5EDE6] bg-white px-5 py-4 sm:px-6">
                <Button type="button" variant="ghost" onClick={() => setRfqOpen(false)} disabled={rfqLoading}>Cancelar</Button>
                <Button type="submit" disabled={rfqLoading} className="rounded-full bg-[#2c863b] text-white hover:bg-[#246f32]">{rfqLoading ? 'A enviar…' : 'Enviar solicitação'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

       <ActionButtons
         onChat={handleStartChat}
         onRFQ={handleRFQ}
         phone={companyData.phone}
       />
     </div>
   );
 };
 
 export default B2BProfile;