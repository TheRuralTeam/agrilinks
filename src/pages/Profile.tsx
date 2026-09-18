import React, { useState, useEffect } from "react"
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import {
  User, Edit, Package, MapPin, Phone, Mail, Calendar, BarChart3,
  Settings, LogOut, Trash2, Camera, CheckCircle, Share2, Star, Users,
  ClipboardList, Bell, ShoppingCart, Search, BadgeCheck, Globe,
  TrendingUp, MessageCircle, Heart, Sparkles
} from 'lucide-react'
import { FileSignature } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useGuestGate } from '../contexts/GuestGateContext'
import { GUEST_PROFILE, getGuestData, getGuestProfile } from '../lib/guestSession'
import { supabase } from '../integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { toast } from '../hooks/use-toast'
import { getProfileDisplayName, getProfileRoleLabel, resolveAvatarUrl } from '../lib/profileDisplay'
import { sanitizePublicProfile, isNeutralPublicView } from '../lib/publicData'

/* ─── Design tokens ──────────────────────────────────────────────────────────
   Mesma fonte de verdade da landing (../lib/brand). Os campos abaixo com
   fallback (??) são tokens que este ficheiro usa mas que não confirmei
   existirem em lib/brand.ts — se não existirem lá, o React estava a receber
   `undefined` nesses estilos e a cair no default do browser, o que é a causa
   mais provável do visual "apagado". Ideal: migrar estes fallbacks para
   lib/brand.ts para ficarem partilhados por toda a app. */
import { T as Brand } from '../lib/brand';
const T: any = {
  ...Brand,
  mid: (Brand as any).mid ?? Brand.ink,
  faint: (Brand as any).faint ?? Brand.muted,
  g50: (Brand as any).g50 ?? 'rgba(45,125,58,0.06)',
  g100: (Brand as any).g100 ?? 'rgba(45,125,58,0.12)',
  gBorder: (Brand as any).gBorder ?? Brand.rule,
  shadow: (Brand as any).shadow ?? 'rgba(17,23,20,0.05)',
};

// Cores por papel — as mesmas já usadas nos cartões de papéis da landing.
// Reaproveitadas aqui para dar identidade visual a cada tipo de conta em
// vez de tratar agricultor/agente/comprador/motorista todos da mesma cor.
const ROLE_ACCENT: Record<string, string> = {
  agricultor: '#2D7D3A',
  agente: '#C6871E',
  comprador: '#2563EB',
  motorista: '#DB6B1F',
}

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

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
  buyer?: { full_name: string; phone: string; email?: string }
}
interface SourcingRequest {
  id: string; product_name: string; quantity: number; delivery_date: string
  description: string | null; status: string; admin_notes: string | null; created_at: string
}

/* ════════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
   ════════════════════════════════════════════════════════════════════════════ */

/* Tira de estatísticas — números grandes lado a lado com divisórias finas,
   em vez de três caixas idênticas com sombra igual (o "kit SaaS" genérico). */
