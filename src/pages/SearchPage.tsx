import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/integrations/supabase/client'
import { 
  ChevronLeft, Search, Package, User, TrendingUp, Clock, 
  DollarSign, Filter, X, SlidersHorizontal, Wheat, Apple,
  Carrot, Leaf, ArrowUpDown
} from 'lucide-react'
import { angolaProvinces } from '@/data/angola-locations'
import { ProductCard, Product as ProductCardType } from '@/components/ProductCard'
import { useAuth } from '@/contexts/AuthContext'
import { validatePreOrderSubmission } from '@/features/products/businessRules'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

/* 
  BRANDING THEME - AgriLinks 
  Improved color palette for a professional agricultural look
*/
const T = {
  /* Greens - Primary Brand Colors */
  g900:   '#2c863b', // Deep Forest Green
  g700:   '#2c863b', // Rich Leaf Green
  g600:   '#2c863b', // Vibrant Grass
  g500:   '#2c863b', // Standard Green
  g400:   '#81C784', // Soft Green
  g100:   '#E8F5E9', // Mint Tint
  g50:    '#F2FAF3', // Subtle Green Wash
  gBorder:'#C8E6CA',

  /* Earth - Secondary Brand Colors */
  e700:   '#5C3317', // Dark Soil
  e500:   '#7B4F2E', // Terracotta
  e300:   '#A0522D', // Sienna
  ePale:  '#FDF5EE', // Sand
  eBorder:'#EDD9C6',

  /* Neutrals */
  ink:    '#111714', // Near Black
  mid:    '#3D4D40', // Dark Grey-Green
  muted:  '#758A79', // Muted Sage
  faint:  '#A8BAA9', // Light Sage
  canvas: '#F7F9F7', // Off-white Greenish
  white:  '#FFFFFF',
  rule:   '#E5EDE6',

  /* Accents */
  gold:   '#B07D0A', // Harvest Gold
  goldL:  '#E5A020', // Sun Gold

  /* Shadow */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

interface Product extends ProductCardType {}

interface UserResult {
  id: string
  full_name: string
  email: string
  user_type: string
  avatar_url?: string
}

type SortOption = 'recent' | 'popular' | 'price_asc' | 'price_desc'
type TabOption = 'all' | 'products' | 'users'

const productCategories = [
  { id: 'all', name: 'Todos', icon: Package },
  { id: 'cereais', name: 'Cereais', icon: Wheat },
  { id: 'frutas', name: 'Frutas', icon: Apple },
  { id: 'legumes', name: 'Legumes', icon: Carrot },
  { id: 'verduras', name: 'Verduras', icon: Leaf },
]

const SearchPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [activeTab, setActiveTab] = useState<TabOption>('all')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [preOrderModalOpen, setPreOrderModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderData, setOrderData] = useState({ quantity: 1, location: '' })
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<any>(null)

  const searchData = React.useCallback(async (term: string, province?: string, category?: string) => {
    setLoading(true)
    try {
      // Buscar produtos
      let query = supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
      
      if (province) {
        query = query.eq('province_id', province)
      }
      
      if (term.trim()) {
        query = query.or(`product_type.ilike.%${term}%,description.ilike.%${term}%,farmer_name.ilike.%${term}%`)
      }

      // Filtrar por categoria (usando product_type)
      if (category && category !== 'all') {
        query = query.ilike('product_type', `%${category}%`)
      }

      const { data: products } = await query

      const productsWithData = await Promise.all(
        (products || []).map(async (product) => {
          const { count: likesCount } = await supabase
            .from('product_likes')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', product.id)

          const { data: userLike } = user
            ? await supabase
                .from('product_likes')
                .select('id')
                .eq('product_id', product.id)
                .eq('user_id', user.id)
                .maybeSingle()
            : { data: null }

          const { data: comments } = await supabase
            .from('product_comments')
            .select(`id, user_id, comment_text, created_at`)
            .eq('product_id', product.id)
            .order('created_at', { ascending: false })

          const commentsWithUserInfo = await Promise.all(
            (comments || []).map(async (c) => {
              const { data: userData } = await supabase
                .from('users')
                .select('full_name, user_type')
                .eq('id', c.user_id)
                .maybeSingle()
              return { ...c, user_name: userData?.full_name || 'Usuário', user_type: userData?.user_type || 'agricultor' }
            })
          )

          return { 
            ...product, 
            likes_count: likesCount || 0, 
            is_liked: !!userLike, 
            comments: commentsWithUserInfo 
          } as Product
        })
      )

      setProductResults(productsWithData)

      // Buscar usuários
      if (term.trim() && (activeTab === 'all' || activeTab === 'users')) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, user_type, avatar_url')
          .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
          .limit(20)

        setUserResults((users || []) as UserResult[])
      } else {
        setUserResults([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user, activeTab])

  useEffect(() => {
    searchData(searchTerm, selectedProvince, selectedCategory)
  }, [searchTerm, selectedProvince, selectedCategory, activeTab, searchData])

  // Ordenar produtos
  const sortedProducts = useMemo(() => {
    const sorted = [...productResults]
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
      case 'popular':
        return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
      case 'price_asc':
        return sorted.sort((a, b) => a.price - b.price)
      case 'price_desc':
        return sorted.sort((a, b) => b.price - a.price)
      default:
        return sorted
    }
  }, [productResults, sortBy])

  const handleProvinceClick = (provinceId: string) => {
    setSelectedProvince(prev => prev === provinceId ? '' : provinceId)
  }

  const handleProductUpdate = (updatedProduct: Product) => {
    setProductResults(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p))
  }

  useEffect(() => {
    if (!mapModalOpen || !selectedProduct?.location_lat || !selectedProduct?.location_lng || !mapContainerRef.current) return

    let cancelled = false

    const loadMap = async () => {
      try {
        const [{ default: mapboxgl }] = await Promise.all([
          import('mapbox-gl'),
          import('mapbox-gl/dist/mapbox-gl.css')
        ])

        if (cancelled || !mapContainerRef.current) return

        mapboxgl.accessToken = MAPBOX_TOKEN
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [selectedProduct.location_lng, selectedProduct.location_lat],
          zoom: 9,
          attributionControl: false,
        })

        mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
        new mapboxgl.Marker({ color: 'green' })
          .setLngLat([selectedProduct.location_lng, selectedProduct.location_lat])
          .addTo(mapRef.current)
      } catch (error) {
        console.error('Erro ao carregar mapa da busca:', error)
      }
    }

    loadMap()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapModalOpen, selectedProduct])

  const handleOpenMap = (product: Product) => {
    setSelectedProduct(product)
    setMapModalOpen(true)
  }

  const handleOpenPreOrder = (product: Product) => {
    setSelectedProduct(product)
    setOrderData({ quantity: 1, location: '' })
    setPreOrderModalOpen(true)
  }

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !user) return toast.error('Erro ao processar pré-compra')

    try {
      validatePreOrderSubmission({
        product: {
          id: selectedProduct.id,
          status: selectedProduct.status,
          quantity: Number(selectedProduct.quantity || 0),
          user_id: selectedProduct.user_id,
          price: Number(selectedProduct.price || 0),
        },
        buyer_id: user.id,
        quantity: Number(orderData.quantity || 0),
        location: orderData.location,
      })
    } catch (validationError: any) {
      toast.error(validationError?.message || 'Dados da pré-compra inválidos.')
      return
    }

    try {
      const { error } = await supabase.from('pre_orders').insert({
        product_id: selectedProduct.id,
        user_id: user.id,
        quantity: orderData.quantity,
        location: orderData.location,
        status: 'pending'
      })

      if (error) throw error

      await supabase.rpc('create_notification', {
        p_user_id: selectedProduct.user_id,
        p_type: 'pre_order',
        p_title: 'Nova Pré-Compra',
        p_message: `${user.email} quer comprar ${orderData.quantity}kg do seu produto ${selectedProduct.product_type}`,
        p_metadata: {
          product_id: selectedProduct.id,
          buyer_id: user.id,
          quantity: orderData.quantity
        }
      })

      const { data: agentUsers } = await supabase
        .from('users')
        .select('id')
        .eq('user_type', 'agente' as const)
      
      if (agentUsers && agentUsers.length > 0) {
        for (const agent of agentUsers) {
          await supabase.rpc('create_notification', {
            p_user_id: agent.id,
            p_type: 'pre_order',
            p_title: 'Nova Pré-Compra no Sistema',
            p_message: `${user.email} quer comprar ${orderData.quantity}kg de ${selectedProduct.product_type} de ${selectedProduct.farmer_name}`,
            p_metadata: {
              product_id: selectedProduct.id,
              buyer_id: user.id,
              seller_id: selectedProduct.user_id,
              quantity: orderData.quantity
            }
          })
        }
      }

      toast.success('Pré-compra realizada com sucesso!')
      setPreOrderModalOpen(false)
      setSelectedProduct(null)
    } catch (error) {
      console.error('Erro ao criar pré-compra:', error)
      toast.error('Erro ao processar pré-compra')
    }
  }

  const clearFilters = () => {
    setSelectedProvince('')
    setSelectedCategory('all')
    setSortBy('recent')
    setSearchTerm('')
  }

  const hasActiveFilters = selectedProvince || selectedCategory !== 'all' || sortBy !== 'recent' || searchTerm

  React.useEffect(() => {
    if (!mapModalOpen || !selectedProduct?.location_lat || !selectedProduct?.location_lng) return
    if (!mapContainerRef.current) return

    try {
      if (!MAPBOX_TOKEN) {
        toast.error('Mapa não configurado. Defina VITE_MAPBOX_TOKEN nas variáveis de ambiente.')
        return
      }

      mapboxgl.accessToken = MAPBOX_TOKEN
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [selectedProduct.location_lng, selectedProduct.location_lat],
        zoom: 9,
        attributionControl: false
      })

      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      new mapboxgl.Marker({ color: 'green' })
        .setLngLat([selectedProduct.location_lng, selectedProduct.location_lat])
        .addTo(mapRef.current)

      return () => {
        if (mapRef.current) {
          mapRef.current.remove()
          mapRef.current = null
        }
      }
    } catch (error) {
      console.error('Error initializing map:', error)
    }
  }, [mapModalOpen, selectedProduct])

  const TAX_RATE = 0.10
  const totalPrice = selectedProduct ? orderData.quantity * selectedProduct.price * (1 + TAX_RATE) : 0

  return (
    <div className="min-h-screen bg-[#F7F9F7] pb-20">
      {/* Header — estilo leve, translúcido com blur, sem sombras duras */}
      <div
        className="sticky top-0 z-40 border-b border-black/[0.06]"
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-9 h-9 rounded-full text-[#2c863b] transition-colors"
              style={{ background: 'rgba(118,118,128,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(118,118,128,0.13)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(118,118,128,0.08)' }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Pesquisa — pílula leve, sem borda/sombra dura */}
            <div
              className="relative flex-1 min-w-0 flex items-center gap-2 rounded-full px-4 h-10 transition-colors"
              style={{ background: 'rgba(118,118,128,0.08)' }}
            >
              <Search className="h-4 w-4 text-[#A8BAA9] flex-shrink-0" />
              <input
                placeholder="Pesquisar produtos, agricultores..."
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-[#111714] placeholder:text-[#A8BAA9]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-colors"
              style={{
                background: showFilters ? '#2c863b' : 'rgba(118,118,128,0.08)',
                color: showFilters ? '#fff' : '#2c863b',
              }}
              onMouseEnter={e => { if (!showFilters) e.currentTarget.style.background = 'rgba(118,118,128,0.13)' }}
              onMouseLeave={e => { if (!showFilters) e.currentTarget.style.background = 'rgba(118,118,128,0.08)' }}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Filtros Rápidos — pílulas leves, sem borda dura */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {productCategories.map((cat) => {
              const active = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="rounded-full whitespace-nowrap flex items-center gap-1.5 px-3.5 h-8 text-sm font-medium transition-colors flex-shrink-0"
                  style={{
                    background: active ? '#2c863b' : 'rgba(118,118,128,0.08)',
                    color: active ? '#fff' : '#3D4D40',
                  }}
                >
                  <cat.icon className="h-3.5 w-3.5" />
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Painel de Filtros Expandido */}
      {showFilters && (
        <div
          className="border-b border-black/[0.06] p-4 animate-in slide-in-from-top duration-200"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)' }}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#111714]">Filtros Avançados</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium text-[#B07D0A] hover:text-[#E5A020] transition-colors"
                >
                  Limpar Tudo
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-[#3D4D40] flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" /> Ordenar por
                </label>
                <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                  <SelectTrigger className="border-none rounded-xl" style={{ background: 'rgba(118,118,128,0.08)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais Recentes</SelectItem>
                    <SelectItem value="popular">Mais Populares</SelectItem>
                    <SelectItem value="price_asc">Menor Preço</SelectItem>
                    <SelectItem value="price_desc">Maior Preço</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-[#3D4D40] flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Província
                </label>
                <div className="flex flex-wrap gap-2">
                  {angolaProvinces.map(p => {
                    const active = selectedProvince === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleProvinceClick(p.id)}
                        className="cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                        style={{
                          background: active ? '#2c863b' : 'rgba(118,118,128,0.08)',
                          color: active ? '#fff' : '#758A79',
                        }}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-[#E5EDE6] rounded-full p-1">
            <TabsTrigger value="all" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#2c863b] data-[state=active]:shadow-none">Tudo</TabsTrigger>
            <TabsTrigger value="products" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#2c863b] data-[state=active]:shadow-none">Produtos</TabsTrigger>
            <TabsTrigger value="users" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#2c863b] data-[state=active]:shadow-none">Usuários</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#E5EDE6] border-t-[#2c863b]"></div>
            <p className="text-[#758A79] font-medium">Buscando as melhores ofertas...</p>
          </div>
        )}

        {/* Resultados de Usuários - Grelha de 4 Colunas */}
        {(activeTab === 'all' || activeTab === 'users') && userResults.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-[#2c863b]" />
              <h2 className="font-bold text-lg text-[#111714]">Agricultores e Agentes</h2>
              <Badge className="bg-[#E8F5E9] text-[#2c863b] border-none">{userResults.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {userResults.map(user => (
                <div
                  key={user.id}
                  className="rounded-2xl p-4 transition-shadow cursor-pointer group"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)' }}
                  onClick={() => navigate(`/perfil/${user.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-[#E8F5E9] group-hover:border-[#2c863b] transition-colors">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-[#F2FAF3] text-[#2c863b] font-bold">
                        {user.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#111714] truncate group-hover:text-[#2c863b] transition-colors">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-[#758A79] capitalize">{user.user_type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultados de Produtos - Grelha de 4 Colunas */}
        {(activeTab === 'all' || activeTab === 'products') && sortedProducts.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#2c863b]" />
                <h2 className="font-bold text-lg text-[#111714]">Produtos Disponíveis</h2>
                <Badge className="bg-[#E8F5E9] text-[#2c863b] border-none">{sortedProducts.length}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sortedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onProductUpdate={handleProductUpdate}
                  onOpenMap={handleOpenMap}
                  onOpenPreOrder={handleOpenPreOrder}
                />
              ))}
            </div>
          </div>
        )}

        {/* Estado vazio sem pesquisa */}
        {!loading && !searchTerm && sortedProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl" style={{ background: '#fff', border: '1px dashed rgba(0,0,0,0.08)' }}>
            <div className="p-6 rounded-full mb-4" style={{ background: '#F2FAF3' }}>
              <Search className="h-12 w-12 text-[#2c863b]" />
            </div>
            <h3 className="text-xl font-bold text-[#111714]">Encontre o que precisa</h3>
            <p className="text-[#758A79] max-w-xs mt-2">
              Pesquise por produtos agrícolas, agricultores ou províncias para começar.
            </p>
          </div>
        )}
      </div>

      {/* MAP MODAL */}
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent className="max-w-4xl border-none rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2c863b]">Localização do Produto</DialogTitle>
            <DialogDescription className="text-[#758A79]">
              {selectedProduct?.product_type} - {selectedProduct?.farmer_name}
            </DialogDescription>
          </DialogHeader>
          <div ref={mapContainerRef} className="w-full h-[400px] rounded-xl" style={{ border: '1px solid rgba(0,0,0,0.06)' }} />
        </DialogContent>
      </Dialog>

      {/* PRE-ORDER MODAL */}
      <Dialog open={preOrderModalOpen} onOpenChange={setPreOrderModalOpen}>
        <DialogContent className="border-none rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2c863b]">Pré-Compra de {selectedProduct?.product_type}</DialogTitle>
            <DialogDescription className="text-[#758A79]">
              Preencha os dados para solicitar a pré-compra deste produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#3D4D40]">Quantidade (kg)</label>
              <Input
                type="number"
                min="1"
                max={selectedProduct?.quantity}
                value={orderData.quantity}
                onChange={(e) => setOrderData({ ...orderData, quantity: Number(e.target.value) })}
                className="border-none rounded-xl"
                style={{ background: 'rgba(118,118,128,0.08)' }}
              />
              <p className="text-xs text-[#758A79]">
                Disponível: <span className="font-bold text-[#2c863b]">{selectedProduct?.quantity.toLocaleString()} kg</span>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#3D4D40]">Local de Entrega</label>
              <Input
                placeholder="Digite o local de entrega"
                value={orderData.location}
                onChange={(e) => setOrderData({ ...orderData, location: e.target.value })}
                className="border-none rounded-xl"
                style={{ background: 'rgba(118,118,128,0.08)' }}
              />
            </div>
            <div className="p-4 rounded-2xl space-y-2" style={{ background: 'rgba(118,118,128,0.06)' }}>
              <div className="flex justify-between text-sm text-[#3D4D40]">
                <span>Preço por kg:</span>
                <span className="font-medium">{selectedProduct?.price.toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between text-sm text-[#3D4D40]">
                <span>Subtotal:</span>
                <span className="font-medium">{(orderData.quantity * (selectedProduct?.price || 0)).toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between text-sm text-[#B07D0A]">
                <span>Taxa de Serviço (10%):</span>
                <span className="font-medium">{(orderData.quantity * (selectedProduct?.price || 0) * TAX_RATE).toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-3 border-t border-black/[0.06] text-[#2c863b]">
                <span>Total Estimado:</span>
                <span>{totalPrice.toLocaleString()} Kz</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPreOrderModalOpen(false)} className="text-[#758A79] rounded-full">
              Cancelar
            </Button>
            <Button onClick={handlePreOrderSubmit} className="bg-[#2c863b] hover:bg-[#256e32] text-white rounded-full">
              Confirmar Pré-Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SearchPage