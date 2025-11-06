import React, { useEffect, useState } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Settings, LogOut, Mail, Phone, MapPin, User, ClipboardList, BarChart3, Camera
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'

interface FichaRecebimento {
  id: string
  codigo: string
  data_recebimento: string
  fornecedor: string
  valor_total: number
  status: string
}

const PerfilComprador = () => {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()

  const [fichas, setFichas] = useState<FichaRecebimento[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)

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

  useEffect(() => { if (user) fetchFichas() }, [user])

  const fetchFichas = async () => {
    try {
      const { data, error } = await supabase
        .from('fichas_recebimento' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setFichas(data as any || [])
    } catch (error) {
      console.error('Erro ao buscar fichas:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from('users')
        .update({ ...profileData, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      alert('Perfil atualizado com sucesso!')
      setSettingsOpen(false)
    } catch (error: any) {
      alert('Erro: ' + (error.message || 'desconhecido'))
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

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Meu Perfil</h1>
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

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado esquerdo */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="relative mx-auto mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={userProfile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-white text-xl">{profileData.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={avatarLoading} onClick={() => document.getElementById('avatar-upload')?.click()}>
                    {avatarLoading ? <div className="animate-spin h-3 w-3 border-b-2 border-primary rounded-full"></div> : <Camera className="h-3 w-3" />}
                  </Button>
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={uploadAvatar}/>
                </div>
              </div>
              <CardTitle>{profileData.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{userProfile?.user_type}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground"/> {profileData.email}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground"/> {profileData.phone}</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> {profileData.province_id}, {profileData.municipality_id}</div>
            </CardContent>
          </Card>
        </div>

        {/* Lado direito */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="fichas" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="fichas">Minhas Fichas</TabsTrigger>
              <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
            </TabsList>

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
                      <p className="text-lg font-bold">{ficha.valor_total.toLocaleString()} Kz</p>
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
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/>Resumo de Compras</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Total de fichas: {fichas.length}</p>
                  <p>
                    Total gasto: {fichas.reduce((s, f) => s + f.valor_total, 0).toLocaleString()} Kz
                  </p>
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
