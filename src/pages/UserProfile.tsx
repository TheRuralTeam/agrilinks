import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, Package, MessageCircle, Phone,
  Star, ShoppingCart, Users, Verified, BadgeCheck, Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ProductCard, Product } from '@/components/ProductCard';
import { getProfileDisplayName, getProfileRoleLabel, resolveAvatarUrl } from '@/lib/profileDisplay';
import { sanitizePublicProfile, isNeutralPublicView } from '@/lib/publicData';

/* ─── Design tokens — mesma linguagem visual do Perfil e do Mapa ────────────── */
import { T } from '@/lib/brand';

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"

interface UserData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  user_type: 'agricultor' | 'comprador' | 'agente' | 'motorista' | null;
  province_id: string;
  municipality_id: string;
  created_at: string;
  phone?: string;
  agent_code?: string;
  verified?: boolean;
}

interface UserStats {
  totalProducts: number;
  totalSales: number;
  totalReferrals: number;
  rating: number;
}

/* ─── Micro components (alinhados com o Profile.tsx) ─────────────────────────── */
const StatBlock = ({ icon, value, label, color = T.g600 }: { icon: React.ReactNode; value: number | string; label: string; color?: string }) => (
  <div style={{
    background: T.white, borderRadius: 18, padding: '18px 14px',
    border: `1px solid ${T.rule}`, boxShadow: `0 2px 10px ${T.shadow}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 28px ${T.shadowMd}` }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 10px ${T.shadow}` }}
  >
    <div style={{ width: 36, height: 36, borderRadius: 11, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em', fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 10, color: T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>{label}</div>
  </div>
)

const InfoRow = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: `1px solid ${T.rule}` }}>
    <div style={{ width: 34, height: 34, borderRadius: 10, background: accent ? `${accent}14` : T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 10.5, color: T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13.5, color: T.ink, fontWeight: 600, fontFamily: FONT, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</p>
    </div>
  </div>
)

const Btn = ({ children, onClick, variant = 'primary', style: extraStyle = {} }: any) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 13, cursor: 'pointer', fontWeight: 700, fontFamily: FONT,
    transition: 'all 0.18s', border: 'none', fontSize: 14, padding: '13px 22px',
    ...extraStyle,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: `linear-gradient(135deg, ${T.g500}, ${T.g700})`, color: T.white, boxShadow: `0 6px 18px rgba(45,125,58,0.3)` },
    outline: { background: T.white, color: T.mid, border: `1px solid ${T.rule}`, boxShadow: `0 2px 8px ${T.shadow}` },
  }
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick}
      onMouseEnter={e => { if (variant === 'primary') { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 26px rgba(45,125,58,0.4)` } }}
      onMouseLeave={e => { if (variant === 'primary') { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 18px rgba(45,125,58,0.3)` } }}
    >{children}</button>
  )
}

const TypeBadge = ({ type }: { type: string | null }) => {
  const map: Record<string, { bg: string; color: string; border: string; label: string; icon: React.ReactNode }> = {
    agricultor: { bg: T.g50,   color: T.g600,  border: T.gBorder,               label: 'Fornecedor', icon: <Package size={12}/> },
    comprador:  { bg: '#EFF6FF', color: '#2563EB', border: 'rgba(37,99,235,0.18)', label: 'Comprador',   icon: <ShoppingCart size={12}/> },
    agente:     { bg: '#F5F0FF', color: '#7C3AED', border: 'rgba(124,58,237,0.18)', label: 'Agente',      icon: <Users size={12}/> },
  }
  const s = map[type || ''] || { bg: T.canvas, color: T.muted, border: T.rule, label: 'Utilizador', icon: null }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, padding: '5px 13px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {s.icon} {s.label}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const UserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<UserStats>({ totalProducts: 0, totalSales: 0, totalReferrals: 0, rating: 4.5 });
  const [loading, setLoading] = useState(true);

  const fetchUserData = React.useCallback(async () => {
    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, user_type, province_id, municipality_id, created_at, phone, agent_code, verified')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      setUserData(profileData);

      // Buscar produtos do usuário
      if (profileData?.user_type !== 'comprador') {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (!productsError && productsData) {
          const productsWithData = await Promise.all(
            productsData.map(async (product) => {
              const { count: likesCount } = await supabase
                .from('product_likes')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', product.id);

              const { data: userLike } = await supabase
                .from('product_likes')
                .select('id')
                .eq('product_id', product.id)
                .eq('user_id', user?.id || '')
                .maybeSingle();

              const { count: commentsCount } = await supabase
                .from('product_comments')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', product.id);

              return {
                ...product,
                likes_count: likesCount || 0,
                is_liked: !!userLike,
                comments: Array(commentsCount || 0).fill({})
              } as Product;
            })
          );
          setProducts(productsWithData);
          setStats(prev => ({ ...prev, totalProducts: productsWithData.length }));
        }
      }

      // Buscar estatísticas de vendas (pedidos aceitos)
      const { count: salesCount } = await supabase
        .from('pre_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .in('product_id', (await supabase.from('products').select('id').eq('user_id', id)).data?.map(p => p.id) || []);

      setStats(prev => ({ ...prev, totalSales: salesCount || 0 }));

      // Para agentes, buscar indicações
      if (profileData?.user_type === 'agente') {
        const { data: referralData } = await supabase.rpc('get_agent_referral_stats', { agent_user_id: id });
        if (referralData && referralData.length > 0) {
          setStats(prev => ({ ...prev, totalReferrals: Number(referralData[0].total_referrals) || 0 }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast.error('Erro ao carregar perfil do usuário');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, navigate]);

  useEffect(() => {
    if (id) {
      if (user?.id === id) {
        navigate('/perfil', { replace: true });
        return;
      }
      fetchUserData();
    }
  }, [id, user?.id, navigate, fetchUserData]);

  const publicUserData = isNeutralPublicView(user) && userData ? sanitizePublicProfile(userData) : userData
  const profileDisplayName = publicUserData ? getProfileDisplayName(publicUserData as any) : 'Utilizador';
  const profileRoleLabel = getProfileRoleLabel((publicUserData as any)?.user_type || userData?.user_type);
  const profileAvatarUrl = publicUserData ? resolveAvatarUrl((publicUserData as any)?.avatar_url || userData?.avatar_url) : null;

  const handleProductUpdate = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const startConversation = async () => {
    if (!user || !id) return;

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
          title: userData?.full_name || 'Usuário',
          avatar: userData?.avatar_url,
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${T.gBorder}`, borderTopColor: T.g500, animation: 'spin 0.9s linear infinite' }}/>
          <p style={{ fontSize: 13, color: T.faint, fontWeight: 500, fontFamily: FONT }}>A carregar perfil…</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONT }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Users size={26} color={T.faint}/>
        </div>
        <p style={{ color: T.muted, marginBottom: 18, fontSize: 14, fontWeight: 600 }}>Utilizador não encontrado</p>
        <Btn variant="primary" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/app')}>Voltar</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 80 }}>

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(247,249,247,0.85)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${T.rule}`,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/app')}
            style={{ width: 34, height: 34, borderRadius: '50%', background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.g600, flexShrink: 0, transition: 'background 0.15s' }}
          >
            <ArrowLeft size={16}/>
          </button>
          <h1 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>Perfil do Utilizador</h1>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 0' }}>

        {/* ═══ HERO CARD ══════════════════════════════════════════════════════ */}
        <div style={{
          background: T.white, borderRadius: 24, border: `1px solid ${T.rule}`,
          boxShadow: `0 4px 20px ${T.shadow}`, overflow: 'hidden',
          animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <div style={{ height: 108, background: `linear-gradient(135deg, ${T.g900}, ${T.g700} 55%, ${T.g500})`, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }}/>
            <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)' }}>
              <Sparkles size={10} color="#fff"/>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>AgriLink</span>
            </div>
          </div>

          <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', marginTop: -50,
              border: `4px solid ${T.white}`, boxShadow: `0 8px 24px ${T.shadowMd}`,
              background: `linear-gradient(135deg, ${T.g600}, ${T.g400})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            }}>
              {profileAvatarUrl
                ? <img src={profileAvatarUrl} alt={profileDisplayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                : <span style={{ fontFamily: FONT, fontSize: 36, fontWeight: 800, color: T.white }}>{profileDisplayName.charAt(0).toUpperCase() || 'U'}</span>
              }
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14 }}>
              <h2 style={{ fontFamily: FONT, fontSize: 23, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.02em' }}>{profileDisplayName}</h2>
              {userData.verified && (
                <div style={{ width: 21, height: 21, borderRadius: '50%', background: T.g50, border: `1.5px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BadgeCheck size={12} color={T.g600}/>
                </div>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <TypeBadge type={profileRoleLabel.toLowerCase() === 'utilizador' ? null : userData.user_type}/>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 22, width: '100%' }}>
              <Btn variant="primary" onClick={startConversation} style={{ flex: 1 }}>
                <MessageCircle size={16}/> Enviar Mensagem
              </Btn>
              {userData.phone && (
                <Btn variant="outline" onClick={() => window.open(`tel:${userData.phone}`, '_self')} style={{ width: 50, padding: 0 }}>
                  <Phone size={16}/>
                </Btn>
              )}
            </div>
          </div>
        </div>

        {/* ═══ STATS ══════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18, animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) 0.06s both' }}>
          <StatBlock icon={<Package size={15} color={T.g500}/>} value={stats.totalProducts} label="Produtos" color={T.g600}/>
          <StatBlock icon={<ShoppingCart size={15} color={T.g500}/>} value={stats.totalSales} label="Vendas" color={T.g600}/>
          <StatBlock icon={<Star size={15} color={T.goldL}/>} value={stats.rating} label="Avaliação" color={T.gold}/>
        </div>

        {/* ═══ INFO CARD ══════════════════════════════════════════════════════ */}
        <div style={{
          background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`,
          boxShadow: `0 2px 10px ${T.shadow}`, padding: '18px 20px', marginTop: 14,
          animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) 0.1s both',
        }}>
          <h3 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.ink, margin: '0 0 4px' }}>Informações</h3>
          <InfoRow icon={<MapPin size={14} color={T.g600}/>} label="Localização" value={`${userData.province_id}${userData.municipality_id ? ', ' + userData.municipality_id : ''}`}/>
          <InfoRow icon={<Calendar size={14} color={T.g600}/>} label="Membro desde" value={new Date(userData.created_at).toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' })}/>
          {userData.user_type === 'agente' && userData.agent_code && (
            <InfoRow icon={<Verified size={14} color="#7C3AED"/>} label="Código de Agente" value={userData.agent_code} accent="#7C3AED"/>
          )}
          {userData.user_type === 'agente' && stats.totalReferrals > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={14} color={T.g600}/>
              </div>
              <div>
                <p style={{ fontSize: 10.5, color: T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Indicações</p>
                <p style={{ fontSize: 13.5, color: T.g600, fontWeight: 700, fontFamily: FONT, margin: '2px 0 0' }}>{stats.totalReferrals} utilizadores indicados</p>
              </div>
            </div>
          )}
        </div>

        {/* ═══ PRODUCTS ═══════════════════════════════════════════════════════ */}
        {userData.user_type !== 'comprador' && (
          <div style={{ marginTop: 26, animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) 0.14s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: T.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={17} color={T.g600}/> Produtos Publicados
              </h3>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.g600, background: T.g50, border: `1px solid ${T.gBorder}`, padding: '3px 11px', borderRadius: 20 }}>{products.length}</span>
            </div>

            {products.length === 0 ? (
              <div style={{
                borderRadius: 20, border: `1.5px dashed ${T.rule}`, background: T.white,
                padding: '48px 20px', textAlign: 'center',
              }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Package size={24} color={T.faint}/>
                </div>
                <p style={{ color: T.muted, fontSize: 13.5, fontWeight: 600, margin: 0 }}>Nenhum produto publicado</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onProductUpdate={handleProductUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

export default UserProfile;