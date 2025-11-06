import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Users, Package, MapPin, Download, FileText, BarChart3, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  activeProducts: number
  totalProvinces: number
  usersByProvince: { [key: string]: number }
  productsByProvince: { [key: string]: number }
}

interface Product {
  id: string
  product_type: string
  quantity: number
  harvest_date: string
  price: number
  province_id: string
  municipality_id: string
  logistics_access: string
  farmer_name: string
  contact: string
  status: string
  created_at: string
  user_id: string
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalProvinces: 0,
    usersByProvince: {},
    productsByProvince: {}
  })
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Permitir acesso para todos os usuários logados
    if (user) {
      fetchDashboardData()
    }
  }, [user, userProfile])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch users count
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (productsError) throw productsError

      // Fetch users by province
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('province_id')

      if (usersError) throw usersError

      // Calculate statistics
      const activeProducts = productsData?.filter(p => p.status === 'active') || []
      const usersByProvince = usersData?.reduce((acc: any, user) => {
        acc[user.province_id] = (acc[user.province_id] || 0) + 1
        return acc
      }, {}) || {}

      const productsByProvince = productsData?.reduce((acc: any, product) => {
        acc[product.province_id] = (acc[product.province_id] || 0) + 1
        return acc
      }, {}) || {}

      setStats({
        totalUsers: usersCount || 0,
        totalProducts: productsData?.length || 0,
        activeProducts: activeProducts.length,
        totalProvinces: Object.keys(usersByProvince).length,
        usersByProvince,
        productsByProvince
      })

      setProducts(productsData || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLogisticsBadge = (logistics: string) => {
    const variants = {
      'sim': 'default',
      'nao': 'destructive',
      'parcial': 'secondary'
    } as const

    return (
      <Badge variant={variants[logistics as keyof typeof variants] || 'outline'}>
        {logistics === 'sim' ? 'Sim' : logistics === 'nao' ? 'Não' : 'Parcial'}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      'active': 'default',
      'inactive': 'secondary',
      'removed': 'destructive'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status === 'active' ? 'Ativo' : status === 'inactive' ? 'Inativo' : 'Removido'}
      </Badge>
    )
  }

  const handleGenerateTechnicalSheet = (productId: string) => {
    navigate(`/ficha-tecnica/${productId}`)
  }

  const handleDownloadAllTechnicalSheets = () => {
    alert('Função de download em desenvolvimento')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Dashboard AgriLink</h1>
              <p className="text-muted-foreground">Painel administrativo da plataforma</p>
            </div>
          </div>
          <Button
            onClick={handleDownloadAllTechnicalSheets}
            className="bg-business hover:bg-business/90"
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar Todos os Relatórios
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-soft border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Cadastrados na plataforma
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-business" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-business">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeProducts} ativos
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Províncias Ativas</CardTitle>
              <MapPin className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.totalProvinces}</div>
              <p className="text-xs text-muted-foreground">
                Com usuários cadastrados
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Produtos Ativos</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats.totalProducts > 0 ? Math.round((stats.activeProducts / stats.totalProducts) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Produtos em situação ativa
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Products Table */}
        <Card className="shadow-medium border-card-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>Produtos Cadastrados</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Data de Colheita</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Preço Provável</TableHead>
                    <TableHead>Logística</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_type}</TableCell>
                      <TableCell>{product.quantity.toLocaleString()} kg</TableCell>
                      <TableCell>{new Date(product.harvest_date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{product.province_id}</TableCell>
                      <TableCell>{product.price.toLocaleString()} Kz</TableCell>
                      <TableCell>{getLogisticsBadge(product.logistics_access)}</TableCell>
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateTechnicalSheet(product.id)}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            Ficha
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {products.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto cadastrado ainda
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard