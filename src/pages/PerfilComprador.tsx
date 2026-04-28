import React, { useCallback, useEffect, useState } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, LogOut, Mail, Phone, MapPin, ClipboardList, BarChart3, Camera, 
  ShoppingCart, Clock, XCircle, CheckCircle, ArrowLeft, AlertTriangle
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/use-toast'

interface FichaRecebimento {
  id: string
  codigo?: string
  data_recebimento?: string
  fornecedor?: string
  valor_total?: number
  status: string
  created_at?: string
}

interface Order {
  id: string
  product_id: string
  quantity: number
  total_price: number
  status: string
  location: string
  created_at: string
  product?: {
    product_type: string
    farmer_name: string
    photos: string[]
  }
}

const PerfilComprador = () => {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()

  const [fichas, setFichas] = useState<FichaRecebimento[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const [profileData, setProfileData] = useState({
    full_name: userProfile?.full_name || '',
    phone: userProfile?.phone || '',
    email: userProfile?.email || user?.email || '',
    province_id: userProfile?.province_id || '',
    municipality_id: userProfile?.municipality_id || '',
  })

  // Redirecionamento automático se não for comprador
  useEffect(() => {
    if (userProfile?.user_type === 'agricultor' || userProfile?.user_type === 'agente') {
      navigate('/perfil-agricultor')
    }
  }, [userProfile, navigate])

  const fetchFichas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('fichas_recebimento')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setFichas((data as FichaRecebimento[]) || [])
    } catch (error) {
      console.error('Erro ao buscar fichas:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          product:products!orders_product_id_fkey(product_type, farmer_name, photos)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setOrders((data || []) as unknown as Order[])
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
    }
  }, [user?.id])

  useEffect(() => {
    if (user) {
      fetchFichas()
      fetchOrders()
    }
  }, [fetchFichas, fetchOrders, user])

  const updateProfile = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from('users')
        .update({ ...profileData, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      toast({ title: 'Sucesso', description: 'Perfil atualizado com sucesso!' })
      setSettingsOpen(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  }

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setAvatarLoading(true)
      const file = event.target.files?.[0]
      if (!file) return
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user?.id)
    } catch (error) {
      console.error(error)
    } finally {
      setAvatarLoading(false)
    }
  }

  // Check if order can be cancelled (within 3 hours)
  const canCancelOrder = (createdAt: string) => {
    const orderDate = new Date(createdAt)
    const now = new Date()
    const hoursDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)
    return hoursDiff <= 3
  }

  const getTimeRemaining = (createdAt: string) => {
    const orderDate = new Date(createdAt)
    const now = new Date()
    const hoursDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)
    const hoursRemaining = 3 - hoursDiff
    
    if (hoursRemaining <= 0) return null
    
    const hours = Math.floor(hoursRemaining)
    const minutes = Math.floor((hoursRemaining - hours) * 60)
    return `${hours}h ${minutes}m restantes`
  }

  const handleCancelOrder = async () => {
    if (!selectedOrderId) return

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', selectedOrderId)
        .eq('user_id', user?.id)

      if (error) throw error

      toast({ title: 'Pedido cancelado', description: 'Seu pedido foi cancelado com sucesso.' })
      fetchOrders()
      setCancelDialogOpen(false)
      setSelectedOrderId(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao cancelar pedido'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
      case 'accepted':
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="h-3 w-3 mr-1" />Em andamento</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-primary">Meu Perfil</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}><Settings className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Configurações */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações de Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-3">
            <Label>Nome Completo</Label>
            <Input value={profileData.full_name} onChange={e => setProfileData({ ...profileData, full_name: e.target.value })} />
            <Label>Telefone</Label>
            <Input value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} />
            <Label>Email</Label>
            <Input type="email" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} />
          </div>
          <DialogFooter>
            <Button onClick={updateProfile}>Salvar</Button>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Cancelar Pedido
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Não, manter</Button>
            <Button variant="destructive" onClick={handleCancelOrder}>Sim, cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado esquerdo */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="relative mx-auto mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={userProfile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-white text-xl">{profileData.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={avatarLoading} onClick={() => document.getElementById('avatar-upload')?.click()}>
                    {avatarLoading ? <div className="animate-spin h-3 w-3 border-b-2 border-primary rounded-full"></div> : <Camera className="h-3 w-3" />}
                  </Button>
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={uploadAvatar}/>
                </div>
              </div>
              <CardTitle>{profileData.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground capitalize">{userProfile?.user_type}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground"/> {profileData.email}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground"/> {profileData.phone || 'Não informado'}</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> {profileData.province_id || 'Não informado'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Lado direito */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="pedidos" className="w-full">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="pedidos" className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />
                Meus Pedidos
              </TabsTrigger>
              <TabsTrigger value="fichas">Minhas Fichas</TabsTrigger>
              <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
            </TabsList>

            {/* Pedidos */}
            <TabsContent value="pedidos" className="mt-4 space-y-4">
              {orders.length > 0 ? orders.map(order => (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {order.product?.photos?.[0] && (
                        <img 
                          src={order.product.photos[0]} 
                          alt={order.product.product_type}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-primary">{order.product?.product_type || 'Produto'}</h3>
                            <p className="text-sm text-muted-foreground">{order.product?.farmer_name}</p>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                        
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-primary">{order.total_price?.toLocaleString()} Kz</p>
                            <p className="text-xs text-muted-foreground">{order.quantity} kg • {order.location}</p>
                          </div>
                          
                          {order.status === 'pending' && canCancelOrder(order.created_at) && (
                            <div className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedOrderId(order.id)
                                  setCancelDialogOpen(true)
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Desistir
                              </Button>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getTimeRemaining(order.created_at)}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          Pedido em: {new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-10 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-60" />
                  <p>Nenhum pedido encontrado</p>
                  <Button className="mt-4" onClick={() => navigate('/app')}>Explorar Produtos</Button>
                </div>
              )}
            </TabsContent>

            {/* Fichas */}
            <TabsContent value="fichas" className="mt-4 space-y-4">
              {fichas.length > 0 ? fichas.map(ficha => (
                <Card key={ficha.id}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-primary">Ficha #{ficha.codigo}</h3>
                      <p className="text-sm text-muted-foreground">{ficha.fornecedor}</p>
                      <p className="text-xs text-muted-foreground">Recebido em: {new Date(ficha.data_recebimento).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{ficha.valor_total?.toLocaleString()} Kz</p>
                      <p className="text-xs text-muted-foreground">{ficha.status}</p>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-60" />
                  <p>Nenhuma ficha de recebimento encontrada</p>
                  <Button className="mt-4" onClick={() => navigate('/ficharecebimento')}>Nova Ficha</Button>
                </div>
              )}
            </TabsContent>

            {/* Estatísticas */}
            <TabsContent value="estatisticas" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/>Resumo de Atividades</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{orders.length}</p>
                    <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{fichas.length}</p>
                    <p className="text-sm text-muted-foreground">Total de Fichas</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {orders.filter(o => o.status === 'completed').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Pedidos Concluídos</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">
                      {orders.reduce((s, o) => s + (o.total_price || 0), 0).toLocaleString()} Kz
                    </p>
                    <p className="text-sm text-muted-foreground">Total Gasto</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default PerfilComprador