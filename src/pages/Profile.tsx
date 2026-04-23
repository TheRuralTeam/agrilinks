import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  User, Edit, Package, MapPin, Phone, Mail, Calendar, BarChart3,
  Settings, LogOut, Trash2, Eye, Camera, CheckCircle, Share2, Star, Users,
  ClipboardList, Bell, ShoppingCart, Search, BadgeCheck, Globe, ChevronRight,
  TrendingUp, Zap, ArrowUpRight, MessageCircle, Heart
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/use-toast'

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const T = {
  g900:    '#0D2B12',
  g700:    '#1A5C24',
  g600:    '#2D7D3A',
  g500:    '#3D9A48',
  g400:    '#4CAF50',
  g100:    '#E8F5E9',
  g50:     '#F2FAF3',
  gBorder: '#C8E6CA',
  e700:    '#5C3317',
  e500:    '#7B4F2E',
  e300:    '#A0522D',
  ePale:   '#FDF5EE',
  eBorder: '#EDD9C6',
  ink:     '#111714',
  mid:     '#3D4D40',
  muted:   '#758A79',
  faint:   '#A8BAA9',
  canvas:  '#F7F9F7',
  white:   '#FFFFFF',
  rule:    '#E5EDE6',
  gold:    '#B07D0A',
  goldL:   '#E5A020',
  shadow:  'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

/* ─── Interfaces ─────────────────────────────────────────────────────────────── */
interface UserProduct {
  id: string; product_type: string; quantity: number; harvest_date: string
  price: number; province_id: string; municipality_id: string
  status: 'active' | 'inactive' | 'removed'; created_at: string
  views?: number; interests?: number
}
interface FichaRecebimento {
  id: string; nomeFicha: string; produto: string; qualidade: string
  embalagem: string; locaisEntrega?: string[]; telefone: string; created_at: string
}
interface ReceivedOrder {
  id: string; product_id: string; user_id: string; quantity: number
  location: string; status: string; created_at: string
  product?: { product_type: string; price: number }
  buyer?: { full_name: string; phone: string }
}
interface SourcingRequest {
  id: string; product_name: string; quantity: number; delivery_date: string
  description: string | null; status: string; admin_notes: string | null; created_at: string
}

/* ─── Micro components ───────────────────────────────────────────────────────── */
const StatCard = ({ icon, value, label, color = T.g600 }: { icon: React.ReactNode; value: number | string; label: string; color?: string }) => (
  <div style={{
    background: T.white, borderRadius: 16, padding: '18px 16px',
    border: `1px solid ${T.rule}`, boxShadow: `0 1px 6px ${T.shadow}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'default',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${T.shadowMd}` }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 6px ${T.shadow}` }}
  >
    <div style={{ width: 38, height: 38, borderRadius: 10, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: '-0.03em', fontFamily: "'Cormorant Garamond', Georgia, serif", fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div style={{ fontSize: 10, color: T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.3 }}>{label}</div>
  </div>
)

const InfoRow = ({ icon, value }: { icon: React.ReactNode; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.rule}` }}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
    <span style={{ fontSize: 13, color: T.mid, fontWeight: 500 }}>{value || '—'}</span>
  </div>
)

const TabBtn = ({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
    borderRadius: 10, border: 'none', cursor: 'pointer',
    background: active ? T.g600 : 'transparent',
    color: active ? T.white : T.muted,
    fontWeight: active ? 700 : 500,
    fontSize: 13, transition: 'all 0.18s',
    position: 'relative', flexShrink: 0,
  }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = T.g50 }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', color: T.white, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
    )}
  </button>
)

const Btn = ({ children, onClick, variant = 'primary', disabled = false, size = 'md', style: extraStyle = {} }: any) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700, transition: 'all 0.18s', border: 'none',
    opacity: disabled ? 0.5 : 1,
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '9px 18px',
    fontSize: size === 'sm' ? 12 : 13,
    ...extraStyle,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: `linear-gradient(135deg, ${T.g500}, ${T.g700})`, color: T.white, boxShadow: `0 4px 14px rgba(45,125,58,0.28)` },
    secondary: { background: T.g50, color: T.g600, border: `1px solid ${T.gBorder}` },
    outline:   { background: 'transparent', color: T.mid, border: `1px solid ${T.rule}` },
    danger:    { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
    ghost:     { background: 'transparent', color: T.muted, border: 'none' },
  }
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}
      onMouseEnter={e => { if (!disabled && variant === 'primary') { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px rgba(45,125,58,0.38)` } }}
      onMouseLeave={e => { if (variant === 'primary') { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px rgba(45,125,58,0.28)` } }}
    >{children}</button>
  )
}

