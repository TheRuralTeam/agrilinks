import React, { useState, useEffect } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  User, Edit, Package, MapPin, Phone, Mail, Calendar, BarChart3, 
  Settings, LogOut, Trash2, Eye, Camera 
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'

interface UserProduct {
  id: string
  product_type: string
  quantity: number
  harvest_date: string
  price: number
  province_id: string
  municipality_id: string
  status: 'active' | 'inactive' | 'removed'
  created_at: string
  views?: number
  interests?: number
}

interface FichaRecebimento {
  id: string
  nomeFicha: string
  produto: string
  qualidade: string
  embalagem: string
  locaisEntrega?: string[]
  telefone: string
  created_at: string
}

const Profile = () => {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()

  const [userProducts, setUserProducts] = useState<UserProduct[]>([])
  const [fichasRecebimento, setFichasRecebimento] = useState<FichaRecebimento[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agentStats, setAgentStats] = useState<{ totalReferrals: number; totalPoints: number; recentReferrals: any[] } | null>(null)

  const [provinceName, setProvinceName] = useState('')
  const [municipalityName, setMunicipalityName] = useState('')
  const [profileData, setProfileData] = useState({
    full_name: userProfile?.full_name || '',
    phone: userProfile?.phone || '',
    email: userProfile?.email || user?.email || '',
    province_id: userProfile?.province_id || '',
    municipality_id: userProfile?.municipality_id || '',
  })

  // Buscar produtos do agricultor
  const fetchUserProducts = async () => {
    try {
      const { data, error } = await supabase.from('products')
        .select('*').eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      const productsWithStats = (data || []).map(product => ({
        ...product,
        status: product.status as 'active' | 'inactive' | 'removed',
        views: Math.floor(Math.random() * 100),
        interests: Math.floor(Math.random() * 20)
      }))
      setUserProducts(productsWithStats)
    } catch (error) { console.error(error) }
  }

  // Buscar fichas de recebimento para compradores
  const fetchFichasRecebimento = async () => {
    try {
      const { data, error } = await supabase.from('fichas_recebimento' as any)
        .select('*').eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setFichasRecebimento((data || []) as any)
    } catch (error) { console.error(error) }
  }

  // Buscar estatísticas de indicações para agentes
  const fetchAgentStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_agent_referral_stats', { agent_user_id: user?.id });
      if (error) throw error;
      if (data && data.length > 0) {
        const stats = data[0];
        setAgentStats({
          totalReferrals: Number(stats.total_referrals) || 0,
          totalPoints: Number(stats.total_points) || 0,
          recentReferrals: Array.isArray(stats.recent_referrals) ? stats.recent_referrals : []
        });
      }
    } catch (error) { 
      console.error('Erro ao buscar stats de agente:', error);
    }
  };

  useEffect(() => {
    if (!user) return
    if (userProfile?.user_type === 'comprador') fetchFichasRecebimento()
    else fetchUserProducts()
    if (userProfile?.user_type === 'agente') {
      fetchUserProducts() // Agentes também podem publicar produtos
      fetchAgentStats()
    }
    setLoading(false)
  }, [user, userProfile])

  const fetchProvinceAndMunicipality = async (province_id: string, municipality_id: string) => {
    try {
      // Usar os IDs diretamente já que não temos tabelas de províncias/municípios
      setProvinceName(province_id)
      setMunicipalityName(municipality_id)
    } catch (error) { console.error('Erro ao buscar nomes de localizações:', error) }
  }

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        email: userProfile.email || user?.email || '',
        province_id: userProfile.province_id || '',
        municipality_id: userProfile.municipality_id || '',
      })
      fetchProvinceAndMunicipality(userProfile.province_id, userProfile.municipality_id)
    }
  }, [userProfile, user])

  const updateProfile = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from('users')
        .update({ ...profileData, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      alert('Perfil atualizado com sucesso!')
      setEditMode(false)
    } catch (error: any) { console.error('Erro ao atualizar perfil:', error); alert('Erro: ' + (error.message || 'desconhecido')) }
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
      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', user?.id)
      if (updateError) throw updateError
      setProfileData(prev => ({ ...prev }))
    } catch (error: any) { console.error('Erro upload avatar:', error); alert('Erro: ' + (error.message || 'desconhecido')) }
    finally { setAvatarLoading(false) }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Deseja remover este produto?')) return
    try {
      const { error } = await supabase.from('products').update({ status: 'removed' }).eq('id', productId)
      if (error) throw error
      setUserProducts(prev => prev.map(p => p.id === productId ? { ...p, status: 'removed' } : p))
    } catch (error) { console.error('Error deleting product:', error) }
  }

  const getStatusBadge = (status: string) => {
    const variants = { 'active': 'default', 'inactive': 'secondary', 'removed': 'destructive' } as const
    const labels = { 'active': 'Ativo', 'inactive': 'Inativo', 'removed': 'Removido' }
    return <Badge variant={variants[status as keyof typeof variants] || 'outline'}>{labels[status as keyof typeof labels] || status}</Badge>
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR')

  const activeProducts = userProducts.filter(p => p.status === 'active').length
  const totalViews = userProducts.reduce((sum, p) => sum + (p.views || 0), 0)
  const totalInterests = userProducts.reduce((sum, p) => sum + (p.interests || 0), 0)

  if (loading) return <div className="pb-20 bg-background min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>

  return (
    <div className="pb-20 bg-background min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Meu Perfil</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}><Settings className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => logout()}><LogOut className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: perfil e estatísticas */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-soft border-card-border">
            <CardHeader className="text-center pb-2">
              <div className="relative mx-auto mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={userProfile?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">{profileData.full_name.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={avatarLoading} onClick={() => document.getElementById('avatar-upload')?.click()}>
                    {avatarLoading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div> : <Camera className="h-3 w-3" />}
                  </Button>
                  <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} className="hidden"/>
                </div>
              </div>
              <CardTitle className="text-xl">{profileData.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{userProfile?.user_type}</p>
            </CardHeader>
            <CardContent>
              {!editMode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground"/><span>{profileData.email}</span></div>
                  <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground"/><span>{profileData.phone}</span></div>
                  <div className="flex items-center gap-3 text-sm"><MapPin className="h-4 w-4 text-muted-foreground"/><span>{provinceName}, {municipalityName}</span></div>
                  
                  {/* Código do Agente */}
                  {userProfile?.user_type === 'agente' && (
                    <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Seu Código de Agente</p>
                      <p className="text-lg font-mono font-bold text-primary">{(userProfile as any).agent_code || 'Gerando...'}</p>
                      <p className="text-xs text-muted-foreground mt-1">Compartilhe este código para indicar novos usuários</p>
                    </div>
                  )}
                  
                  <Button onClick={() => setEditMode(true)} className="w-full mt-4" variant="outline"><Edit className="h-4 w-4 mr-2"/>Editar Perfil</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Nome Completo</Label><Input value={profileData.full_name} onChange={e=>setProfileData(prev=>({...prev, full_name:e.target.value}))}/></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input value={profileData.phone} onChange={e=>setProfileData(prev=>({...prev, phone:e.target.value}))}/></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={profileData.email} onChange={e=>setProfileData(prev=>({...prev, email:e.target.value}))}/></div>
                  <div className="flex gap-2"><Button onClick={updateProfile} className="flex-1">Salvar</Button><Button variant="outline" onClick={()=>setEditMode(false)} className="flex-1">Cancelar</Button></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas */}
          {userProfile?.user_type === 'agente' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <Card className="text-center"><CardContent className="pt-4"><div className="text-2xl font-bold text-primary">{agentStats?.totalReferrals || 0}</div><p className="text-xs text-muted-foreground">Usuários Indicados</p></CardContent></Card>
              <Card className="text-center"><CardContent className="pt-4"><div className="text-2xl font-bold text-accent">{agentStats?.totalPoints || 0}</div><p className="text-xs text-muted-foreground">Pontos Ganhos</p></CardContent></Card>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              <Card className="text-center"><CardContent className="pt-4"><div className="text-2xl font-bold text-primary">{activeProducts}</div><p className="text-xs text-muted-foreground">Produtos Ativos</p></CardContent></Card>
              <Card className="text-center"><CardContent className="pt-4"><div className="text-2xl font-bold text-business">{totalViews}</div><p className="text-xs text-muted-foreground">Visualizações</p></CardContent></Card>
              <Card className="text-center"><CardContent className="pt-4"><div className="text-2xl font-bold text-accent">{totalInterests}</div><p className="text-xs text-muted-foreground">Interesses</p></CardContent></Card>
            </div>
          )}
        </div>

        {/* Coluna direita: produtos / fichas / estatísticas */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="products" className="w-full">
            <TabsList className={`grid w-full ${userProfile?.user_type === 'agente' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="products">{userProfile?.user_type==='comprador'?'Minhas Fichas':'Meus Produtos'}</TabsTrigger>
              {userProfile?.user_type === 'agente' && <TabsTrigger value="referrals">Minhas Indicações</TabsTrigger>}
              <TabsTrigger value="statistics">Estatísticas</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4 mt-4">
              {userProfile?.user_type==='comprador' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fichasRecebimento.map(ficha=>(
                    <Card key={ficha.id} className="shadow-soft border-card-border">
                      <CardContent>
                        <h3 className="font-semibold">{ficha.nomeFicha}</h3>
                        <p>Produto: {ficha.produto}</p>
                        <p>Qualidade: {ficha.qualidade}</p>
                        <p>Embalagem: {ficha.embalagem}</p>
                        <p>Locais: {ficha.locaisEntrega?.length || 0}</p>
                        <p>Telefone: {ficha.telefone}</p>
                        <p>Criado em: {formatDate(ficha.created_at)}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {fichasRecebimento.length===0 && <p className="text-center text-muted-foreground py-8">Nenhuma ficha de recebimento criada.</p>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProducts.map(product=>(
                    <Card key={product.id} className="shadow-soft border-card-border">
                      <CardContent className="p-4 flex justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2"><h3 className="font-semibold">{product.product_type}</h3>{getStatusBadge(product.status)}</div>
                          <div className="text-sm text-muted-foreground"><span>{product.quantity.toLocaleString()} kg</span> • <span>{product.price.toLocaleString()} Kz</span></div>
                          <div className="text-xs text-muted-foreground flex gap-2 items-center"><Calendar className="h-3 w-3"/>Colheita: {formatDate(product.harvest_date)}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 items-center"><MapPin className="h-3 w-3"/>Província: {product.province_id} | Município: {product.municipality_id}</div>
                          <div className="flex gap-2 mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3"/>{product.views}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Package className="h-3 w-3"/>{product.interests}</div>
                          </div>
                        </div>
                        {product.status !== 'removed' && <Button variant="ghost" size="icon" onClick={()=>deleteProduct(product.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                      </CardContent>
                    </Card>
                  ))}
                  {userProducts.length===0 && <p className="text-center text-muted-foreground py-8">Nenhum produto publicado ainda.</p>}
                </div>
              )}
            </TabsContent>

            {/* Aba de Indicações (só para agentes) */}
            {userProfile?.user_type === 'agente' && (
              <TabsContent value="referrals" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {agentStats && agentStats.recentReferrals && agentStats.recentReferrals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {agentStats.recentReferrals.map((referral: any, idx: number) => (
                        <Card key={idx} className="shadow-soft border-card-border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h3 className="font-semibold">{referral.user_name}</h3>
                                <Badge variant="outline" className="text-xs">{referral.user_type}</Badge>
                                <p className="text-sm text-muted-foreground">+{referral.points} pontos</p>
                                <p className="text-xs text-muted-foreground">{formatDate(referral.created_at)}</p>
                              </div>
                              <div className="text-2xl font-bold text-primary">+{referral.points}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50"/>
                      <p className="text-muted-foreground">Você ainda não indicou nenhum usuário</p>
                      <p className="text-sm text-muted-foreground mt-2">Compartilhe seu código de agente para começar a ganhar pontos!</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="statistics" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/>Resumo de Performance</CardTitle></CardHeader>
                <CardContent>
                   {userProfile?.user_type==='agente' ? (
                    <div className="space-y-2">
                      <p className="flex justify-between"><span>Total de Indicações:</span><span className="font-bold">{agentStats?.totalReferrals || 0}</span></p>
                      <p className="flex justify-between"><span>Total de Pontos:</span><span className="font-bold text-primary">{agentStats?.totalPoints || 0}</span></p>
                      <p className="text-sm text-muted-foreground mt-4">Cada usuário indicado vale 10 pontos!</p>
                    </div>
                  ) : userProfile?.user_type==='comprador' ? (
                    <p>Total Fichas Recebimento: {fichasRecebimento.length}</p>
                  ) : (
                    <>
                      <p>Total Produtos: {userProducts.length}</p>
                      <p>Produtos Ativos: {activeProducts}</p>
                      <p>Total Visualizações: {totalViews}</p>
                      <p>Total Interesses: {totalInterests}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default Profile