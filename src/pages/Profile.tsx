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

/* ─── Design tokens — B2B Modern / League Spartan ───────────────────────────── */
const T = {
  /* Greens — deeper, more corporate */
  g950:    '#061A09',
  g900:    '#0A2310',
  g800:    '#0F3318',
  g700:    '#165220',
  g600:    '#1E7A2E',
  g500:    '#28A745',
  g400:    '#3DBE5C',
  g200:    '#B6E8C0',
  g100:    '#E4F5E8',
  g50:     '#F0FAF2',
  gBorder: '#C4E2CA',

  /* Accent — slate-teal for B2B edge */
  accent:  '#0D7E6A',
  accentL: '#10A688',
  accentBg:'#E8F7F4',

  /* Neutrals — cool-shifted for professionalism */
  ink:     '#0C1311',
  slate:   '#243329',
  mid:     '#3A4D40',
  muted:   '#6B8070',
  faint:   '#9DB5A4',
  rule:    '#DDE8DF',
  canvas:  '#F4F7F5',
  surface: '#FAFCFA',
  white:   '#FFFFFF',

  /* Amber — reserved, only for gold/points */
  gold:    '#92660A',
  goldL:   '#C78B12',
  goldBg:  '#FDF6E3',

  /* Shadows */
  shadow:  'rgba(10,35,16,0.08)',
  shadowMd:'rgba(10,35,16,0.14)',
  shadowLg:'rgba(10,35,16,0.20)',
}

const FONT = "'League Spartan', 'Helvetica Neue', Arial, sans-serif"

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
interface AgentReferral {
  user_name: string; user_type: string; created_at: string; points: number
}
interface ProfileExtras {
  verified?: boolean; agent_code?: string | null; avatar_url?: string | null
}
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'accent'
interface BtnProps {
  children: React.ReactNode; onClick?: () => void; variant?: ButtonVariant
  disabled?: boolean; size?: 'sm' | 'md' | 'lg'; style?: React.CSSProperties
}
interface InputFieldProps {
  label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: React.HTMLInputTypeAttribute; placeholder?: string; required?: boolean
}
interface TextareaFieldProps {
  label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string; rows?: number
}
interface ProfileTab {
  id: string; label: string; icon: React.ReactNode; badge?: number
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  return 'Erro inesperado'
}

/* ─── Micro components ───────────────────────────────────────────────────────── */

const StatCard = ({ icon, value, label, color = T.g600, accent = false }:
  { icon: React.ReactNode; value: number | string; label: string; color?: string; accent?: boolean }) => (
  <div style={{
    background: accent ? `linear-gradient(135deg, ${T.g800}, ${T.g700})` : T.white,
    borderRadius: 12,
    padding: '20px 16px',
    border: accent ? 'none' : `1px solid ${T.rule}`,
    boxShadow: accent ? `0 8px 32px ${T.shadowMd}` : `0 1px 4px ${T.shadow}`,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
    transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'default',
    position: 'relative', overflow: 'hidden',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = accent ? `0 12px 40px ${T.shadowLg}` : `0 6px 24px ${T.shadowMd}` }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = accent ? `0 8px 32px ${T.shadowMd}` : `0 1px 4px ${T.shadow}` }}
  >
    {accent && <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}/>}
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: accent ? 'rgba(255,255,255,0.12)' : T.g50,
      border: accent ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${T.gBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {React.cloneElement(icon as React.ReactElement, { size: 14, color: accent ? T.white : T.g500 })}
    </div>
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ? T.white : color, letterSpacing: '-0.04em', fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: accent ? 'rgba(255,255,255,0.55)' : T.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{label}</div>
    </div>
  </div>
)

