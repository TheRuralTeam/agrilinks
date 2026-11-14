import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, MessageCircle, Package, UserRound } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import Loader from '../components/ui/Loader';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { ProductCard, Product } from '../components/ProductCard';
import { getProfileDisplayName, getProfileRoleLabel, resolveAvatarUrl } from '../lib/profileDisplay';
import { T } from '../lib/brand';

interface UserData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  user_type: 'agricultor' | 'comprador' | 'agente' | 'motorista' | null;
  verified: boolean;
}

const UserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const fetchUserData = useCallback(async () => {
    if (!id) {
      setUserData(null);
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
      // Public profile data comes only from the deliberately limited public directory.
      // Private users fields (phone, email, location and referral identifiers) are never queried here.
      const { data: profileData, error: profileError } = await supabase
        .from('public_user_profiles')
        .select('id, full_name, avatar_url, user_type, verified')
        .eq('id', id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (requestId !== requestSequence.current) return;

      if (!profileData) {
        setUserData(null);
        return;
      }

      const safeProfile: UserData = {
        id: profileData.id,
        full_name: profileData.full_name?.trim() || 'Utilizador AgriLink',
        avatar_url: profileData.avatar_url,
        user_type: profileData.user_type,
        verified: Boolean(profileData.verified),
      };
      setUserData(safeProfile);

      if (safeProfile.user_type === 'agricultor' || safeProfile.user_type === 'agente') {
        try {
          const { data: productRows, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

          if (productsError) throw productsError;

          const productsWithData = await Promise.all((productRows || []).map(async (product) => {
            const [likesResult, commentsResult] = await Promise.all([
              supabase.from('product_likes').select('id', { count: 'exact', head: true }).eq('product_id', product.id),
              supabase.from('product_comments').select('id', { count: 'exact', head: true }).eq('product_id', product.id),
            ]);
            if (likesResult.error) throw likesResult.error;
            if (commentsResult.error) throw commentsResult.error;

            let isLiked = false;
            if (user?.id) {
              const { data: userLike, error: userLikeError } = await supabase
                .from('product_likes')
                .select('id')
                .eq('product_id', product.id)
                .eq('user_id', user.id)
                .maybeSingle();
              if (userLikeError) throw userLikeError;
              isLiked = Boolean(userLike);
            }

            return {
              ...product,
              likes_count: likesResult.count || 0,
              is_liked: isLiked,
              comments_count: commentsResult.count || 0,
            } as Product;
          }));

          if (requestId !== requestSequence.current) return;
          setProducts(productsWithData);
        } catch (error) {
          if (requestId !== requestSequence.current) return;
          console.error('[AgriLink] Não foi possível carregar os produtos públicos:', error);
          setProductsLoadError('Não foi possível consultar os produtos publicados. Tente novamente.');
        }
      }
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      console.error('[AgriLink] Não foi possível carregar o perfil público:', error);
      setLoadError('Não foi possível consultar este perfil. Verifique a ligação e tente novamente.');
      setUserData(null);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) {
      void fetchUserData();
      return;
    }
    if (user?.id === id) {
      navigate('/perfil', { replace: true });
      return;
    }
    void fetchUserData();
    return () => {
      requestSequence.current += 1;
    };
  }, [id, user?.id, navigate, fetchUserData]);

  const startConversation = async () => {
    if (!user) {
      toast.error('Inicie sessão para enviar uma mensagem.');
      navigate('/login');
      return;
    }
    if (!id || !userData) return;

    try {
      const { data: existingConv, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user_id.eq.${user.id},peer_user_id.eq.${id}),and(user_id.eq.${id},peer_user_id.eq.${user.id})`)
        .limit(1);

      if (existingError) throw existingError;
      if (existingConv?.[0]?.id) {
        navigate(`/messages/${existingConv[0].id}`);
        return;
      }

      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          peer_user_id: id,
          title: userData.full_name || 'Utilizador AgriLink',
          avatar: userData.avatar_url,
          last_timestamp: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError) throw createError;
      if (!newConv?.id) throw new Error('O servidor não confirmou a criação da conversa.');
      navigate(`/messages/${newConv.id}`);
    } catch (error) {
      console.error('[AgriLink] Não foi possível iniciar a conversa:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader compact />
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-5 text-center" style={{ background: T.canvas }}>
        <UserRound size={36} color={T.faint} />
        <h1 className="text-lg font-bold" style={{ color: T.ink }}>Não foi possível carregar o perfil</h1>
        <p className="break-words text-sm" style={{ color: T.muted }}>{loadError}</p>
        <button type="button" onClick={() => void fetchUserData()} className="rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: T.g600 }}>Tentar novamente</button>
        <button type="button" onClick={() => navigate('/app')} className="text-sm font-semibold" style={{ color: T.g600 }}>Voltar ao Feed</button>
      </main>
    );
  }

  if (!userData) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-5 text-center" style={{ background: T.canvas }}>
        <UserRound size={36} color={T.faint} />
        <p className="text-sm font-semibold" style={{ color: T.muted }}>Este perfil público não está disponível.</p>
        <button type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/app')} className="rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: T.g600 }}>Voltar</button>
      </main>
    );
  }

  const profileDisplayName = getProfileDisplayName(userData);
  const profileRoleLabel = getProfileRoleLabel(userData.user_type);
  const profileAvatarUrl = resolveAvatarUrl(userData.avatar_url);
  const canShowProducts = userData.user_type === 'agricultor' || userData.user_type === 'agente';

  return (
    <main className="min-h-screen pb-20" style={{ background: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: 'rgba(247,249,247,0.94)', borderColor: T.rule, backdropFilter: 'blur(16px)' }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <button type="button" aria-label="Voltar" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/app')} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}>
            <ArrowLeft size={17} />
          </button>
          <h1 className="text-sm font-bold" style={{ color: T.ink }}>Perfil público</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-3xl border bg-white" style={{ borderColor: T.rule }}>
          <div className="h-24" style={{ background: `linear-gradient(135deg, ${T.g900}, ${T.g700} 60%, ${T.g500})` }} />
          <div className="flex flex-col items-center px-6 pb-6 text-center">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white shadow-md" style={{ background: T.g600 }}>
              {profileAvatarUrl
                ? <img src={profileAvatarUrl} alt={profileDisplayName} className="h-full w-full object-cover" />
                : <span className="text-3xl font-extrabold text-white">{profileDisplayName.charAt(0).toUpperCase() || 'U'}</span>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-xl font-extrabold" style={{ color: T.ink }}>{profileDisplayName}</h2>
              {userData.verified && <BadgeCheck size={19} color={T.g600} aria-label="Perfil verificado" />}
            </div>
            <p className="mt-1 text-sm font-semibold" style={{ color: T.muted }}>{profileRoleLabel}</p>
            <button type="button" onClick={() => void startConversation()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white" style={{ background: T.g600 }}>
              <MessageCircle size={16} /> Enviar mensagem
            </button>
          </div>
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
                <p className="mt-2 break-words text-xs" style={{ color: T.muted }}>{productsLoadError}</p>
                <button type="button" onClick={() => void fetchUserData()} className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: T.rule, color: T.g600 }}>Tentar novamente</button>
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
    </main>
  );
};

export default UserProfile;
