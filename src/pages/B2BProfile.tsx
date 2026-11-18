import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Building2, FileText, MessageCircle, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import Loader from '../components/ui/Loader';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../components/ProductCard';
import { fetchProductsByOwner } from '../features/products/productsService';
import { getProfileDisplayName, getProfileRoleLabel, resolveAvatarUrl } from '../lib/profileDisplay';
import { T } from '../lib/brand';
import { angolaProvinces } from '../data/angola-locations';
import { SOURCING_AGRICULTURAL_PRODUCTS, SOURCING_UNITS } from '../features/sourcing/sourcingCatalog';

interface CompanyData {
  id: string;
  name: string;
  logo: string | null;
  userType: string | null;
  isVerified: boolean;
}

const initialRfqForm = {
  productName: '',
  quantity: '',
  unit: 'kg',
  qualitySpecification: '',
  deliveryProvinceId: '',
  deliveryMunicipalityId: '',
  deliveryLocation: '',
  deliveryDate: '',
  description: '',
};

const luandaDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const B2BProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqForm, setRfqForm] = useState({ ...initialRfqForm });
  const requestSequence = useRef(0);

  const fetchCompanyData = useCallback(async () => {
    if (!id) {
      setCompanyData(null);
      setProducts([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    setProductsLoadError(null);
    setProducts([]);

    try {
      // Only fields intentionally published in the public directory are queried.
      const { data: publicProfile, error: profileError } = await supabase
        .from('public_user_profiles')
        .select('id, full_name, avatar_url, user_type, verified')
        .eq('id', id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (requestId !== requestSequence.current) return;
      if (!publicProfile) {
        setCompanyData(null);
        return;
      }

      setCompanyData({
        id: publicProfile.id,
        name: getProfileDisplayName(publicProfile) || 'Utilizador AgriLink',
        logo: resolveAvatarUrl(publicProfile.avatar_url) || null,
        userType: publicProfile.user_type,
        isVerified: Boolean(publicProfile.verified),
      });

      if (publicProfile.user_type === 'agricultor' || publicProfile.user_type === 'agente') {
        try {
          const publicProducts = await fetchProductsByOwner(id, user?.id, 20);
          if (requestId !== requestSequence.current) return;
          setProducts(publicProducts as Product[]);
        } catch (error) {
          if (requestId !== requestSequence.current) return;
          console.error('[AgriLink] Não foi possível carregar o portfólio público:', error);
          setProductsLoadError('Não foi possível consultar os produtos publicados. Tente novamente.');
        }
      }
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      console.error('[AgriLink] Não foi possível carregar o perfil público:', error);
      setCompanyData(null);
      setLoadError('Não foi possível consultar este perfil. Verifique a ligação e tente novamente.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) {
      void fetchCompanyData();
      return;
    }
    if (user?.id === id) {
      navigate('/perfil', { replace: true });
      return;
    }
    void fetchCompanyData();
    return () => { requestSequence.current += 1; };
  }, [id, user?.id, navigate, fetchCompanyData]);

  const handleStartChat = async () => {
    if (!user) {
      toast.error('Inicie sessão para enviar uma mensagem.');
      navigate('/login');
      return;
    }
    if (!id || !companyData) return;

    try {
      const { data: legacyConversation, error: legacyError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user_id.eq.${user.id},peer_user_id.eq.${id}),and(user_id.eq.${id},peer_user_id.eq.${user.id})`)
        .limit(1);
      if (legacyError) throw legacyError;
      if (legacyConversation?.[0]?.id) {
        navigate(`/messages/${legacyConversation[0].id}`);
        return;
      }

      const { data: conversationId, error } = await supabase.rpc('get_or_create_conversation', {
        p_user_id: user.id,
        p_other_user_id: id,
      });
      if (error) throw error;
      if (!conversationId) throw new Error('O servidor não confirmou a criação da conversa.');
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error('[AgriLink] Não foi possível iniciar a conversa:', error);
      toast.error('Não foi possível iniciar a conversa. Verifique a ligação e tente novamente.');
    }
  };

  const handleRFQ = () => {
    if (!user?.id) {
      toast.error('Inicie sessão para enviar uma solicitação de cotação.');
      navigate('/login');
      return;
    }
    setRfqForm({ ...initialRfqForm });
    setRfqOpen(true);
  };

  const submitRFQ = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) {
      toast.error('A sua sessão expirou. Entre novamente para continuar.');
      navigate('/login');
      return;
    }

    const productName = rfqForm.productName.trim();
    const quantity = Number(rfqForm.quantity);
    if (
      !SOURCING_AGRICULTURAL_PRODUCTS.includes(productName as (typeof SOURCING_AGRICULTURAL_PRODUCTS)[number]) ||
      !Number.isFinite(quantity) || quantity <= 0 ||
      !rfqForm.deliveryDate || rfqForm.deliveryDate < luandaDate() ||
      !rfqForm.deliveryProvinceId || !rfqForm.deliveryMunicipalityId
    ) {
      toast.error('Indique um produto da lista, quantidade válida, data futura ou actual e município de entrega.');
      return;
    }

    setRfqLoading(true);
    try {
      const selectedProvince = angolaProvinces.find((province) => province.id === rfqForm.deliveryProvinceId);
      const selectedMunicipality = selectedProvince?.municipalities.find((municipality) => municipality.id === rfqForm.deliveryMunicipalityId);
      const deliveryLocation = rfqForm.deliveryLocation.trim() || [selectedMunicipality?.name, selectedProvince?.name].filter(Boolean).join(', ');
      const details = [
        companyData?.name ? `Perfil consultado: ${companyData.name}` : '',
        rfqForm.description.trim() ? `Observações: ${rfqForm.description.trim()}` : '',
      ].filter(Boolean).join('\n\n');

      const { data: sourcingRequest, error } = await supabase.from('sourcing_requests').insert({
        user_id: user.id,
        product_name: productName,
        quantity,
        unit: rfqForm.unit,
        quality_specification: rfqForm.qualitySpecification.trim() || null,
        delivery_province_id: rfqForm.deliveryProvinceId,
        delivery_municipality_id: rfqForm.deliveryMunicipalityId,
        delivery_location: deliveryLocation || null,
        delivery_date: rfqForm.deliveryDate,
        description: details || null,
        status: 'pending',
      }).select('id').single();

      if (error) throw error;
      if (!sourcingRequest?.id) throw new Error('O servidor não confirmou o registo do pedido.');

      // The saved sourcing request is authoritative; task dispatch is supplementary.
      const { error: agentError } = await supabase.functions.invoke('agent-task-submit', {
        body: {
          task_type: 'sourcing_intake',
          autonomy_mode: 'suggest',
          idempotency_key: `sourcing-${sourcingRequest.id}`,
          input_payload: {
            sourcing_request_id: sourcingRequest.id,
            product_name: productName,
            quantity,
            unit: rfqForm.unit,
            delivery_location: deliveryLocation,
            delivery_date: rfqForm.deliveryDate,
            quality_specification: rfqForm.qualitySpecification.trim() || null,
          },
        },
      });

      if (agentError) {
        console.error('[AgriLink] O pedido foi registado, mas a tarefa auxiliar não foi confirmada:', agentError);
        toast.info('Pedido registado. A execução auxiliar não foi confirmada; acompanhe o estado em Meus Pedidos.');
      } else {
        toast.success('Pedido registado. Pode acompanhar o estado na área Meus Pedidos.');
      }
      setRfqOpen(false);
      setRfqForm({ ...initialRfqForm });
      navigate('/perfil?tab=sourcing');
    } catch (error) {
      console.error('[AgriLink] Não foi possível registar a solicitação de cotação:', error);
      toast.error('Não foi possível registar a solicitação. Verifique os dados e tente novamente.');
    } finally {
      setRfqLoading(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center" style={{ background: T.canvas }}><Loader compact /></div>;
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-5 text-center" style={{ background: T.canvas }}>
        <Building2 size={36} color={T.faint} />
        <h1 className="text-lg font-bold" style={{ color: T.ink }}>Não foi possível carregar o perfil</h1>
        <p className="text-sm" style={{ color: T.muted }}>{loadError}</p>
        <Button onClick={() => void fetchCompanyData()}>Tentar novamente</Button>
        <Button variant="ghost" onClick={() => navigate('/app')}>Voltar ao Feed</Button>
      </main>
    );
  }

  if (!companyData) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-5 text-center" style={{ background: T.canvas }}>
        <Building2 size={36} color={T.faint} />
        <p className="text-sm font-semibold" style={{ color: T.muted }}>Este perfil público não está disponível.</p>
        <Button variant="outline" onClick={() => navigate('/app')}>Voltar ao Feed</Button>
      </main>
    );
  }

  const profileRole = getProfileRoleLabel(companyData.userType);
  const canShowProducts = companyData.userType === 'agricultor' || companyData.userType === 'agente';

  return (
    <main className="min-h-screen pb-20" style={{ background: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: 'rgba(247,249,247,0.94)', borderColor: T.rule, backdropFilter: 'blur(16px)' }}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <button type="button" aria-label="Voltar" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}>
            <ArrowLeft size={17} />
          </button>
          <h1 className="text-sm font-bold" style={{ color: T.ink }}>Perfil público</h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-3xl border bg-white" style={{ borderColor: T.rule }}>
          <div className="h-24" style={{ background: `linear-gradient(135deg, ${T.g900}, ${T.g700} 60%, ${T.g500})` }} />
          <div className="flex flex-col items-center px-6 pb-6 text-center">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white shadow-md" style={{ background: T.g600 }}>
              {companyData.logo
                ? <img src={companyData.logo} alt={companyData.name} className="h-full w-full object-cover" />
                : <span className="text-3xl font-extrabold text-white">{companyData.name.charAt(0).toUpperCase() || 'A'}</span>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-xl font-extrabold" style={{ color: T.ink }}>{companyData.name}</h2>
              {companyData.isVerified && <BadgeCheck size={19} color={T.g600} aria-label="Perfil verificado" />}
            </div>
            <p className="mt-1 text-sm font-semibold" style={{ color: T.muted }}>{profileRole}</p>
            <div className="mt-5 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
              <Button type="button" onClick={() => void handleStartChat()} className="rounded-xl">
                <MessageCircle className="mr-2 h-4 w-4" /> Enviar mensagem
              </Button>
              <Button type="button" variant="outline" onClick={handleRFQ} className="rounded-xl">
                <FileText className="mr-2 h-4 w-4" /> Solicitar cotação
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5" style={{ borderColor: T.rule }}>
          <h3 className="flex items-center gap-2 text-base font-bold" style={{ color: T.ink }}>
            <Building2 size={18} color={T.g600} /> Sobre este perfil
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: T.muted }}>
            Este perfil não disponibiliza informações comerciais adicionais.
          </p>
        </section>

        {canShowProducts && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold" style={{ color: T.ink }}>
                <Package size={18} color={T.g600} /> Produtos publicados
              </h3>
              {!productsLoadError && <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: T.g50, color: T.g600 }}>{products.length}</span>}
            </div>
            {productsLoadError ? (
              <div role="alert" className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: T.rule }}>
                <p className="text-sm font-semibold" style={{ color: T.ink }}>Não foi possível carregar os produtos</p>
                <p className="mt-2 text-xs" style={{ color: T.muted }}>{productsLoadError}</p>
                <Button variant="outline" className="mt-4" onClick={() => void fetchCompanyData()}>Tentar novamente</Button>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white px-5 py-12 text-center" style={{ borderColor: T.rule }}>
                <Package size={28} color={T.faint} className="mx-auto mb-3" />
                <p className="text-sm font-semibold" style={{ color: T.muted }}>Este utilizador ainda não tem produtos activos publicados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} onProductUpdate={(updated) => setProducts((previous) => previous.map((item) => item.id === updated.id ? updated : item))} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog open={rfqOpen} onOpenChange={(open) => { if (!open && !rfqLoading) setRfqOpen(false); }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl border p-0" style={{ borderColor: T.rule }}>
          <div className="h-1.5" style={{ background: T.g600 }} />
          <form onSubmit={submitRFQ}>
            <div className="p-5 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-lg">Solicitar cotação à AgriLink</DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-6">
                  Registe uma necessidade de compra para acompanhamento pela equipa AgriLink. O perfil consultado será indicado como referência, não como fornecedor contratado.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rfq-product">Produto agrícola *</Label>
                  <select id="rfq-product" value={rfqForm.productName} onChange={(event) => setRfqForm((value) => ({ ...value, productName: event.target.value }))} required disabled={rfqLoading} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Seleccionar produto</option>
                    {SOURCING_AGRICULTURAL_PRODUCTS.map((product) => <option key={product} value={product}>{product}</option>)}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="rfq-quantity">Quantidade *</Label><Input id="rfq-quantity" type="number" min="0.01" step="any" value={rfqForm.quantity} onChange={(event) => setRfqForm((value) => ({ ...value, quantity: event.target.value }))} required disabled={rfqLoading} /></div>
                  <div className="space-y-2"><Label htmlFor="rfq-unit">Unidade *</Label><select id="rfq-unit" value={rfqForm.unit} onChange={(event) => setRfqForm((value) => ({ ...value, unit: event.target.value }))} required disabled={rfqLoading} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{SOURCING_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="rfq-province">Província de entrega *</Label><select id="rfq-province" value={rfqForm.deliveryProvinceId} onChange={(event) => setRfqForm((value) => ({ ...value, deliveryProvinceId: event.target.value, deliveryMunicipalityId: '' }))} required disabled={rfqLoading} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Seleccionar província</option>{angolaProvinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="rfq-municipality">Município de entrega *</Label><select id="rfq-municipality" value={rfqForm.deliveryMunicipalityId} onChange={(event) => setRfqForm((value) => ({ ...value, deliveryMunicipalityId: event.target.value }))} required disabled={rfqLoading || !rfqForm.deliveryProvinceId} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Seleccionar município</option>{angolaProvinces.find((province) => province.id === rfqForm.deliveryProvinceId)?.municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name}</option>)}</select></div>
                </div>
                <div className="space-y-2"><Label htmlFor="rfq-location">Local de entrega (opcional)</Label><Input id="rfq-location" maxLength={180} value={rfqForm.deliveryLocation} onChange={(event) => setRfqForm((value) => ({ ...value, deliveryLocation: event.target.value }))} placeholder="Armazém, mercado ou ponto de descarga" disabled={rfqLoading} /></div>
                <div className="space-y-2"><Label htmlFor="rfq-quality">Qualidade e apresentação pretendidas</Label><Textarea id="rfq-quality" maxLength={1000} rows={3} value={rfqForm.qualitySpecification} onChange={(event) => setRfqForm((value) => ({ ...value, qualitySpecification: event.target.value }))} placeholder="Frescura, maturação, calibre, secagem ou embalagem" disabled={rfqLoading} /></div>
                <div className="space-y-2"><Label htmlFor="rfq-date">Data de entrega *</Label><Input id="rfq-date" type="date" min={luandaDate()} value={rfqForm.deliveryDate} onChange={(event) => setRfqForm((value) => ({ ...value, deliveryDate: event.target.value }))} required disabled={rfqLoading} /></div>
                <div className="space-y-2"><Label htmlFor="rfq-description">Observações adicionais</Label><Textarea id="rfq-description" rows={3} value={rfqForm.description} onChange={(event) => setRfqForm((value) => ({ ...value, description: event.target.value }))} placeholder="Requisitos adicionais para a equipa AgriLink" disabled={rfqLoading} /></div>
              </div>
            </div>
            <DialogFooter className="border-t px-5 py-4 sm:px-6" style={{ borderColor: T.rule }}>
              <Button type="button" variant="ghost" onClick={() => setRfqOpen(false)} disabled={rfqLoading}>Cancelar</Button>
              <Button type="submit" disabled={rfqLoading}>{rfqLoading ? 'A enviar…' : 'Enviar solicitação'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default B2BProfile;