const InfoRow = ({ icon, value, label }: { icon: React.ReactNode; value: string; label?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${T.rule}` }}>
    <div style={{ width: 28, height: 28, borderRadius: 7, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {React.cloneElement(icon as React.ReactElement, { size: 12, color: T.g600 })}
    </div>
    <div>
      {label && <div style={{ fontSize: 9, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 1 }}>{label}</div>}
      <span style={{ fontSize: 13, color: T.slate, fontWeight: 500, letterSpacing: '-0.01em' }}>{value || '—'}</span>
    </div>
  </div>
)

const TabBtn = ({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? T.g700 : 'transparent',
    color: active ? T.white : T.muted,
    fontWeight: 700, fontSize: 12,
    fontFamily: FONT,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    transition: 'all 0.15s',
    position: 'relative', flexShrink: 0,
  }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = T.g50; if (!active) (e.currentTarget as HTMLElement).style.color = T.slate }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; if (!active) (e.currentTarget as HTMLElement).style.color = T.muted }}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 13 })}
    <span className="hidden sm:inline">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span style={{ position: 'absolute', top: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: '#EF4444', color: T.white, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
    )}
  </button>
)

const Btn = ({ children, onClick, variant = 'primary', disabled = false, size = 'md', style: extraStyle = {} }: BtnProps) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontFamily: FONT,
    fontSize: size === 'sm' ? 11 : 12,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    transition: 'all 0.15s', border: 'none',
    opacity: disabled ? 0.5 : 1,
    padding: size === 'sm' ? '7px 12px' : size === 'lg' ? '13px 26px' : '10px 18px',
    ...extraStyle,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: T.g700, color: T.white, boxShadow: `0 2px 8px rgba(22,82,32,0.30)` },
    secondary: { background: T.g50, color: T.g700, border: `1.5px solid ${T.gBorder}` },
    outline:   { background: 'transparent', color: T.mid, border: `1.5px solid ${T.rule}` },
    danger:    { background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' },
    ghost:     { background: 'transparent', color: T.muted },
    accent:    { background: T.accent, color: T.white, boxShadow: `0 2px 8px rgba(13,126,106,0.30)` },
  }
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}
      onMouseEnter={e => { if (!disabled) { if (variant === 'primary') { (e.currentTarget as HTMLElement).style.background = T.g600; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(22,82,32,0.40)` } if (variant === 'accent') { (e.currentTarget as HTMLElement).style.background = T.accentL } } }}
      onMouseLeave={e => { if (variant === 'primary') { (e.currentTarget as HTMLElement).style.background = T.g700; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px rgba(22,82,32,0.30)` } if (variant === 'accent') { (e.currentTarget as HTMLElement).style.background = T.accent } }}
    >{children}</button>
  )
}

const Input = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: InputFieldProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && (
      <label style={{ fontSize: 10, fontWeight: 700, color: T.mid, textTransform: 'uppercase', letterSpacing: '0.09em', display: 'flex', gap: 6, alignItems: 'center', fontFamily: FONT }}>
        {label}{required && <span style={{ color: T.g500, fontSize: 9, background: T.g50, padding: '1px 6px', borderRadius: 4, border: `1px solid ${T.gBorder}` }}>obrigatório</span>}
      </label>
    )}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
      height: 40, borderRadius: 8, border: `1.5px solid ${T.rule}`, padding: '0 12px',
      fontSize: 13, outline: 'none', background: T.white, color: T.ink,
      transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%', boxSizing: 'border-box',
      fontFamily: FONT, fontWeight: 500, letterSpacing: '-0.01em',
    }}
      onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(30,122,46,0.10)` }}
      onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
    />
  </div>
)

