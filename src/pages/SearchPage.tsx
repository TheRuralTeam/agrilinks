import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { supabase } from '../integrations/supabase/client'
import { 
  ChevronLeft, Search, Package, User, TrendingUp, Clock, 
  DollarSign, Filter, X, SlidersHorizontal, Wheat, Apple,
  Carrot, Leaf, ArrowUpDown
} from 'lucide-react'
import { angolaProvinces } from '../data/angola-locations'
import { ProductCard, Product as ProductCardType } from '../components/ProductCard'
import { fetchProductsFeed } from '../features/products/productsService'
import { ProductLocationMap } from '../components/ProductLocationMap'
import { useAuth } from '../contexts/AuthContext'
import IdentityActionDialog from '../components/IdentityActionDialog'
import LocationAutocomplete from '../components/LocationAutocomplete'
import { savePreferredDeliveryLocation } from '../features/products/deliveryLocationPreference'
import { validatePreOrderSubmission } from '../features/products/businessRules'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { toast } from 'sonner'
import Loader from '../components/ui/Loader'

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
  full_name: string | null
  user_type: string | null
  avatar_url?: string | null
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
  const { user, userProfile, refreshProfile } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [activeTab, setActiveTab] = useState<TabOption>('all')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [preOrderModalOpen, setPreOrderModalOpen] = useState(false)
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderData, setOrderData] = useState({ quantity: 1, location: '' })
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)

  const searchRequestId = useRef(0)

  const searchData = React.useCallback(async (term: string, province?: string, category?: string) => {
    const requestId = ++searchRequestId.current
    setLoading(true)
    setSearchError(null)
    try {
      const products = await fetchProductsFeed({
        userId: user?.id,
        status: 'active',
        limit: 20,
        province,
        search: term,
        category,
      })

      if (requestId !== searchRequestId.current) return
      setProductResults(products as Product[])

      if (term.trim() && (activeTab === 'all' || activeTab === 'users')) {
        const { data: users, error: usersError } = await supabase
          .from('public_user_profiles')
          .select('id, full_name, user_type, avatar_url')
          .in('user_type', ['agricultor', 'agente'])
          .ilike('full_name', `%${term.trim().replace(/[%(),]/g, ' ')}%`)
          .order('full_name', { ascending: true })
          .limit(20)

        if (usersError) throw usersError
        if (requestId !== searchRequestId.current) return
        setUserResults((users || []) as UserResult[])
      } else {
        setUserResults([])
      }
    } catch (err) {
      if (requestId !== searchRequestId.current) return
      console.error('[AgriLink] Marketplace search failed:', err)
      setSearchError('Não foi possível consultar os resultados. Verifique a ligação e tente novamente.')
    } finally {
      if (requestId === searchRequestId.current) setLoading(false)
    }
  }, [user?.id, activeTab])

  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      searchData(searchTerm, selectedProvince, selectedCategory)
    }, searchTerm.trim() ? 300 : 0)

    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
      searchRequestId.current += 1
    }
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

  const handleOpenMap = (product: Product) => {
    setSelectedProduct(product)
    setMapModalOpen(true)
  }

  const handleOpenPreOrder = (product: Product) => {
    setSelectedProduct(product)
    setOrderData({ quantity: 1, location: '' })
    setDeliveryCoordinates(null)
    setPreOrderModalOpen(true)
  }

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !user) return toast.error('Inicie sessão para continuar')
    if (!userProfile?.identity_document?.trim()) {
      setIdentityDialogOpen(true)
      return
    }

    try {
      const quantity = Number(orderData.quantity || 0)

      validatePreOrderSubmission({
        product: {
          id: selectedProduct.id,
          status: selectedProduct.status,
          quantity: selectedProduct.quantity,
          user_id: selectedProduct.user_id,
          price: selectedProduct.price,
          sale_unit: selectedProduct.sale_unit || 'kg',
          min_order_quantity: selectedProduct.min_order_quantity ?? 1,
        },
        buyer_id: user.id,
        quantity,
        location: orderData.location,
      })


      const idempotencyKey = crypto.randomUUID()

      const { data, error } = await supabase.rpc('create_marketplace_pre_order', {
        p_product_id: selectedProduct.id,
        p_quantity: quantity,
        p_location: orderData.location,
        p_delivery_lat: deliveryCoordinates?.latitude ?? undefined,
        p_delivery_lng: deliveryCoordinates?.longitude ?? undefined,
        p_idempotency_key: idempotencyKey,
      })

      if (error) {
        const message = error.message || ''
        if (message.includes('INSUFFICIENT_STOCK')) throw new Error('A quantidade disponível acabou de ser alterada. Reduza a quantidade e tente novamente.')
        if (message.includes('MIN_ORDER_QUANTITY')) throw new Error(`A quantidade está abaixo do mínimo desta publicação (${selectedProduct.min_order_quantity ?? 1} ${selectedProduct.sale_unit || 'kg'}).`)
        if (message.includes('PRODUCT_NOT_AVAILABLE')) throw new Error('Este produto já não está disponível.')
        if (message.includes('SELLER_CANNOT_BUY_OWN_PRODUCT')) throw new Error('Não pode comprar o seu próprio produto.')
        if (message.includes('DELIVERY_LOCATION_REQUIRED')) throw new Error('Informe o local de entrega.')
        if (message.includes('DELIVERY_COORDINATES_PAIR_REQUIRED') || message.includes('DELIVERY_COORDINATES_INVALID')) throw new Error('O ponto de entrega não foi localizado com precisão. Informe uma localização mais específica e tente novamente.')
        throw error
      }

      const reservation = Array.isArray(data) ? data[0] : data
      if (!reservation) throw new Error('Não foi possível criar a reserva.')

      await savePreferredDeliveryLocation(user.id, orderData.location)
      toast.success('Pré-compra enviada. O local foi guardado e será confirmado antes de iniciar a logística.')
      setPreOrderModalOpen(false)
      setSelectedProduct(null)

      // Notifications are generated server-side by database triggers/jobs.
      // The browser never loops through all agents.
    } catch (error: any) {
      console.error('[AgriLink] Erro ao criar pré-compra:', error)
      toast.error(error?.message || 'Não foi possível concluir a reserva.')
    }
  }

  const clearFilters = () => {
    setSelectedProvince('')
    setSelectedCategory('all')
    setSortBy('recent')
    setSearchTerm('')
  }

  const hasActiveFilters = selectedProvince || selectedCategory !== 'all' || sortBy !== 'recent' || searchTerm

  const totalPrice = selectedProduct ? orderData.quantity * selectedProduct.price : 0

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
                aria-label="Pesquisar produtos e perfis públicos"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-[#111714] placeholder:text-[#A8BAA9]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label={showFilters ? 'Fechar filtros' : 'Abrir filtros'}
              aria-expanded={showFilters}
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
            <Loader compact />
            <p className="text-[#758A79] font-medium">Buscando as melhores ofertas...</p>
          </div>
        )}
        {searchError && !loading && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-900">Não foi possível carregar os resultados</p>
            <p className="mt-2 break-words text-sm text-red-800">{searchError}</p>
            <Button variant="outline" className="mt-4" onClick={() => void searchData(searchTerm, selectedProvince, selectedCategory)}>Tentar novamente</Button>
          </div>
        )}
        {!loading && !searchError && searchTerm.trim() &&
          (activeTab === 'products' ? sortedProducts.length === 0 : activeTab === 'users' ? userResults.length === 0 : sortedProducts.length === 0 && userResults.length === 0) && (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center">
            <Search className="mx-auto mb-3 h-9 w-9 text-[#A8BAA9]" />
            <p className="font-semibold text-[#111714]">Nenhum resultado encontrado</p>
            <p className="mt-2 text-sm text-[#758A79]">Tente outro termo ou ajuste os filtros de pesquisa.</p>
          </div>
        )}

        {/* Resultados de Usuários - Grelha de 4 Colunas */}
        {!searchError && (activeTab === 'all' || activeTab === 'users') && userResults.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-[#2c863b]" />
              <h2 className="font-bold text-lg text-[#111714]">Agricultores e Agentes</h2>
              <Badge className="bg-[#E8F5E9] text-[#2c863b] border-none">{userResults.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {userResults.map(user => (
                <button
                  type="button"
                  key={user.id}
                  aria-label={`Ver perfil de ${user.full_name?.trim() || 'Utilizador AgriLink'}`}
                  className="w-full rounded-2xl p-4 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c863b] group"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)' }}
                  onClick={() => navigate(`/perfil/${user.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-[#E8F5E9] group-hover:border-[#2c863b] transition-colors">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-[#F2FAF3] text-[#2c863b] font-bold">
                        {(user.full_name?.trim() || 'Utilizador AgriLink').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#111714] truncate group-hover:text-[#2c863b] transition-colors">
                        {user.full_name?.trim() || 'Utilizador AgriLink'}
                      </p>
                      <p className="text-xs text-[#758A79] capitalize">{user.user_type || 'Membro AgriLink'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resultados de Produtos - Grelha de 4 Colunas */}
        {!searchError && (activeTab === 'all' || activeTab === 'products') && sortedProducts.length > 0 && (
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
        {!loading && !searchError && !searchTerm && sortedProducts.length === 0 && (
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
      <IdentityActionDialog
        open={identityDialogOpen}
        actionLabel="a pré-compra"
        onOpenChange={setIdentityDialogOpen}
        onCompleted={async () => {
          await refreshProfile()
        }}
      />

      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent className="max-w-4xl border-none rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2c863b]">Localização do Produto</DialogTitle>
            <DialogDescription className="text-[#758A79]">
              {selectedProduct?.product_type} - {selectedProduct?.farmer_name}
            </DialogDescription>
          </DialogHeader>
          <ProductLocationMap
            latitude={selectedProduct?.location_lat}
            longitude={selectedProduct?.location_lng}
            className="h-[400px] border-0"
          />
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
              <label className="text-sm font-bold text-[#3D4D40]">Quantidade ({selectedProduct?.sale_unit || 'kg'})</label>
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
                Disponível: <span className="font-bold text-[#2c863b]">{selectedProduct?.quantity.toLocaleString()} {selectedProduct?.sale_unit || 'kg'}</span>
                {selectedProduct?.min_order_quantity != null && <span className="block mt-1">Mínimo por encomenda: {selectedProduct.min_order_quantity} {selectedProduct.sale_unit || 'kg'}</span>}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#3D4D40]">Local de Entrega</label>
              <LocationAutocomplete
                value={orderData.location}
                onChange={(location) => setOrderData({ ...orderData, location })}
                onSelectLocation={(location) => setDeliveryCoordinates(location ? { latitude: location.latitude, longitude: location.longitude } : null)}
                placeholder="Ex.: Viana, Luanda ou Bairro/Zona"
                inputClassName="h-10 rounded-xl border-none text-sm text-[#111714] placeholder:text-[#758A79] outline-none"
                inputStyle={{ background: 'rgba(118,118,128,0.08)' }}
              />
            </div>
            <div className="p-4 rounded-2xl space-y-2" style={{ background: 'rgba(118,118,128,0.06)' }}>
              <div className="flex justify-between text-sm text-[#3D4D40]">
                <span>Preço por {selectedProduct?.sale_unit || 'kg'}:</span>
                <span className="font-medium">{selectedProduct?.price.toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between text-sm text-[#3D4D40]">
                <span>Subtotal:</span>
                <span className="font-medium">{(orderData.quantity * (selectedProduct?.price || 0)).toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-3 border-t border-black/[0.06] text-[#2c863b]">
                <span>Valor do produto:</span>
                <span>{totalPrice.toLocaleString()} Kz</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPreOrderModalOpen(false)} className="text-[#758A79] rounded-full">
              Cancelar
            </Button>
            <Button onClick={handlePreOrderSubmit} className="bg-[#2c863b] hover:bg-[#256e32] text-white rounded-full">
              Enviar Pré-Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SearchPage