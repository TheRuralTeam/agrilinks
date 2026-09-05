 import React, { useState, useEffect } from 'react';
 import { useParams, useNavigate } from 'react-router-dom';
 import { Button } from '@/components/ui/button';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ArrowLeft, Building2, Briefcase, History, FileText } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 import { getProfileDisplayName, resolveAvatarUrl } from '@/lib/profileDisplay';
 import { sanitizePublicProfile, isNeutralPublicView } from '@/lib/publicData';
 
 import { CompanyHeader, CompanyTier, UserType } from '@/components/b2b/CompanyHeader';
 import { TrustMetrics } from '@/components/b2b/TrustMetrics';
 import { BuyerProfile } from '@/components/b2b/BuyerProfile';
 import { SupplierPortfolio, PortfolioProduct } from '@/components/b2b/SupplierPortfolio';
 import { AboutCompany } from '@/components/b2b/AboutCompany';
 import { ActionButtons } from '@/components/b2b/ActionButtons';
 
 import orbisLinkLogo from '@/assets/orbislink-logo.png';
 
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
     return (
       <div className="min-h-screen bg-white flex items-center justify-center">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0a1628]"></div>
       </div>
     );
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
           <ArrowLeft className="h-5 w-5 text-[#0a1628]" />
         </Button>
         <img src={orbisLinkLogo} alt="OrbisLink" className="h-8" />
         <h1 className="text-lg font-semibold text-[#0a1628]">Perfil Institucional</h1>
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
           <TabsList className="w-full grid grid-cols-4 mb-6 bg-gray-100">
             <TabsTrigger value="overview" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#0a1628]">
               <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
               Visão Geral
             </TabsTrigger>
             <TabsTrigger value="commercial" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#0a1628]">
               <Briefcase className="h-4 w-4 mr-1 hidden sm:inline" />
               {isBuyer ? 'Perfil Compra' : 'Portfólio'}
             </TabsTrigger>
             <TabsTrigger value="history" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#0a1628]">
               <History className="h-4 w-4 mr-1 hidden sm:inline" />
               Histórico
             </TabsTrigger>
             <TabsTrigger value="documents" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-[#0a1628]">
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
       <ActionButtons
         onChat={handleStartChat}
         onRFQ={handleRFQ}
         phone={companyData.phone}
       />
     </div>
   );
 };
 
 export default B2BProfile;