const Textarea = ({ label, value, onChange, placeholder = '', rows = 4 }: TextareaFieldProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <label style={{ fontSize: 10, fontWeight: 700, color: T.mid, textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: FONT }}>{label}</label>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{
      borderRadius: 8, border: `1.5px solid ${T.rule}`, padding: '10px 12px',
      fontSize: 13, outline: 'none', background: T.white, color: T.ink,
      transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%', boxSizing: 'border-box',
      resize: 'vertical', fontFamily: FONT, lineHeight: 1.6, fontWeight: 500,
    }}
      onFocus={e => { e.currentTarget.style.borderColor = T.g600; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(30,122,46,0.10)` }}
      onBlur={e => { e.currentTarget.style.borderColor = T.rule; e.currentTarget.style.boxShadow = 'none' }}
    />
  </div>
)

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string; label: string; dot: string }> = {
    active:     { bg: T.g50,     color: T.g700,    label: 'Activo',      dot: T.g500 },
    inactive:   { bg: T.goldBg,  color: T.gold,    label: 'Inactivo',    dot: T.goldL },
    removed:    { bg: '#FEF2F2', color: '#DC2626',  label: 'Removido',    dot: '#EF4444' },
    pending:    { bg: T.goldBg,  color: T.gold,    label: 'Pendente',    dot: T.goldL },
    accepted:   { bg: T.g50,     color: T.g700,    label: 'Aceite',      dot: T.g500 },
    rejected:   { bg: '#FEF2F2', color: '#DC2626',  label: 'Rejeitado',   dot: '#EF4444' },
    completed:  { bg: T.accentBg,color: T.accent,  label: 'Concluído',   dot: T.accentL },
    processing: { bg: '#EFF6FF', color: '#2563EB',  label: 'A processar', dot: '#60A5FA' },
  }
  const s = map[status] || { bg: T.canvas, color: T.muted, label: status, dot: T.faint }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>
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
  const profileExtras = userProfile as (typeof userProfile & ProfileExtras) | null

  const [activeTab, setActiveTab] = useState('products')
  const [userProducts, setUserProducts] = useState<UserProduct[]>([])
  const [fichasRecebimento, setFichasRecebimento] = useState<FichaRecebimento[]>([])
  const [receivedOrders, setReceivedOrders] = useState<ReceivedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agentStats, setAgentStats] = useState<{ totalReferrals: number; totalPoints: number; recentReferrals: AgentReferral[] } | null>(null)
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
      const { data, error } = await supabase.from('fichas_recebimento').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      setFichasRecebimento((data || []) as FichaRecebimento[])
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
    } catch (error: unknown) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' })
    } finally { setSubmittingSourcing(false) }
  }

  const shareAgentCode = async () => {
    const agentCode = profileExtras?.agent_code; if (!agentCode) return
    const shareMessage = `${t('profile.shareMessage')}: ${agentCode}\n\nCadastrar: ${window.location.origin}/cadastro`
    if (navigator.share) { try { await navigator.share({ title: 'AgriLink - Código de Agente', text: shareMessage }) } catch { copyAgentCode() } } else { copyAgentCode() }
  }

  const copyAgentCode = () => {
    const agentCode = profileExtras?.agent_code; if (!agentCode) return
    navigator.clipboard.writeText(agentCode)
    toast({ title: t('profile.codeCopied') })
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!user) return
    if (userProfile?.user_type === 'comprador') { fetchFichasRecebimento(); fetchSourcingRequests(); fetchBuyerStats() }
    else { fetchUserProducts(); fetchReceivedOrders() }
    if (userProfile?.user_type === 'agente') fetchAgentStats()
    setLoading(false)
  }, [user, userProfile])
  /* eslint-enable react-hooks/exhaustive-deps */

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
    } catch (error: unknown) { toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }) }
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
    } catch (error: unknown) { toast({ title: 'Erro no upload', description: getErrorMessage(error), variant: 'destructive' }) }
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
    } catch { toast({ title: 'Erro ao aceitar pedido', description: 'Não foi possível actualizar o pedido.', variant: 'destructive' }) }
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
    <div style={{ minHeight: '100vh', background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${T.gBorder}`, borderTopColor: T.g600, animation: 'spin 0.8s linear infinite' }}/>
        <p style={{ fontSize: 11, color: T.faint, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('profile.loadingProfile')}</p>
      </div>
    </div>
  )

  const isComprador = userProfile?.user_type === 'comprador'
  const isAgente = userProfile?.user_type === 'agente'
  const isAgricultor = userProfile?.user_type === 'agricultor'

  const tabs: ProfileTab[] = [
    { id: 'products', label: isComprador ? t('profile.myFichas') : t('profile.myProducts'), icon: isComprador ? <ClipboardList size={13}/> : <Package size={13}/> },
    ...(isComprador ? [{ id: 'sourcing', label: t('profile.sourcing'), icon: <Search size={13}/> }] : []),
    ...(isAgricultor || isAgente ? [{ id: 'orders', label: t('profile.receivedOrders'), icon: <ShoppingCart size={13}/>, badge: receivedOrders.filter(o => o.status === 'pending').length }] : []),
    ...(isAgente ? [{ id: 'referrals', label: t('profile.myReferrals'), icon: <Users size={13}/> }] : []),
    { id: 'statistics', label: t('profile.statistics'), icon: <BarChart3 size={13}/> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 80 }}>

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: T.g900,
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        boxShadow: `0 2px 20px ${T.shadowMd}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Brand mark */}
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.g600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color={T.white} />
            </div>
            <div>
              <h1 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.white, margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                {t('profile.title')}
              </h1>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {userProfile?.user_type}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSettingsOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FONT,
              letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.15s',
            }}>
              <Settings size={13}/> <span className="hidden sm:inline">{t('profile.settings')}</span>
            </button>
            <button onClick={() => logout()} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 7, border: '1px solid rgba(239,68,68,0.30)',
              background: 'rgba(239,68,68,0.10)', color: '#FCA5A5',
              cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: FONT,
              letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.15s',
            }}>
              <LogOut size={13}/> <span className="hidden sm:inline">{t('common.logout') || 'Sair'}</span>
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: '1fr', gap: 24 }} className="lg:grid-cols-[300px_1fr]">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Profile Card */}
          <div style={{
            background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`,
            boxShadow: `0 2px 12px ${T.shadow}`, overflow: 'hidden',
            animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            {/* Dark header band with grid texture */}
            <div style={{ height: 80, background: `linear-gradient(135deg, ${T.g950} 0%, ${T.g800} 100%)`, position: 'relative', overflow: 'hidden' }}>
              {/* Fine grid overlay */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.08,
                backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
                backgroundSize: '20px 20px'
              }}/>
              {/* Accent dot top-right */}
              <div style={{ position: 'absolute', top: 16, right: 16, width: 6, height: 6, borderRadius: '50%', background: T.g400, boxShadow: `0 0 10px ${T.g500}` }}/>
            </div>

            <div style={{ padding: '0 20px 22px' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', display: 'inline-block', marginTop: -32, marginBottom: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 12,
                  border: `3px solid ${T.white}`, boxShadow: `0 4px 16px ${T.shadowMd}`,
                  background: `linear-gradient(135deg, ${T.g700}, ${T.g500})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {userProfile?.avatar_url
                    ? <img src={userProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: T.white, letterSpacing: '-0.03em' }}>{profileData.full_name.charAt(0) || 'U'}</span>
                  }
                </div>
                <label htmlFor="avatar-upload" style={{
                  position: 'absolute', bottom: -4, right: -4, width: 22, height: 22,
                  borderRadius: 6, background: T.white, border: `1.5px solid ${T.rule}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  boxShadow: `0 2px 8px ${T.shadow}`,
                }}>
                  {avatarLoading
                    ? <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${T.g600}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}/>
                    : <Camera size={10} color={T.g600}/>
                  }
                </label>
                <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }}/>
              </div>

              {/* Name + type */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <h2 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.03em' }}>
                    {profileData.full_name || 'Utilizador'}
                  </h2>
                  {profileExtras?.verified && (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: T.accentBg, border: `1.5px solid ${T.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BadgeCheck size={11} color={T.accent}/>
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 6,
                  background: T.g900, color: T.g200,
                  textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: FONT,
                }}>
                  {userProfile?.user_type}
                </span>
              </div>

              {/* Contact info / Edit form */}
              {!editMode ? (
                <>
                  <InfoRow icon={<Mail size={12}/>} value={profileData.email} label="Email" />
                  <InfoRow icon={<Phone size={12}/>} value={profileData.phone} label="Telefone" />
                  <InfoRow icon={<MapPin size={12}/>} value={`${provinceName}${municipalityName ? ', ' + municipalityName : ''}`} label="Localização" />

                  {isAgente && profileExtras?.agent_code && (
                    <div style={{ marginTop: 14, padding: '14px', borderRadius: 10, background: T.g900, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: '16px 16px' }}/>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontFamily: FONT }}>{t('profile.agentCode')}</p>
                      <p style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.g200, letterSpacing: '0.12em', margin: 0 }}>{profileExtras.agent_code}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Btn variant="secondary" onClick={() => setEditMode(true)} style={{ flex: 1 }}>
                      <Edit size={12}/> {t('profile.editProfile')}
                    </Btn>
                    {isAgente && (
                      <Btn variant="outline" size="sm" onClick={shareAgentCode}>
                        <Share2 size={12}/>
                      </Btn>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                  <Input label={t('profile.fullName')} value={profileData.full_name} onChange={(e) => setProfileData(p => ({ ...p, full_name: e.target.value }))} />
                  <Input label={t('profile.phone')} value={profileData.phone} onChange={(e) => setProfileData(p => ({ ...p, phone: e.target.value }))} />
                  <Input label={t('profile.email')} type="email" value={profileData.email} onChange={(e) => setProfileData(p => ({ ...p, email: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="primary" onClick={updateProfile} style={{ flex: 1 }}>{t('common.save')}</Btn>
                    <Btn variant="outline" onClick={() => setEditMode(false)} style={{ flex: 1 }}>{t('common.cancel')}</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) 0.07s both' }}
            className="lg:grid-cols-1"
          >
            {isAgente ? (
              <>
                <StatCard icon={<Users size={14}/>} value={agentStats?.totalReferrals || 0} label={t('profile.usersReferred')} color={T.g700} accent />
                <StatCard icon={<Star size={14}/>} value={agentStats?.totalPoints || 0} label={t('profile.pointsEarned')} color={T.gold} />
              </>
            ) : isComprador ? (
              <>
                <StatCard icon={<ClipboardList size={14}/>} value={fichasRecebimento.length} label={t('profile.fichasCreated')} color={T.g700} accent />
                <StatCard icon={<ShoppingCart size={14}/>} value={buyerStats.completedOrders} label={t('profile.purchasesCompleted')} color={T.g700} />
                <StatCard icon={<Heart size={14}/>} value={buyerStats.favoriteProducts} label={t('profile.favoriteProducts')} color={T.gold} />
              </>
            ) : (
              <>
                <StatCard icon={<Package size={14}/>} value={activeProducts} label={t('profile.activeProducts')} color={T.g700} accent />
                <StatCard icon={<MessageCircle size={14}/>} value={totalComments} label={t('profile.comments')} color={T.g700} />
                <StatCard icon={<Heart size={14}/>} value={totalLikes} label={t('profile.likes')} color={T.gold} />
              </>
            )}
          </div>
        </div>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════ */}
        <div style={{ animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) 0.10s both' }}>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 3, padding: '5px',
            borderRadius: 10,
            background: T.white,
            border: `1px solid ${T.rule}`,
            boxShadow: `0 1px 4px ${T.shadow}`,
            marginBottom: 18, overflowX: 'auto',
          }}>
            {tabs.map(tab => (
              <TabBtn key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} label={tab.label} badge={tab.badge} />
            ))}
          </div>

          {/* ── Products / Fichas ── */}
          {activeTab === 'products' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
              {isComprador ? (
                fichasRecebimento.length === 0
                  ? <EmptyState icon={<ClipboardList size={24}/>} message={t('profile.noFichasCreated')} />
                  : fichasRecebimento.map((ficha, i) => (
                    <ProductCardBlock key={ficha.id} delay={i * 0.04}>
                      <CardTopBar>
                        <div>
                          <h3 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.ink, margin: '0 0 5px', letterSpacing: '-0.02em' }}>{ficha.nomeFicha}</h3>
                          <StatusPill status="active" />
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <IconBtn icon={<Edit size={12}/>} title={t('profile.editFicha')} />
                          <IconBtn icon={<Bell size={12}/>} title={t('profile.notifications')} />
                          <IconBtn icon={<Trash2 size={12}/>} title={t('profile.removeFicha')} danger />
                        </div>
                      </CardTopBar>
                      <Divider />
                      <MetaRow icon={<Package size={11}/>} label={ficha.produto} />
                      <MetaRow icon={<Star size={11}/>} label={ficha.qualidade} />
                      <MetaRow icon={<MapPin size={11}/>} label={`${ficha.locaisEntrega?.length || 0} locais de entrega`} />
                      <MetaRow icon={<Calendar size={11}/>} label={formatDate(ficha.created_at)} />
                    </ProductCardBlock>
                  ))
              ) : (
                userProducts.length === 0
                  ? <EmptyState icon={<Package size={24}/>} message={t('profile.noProductsPublished')} />
                  : userProducts.map((product, i) => (
                    <ProductCardBlock key={product.id} delay={i * 0.04}>
                      <CardTopBar>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.ink, margin: '0 0 5px', letterSpacing: '-0.02em' }}>{product.product_type}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <StatusPill status={product.status} />
                            <span style={{ fontSize: 12, fontWeight: 800, color: T.g700, fontFamily: FONT }}>{product.price.toLocaleString()} <span style={{ fontSize: 10, fontWeight: 600, color: T.faint }}>Kz/kg</span></span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <IconBtn icon={<Edit size={12}/>} title={t('profile.editProduct')} />
                          <IconBtn icon={<Share2 size={12}/>} title={t('profile.promoteShare')} />
                          {product.status !== 'removed' && <IconBtn icon={<Trash2 size={12}/>} danger onClick={() => deleteProduct(product.id)} title={t('profile.removeProduct')} />}
                        </div>
                      </CardTopBar>
                      <Divider />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
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
              <SectionHeader
                title={t('sourcing.title')}
                sub={t('sourcing.subtitle')}
                action={<Btn variant="primary" size="sm" onClick={() => setShowSourcingForm(!showSourcingForm)}>
                  {showSourcingForm ? t('common.cancel') : t('sourcing.newRequest')}
                </Btn>}
              />

              {showSourcingForm && (
                <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.rule}`, padding: 20, boxShadow: `0 2px 12px ${T.shadow}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="sm:grid-cols-2">
                    <Input label={t('sourcing.productName')} value={sourcingForm.product_name} onChange={(e) => setSourcingForm(p => ({ ...p, product_name: e.target.value }))} placeholder={t('sourcing.productNamePlaceholder')} required />
                    <Input label={t('sourcing.quantity')} type="number" value={sourcingForm.quantity} onChange={(e) => setSourcingForm(p => ({ ...p, quantity: e.target.value }))} placeholder={t('sourcing.quantityPlaceholder')} required />
                  </div>
                  <Input label={t('sourcing.deliveryDate')} type="date" value={sourcingForm.delivery_date} onChange={(e) => setSourcingForm(p => ({ ...p, delivery_date: e.target.value }))} required />
                  <Textarea label={t('sourcing.description')} value={sourcingForm.description} onChange={(e) => setSourcingForm(p => ({ ...p, description: e.target.value }))} placeholder={t('sourcing.descriptionPlaceholder')} />
                  <Btn variant="primary" onClick={submitSourcingRequest} disabled={submittingSourcing} style={{ width: '100%' }}>
                    {submittingSourcing ? t('common.processing') : t('sourcing.submitRequest')}
                  </Btn>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sourcingRequests.length === 0
                  ? <EmptyState icon={<Search size={24}/>} message={t('sourcing.noRequests')} />
                  : sourcingRequests.map((req, i) => (
                    <div key={req.id} style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.rule}`, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: `fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s both` }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0, fontFamily: FONT, letterSpacing: '-0.02em' }}>{req.product_name} <span style={{ color: T.faint, fontWeight: 600 }}>· {req.quantity}kg</span></p>
                        <p style={{ fontSize: 10, color: T.faint, marginTop: 3, fontFamily: FONT }}>{t('sourcing.deliveryDate')}: {new Date(req.delivery_date).toLocaleDateString()}</p>
                      </div>
                      <StatusPill status={req.status} />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Received Orders ── */}
          {activeTab === 'orders' && (isAgricultor || isAgente) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
              {receivedOrders.length === 0
                ? <EmptyState icon={<ShoppingCart size={24}/>} message={t('profile.noOrdersReceived')} sub={t('profile.ordersWillAppear')} />
                : receivedOrders.map((order, i) => (
                  <ProductCardBlock key={order.id} delay={i * 0.04}>
                    {/* Status accent bar */}
                    <div style={{ height: 2, borderRadius: 2, background: order.status === 'pending' ? T.goldL : order.status === 'accepted' ? T.g500 : '#EF4444', marginBottom: 14 }} />
                    <CardTopBar>
                      <div>
                        <h3 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.ink, margin: '0 0 5px', letterSpacing: '-0.02em' }}>{order.product?.product_type || t('profile.product')}</h3>
                        <StatusPill status={order.status} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 18, fontWeight: 800, color: T.g700, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: FONT, letterSpacing: '-0.03em' }}>{order.quantity.toLocaleString()} <span style={{ fontSize: 10, fontWeight: 600, color: T.faint }}>kg</span></p>
                        <p style={{ fontSize: 10, color: T.faint, margin: 0, fontFamily: FONT }}>{((order.product?.price || 0) * order.quantity).toLocaleString()} Kz</p>
                      </div>
                    </CardTopBar>
                    <Divider />
                    <MetaRow icon={<User size={11}/>} label={order.buyer?.full_name || 'Comprador'} />
                    <MetaRow icon={<Phone size={11}/>} label={order.buyer?.phone || t('profile.noPhone')} />
                    <MetaRow icon={<MapPin size={11}/>} label={order.location} />
                    <MetaRow icon={<Calendar size={11}/>} label={formatDate(order.created_at)} />
                    {order.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
                        <Btn variant="primary" size="sm" onClick={() => acceptOrder(order.id)} style={{ flex: 1 }}>
                          <CheckCircle size={12}/> {t('profile.accept')}
                        </Btn>
                        <Btn variant="danger" size="sm" onClick={() => rejectOrder(order.id)} style={{ flex: 1 }}>
                          <Trash2 size={12}/> {t('profile.reject')}
                        </Btn>
                        <Btn variant="outline" size="sm" onClick={() => contactBuyer(order)}>
                          <Phone size={12}/>
                        </Btn>
                      </div>
                    ) : (
                      <div style={{ marginTop: 14 }}>
                        <Btn variant="outline" size="sm" onClick={() => contactBuyer(order)} style={{ width: '100%' }}>
                          <Phone size={12}/> {t('profile.contact')}
                        </Btn>
                      </div>
                    )}
                  </ProductCardBlock>
                ))}
            </div>
          )}

          {/* ── Referrals ── */}
          {activeTab === 'referrals' && isAgente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: T.g900, borderRadius: 12, padding: '22px 18px', position: 'relative', overflow: 'hidden', boxShadow: `0 4px 20px ${T.shadowMd}` }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: '20px 20px' }}/>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8, fontFamily: FONT }}>{t('profile.usersReferred')}</div>
                  <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: T.white, letterSpacing: '-0.05em', lineHeight: 1 }}>{agentStats?.totalReferrals || 0}</div>
                </div>
                <div style={{ background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldL} 100%)`, borderRadius: 12, padding: '22px 18px', boxShadow: `0 4px 20px rgba(146,102,10,0.25)` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8, fontFamily: FONT }}>{t('profile.pointsEarned')}</div>
                  <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: T.white, letterSpacing: '-0.05em', lineHeight: 1 }}>{agentStats?.totalPoints || 0}</div>
                </div>
              </div>

              {!agentStats?.recentReferrals?.length
                ? <EmptyState icon={<Users size={24}/>} message={t('profile.noReferralsYet')} sub={t('profile.shareToEarnPoints')} />
                : agentStats.recentReferrals.map((referral, i) => (
                  <div key={i} style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.rule}`, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: `fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s both`, boxShadow: `0 1px 4px ${T.shadow}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={15} color={T.g600}/>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0, fontFamily: FONT, letterSpacing: '-0.02em' }}>{referral.user_name}</p>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                          <StatusPill status={referral.user_type} />
                          <span style={{ fontSize: 10, color: T.faint, fontFamily: FONT }}>{formatDate(referral.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={12} color={T.goldL} fill={T.goldL}/>
                      <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: T.gold, letterSpacing: '-0.03em' }}>+{referral.points}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ── Statistics ── */}
          {activeTab === 'statistics' && (
            <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.rule}`, overflow: 'hidden', boxShadow: `0 2px 12px ${T.shadow}` }}>
              {/* Section header */}
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.rule}`, display: 'flex', alignItems: 'center', gap: 10, background: T.surface }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.g900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={14} color={T.g200}/>
                </div>
                <div>
                  <h3 style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>{t('profile.performanceSummary')}</h3>
                  <p style={{ fontSize: 10, color: T.faint, margin: 0, fontFamily: FONT }}>Visão geral da conta</p>
                </div>
              </div>
              <div style={{ padding: '0 22px' }}>
                {(isAgente ? [
                  { label: t('profile.totalReferrals'), val: agentStats?.totalReferrals || 0, color: T.g700 },
                  { label: t('profile.totalPoints'), val: agentStats?.totalPoints || 0, color: T.gold },
                ] : isComprador ? [
                  { label: t('profile.totalReceipts'), val: fichasRecebimento.length, color: T.g700 },
                  { label: t('profile.purchasesSimulation'), val: buyerStats.completedOrders, color: T.g700 },
                  { label: t('profile.favoritesSimulation'), val: buyerStats.favoriteProducts, color: T.gold },
                ] : [
                  { label: t('profile.totalProductsPublished'), val: userProducts.length, color: T.ink },
                  { label: t('profile.activeProducts'), val: activeProducts, color: T.g700 },
                  { label: t('profile.totalComments'), val: totalComments, color: T.g700 },
                  { label: t('profile.totalLikes'), val: totalLikes, color: T.gold },
                ]).map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: i < arr.length - 1 ? `1px solid ${T.rule}` : 'none' }}>
                    <span style={{ fontSize: 12, color: T.muted, fontWeight: 600, fontFamily: FONT, letterSpacing: '-0.01em' }}>{row.label}</span>
                    <span style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: row.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>{typeof row.val === 'number' ? row.val.toLocaleString() : row.val}</span>
                  </div>
                ))}
              </div>
              {isAgente && (
                <div style={{ margin: '0 22px 22px', padding: '12px 14px', borderRadius: 8, background: T.g50, border: `1px solid ${T.gBorder}` }}>
                  <p style={{ fontSize: 11, color: T.g700, fontFamily: FONT, fontWeight: 600, margin: 0 }}>{t('profile.eachUserWorth')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SETTINGS MODAL ═══════════════════════════════════════════════════ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent style={{ maxWidth: 400, borderRadius: 14, border: `1px solid ${T.rule}`, boxShadow: `0 24px 80px ${T.shadowLg}` }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.ink, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              <Settings size={15} color={T.g600}/> {t('profile.settings')}
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '8px 0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.mid, textTransform: 'uppercase', letterSpacing: '0.09em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: FONT }}>
                <Globe size={12} color={T.g500}/> {t('common.language') || 'Idioma'}
              </label>
              <Select value={i18n.language} onValueChange={(value) => {
                i18n.changeLanguage(value)
                localStorage.setItem('orbislink_language', value)
                toast({ title: t('common.success'), description: t('common.languageChanged') || 'Idioma alterado.' })
              }}>
                <SelectTrigger style={{ borderRadius: 8, border: `1.5px solid ${T.rule}`, height: 40, fontSize: 13, fontFamily: FONT }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ borderRadius: 10, border: `1px solid ${T.rule}`, boxShadow: `0 12px 40px ${T.shadowMd}` }}>
                  {[{ val: 'pt', flag: '🇦🇴', label: 'Português' }, { val: 'en', flag: '🇬🇧', label: 'English' }, { val: 'fr', flag: '🇫🇷', label: 'Français' }].map(l => (
                    <SelectItem key={l.val} value={l.val} style={{ fontSize: 13, fontFamily: FONT }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{l.flag}</span> {l.label}
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
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.rule}; border-radius: 2px; }
        @media (min-width: 1024px) {
          .lg\\:grid-cols-\\[300px_1fr\\] { grid-template-columns: 300px 1fr !important; }
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
    background: T.white, borderRadius: 12, border: `1px solid ${T.rule}`,
    padding: '16px', boxShadow: `0 1px 4px ${T.shadow}`,
    transition: 'transform 0.15s, box-shadow 0.15s',
    animation: `fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${T.shadowMd}` }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 4px ${T.shadow}` }}
  >{children}</div>
)