const StatsStrip = ({ items }: { items: { value: number | string; label: string; color: string }[] }) => (
  <div style={{
    background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`,
    display: 'flex', overflow: 'hidden',
  }}>
    {items.map((it, i) => (
      <div key={it.label} style={{
        flex: 1, padding: '18px 14px', textAlign: 'center',
        borderLeft: i > 0 ? `1px solid ${T.rule}` : 'none',
      }}>
        <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: it.color, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {it.value}
        </div>
        <div style={{ fontSize: 11, color: T.faint, fontWeight: 500, marginTop: 6 }}>{it.label}</div>
      </div>
    ))}
  </div>
)

const InfoRow = ({ icon, value }: { icon: React.ReactNode; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: `1px solid ${T.rule}` }}>
    <span style={{ color: T.faint, flexShrink: 0, display: 'flex' }}>{icon}</span>
    <span style={{ fontSize: 13.5, color: T.mid, fontWeight: 500, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</span>
  </div>
)

/* Tabs por sublinhado na cor do papel, em vez de pílula neutra genérica */
const TabBtn = ({ active, onClick, icon, label, badge, accent }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number; accent: string }) => (
  <button onClick={onClick} className="ag-tab" style={{
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 3px',
    border: 'none', borderBottom: `2px solid ${active ? accent : 'transparent'}`,
    background: 'transparent', cursor: 'pointer',
    color: active ? T.ink : T.muted,
    fontWeight: active ? 700 : 600,
    fontSize: 13.5, fontFamily: FONT, transition: `all 0.25s ${EASE}`,
    position: 'relative', flexShrink: 0, whiteSpace: 'nowrap',
  }}>
    {icon}
    <span className="hidden sm:inline">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 20, background: '#EF4444', color: T.white, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
    )}
  </button>
)

const Btn = ({ children, onClick, variant = 'primary', disabled = false, size = 'md', style: extraStyle = {} }: any) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700, transition: `all 0.25s ${EASE}`, border: 'none', fontFamily: FONT,
    opacity: disabled ? 0.5 : 1,
    padding: size === 'sm' ? '8px 14px' : size === 'lg' ? '13px 26px' : '10px 18px',
    fontSize: size === 'sm' ? 12 : 13,
    ...extraStyle,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: `linear-gradient(135deg, ${T.g500 ?? T.g600}, ${T.g700 ?? T.g900})`, color: T.white, boxShadow: `0 1px 4px rgba(45,125,58,0.18)` },
    secondary: { background: T.g50, color: T.g600 },
    outline:   { background: T.white, color: T.mid, border: `1px solid ${T.rule}` },
    danger:    { background: '#FEF2F2', color: '#DC2626' },
    ghost:     { background: 'transparent', color: T.muted, border: 'none' },
  }
  return (
    <button className="ag-btn" style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>
  )
}

const Input = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && (
      <label style={{ fontSize: 12, fontWeight: 700, color: T.ink, display: 'flex', gap: 6, alignItems: 'center', fontFamily: FONT }}>
        {label}{required && <span style={{ color: T.g500 ?? T.g600, fontSize: 11, fontWeight: 500 }}>obrigatório</span>}
      </label>
    )}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="ag-input" style={{
      height: 44, borderRadius: 12, border: `1px solid ${T.rule}`, padding: '0 14px',
      fontSize: 13.5, outline: 'none', background: T.canvas, color: T.ink,
      transition: `border-color 0.2s ${EASE}, box-shadow 0.2s ${EASE}, background 0.2s ${EASE}`, width: '100%', boxSizing: 'border-box',
      fontFamily: FONT,
    }} />
  </div>
)

const Textarea = ({ label, value, onChange, placeholder = '', rows = 4 }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: FONT }}>{label}</label>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} className="ag-input" style={{
      borderRadius: 12, border: `1px solid ${T.rule}`, padding: '11px 14px',
      fontSize: 13.5, outline: 'none', background: T.canvas, color: T.ink,
      transition: `border-color 0.2s ${EASE}, box-shadow 0.2s ${EASE}`, width: '100%', boxSizing: 'border-box',
      resize: 'vertical', fontFamily: FONT, lineHeight: 1.6,
    }} />
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
    <span style={{ padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, fontFamily: FONT, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

const IconBtn = ({ icon, title, danger = false, onClick }: { icon: React.ReactNode; title: string; danger?: boolean; onClick?: () => void }) => (
  <button title={title} onClick={onClick} className="ag-icon-btn" style={{
    width: 30, height: 30, borderRadius: 9, border: 'none',
    background: danger ? '#FEF2F2' : T.g50, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: danger ? '#DC2626' : T.muted, transition: `all 0.2s ${EASE}`,
  }}>{icon}</button>
)

const EmptyState = ({ icon, message, sub }: { icon: React.ReactNode; message: string; sub?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px', textAlign: 'center', background: T.white, borderRadius: 20, border: `1px dashed ${T.rule}` }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{icon}</div>
    <p style={{ fontFamily: FONT, fontSize: 15.5, fontWeight: 700, color: T.ink, margin: 0 }}>{message}</p>
    {sub && <p style={{ fontSize: 12, color: T.faint, marginTop: 6, maxWidth: 260, lineHeight: 1.6 }}>{sub}</p>}
  </div>
)

/* ── Responsive data table: real table on desktop, stacked cards on mobile ── */
interface RCol<T> { key: string; label: string; align?: 'left' | 'right' | 'center'; width?: string; render: (row: T) => React.ReactNode }
function RTable<T>({ columns, rows, keyField, actions, empty, accent }: {
  columns: RCol<T>[]; rows: T[]; keyField: (r: T, i: number) => string
  actions?: (r: T) => React.ReactNode; empty: React.ReactNode; accent?: (r: T) => string | undefined
}) {
  if (!rows.length) return <>{empty}</>
  return (
    <div className="ag-table-wrap" style={{ background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`, overflow: 'hidden' }}>
      <table className="ag-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 4, padding: 0 }} />
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }}>{c.label}</th>
            ))}
            {actions && <th style={{ textAlign: 'right' }}>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyField(row, i)} style={{ animationDelay: `${i * 0.03}s` }}>
              <td className="ag-accent-cell" style={{ background: accent?.(row) || 'transparent' }} />
              {columns.map(c => (
                <td key={c.key} data-label={c.label} style={{ textAlign: c.align || 'left' }}>{c.render(row)}</td>
              ))}
              {actions && <td data-label="Ações" style={{ textAlign: 'right' }}><div className="ag-row-actions">{actions(row)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* Wrappers já tipados — evita usar `<RTable<Tipo> ...>` diretamente no JSX,
   que quebra com o plugin de tagging do Lovable (data-lov-*). */
const FichaTable = RTable<FichaRecebimento>
const ProductTable = RTable<UserProduct>
const SourcingTable = RTable<SourcingRequest>
const OrdersTable = RTable<ReceivedOrder>
const ReferralsTable = RTable<any>

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const Profile = () => {
  const { t } = useTranslation()
  const { user, userProfile: realProfile, logout } = useAuth()
  const { isGuest } = useGuestGate()
  const userProfile: any = React.useMemo(
    () => realProfile || (isGuest ? { ...GUEST_PROFILE, ...getGuestProfile() } : null),
    [realProfile, isGuest]
  )
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

  const publicProfile = isNeutralPublicView(user) ? sanitizePublicProfile(userProfile || profileData) : userProfile || profileData
  const profileDisplayName = getProfileDisplayName((publicProfile as any) || profileData)
  const profileRoleLabel = getProfileRoleLabel((publicProfile as any)?.user_type || userProfile?.user_type)
  const profileAvatarUrl = resolveAvatarUrl((publicProfile as any)?.avatar_url || userProfile?.avatar_url)
  const roleAccent = ROLE_ACCENT[userProfile?.user_type as string] || T.g600
  const memberCode = (userProfile as any)?.agent_code || (user?.id ? user.id.slice(0, 8).toUpperCase() : '—')

  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([])
  const [showSourcingForm, setShowSourcingForm] = useState(false)
  const [sourcingForm, setSourcingForm] = useState({ product_name: '', quantity: '', delivery_date: '', description: '' })
  const [submittingSourcing, setSubmittingSourcing] = useState(false)

  const fetchUserProducts = React.useCallback(async () => {
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
  }, [user?.id])

  const fetchFichasRecebimento = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('fichas_recebimento' as any).select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      setFichasRecebimento((data || []) as any)
    } catch (error) { console.error(error) }
  }, [user?.id])

  const fetchAgentStats = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_agent_referral_stats', { agent_user_id: user?.id })
      if (error) throw error
      if (data && data.length > 0) {
        const s = data[0]
        setAgentStats({ totalReferrals: Number(s.total_referrals) || 0, totalPoints: Number(s.total_points) || 0, recentReferrals: Array.isArray(s.recent_referrals) ? s.recent_referrals : [] })
      }
    } catch (error) { console.error(error) }
  }, [user?.id])

  const fetchReceivedOrders = React.useCallback(async () => {
    try {
      const { data: userProductIds, error: prodError } = await supabase.from('products').select('id').eq('user_id', user?.id)
      if (prodError) throw prodError
      if (!userProductIds || userProductIds.length === 0) { setReceivedOrders([]); return }
      const productIds = userProductIds.map(p => p.id)
      const { data: orders, error: ordersError } = await supabase.from('pre_orders').select('id, product_id, user_id, quantity, location, status, created_at').in('product_id', productIds).order('created_at', { ascending: false })
      if (ordersError) throw ordersError
      const ordersWithDetails = await Promise.all((orders || []).map(async (order) => {
        const { data: product } = await supabase.from('products').select('product_type, price').eq('id', order.product_id).single()
        const { data: buyer } = await supabase.from('users').select('full_name, phone, email').eq('id', order.user_id).single()
        return { ...order, product: product || undefined, buyer: buyer || undefined } as ReceivedOrder
      }))
      setReceivedOrders(ordersWithDetails)
    } catch (error) { console.error(error) }
  }, [user?.id])

  const fetchSourcingRequests = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('sourcing_requests').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      setSourcingRequests(data || [])
    } catch (error) { console.error(error) }
  }, [user?.id])

  const fetchBuyerStats = React.useCallback(async () => {
    try {
      const { count: completedCount } = await supabase.from('pre_orders').select('*', { count: 'exact', head: true }).eq('user_id', user?.id).in('status', ['completed', 'accepted'])
      const { count: likesCount } = await supabase.from('product_likes').select('*', { count: 'exact', head: true }).eq('user_id', user?.id)
      setBuyerStats({ completedOrders: completedCount || 0, favoriteProducts: likesCount || 0 })
    } catch (error) { console.error(error) }
  }, [user?.id])

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
    if (!user) {
      if (isGuest) {
        setUserProducts(getGuestData<any[]>('products', []))
        setFichasRecebimento(getGuestData<any[]>('fichas', []))
      }
      setLoading(false)
      return
    }
    if (userProfile?.user_type === 'comprador') { fetchFichasRecebimento(); fetchSourcingRequests(); fetchBuyerStats() }
    else { fetchUserProducts(); fetchReceivedOrders() }
    if (userProfile?.user_type === 'agente') fetchAgentStats()
    setLoading(false)
  }, [user, userProfile, isGuest, fetchAgentStats, fetchBuyerStats, fetchFichasRecebimento, fetchReceivedOrders, fetchSourcingRequests, fetchUserProducts])

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
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2.5px solid ${T.gBorder}`, borderTopColor: T.g500 ?? T.g600, animation: 'ag-spin 0.8s linear infinite' }}/>
        <p style={{ fontSize: 13, color: T.faint, fontWeight: 500, fontFamily: FONT }}>{t('profile.loadingProfile')}</p>
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

  const statItems = isAgente
    ? [
        { value: agentStats?.totalReferrals || 0, label: t('profile.usersReferred'), color: T.g600 },
        { value: agentStats?.totalPoints || 0, label: t('profile.pointsEarned'), color: T.gold },
      ]
    : isComprador
    ? [
        { value: fichasRecebimento.length, label: t('profile.fichasCreated'), color: T.g600 },
        { value: buyerStats.completedOrders, label: t('profile.purchasesCompleted'), color: T.g600 },
        { value: buyerStats.favoriteProducts, label: t('profile.favoriteProducts'), color: T.gold },
      ]
    : [
        { value: activeProducts, label: t('profile.activeProducts'), color: T.g600 },
        { value: totalComments, label: t('profile.comments'), color: T.g600 },
        { value: totalLikes, label: t('profile.likes'), color: T.gold },
      ]

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, fontFamily: FONT, paddingBottom: 80, WebkitFontSmoothing: 'antialiased' }}>

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(247,249,247,0.72)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${T.rule}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>
            {t('profile.title')}
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="outline" size="sm" onClick={() => navigate('/contratos')}>
              <FileSignature size={14}/> <span className="hidden sm:inline">Contratos</span>
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings size={14}/> <span className="hidden sm:inline">{t('profile.settings')}</span>
            </Btn>
            <Btn variant="danger" size="sm" onClick={() => logout()}>
              <LogOut size={14}/> <span className="hidden sm:inline">{t('common.logout') || 'Sair'}</span>
            </Btn>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px', display: 'grid', gridTemplateColumns: '1fr', gap: 22 }} className="ag-layout">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Cartão de membro: friso lateral na cor do papel + código no
               rodapé, como um crachá real da rede AgriLink. Substitui o
               banner fino + avatar flutuante genérico. ── */}
          <div style={{
            display: 'flex', background: T.white, borderRadius: 22, border: `1px solid ${T.rule}`,
            overflow: 'hidden', animation: `ag-fade-up 0.5s ${EASE} both`,
          }}>
            <div style={{ width: 6, background: roleAccent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ padding: '22px 22px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    border: `2px solid ${roleAccent}33`,
                    background: `linear-gradient(135deg, ${roleAccent}, ${T.g400})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {profileAvatarUrl
                      ? <img src={profileAvatarUrl} alt={profileDisplayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      : <span style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: T.white }}>{profileDisplayName.charAt(0).toUpperCase() || 'U'}</span>
                    }
                  </div>
                  <label htmlFor="avatar-upload" className="ag-avatar-edit" style={{
                    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
                    borderRadius: '50%', background: T.white, border: `1px solid ${T.rule}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: `transform 0.2s ${EASE}`,
                  }}>
                    {avatarLoading ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${roleAccent}`, borderTopColor: 'transparent', animation: 'ag-spin 0.8s linear infinite' }}/> : <Camera size={10} color={roleAccent} strokeWidth={1.75}/>}
                  </label>
                  <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }}/>
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h2 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profileDisplayName}
                    </h2>
                    {(userProfile as any)?.verified && <BadgeCheck size={16} color={roleAccent} strokeWidth={2}/>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleAccent, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>{userProfile?.user_type}</span>
                  </div>
                </div>
              </div>

              {!editMode ? (
                <div style={{ padding: '0 22px 18px' }}>
                  <InfoRow icon={<Mail size={14} strokeWidth={1.6}/>} value={profileData.email} />
                  <InfoRow icon={<Phone size={14} strokeWidth={1.6}/>} value={profileData.phone} />
                  <InfoRow icon={<MapPin size={14} strokeWidth={1.6}/>} value={`${provinceName}${municipalityName ? ', ' + municipalityName : ''}`} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Btn variant="secondary" onClick={() => setEditMode(true)} style={{ flex: 1 }}>
                      <Edit size={13} strokeWidth={1.75}/> {t('profile.editProfile')}
                    </Btn>
                    {isAgente && (
                      <Btn variant="outline" size="sm" onClick={shareAgentCode}>
                        <Share2 size={13} strokeWidth={1.75}/>
                      </Btn>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Input label={t('profile.fullName')} value={profileData.full_name} onChange={(e: any) => setProfileData(p => ({ ...p, full_name: e.target.value }))} />
                  <Input label={t('profile.phone')} value={profileData.phone} onChange={(e: any) => setProfileData(p => ({ ...p, phone: e.target.value }))} />
                  <Input label={t('profile.email')} type="email" value={profileData.email} onChange={(e: any) => setProfileData(p => ({ ...p, email: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="primary" onClick={updateProfile} style={{ flex: 1 }}>{t('common.save')}</Btn>
                    <Btn variant="outline" onClick={() => setEditMode(false)} style={{ flex: 1 }}>{t('common.cancel')}</Btn>
                  </div>
                </div>
              )}

              {/* Talão do cartão — código de membro, separado por borda tracejada */}
              <div style={{
                borderTop: `1px dashed ${T.rule}`, padding: '11px 22px',
                background: T.canvas, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 10.5, color: T.faint, fontWeight: 600 }}>Rede AgriLink</span>
                <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5, color: T.mid, fontWeight: 700, letterSpacing: '0.04em' }}>
                  #{memberCode}
                </span>
              </div>
            </div>
          </div>

          <div style={{ animation: `ag-fade-up 0.5s ${EASE} 0.06s both` }}>
            <StatsStrip items={statItems} />
          </div>

          {isAgente && (userProfile as any)?.agent_code && (
            <div style={{ padding: '14px 16px', borderRadius: 16, background: `${roleAccent}14`, animation: `ag-fade-up 0.5s ${EASE} 0.1s both` }}>
              <p style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, margin: 0 }}>{t('profile.agentCode')}</p>
              <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 20, fontWeight: 800, color: roleAccent, letterSpacing: '0.05em', margin: '2px 0 0' }}>{(userProfile as any).agent_code}</p>
            </div>
          )}
        </div>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════ */}
        <div style={{ animation: `ag-fade-up 0.5s ${EASE} 0.1s both`, minWidth: 0 }}>

          {/* Tabs por sublinhado */}
          <div style={{ display: 'flex', gap: 22, borderBottom: `1px solid ${T.rule}`, marginBottom: 20, overflowX: 'auto' }}>
            {tabs.map(tab => (
              <TabBtn
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
                badge={(tab as any).badge}
                accent={roleAccent}
              />
            ))}
          </div>

          <div key={activeTab} style={{ animation: `ag-fade-up 0.35s ${EASE} both` }}>

          {/* ── Products / Fichas ── */}
          {activeTab === 'products' && (
            isComprador ? (
              <FichaTable
                columns={[
                  { key: 'nome', label: 'Ficha', render: r => <span style={{ fontWeight: 700, color: T.ink }}>{r.nomeFicha}</span> },
                  { key: 'produto', label: 'Produto', render: r => r.produto },
                  { key: 'qualidade', label: 'Qualidade', render: r => r.qualidade },
                  { key: 'locais', label: 'Locais', align: 'center', render: r => `${r.locaisEntrega?.length || 0}` },
                  { key: 'data', label: 'Criado em', render: r => formatDate(r.created_at) },
                ]}
                rows={fichasRecebimento}
                keyField={r => r.id}
                actions={() => (
                  <>
                    <IconBtn icon={<Edit size={13} strokeWidth={1.75}/>} title={t('profile.editFicha')} />
                    <IconBtn icon={<Bell size={13} strokeWidth={1.75}/>} title={t('profile.notifications')} />
                    <IconBtn icon={<Trash2 size={13} strokeWidth={1.75}/>} title={t('profile.removeFicha')} danger />
                  </>
                )}
                empty={<EmptyState icon={<ClipboardList size={26} color={T.faint}/>} message={t('profile.noFichasCreated')} />}
              />
            ) : (
              <ProductTable
                columns={[
                  { key: 'produto', label: 'Produto', render: r => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontWeight: 700, color: T.ink }}>{r.product_type}</span>
                      <StatusPill status={r.status} />
                    </div>
                  ) },
                  { key: 'qtd', label: 'Quantidade', render: r => `${r.quantity.toLocaleString()} kg` },
                  { key: 'colheita', label: 'Colheita', render: r => formatDate(r.harvest_date) },
                  { key: 'preco', label: 'Preço', align: 'right', render: r => <span style={{ fontWeight: 800, color: T.g600 }}>{r.price.toLocaleString()} Kz/kg</span> },
                  { key: 'interacoes', label: 'Interações', align: 'center', render: r => (
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', color: T.faint, fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={12} strokeWidth={1.75}/>{productStats[r.id]?.comments || 0}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={12} strokeWidth={1.75}/>{productStats[r.id]?.likes || 0}</span>
                    </div>
                  ) },
                ]}
                rows={userProducts}
                keyField={r => r.id}
                accent={r => r.status === 'active' ? T.g500 ?? T.g600 : r.status === 'inactive' ? T.goldL : '#EF4444'}
                actions={r => (
                  <>
                    <IconBtn icon={<Edit size={13} strokeWidth={1.75}/>} title={t('profile.editProduct')} />
                    <IconBtn icon={<Share2 size={13} strokeWidth={1.75}/>} title={t('profile.promoteShare')} />
                    {r.status !== 'removed' && <IconBtn icon={<Trash2 size={13} strokeWidth={1.75}/>} danger onClick={() => deleteProduct(r.id)} title={t('profile.removeProduct')} />}
                  </>
                )}
                empty={<EmptyState icon={<Package size={26} color={T.faint}/>} message={t('profile.noProductsPublished')} />}
              />
            )
          )}

          {/* ── Sourcing ── */}
          {activeTab === 'sourcing' && isComprador && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: T.ink, margin: 0 }}>{t('sourcing.title')}</h3>
                  <p style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{t('sourcing.subtitle')}</p>
                </div>
                <Btn variant="primary" size="sm" onClick={() => setShowSourcingForm(!showSourcingForm)}>
                  {showSourcingForm ? t('common.cancel') : t('sourcing.newRequest')}
                </Btn>
              </div>

              {showSourcingForm && (
                <div style={{ background: T.white, borderRadius: 20, border: `1px solid ${T.rule}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, animation: `ag-fade-up 0.3s ${EASE} both` }}>
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

              <SourcingTable
                columns={[
                  { key: 'produto', label: 'Produto', render: r => <span style={{ fontWeight: 700, color: T.ink }}>{r.product_name}</span> },
                  { key: 'qtd', label: 'Quantidade', render: r => `${r.quantity} kg` },
                  { key: 'data', label: t('sourcing.deliveryDate'), render: r => new Date(r.delivery_date).toLocaleDateString() },
                  { key: 'estado', label: 'Estado', align: 'right', render: r => <StatusPill status={r.status} /> },
                ]}
                rows={sourcingRequests}
                keyField={r => r.id}
                empty={<EmptyState icon={<Search size={26} color={T.faint}/>} message={t('sourcing.noRequests')} />}
              />
            </div>
          )}

          {/* ── Received Orders ── */}
          {activeTab === 'orders' && (isAgricultor || isAgente) && (
            <OrdersTable
              columns={[
                { key: 'produto', label: 'Produto', render: r => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontWeight: 700, color: T.ink }}>{r.product?.product_type || t('profile.product')}</span>
                    <StatusPill status={r.status} />
                  </div>
                ) },
                { key: 'comprador', label: t('profile.product') === 'Product' ? 'Buyer' : 'Comprador', render: r => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{r.buyer?.full_name || 'Comprador'}</span>
                    <span style={{ fontSize: 11.5, color: T.faint }}>{r.buyer?.phone || t('profile.noPhone')}</span>
                  </div>
                ) },
                { key: 'local', label: 'Localização', render: r => r.location },
                { key: 'qtd', label: 'Quantidade', align: 'right', render: r => <span style={{ fontWeight: 700, color: T.g600 }}>{r.quantity.toLocaleString()} kg</span> },
                { key: 'valor', label: 'Valor', align: 'right', render: r => `${((r.product?.price || 0) * r.quantity).toLocaleString()} Kz` },
                { key: 'data', label: 'Data', render: r => formatDate(r.created_at) },
              ]}
              rows={receivedOrders}
              keyField={r => r.id}
              accent={r => r.status === 'pending' ? T.goldL : r.status === 'accepted' ? T.g400 : '#EF4444'}
              actions={r => r.status === 'pending' ? (
                <>
                  <IconBtn icon={<CheckCircle size={13} strokeWidth={1.75}/>} title={t('profile.accept')} onClick={() => acceptOrder(r.id)} />
                  <IconBtn icon={<Trash2 size={13} strokeWidth={1.75}/>} title={t('profile.reject')} danger onClick={() => rejectOrder(r.id)} />
                  <IconBtn icon={<Phone size={13} strokeWidth={1.75}/>} title={t('profile.contact')} onClick={() => contactBuyer(r)} />
                </>
              ) : (
                <IconBtn icon={<Phone size={13} strokeWidth={1.75}/>} title={t('profile.contact')} onClick={() => contactBuyer(r)} />
              )}
              empty={<EmptyState icon={<ShoppingCart size={26} color={T.faint}/>} message={t('profile.noOrdersReceived')} sub={t('profile.ordersWillAppear')} />}
            />
          )}

          {/* ── Referrals ── */}
          {activeTab === 'referrals' && isAgente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatsStrip items={[
                { value: agentStats?.totalReferrals || 0, label: t('profile.usersReferred'), color: roleAccent },
                { value: agentStats?.totalPoints || 0, label: t('profile.pointsEarned'), color: T.gold },
              ]} />

              <ReferralsTable
                columns={[
                  { key: 'user', label: 'Utilizador', render: r => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.g50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={13} color={T.g600} strokeWidth={1.75}/>
                      </div>
                      <span style={{ fontWeight: 700, color: T.ink }}>{r.user_name}</span>
                    </div>
                  ) },
                  { key: 'tipo', label: 'Tipo', render: r => <StatusPill status={r.user_type} /> },
                  { key: 'data', label: 'Data', render: r => formatDate(r.created_at) },
                  { key: 'pontos', label: 'Pontos', align: 'right', render: r => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, color: T.gold }}>
                      <Star size={12} color={T.goldL} fill={T.goldL} strokeWidth={1.75}/> +{r.points}
                    </span>
                  ) },
                ]}
                rows={agentStats?.recentReferrals || []}
                keyField={(r, i) => `${r.user_name}-${i}`}
                empty={<EmptyState icon={<Users size={26} color={T.faint}/>} message={t('profile.noReferralsYet')} sub={t('profile.shareToEarnPoints')} />}
              />
            </div>
          )}

          {/* ── Statistics ── */}
          {activeTab === 'statistics' && (
            <div style={{ background: T.white, borderRadius: 22, border: `1px solid ${T.rule}`, padding: 24 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: T.ink, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={17} color={roleAccent} strokeWidth={1.75}/> {t('profile.performanceSummary')}
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
                    <span style={{ fontFamily: FONT, fontSize: 21, fontWeight: 700, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{typeof row.val === 'number' ? row.val.toLocaleString() : row.val}</span>
                  </div>
                ))}
              </div>
              {isAgente && (
                <p style={{ fontSize: 11, color: T.faint, marginTop: 16, padding: '12px 14px', borderRadius: 14, background: T.g50 }}>
                  {t('profile.eachUserWorth')}
                </p>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ═══ SETTINGS MODAL ═══════════════════════════════════════════════════ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent style={{ maxWidth: 420, borderRadius: 22, border: `1px solid ${T.rule}` }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT, fontSize: 19, fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={17} color={T.g600}/> {t('profile.settings')}
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '8px 0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Globe size={13} color={T.g500 ?? T.g600}/> {t('common.language') || 'Idioma'}
              </label>
              <Select value={i18n.language} onValueChange={(value) => { i18n.changeLanguage(value); localStorage.setItem('orbislink_language', value); toast({ title: t('common.success'), description: t('common.languageChanged') || 'Idioma alterado.' }) }}>
                <SelectTrigger style={{ borderRadius: 12, border: `1px solid ${T.rule}`, height: 42, fontSize: 13, fontFamily: 'inherit' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ borderRadius: 16, border: `1px solid ${T.rule}` }}>
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
        * { box-sizing: border-box; }

        @keyframes ag-spin    { to { transform: rotate(360deg) } }
        @keyframes ag-fade-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }

        .ag-layout { display: grid; grid-template-columns: 1fr; gap: 22px; }

        .ag-btn:active { transform: scale(0.97); }
        .ag-icon-btn:hover { background: ${T.g100}; color: ${T.g600}; }
        .ag-avatar-edit:hover { transform: scale(1.08); }
        .ag-input:focus { border-color: ${T.g500 ?? T.g600} !important; background: ${T.white} !important; box-shadow: 0 0 0 4px rgba(61,154,72,0.1); }
        .ag-tab:hover { color: ${T.ink}; }

        /* ── Table ───────────────────────────────────────────────────────── */
        .ag-table { border-collapse: collapse; }
        .ag-table thead th {
          text-align: left; font-size: 11px; font-weight: 700; color: ${T.faint}; padding: 14px 18px 14px 0;
          border-bottom: 1px solid ${T.rule}; background: ${T.canvas};
        }
        .ag-table tbody tr { animation: ag-fade-up 0.4s ${EASE} both; transition: background 0.2s ${EASE}; }
        .ag-table tbody tr:hover { background: ${T.g50}; }
        .ag-table tbody tr:hover .ag-row-actions { opacity: 1; }
        .ag-table tbody td { padding: 14px 18px 14px 0; font-size: 13px; color: ${T.mid}; border-bottom: 1px solid ${T.rule}; vertical-align: middle; }
        .ag-table tbody tr:last-child td { border-bottom: none; }
        .ag-row-actions { display: inline-flex; gap: 5px; justify-content: flex-end; opacity: 0.55; transition: opacity 0.2s ${EASE}; }
        .ag-accent-cell { width: 4px; padding: 0 !important; border-bottom: none !important; }

        @media (max-width: 720px) {
          .ag-table thead { display: none; }
          .ag-table, .ag-table tbody, .ag-table tr, .ag-table td { display: block; width: 100%; }
          .ag-table tbody tr { padding: 14px 16px; border-bottom: 1px solid ${T.rule}; position: relative; }
          .ag-table tbody tr:last-child { border-bottom: none; }
          .ag-table td { padding: 5px 0; border: none !important; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: right !important; }
          .ag-table td.ag-accent-cell { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; height: auto; }
          .ag-table td[data-label]::before {
            content: attr(data-label); font-size: 10.5px; font-weight: 700; color: ${T.faint}; text-align: left; flex-shrink: 0;
          }
          .ag-row-actions { opacity: 1; }
        }

        @media (max-width: 480px) {
          .ag-layout { padding: 18px 14px !important; gap: 14px !important; }
        }

        @media (min-width: 1024px) {
          .ag-layout { grid-template-columns: 320px 1fr !important; }
        }
        @media (min-width: 640px) {
          .sm\\:grid-cols-2 { grid-template-columns: 1fr 1fr !important; }
          .sm\\:inline { display: inline !important; }
          .hidden { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}

export default Profile