const Input = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && (
      <label style={{ fontSize: 11, fontWeight: 700, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', gap: 6, alignItems: 'center' }}>
        {label}{required && <span style={{ color: T.g500, fontSize: 10 }}>obrigatório</span>}
      </label>
    )}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
      height: 42, borderRadius: 10, border: `1px solid ${T.rule}`, padding: '0 14px',
      fontSize: 13, outline: 'none', background: T.white, color: T.ink,
      transition: 'border-color 0.18s, box-shadow 0.18s', width: '100%', boxSizing: 'border-box',
      fontFamily: 'inherit',
    }}
      onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(61,154,72,0.1)` }}
      onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
    />
  </div>
)

const Textarea = ({ label, value, onChange, placeholder = '', rows = 4 }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <label style={{ fontSize: 11, fontWeight: 700, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{
      borderRadius: 10, border: `1px solid ${T.rule}`, padding: '10px 14px',
      fontSize: 13, outline: 'none', background: T.white, color: T.ink,
      transition: 'border-color 0.18s, box-shadow 0.18s', width: '100%', boxSizing: 'border-box',
      resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
    }}
      onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(61,154,72,0.1)` }}
      onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
    />
  </div>
)

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active:     { bg: T.g50,     color: T.g600,    label: 'Activo' },
    inactive:   { bg: '#FFF7ED', color: T.gold,    label: 'Inactivo' },
    removed:    { bg: '#FEF2F2', color: '#DC2626',  label: 'Removido' },
    pending:    { bg: '#FFF7ED', color: T.gold,    label: 'Pendente' },
    accepted:   { bg: T.g50,     color: T.g600,    label: 'Aceite' },
    rejected:   { bg: '#FEF2F2', color: '#DC2626',  label: 'Rejeitado' },
    completed:  { bg: T.g50,     color: T.g600,    label: 'Concluído' },
    processing: { bg: '#EFF6FF', color: '#2563EB',  label: 'A processar' },
  }
  const s = map[status] || { bg: T.canvas, color: T.muted, label: status }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {s.label}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const Profile = () => {
  const { t } = useTranslation()
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('products')
  const [userProducts, setUserProducts] = useState<UserProduct[]>([])
  const [fichasRecebimento, setFichasRecebimento] = useState<FichaRecebimento[]>([])
  const [receivedOrders, setReceivedOrders] = useState<ReceivedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agentStats, setAgentStats] = useState<{ totalReferrals: number; totalPoints: number; recentReferrals: any[] } | null>(null)
  const [buyerStats, setBuyerStats] = useState<{ completedOrders: number; favoriteProducts: number }>({ completedOrders: 0, favoriteProducts: 0 })
  const [productStats, setProductStats] = useState<{ [productId: string]: { likes: number; comments: number } }>({})
  const [provinceName, setProvinceName] = useState('')
  const [municipalityName, setMunicipalityName] = useState('')
  const [profileData, setProfileData] = useState({
    full_name: userProfile?.full_name || '',
    phone: userProfile?.phone || '',
    email: userProfile?.email || user?.email || '',
    province_id: userProfile?.province_id || '',
    municipality_id: userProfile?.municipality_id || '',
  })

  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([])
  const [showSourcingForm, setShowSourcingForm] = useState(false)
  const [sourcingForm, setSourcingForm] = useState({ product_name: '', quantity: '', delivery_date: '', description: '' })
  const [submittingSourcing, setSubmittingSourcing] = useState(false)

  const fetchUserProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      const statsMap: { [productId: string]: { likes: number; comments: number } } = {}
      for (const product of (data || [])) {
        const { count: likesCount } = await supabase.from('product_likes').select('*', { count: 'exact', head: true }).eq('product_id', product.id)
        const { count: commentsCount } = await supabase.from('product_comments').select('*', { count: 'exact', head: true }).eq('product_id', product.id)
        statsMap[product.id] = { likes: likesCount || 0, comments: commentsCount || 0 }
      }
      setProductStats(statsMap)
      setUserProducts((data || []).map(p => ({ ...p, status: p.status as 'active' | 'inactive' | 'removed', views: statsMap[p.id]?.comments || 0, interests: statsMap[p.id]?.likes || 0 })))
    } catch (error) { console.error(error) }
  }

  const fetchFichasRecebimento = async () => {
    try {
      const { data, error } = await supabase.from('fichas_recebimento' as any).select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      setFichasRecebimento((data || []) as any)
    } catch (error) { console.error(error) }
  }

  const fetchAgentStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_agent_referral_stats', { agent_user_id: user?.id })
      if (error) throw error
      if (data && data.length > 0) {
        const s = data[0]
        setAgentStats({ totalReferrals: Number(s.total_referrals) || 0, totalPoints: Number(s.total_points) || 0, recentReferrals: Array.isArray(s.recent_referrals) ? s.recent_referrals : [] })
      }
    } catch (error) { console.error(error) }
  }

  const fetchReceivedOrders = async () => {
    try {
      const { data: userProductIds, error: prodError } = await supabase.from('products').select('id').eq('user_id', user?.id)
      if (prodError) throw prodError
      if (!userProductIds || userProductIds.length === 0) { setReceivedOrders([]); return }
      const productIds = userProductIds.map(p => p.id)
      const { data: orders, error: ordersError } = await supabase.from('pre_orders').select('id, product_id, user_id, quantity, location, status, created_at').in('product_id', productIds).order('created_at', { ascending: false })
      if (ordersError) throw ordersError
      const ordersWithDetails = await Promise.all((orders || []).map(async (order) => {
        const { data: product } = await supabase.from('products').select('product_type, price').eq('id', order.product_id).single()
        const { data: buyer } = await supabase.from('users').select('full_name, phone').eq('id', order.user_id).single()
        return { ...order, product: product || undefined, buyer: buyer || undefined } as ReceivedOrder
      }))
      setReceivedOrders(ordersWithDetails)
    } catch (error) { console.error(error) }
  }

  const fetchSourcingRequests = async () => {
    try {
      const { data, error } = await supabase.from('sourcing_requests').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      setSourcingRequests(data || [])
    } catch (error) { console.error(error) }
  }

  const fetchBuyerStats = async () => {
    try {
      const { count: completedCount } = await supabase.from('pre_orders').select('*', { count: 'exact', head: true }).eq('user_id', user?.id).in('status', ['completed', 'accepted'])
      const { count: likesCount } = await supabase.from('product_likes').select('*', { count: 'exact', head: true }).eq('user_id', user?.id)
      setBuyerStats({ completedOrders: completedCount || 0, favoriteProducts: likesCount || 0 })
    } catch (error) { console.error(error) }
  }

  const submitSourcingRequest = async () => {
    if (!user || !sourcingForm.product_name || !sourcingForm.quantity || !sourcingForm.delivery_date) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' }); return
    }
    setSubmittingSourcing(true)
    try {
      const { error } = await supabase.from('sourcing_requests').insert({ user_id: user.id, product_name: sourcingForm.product_name, quantity: parseFloat(sourcingForm.quantity), delivery_date: sourcingForm.delivery_date, description: sourcingForm.description || null })
      if (error) throw error
      await supabase.rpc('create_admin_notifications', { p_type: 'sourcing', p_title: 'Novo Pedido de Sourcing', p_message: `Comprador solicitou: ${sourcingForm.quantity}kg de ${sourcingForm.product_name}`, p_metadata: { user_id: user.id, product_name: sourcingForm.product_name } })
      toast({ title: t('sourcing.requestSent'), description: t('sourcing.requestSentMessage') })
      setSourcingForm({ product_name: '', quantity: '', delivery_date: '', description: '' })
      setShowSourcingForm(false)
      fetchSourcingRequests()
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao enviar pedido', variant: 'destructive' })
    } finally { setSubmittingSourcing(false) }
  }

  const shareAgentCode = async () => {
    const agentCode = (userProfile as any)?.agent_code; if (!agentCode) return
    const shareMessage = `${t('profile.shareMessage')}: ${agentCode}\n\nCadastrar: ${window.location.origin}/cadastro`
    if (navigator.share) { try { await navigator.share({ title: 'AgriLink - Código de Agente', text: shareMessage }) } catch { copyAgentCode() } } else { copyAgentCode() }
  }

  const copyAgentCode = () => {
    const agentCode = (userProfile as any)?.agent_code; if (!agentCode) return
    navigator.clipboard.writeText(agentCode)
    toast({ title: t('profile.codeCopied') })
  }

  useEffect(() => {
    if (!user) return
    if (userProfile?.user_type === 'comprador') { fetchFichasRecebimento(); fetchSourcingRequests(); fetchBuyerStats() }
    else { fetchUserProducts(); fetchReceivedOrders() }
    if (userProfile?.user_type === 'agente') fetchAgentStats()
    setLoading(false)
  }, [user, userProfile])

  useEffect(() => {
    if (userProfile) {
      setProfileData({ full_name: userProfile.full_name || '', phone: userProfile.phone || '', email: userProfile.email || user?.email || '', province_id: userProfile.province_id || '', municipality_id: userProfile.municipality_id || '' })
      setProvinceName(userProfile.province_id)
      setMunicipalityName(userProfile.municipality_id)
    }
  }, [userProfile, user])

  const updateProfile = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from('users').update({ ...profileData, updated_at: new Date().toISOString() }).eq('id', user.id)
      if (error) throw error
      toast({ title: 'Perfil actualizado com sucesso.' })
      setEditMode(false)
    } catch (error: any) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }) }
  }

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setAvatarLoading(true)
      const file = event.target.files?.[0]; if (!file) return
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}/avatar.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      await supabase.from('users').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', user?.id)
    } catch (error: any) { toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }) }
    finally { setAvatarLoading(false) }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Deseja remover este produto?')) return
    try {
      const { error } = await supabase.from('products').update({ status: 'removed' }).eq('id', productId)
      if (error) throw error
      setUserProducts(prev => prev.map(p => p.id === productId ? { ...p, status: 'removed' } : p))
    } catch (error) { console.error(error) }
  }

  const acceptOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from('pre_orders').update({ status: 'accepted' }).eq('id', orderId)
      if (error) throw error
      setReceivedOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'accepted' } : o))
      toast({ title: 'Pedido aceite.' })
    } catch { toast({ title: 'Erro ao aceitar pedido', variant: 'destructive' } as any) }
  }

  const rejectOrder = async (orderId: string) => {
    if (!confirm('Deseja rejeitar este pedido?')) return
    try {
      const { error } = await supabase.from('pre_orders').update({ status: 'rejected' }).eq('id', orderId)
      if (error) throw error
      setReceivedOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'rejected' } : o))
    } catch { console.error('Erro ao rejeitar') }
  }

  const contactBuyer = async (order: ReceivedOrder) => {
    if (!user || !order.user_id) return
    try {
      const { data: existingConv } = await supabase.from('conversations').select('id').or(`and(user_id.eq.${user.id},peer_user_id.eq.${order.user_id}),and(user_id.eq.${order.user_id},peer_user_id.eq.${user.id})`).limit(1)
      if (existingConv && existingConv.length > 0) { navigate(`/messages/${existingConv[0].id}`); return }
      const { data: newConv, error } = await supabase.from('conversations').insert({ user_id: user.id, peer_user_id: order.user_id, title: order.buyer?.full_name || 'Comprador', last_timestamp: new Date().toISOString() }).select('id').single()
      if (error) throw error
      navigate(`/messages/${newConv.id}`)
    } catch (error) { console.error(error) }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-AO')
  const activeProducts = userProducts.filter(p => p.status === 'active').length
  const totalComments = userProducts.reduce((s, p) => s + (productStats[p.id]?.comments || 0), 0)
  const totalLikes = userProducts.reduce((s, p) => s + (productStats[p.id]?.likes || 0), 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${T.gBorder}`, borderTopColor: T.g500, animation: 'spin 0.9s linear infinite' }}/>
        <p style={{ fontSize: 13, color: T.faint, fontWeight: 500 }}>{t('profile.loadingProfile')}</p>
      </div>
    </div>
  )

  /* ── TABS config ── */
  const isComprador = userProfile?.user_type === 'comprador'
  const isAgente = userProfile?.user_type === 'agente'
  const isAgricultor = userProfile?.user_type === 'agricultor'

  const tabs = [
    { id: 'products', label: isComprador ? t('profile.myFichas') : t('profile.myProducts'), icon: isComprador ? <ClipboardList size={15}/> : <Package size={15}/> },
    ...(isComprador ? [{ id: 'sourcing', label: t('profile.sourcing'), icon: <Search size={15}/> }] : []),
    ...(isAgricultor || isAgente ? [{ id: 'orders', label: t('profile.receivedOrders'), icon: <ShoppingCart size={15}/>, badge: receivedOrders.filter(o => o.status === 'pending').length }] : []),
    ...(isAgente ? [{ id: 'referrals', label: t('profile.myReferrals'), icon: <Users size={15}/> }] : []),
    { id: 'statistics', label: t('profile.statistics'), icon: <BarChart3 size={15}/> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 80 }}>

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(247,249,247,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${T.rule}`,
        boxShadow: `0 1px 0 ${T.rule}, 0 4px 20px rgba(13,43,18,0.04)`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>
              {t('profile.title')}
            </h1>
            <p style={{ fontSize: 11, color: T.faint, margin: 0, marginTop: 1, fontWeight: 500 }}>
              {userProfile?.user_type}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings size={14}/> <span className="hidden sm:inline">{t('profile.settings')}</span>
            </Btn>
            <Btn variant="danger" size="sm" onClick={() => logout()}>
              <LogOut size={14}/> <span className="hidden sm:inline">{t('common.logout') || 'Sair'}</span>
            </Btn>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px', display: 'grid', gridTemplateColumns: '1fr', gap: 24 }} className="lg:grid-cols-[320px_1fr]">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Profile Card */}
          <div style={{
            background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`,
            boxShadow: `0 1px 8px ${T.shadow}`, overflow: 'hidden',
            animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            {/* Dark top band */}
            <div style={{ height: 72, background: `linear-gradient(135deg, ${T.g900}, ${T.g700})`, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }}/>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', display: 'inline-block', marginTop: -36, marginBottom: 14 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  border: `3px solid ${T.white}`, boxShadow: `0 4px 16px ${T.shadowMd}`,
                  background: `linear-gradient(135deg, ${T.g600}, ${T.g400})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {userProfile?.avatar_url
                    ? <img src={userProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 700, color: T.white }}>{profileData.full_name.charAt(0) || 'U'}</span>
                  }
                </div>
                <label htmlFor="avatar-upload" style={{
                  position: 'absolute', bottom: 0, right: 0, width: 24, height: 24,
                  borderRadius: '50%', background: T.white, border: `1.5px solid ${T.gBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  boxShadow: `0 2px 8px ${T.shadow}`,
                }}>
                  {avatarLoading ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${T.g500}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}/> : <Camera size={11} color={T.g600}/>}
                </label>
                <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }}/>
              </div>

              {/* Name + type */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>
                    {profileData.full_name || 'Utilizador'}
                  </h2>
                  {(userProfile as any)?.verified && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.g50, border: `1.5px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BadgeCheck size={12} color={T.g600}/>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: T.g50, color: T.g600, border: `1px solid ${T.gBorder}`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {userProfile?.user_type}
                </span>
              </div>

              {/* Contact info / Edit form */}
              {!editMode ? (
                <>
                  <InfoRow icon={<Mail size={13} color={T.g500}/>} value={profileData.email} />
                  <InfoRow icon={<Phone size={13} color={T.g500}/>} value={profileData.phone} />
                  <InfoRow icon={<MapPin size={13} color={T.g500}/>} value={`${provinceName}${municipalityName ? ', ' + municipalityName : ''}`} />

                  {/* Agent code */}
                  {isAgente && (userProfile as any)?.agent_code && (
                    <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: T.g50, border: `1px solid ${T.gBorder}` }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t('profile.agentCode')}</p>
                      <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 700, color: T.g600, letterSpacing: '0.08em', margin: 0 }}>{(userProfile as any).agent_code}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Btn variant="secondary" onClick={() => setEditMode(true)} style={{ flex: 1 }}>
                      <Edit size={13}/> {t('profile.editProfile')}
                    </Btn>
                    {isAgente && (
                      <Btn variant="outline" size="sm" onClick={shareAgentCode}>
                        <Share2 size={13}/>
                      </Btn>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                  <Input label={t('profile.fullName')} value={profileData.full_name} onChange={(e: any) => setProfileData(p => ({ ...p, full_name: e.target.value }))} />
                  <Input label={t('profile.phone')} value={profileData.phone} onChange={(e: any) => setProfileData(p => ({ ...p, phone: e.target.value }))} />
                  <Input label={t('profile.email')} type="email" value={profileData.email} onChange={(e: any) => setProfileData(p => ({ ...p, email: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="primary" onClick={updateProfile} style={{ flex: 1 }}>{t('common.save')}</Btn>
                    <Btn variant="outline" onClick={() => setEditMode(false)} style={{ flex: 1 }}>{t('common.cancel')}</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) 0.08s both' }}
            className="lg:grid-cols-1"
          >
            {isAgente ? (
              <>
                <StatCard icon={<Users size={15} color={T.g500}/>} value={agentStats?.totalReferrals || 0} label={t('profile.usersReferred')} color={T.g600} />
                <StatCard icon={<Star size={15} color={T.goldL}/>} value={agentStats?.totalPoints || 0} label={t('profile.pointsEarned')} color={T.gold} />
              </>
            ) : isComprador ? (
              <>
                <StatCard icon={<ClipboardList size={15} color={T.g500}/>} value={fichasRecebimento.length} label={t('profile.fichasCreated')} color={T.g600} />
                <StatCard icon={<ShoppingCart size={15} color={T.g500}/>} value={buyerStats.completedOrders} label={t('profile.purchasesCompleted')} color={T.g600} />
                <StatCard icon={<Heart size={15} color={T.goldL}/>} value={buyerStats.favoriteProducts} label={t('profile.favoriteProducts')} color={T.gold} />
              </>
            ) : (
              <>
                <StatCard icon={<Package size={15} color={T.g500}/>} value={activeProducts} label={t('profile.activeProducts')} color={T.g600} />
                <StatCard icon={<MessageCircle size={15} color={T.g500}/>} value={totalComments} label={t('profile.comments')} color={T.g600} />
                <StatCard icon={<Heart size={15} color={T.goldL}/>} value={totalLikes} label={t('profile.likes')} color={T.gold} />
              </>
            )}
          </div>
        </div>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════ */}
        <div style={{ animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) 0.12s both' }}>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 4, padding: '6px', borderRadius: 14,
            background: T.white, border: `1px solid ${T.rule}`,
            boxShadow: `0 1px 6px ${T.shadow}`, marginBottom: 20,
            overflowX: 'auto',
          }}>
            {tabs.map(tab => (
              <TabBtn
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
                badge={(tab as any).badge}
              />
            ))}
          </div>

          {/* ── Products / Fichas ── */}
          {activeTab === 'products' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
              {isComprador ? (
                fichasRecebimento.length === 0 ? (
                  <EmptyState icon={<ClipboardList size={28} color={T.faint}/>} message={t('profile.noFichasCreated')} />
                ) : fichasRecebimento.map((ficha, i) => (
                  <ProductCardBlock key={ficha.id} delay={i * 0.04}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 700, color: T.ink, margin: 0 }}>{ficha.nomeFicha}</h3>
                        <StatusPill status="active" />
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <IconBtn icon={<Edit size={13}/>} title={t('profile.editFicha')} />
                        <IconBtn icon={<Bell size={13}/>} title={t('profile.notifications')} />
                        <IconBtn icon={<Trash2 size={13}/>} title={t('profile.removeFicha')} danger />
                      </div>
                    </div>
                    <MetaRow icon={<Package size={12}/>} label={ficha.produto} />
                    <MetaRow icon={<Star size={12}/>} label={ficha.qualidade} />
                    <MetaRow icon={<MapPin size={12}/>} label={`${ficha.locaisEntrega?.length || 0} locais`} />
                    <MetaRow icon={<Calendar size={12}/>} label={formatDate(ficha.created_at)} />
                  </ProductCardBlock>
                ))
              ) : (
                userProducts.length === 0 ? (
                  <EmptyState icon={<Package size={28} color={T.faint}/>} message={t('profile.noProductsPublished')} />
                ) : userProducts.map((product, i) => (
                  <ProductCardBlock key={product.id} delay={i * 0.04}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 700, color: T.ink, margin: '0 0 4px' }}>{product.product_type}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StatusPill status={product.status} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.g600 }}>{product.price.toLocaleString()} Kz/kg</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <IconBtn icon={<Edit size={13}/>} title={t('profile.editProduct')} />
                        <IconBtn icon={<Share2 size={13}/>} title={t('profile.promoteShare')} />
                        {product.status !== 'removed' && <IconBtn icon={<Trash2 size={13}/>} danger onClick={() => deleteProduct(product.id)} title={t('profile.removeProduct')} />}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <MetaRow icon={<Package size={11}/>} label={`${product.quantity.toLocaleString()} kg`} />
                      <MetaRow icon={<Calendar size={11}/>} label={formatDate(product.harvest_date)} />
                      <MetaRow icon={<MessageCircle size={11}/>} label={`${productStats[product.id]?.comments || 0} comentários`} />
                      <MetaRow icon={<Heart size={11}/>} label={`${productStats[product.id]?.likes || 0} likes`} />
                    </div>
                  </ProductCardBlock>
                ))
              )}
            </div>
          )}

          {/* ── Sourcing ── */}
          {activeTab === 'sourcing' && isComprador && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 700, color: T.ink, margin: 0 }}>{t('sourcing.title')}</h3>
                  <p style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{t('sourcing.subtitle')}</p>
                </div>
                <Btn variant="primary" size="sm" onClick={() => setShowSourcingForm(!showSourcingForm)}>
                  {showSourcingForm ? t('common.cancel') : t('sourcing.newRequest')}
                </Btn>
              </div>

              {showSourcingForm && (
                <div style={{ background: T.white, borderRadius: 16, border: `1px solid ${T.rule}`, padding: 20, boxShadow: `0 2px 12px ${T.shadow}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="sm:grid-cols-2">
                    <Input label={t('sourcing.productName')} value={sourcingForm.product_name} onChange={(e: any) => setSourcingForm(p => ({ ...p, product_name: e.target.value }))} placeholder={t('sourcing.productNamePlaceholder')} required />
                    <Input label={t('sourcing.quantity')} type="number" value={sourcingForm.quantity} onChange={(e: any) => setSourcingForm(p => ({ ...p, quantity: e.target.value }))} placeholder={t('sourcing.quantityPlaceholder')} required />
                  </div>
                  <Input label={t('sourcing.deliveryDate')} type="date" value={sourcingForm.delivery_date} onChange={(e: any) => setSourcingForm(p => ({ ...p, delivery_date: e.target.value }))} required />
                  <Textarea label={t('sourcing.description')} value={sourcingForm.description} onChange={(e: any) => setSourcingForm(p => ({ ...p, description: e.target.value }))} placeholder={t('sourcing.descriptionPlaceholder')} />
                  <Btn variant="primary" onClick={submitSourcingRequest} disabled={submittingSourcing} style={{ width: '100%' }}>
                    {submittingSourcing ? t('common.processing') : t('sourcing.submitRequest')}
                  </Btn>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sourcingRequests.length === 0 ? <EmptyState icon={<Search size={28} color={T.faint}/>} message={t('sourcing.noRequests')} /> : sourcingRequests.map((req, i) => (
                  <div key={req.id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: `fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s both` }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>{req.product_name} · {req.quantity}kg</p>
                      <p style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{t('sourcing.deliveryDate')}: {new Date(req.delivery_date).toLocaleDateString()}</p>
                    </div>
                    <StatusPill status={req.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Received Orders ── */}
          {activeTab === 'orders' && (isAgricultor || isAgente) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
              {receivedOrders.length === 0 ? (
                <EmptyState icon={<ShoppingCart size={28} color={T.faint}/>} message={t('profile.noOrdersReceived')} sub={t('profile.ordersWillAppear')} />
              ) : receivedOrders.map((order, i) => (
                <ProductCardBlock key={order.id} delay={i * 0.04}>
                  <div style={{ height: 3, borderRadius: 2, background: order.status === 'pending' ? T.goldL : order.status === 'accepted' ? T.g400 : '#EF4444', marginBottom: 14 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 700, color: T.ink, margin: '0 0 4px' }}>{order.product?.product_type || t('profile.product')}</h3>
                      <StatusPill status={order.status} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: T.g600, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{order.quantity.toLocaleString()} kg</p>
                      <p style={{ fontSize: 11, color: T.faint, margin: 0 }}>{((order.product?.price || 0) * order.quantity).toLocaleString()} Kz</p>
                    </div>
                  </div>
                  <MetaRow icon={<User size={11}/>} label={order.buyer?.full_name || 'Comprador'} />
                  <MetaRow icon={<Phone size={11}/>} label={order.buyer?.phone || t('profile.noPhone')} />
                  <MetaRow icon={<MapPin size={11}/>} label={order.location} />
                  <MetaRow icon={<Calendar size={11}/>} label={formatDate(order.created_at)} />
                  {order.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <Btn variant="primary" size="sm" onClick={() => acceptOrder(order.id)} style={{ flex: 1 }}>
                        <CheckCircle size={13}/> {t('profile.accept')}
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => rejectOrder(order.id)} style={{ flex: 1 }}>
                        <Trash2 size={13}/> {t('profile.reject')}
                      </Btn>
                      <Btn variant="outline" size="sm" onClick={() => contactBuyer(order)}>
                        <Phone size={13}/>
                      </Btn>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      <Btn variant="outline" size="sm" onClick={() => contactBuyer(order)} style={{ width: '100%' }}>
                        <Phone size={13}/> {t('profile.contact')}
                      </Btn>
                    </div>
                  )}
                </ProductCardBlock>
              ))}
            </div>
          )}

          {/* ── Referrals ── */}
          {activeTab === 'referrals' && isAgente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: T.g900, borderRadius: 16, padding: '20px', textAlign: 'center', boxShadow: `0 4px 20px ${T.shadowMd}` }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 700, color: T.white }}>{agentStats?.totalReferrals || 0}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{t('profile.usersReferred')}</div>
                </div>
                <div style={{ background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, borderRadius: 16, padding: '20px', textAlign: 'center', boxShadow: `0 4px 20px rgba(176,125,10,0.28)` }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 700, color: T.white }}>{agentStats?.totalPoints || 0}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{t('profile.pointsEarned')}</div>
                </div>
              </div>

              {!agentStats?.recentReferrals?.length ? (
                <EmptyState icon={<Users size={28} color={T.faint}/>} message={t('profile.noReferralsYet')} sub={t('profile.shareToEarnPoints')} />
              ) : agentStats.recentReferrals.map((referral: any, i: number) => (
                <div key={i} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: `fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s both`, boxShadow: `0 1px 4px ${T.shadow}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} color={T.g600}/>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>{referral.user_name}</p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                        <StatusPill status={referral.user_type} />
                        <span style={{ fontSize: 10, color: T.faint }}>{formatDate(referral.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={13} color={T.goldL} fill={T.goldL}/>
                    <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.gold }}>+{referral.points}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Statistics ── */}
          {activeTab === 'statistics' && (
            <div style={{ background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`, padding: 24, boxShadow: `0 1px 8px ${T.shadow}` }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.ink, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color={T.g500}/> {t('profile.performanceSummary')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {(isAgente ? [
                  { label: t('profile.totalReferrals'), val: agentStats?.totalReferrals || 0, color: T.g600 },
                  { label: t('profile.totalPoints'), val: agentStats?.totalPoints || 0, color: T.gold },
                ] : isComprador ? [
                  { label: t('profile.totalReceipts'), val: fichasRecebimento.length, color: T.g600 },
                  { label: t('profile.purchasesSimulation'), val: buyerStats.completedOrders, color: T.g600 },
                  { label: t('profile.favoritesSimulation'), val: buyerStats.favoriteProducts, color: T.gold },
                ] : [
                  { label: t('profile.totalProductsPublished'), val: userProducts.length, color: T.ink },
                  { label: t('profile.activeProducts'), val: activeProducts, color: T.g600 },
                  { label: t('profile.totalComments'), val: totalComments, color: T.g600 },
                  { label: t('profile.totalLikes'), val: totalLikes, color: T.gold },
                ]).map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < arr.length - 1 ? `1px solid ${T.rule}` : 'none' }}>
                    <span style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>{row.label}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 700, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{typeof row.val === 'number' ? row.val.toLocaleString() : row.val}</span>
                  </div>
                ))}
              </div>
              {isAgente && (
                <p style={{ fontSize: 11, color: T.faint, marginTop: 16, padding: '12px 14px', borderRadius: 10, background: T.g50, border: `1px solid ${T.gBorder}` }}>
                  {t('profile.eachUserWorth')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SETTINGS MODAL ═══════════════════════════════════════════════════ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent style={{ maxWidth: 420, borderRadius: 20, border: `1px solid ${T.rule}`, boxShadow: `0 24px 80px ${T.shadowMd}` }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={17} color={T.g600}/> {t('profile.settings')}
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '8px 0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Globe size={13} color={T.g500}/> {t('common.language') || 'Idioma'}
              </label>
              <Select value={i18n.language} onValueChange={(value) => { i18n.changeLanguage(value); localStorage.setItem('orbislink_language', value); toast({ title: t('common.success'), description: t('common.languageChanged') || 'Idioma alterado.' }) }}>
                <SelectTrigger style={{ borderRadius: 10, border: `1px solid ${T.rule}`, height: 42, fontSize: 13, fontFamily: 'inherit' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ borderRadius: 14, border: `1px solid ${T.rule}`, boxShadow: `0 12px 40px ${T.shadowMd}` }}>
                  {[{ val: 'pt', flag: '🇦🇴', label: 'Português' }, { val: 'en', flag: '🇬🇧', label: 'English' }, { val: 'fr', flag: '🇫🇷', label: 'Français' }].map(l => (
                    <SelectItem key={l.val} value={l.val} style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{l.flag}</span> {l.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Btn variant="outline" onClick={() => setSettingsOpen(false)}>{t('common.close')}</Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        @media (min-width: 1024px) {
          .lg\\:grid-cols-\\[320px_1fr\\] { grid-template-columns: 320px 1fr !important; }
          .lg\\:grid-cols-1 { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 640px) {
          .sm\\:grid-cols-2 { grid-template-columns: 1fr 1fr !important; }
          .sm\\:inline { display: inline !important; }
          .hidden { display: none; }
        }
      `}</style>
    </div>
  )
}

/* ─── Sub-layout helpers ─────────────────────────────────────────────────────── */
const ProductCardBlock = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <div style={{
    background: T.white, borderRadius: 16, border: `1px solid ${T.rule}`,
    padding: '18px', boxShadow: `0 1px 6px ${T.shadow}`,
    transition: 'transform 0.18s, box-shadow 0.18s',
    animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${T.shadowMd}` }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 6px ${T.shadow}` }}
  >{children}</div>
)

const MetaRow = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0' }}>
    <span style={{ color: T.faint, flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{label}</span>
  </div>
)

const IconBtn = ({ icon, title, danger = false, onClick }: { icon: React.ReactNode; title: string; danger?: boolean; onClick?: () => void }) => (
  <button title={title} onClick={onClick} style={{
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${danger ? '#FECACA' : T.rule}`,
    background: danger ? '#FEF2F2' : T.canvas, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: danger ? '#DC2626' : T.muted, transition: 'all 0.15s',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = danger ? '#EF4444' : T.g600; (e.currentTarget as HTMLElement).style.color = danger ? '#DC2626' : T.g600 }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = danger ? '#FECACA' : T.rule; (e.currentTarget as HTMLElement).style.color = danger ? '#DC2626' : T.muted }}
  >{icon}</button>
)

const EmptyState = ({ icon, message, sub }: { icon: React.ReactNode; message: string; sub?: string }) => (
  <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 20px', textAlign: 'center' }}>
    <div style={{ width: 60, height: 60, borderRadius: 16, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{icon}</div>
    <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 700, color: T.ink, margin: 0 }}>{message}</p>
    {sub && <p style={{ fontSize: 12, color: T.faint, marginTop: 6, maxWidth: 260, lineHeight: 1.6 }}>{sub}</p>}
  </div>
)

export default Profile