const CardTopBar = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>{children}</div>
)

const Divider = () => <div style={{ height: 1, background: T.rule, margin: '0 0 10px' }}/>

const MetaRow = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
    <span style={{ color: T.faint, flexShrink: 0 }}>{React.cloneElement(icon as React.ReactElement, { color: T.faint })}</span>
    <span style={{ fontSize: 12, color: T.muted, fontWeight: 500, fontFamily: FONT, letterSpacing: '-0.01em' }}>{label}</span>
  </div>
)

const IconBtn = ({ icon, title, danger = false, onClick }: { icon: React.ReactNode; title: string; danger?: boolean; onClick?: () => void }) => (
  <button title={title} onClick={onClick} style={{
    width: 28, height: 28, borderRadius: 7,
    border: `1.5px solid ${danger ? '#FECACA' : T.rule}`,
    background: danger ? '#FEF2F2' : T.surface,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: danger ? '#DC2626' : T.faint, transition: 'all 0.13s',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = danger ? '#EF4444' : T.g600; (e.currentTarget as HTMLElement).style.color = danger ? '#DC2626' : T.g700; (e.currentTarget as HTMLElement).style.background = danger ? '#FEF2F2' : T.g50 }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = danger ? '#FECACA' : T.rule; (e.currentTarget as HTMLElement).style.color = danger ? '#DC2626' : T.faint; (e.currentTarget as HTMLElement).style.background = danger ? '#FEF2F2' : T.surface }}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 12 })}
  </button>
)

const EmptyState = ({ icon, message, sub }: { icon: React.ReactNode; message: string; sub?: string }) => (
  <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px', textAlign: 'center' }}>
    <div style={{ width: 52, height: 52, borderRadius: 12, background: T.g50, border: `1px solid ${T.gBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
      {React.cloneElement(icon as React.ReactElement, { color: T.faint })}
    </div>
    <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.02em' }}>{message}</p>
    {sub && <p style={{ fontSize: 12, color: T.faint, marginTop: 6, maxWidth: 260, lineHeight: 1.6, fontFamily: FONT }}>{sub}</p>}
  </div>
)

const SectionHeader = ({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12 }}>
    <div>
      <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>{title}</h3>
      {sub && <p style={{ fontSize: 11, color: T.faint, marginTop: 2, fontFamily: FONT }}>{sub}</p>}
    </div>
    {action}
  </div>
)

export default Profile