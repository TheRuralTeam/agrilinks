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
import { R, T } from '../lib/brand'

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
    <div className="min-h-screen pb-20" style={{ background: T.subtle }}>
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderColor: T.rule,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-10 h-10 transition-colors"
              style={{ background: T.g50, color: T.g600, borderRadius: R.sm }}
              onMouseEnter={e => { e.currentTarget.style.background = T.g100 }}
              onMouseLeave={e => { e.currentTarget.style.background = T.g50 }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div
              className="relative flex-1 min-w-0 flex items-center gap-2 px-4 h-10 transition-colors"
              style={{ background: T.subtle, border: `1px solid ${T.rule}`, borderRadius: R.md }}
            >
              <Search className="h-4 w-4 flex-shrink-0" style={{ color: T.faint }} />
              <input
                placeholder="Pesquisar produtos, agricultores..."
                aria-label="Pesquisar produtos e perfis públicos"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm"
                style={{ color: T.ink }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label={showFilters ? 'Fechar filtros' : 'Abrir filtros'}
              aria-expanded={showFilters}
              className="flex items-center justify-center w-10 h-10 flex-shrink-0 transition-colors"
              style={{
                background: showFilters ? T.g600 : T.g50,
                color: showFilters ? T.white : T.g600,
                borderRadius: R.sm,
              }}
              onMouseEnter={e => { if (!showFilters) e.currentTarget.style.background = T.g100 }}
              onMouseLeave={e => { if (!showFilters) e.currentTarget.style.background = T.g50 }}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Categorias rápidas mantêm o formato de etiqueta; os controlos seguem os tokens partilhados. */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {productCategories.map((cat) => {
              const active = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="whitespace-nowrap flex items-center gap-1.5 px-3.5 h-9 text-sm font-medium transition-colors flex-shrink-0"
                  style={{
                    background: active ? T.g600 : T.g50,
                    color: active ? T.white : T.mid,
                    borderRadius: R.pill,
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
          className="border-b p-4 animate-in slide-in-from-top duration-200"
          style={{ background: T.white, borderColor: T.rule }}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold" style={{ color: T.ink }}>Filtros Avançados</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium transition-colors"
                  style={{ color: T.gold }}
                >
                  Limpar Tudo
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2" style={{ color: T.mid }}>
                  <ArrowUpDown className="h-4 w-4" /> Ordenar por
                </label>
                <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                  <SelectTrigger className="border" style={{ background: T.subtle, borderColor: T.rule, borderRadius: R.sm }}>
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
                <label className="text-sm font-semibold flex items-center gap-2" style={{ color: T.mid }}>
                  <Filter className="h-4 w-4" /> Província
                </label>
                <div className="flex flex-wrap gap-2">
                  {angolaProvinces.map(p => {
                    const active = selectedProvince === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleProvinceClick(p.id)}
                        className="cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{
                          background: active ? T.g600 : T.g50,
                          color: active ? T.white : T.muted,
                          borderRadius: R.pill,
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
          <TabsList className="grid w-full grid-cols-3 p-1" style={{ background: T.subtle, borderRadius: R.md }}>
            <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-none" style={{ color: T.g600, borderRadius: R.sm }}>Tudo</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-white data-[state=active]:shadow-none" style={{ color: T.g600, borderRadius: R.sm }}>Produtos</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white data-[state=active]:shadow-none" style={{ color: T.g600, borderRadius: R.sm }}>Usuários</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader compact />
            <p className="font-medium" style={{ color: T.muted }}>Buscando as melhores ofertas...</p>
          </div>
        )}
        {searchError && !loading && (
          <div role="alert" className="border p-6 text-center" style={{ borderColor: T.danger, background: T.dangerBg, borderRadius: R.md }}>
            <p className="font-semibold" style={{ color: T.danger }}>Não foi possível carregar os resultados</p>
            <p className="mt-2 break-words text-sm" style={{ color: T.danger }}>{searchError}</p>
            <Button variant="outline" className="mt-4" onClick={() => void searchData(searchTerm, selectedProvince, selectedCategory)}>Tentar novamente</Button>
          </div>
        )}
        {!loading && !searchError && searchTerm.trim() &&
          (activeTab === 'products' ? sortedProducts.length === 0 : activeTab === 'users' ? userResults.length === 0 : sortedProducts.length === 0 && userResults.length === 0) && (
          <div className="border border-dashed bg-white p-10 text-center" style={{ borderColor: T.rule, borderRadius: R.md }}>
            <Search className="mx-auto mb-3 h-9 w-9" style={{ color: T.faint }} />
            <p className="font-semibold" style={{ color: T.ink }}>Nenhum resultado encontrado</p>
            <p className="mt-2 text-sm" style={{ color: T.muted }}>Tente outro termo ou ajuste os filtros de pesquisa.</p>
          </div>
        )}

        {/* Resultados de Usuários - Grelha de 4 Colunas */}
        {!searchError && (activeTab === 'all' || activeTab === 'users') && userResults.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5" style={{ color: T.g600 }} />
              <h2 className="font-bold text-lg" style={{ color: T.ink }}>Agricultores e Agentes</h2>
              <Badge className="border-none" style={{ background: T.g50, color: T.g600 }}>{userResults.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {userResults.map(user => (
                <button
                  type="button"
                  key={user.id}
                  aria-label={`Ver perfil de ${user.full_name?.trim() || 'Utilizador AgriLink'}`}
                  className="w-full p-4 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 group"
                  style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}
                  onClick={() => navigate(`/perfil/${user.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 transition-colors" style={{ borderColor: T.g50 }}>
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="font-bold" style={{ background: T.g50, color: T.g600 }}>
                        {(user.full_name?.trim() || 'Utilizador AgriLink').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate group-hover:text-primary transition-colors" style={{ color: T.ink }}>
                        {user.full_name?.trim() || 'Utilizador AgriLink'}
                      </p>
                      <p className="text-xs capitalize" style={{ color: T.muted }}>{user.user_type || 'Membro AgriLink'}</p>
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
                <Package className="h-5 w-5" style={{ color: T.g600 }} />
                <h2 className="font-bold text-lg" style={{ color: T.ink }}>Produtos Disponíveis</h2>
                <Badge className="border-none" style={{ background: T.g50, color: T.g600 }}>{sortedProducts.length}</Badge>
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
          <div className="flex flex-col items-center justify-center py-20 text-center" style={{ background: T.white, border: `1px dashed ${T.rule}`, borderRadius: R.md }}>
            <div className="p-6 rounded-full mb-4" style={{ background: T.g50 }}>
              <Search className="h-12 w-12" style={{ color: T.g600 }} />
            </div>
            <h3 className="text-xl font-bold" style={{ color: T.ink }}>Encontre o que precisa</h3>
            <p className="max-w-xs mt-2" style={{ color: T.muted }}>
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
        <DialogContent className="max-w-4xl border" style={{ borderColor: T.rule, borderRadius: R.md }}>
          <DialogHeader>
            <DialogTitle style={{ color: T.g600 }}>Localização do Produto</DialogTitle>
            <DialogDescription style={{ color: T.muted }}>
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
        <DialogContent className="border" style={{ borderColor: T.rule, borderRadius: R.md }}>
          <DialogHeader>
            <DialogTitle style={{ color: T.g600 }}>Pré-Compra de {selectedProduct?.product_type}</DialogTitle>
            <DialogDescription style={{ color: T.muted }}>
              Preencha os dados para solicitar a pré-compra deste produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold" style={{ color: T.mid }}>Quantidade ({selectedProduct?.sale_unit || 'kg'})</label>
              <Input
                type="number"
                min="1"
                max={selectedProduct?.quantity}
                value={orderData.quantity}
                onChange={(e) => setOrderData({ ...orderData, quantity: Number(e.target.value) })}
                className="border"
                style={{ background: T.subtle, borderColor: T.rule, borderRadius: R.sm }}
              />
              <p className="text-xs" style={{ color: T.muted }}>
                Disponível: <span className="font-bold" style={{ color: T.g600 }}>{selectedProduct?.quantity.toLocaleString()} {selectedProduct?.sale_unit || 'kg'}</span>
                {selectedProduct?.min_order_quantity != null && <span className="block mt-1">Mínimo por encomenda: {selectedProduct.min_order_quantity} {selectedProduct.sale_unit || 'kg'}</span>}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold" style={{ color: T.mid }}>Local de Entrega</label>
              <LocationAutocomplete
                value={orderData.location}
                onChange={(location) => setOrderData({ ...orderData, location })}
                onSelectLocation={(location) => setDeliveryCoordinates(location ? { latitude: location.latitude, longitude: location.longitude } : null)}
                placeholder="Ex.: Viana, Luanda ou Bairro/Zona"
                inputClassName="h-10 border text-sm outline-none"
                inputStyle={{ background: T.subtle, borderColor: T.rule, borderRadius: R.sm, color: T.ink }}
              />
            </div>
            <div className="p-4 space-y-2" style={{ background: T.subtle, borderRadius: R.md }}>
              <div className="flex justify-between text-sm" style={{ color: T.mid }}>
                <span>Preço por {selectedProduct?.sale_unit || 'kg'}:</span>
                <span className="font-medium">{selectedProduct?.price.toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between text-sm" style={{ color: T.mid }}>
                <span>Subtotal:</span>
                <span className="font-medium">{(orderData.quantity * (selectedProduct?.price || 0)).toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-3 border-t" style={{ borderColor: T.rule, color: T.g600 }}>
                <span>Valor do produto:</span>
                <span>{totalPrice.toLocaleString()} Kz</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPreOrderModalOpen(false)} className="text-[#758A79]" style={{ color: T.muted, borderRadius: R.sm }}>
              Cancelar
            </Button>
            <Button onClick={handlePreOrderSubmit} className="text-white" style={{ background: T.g600, borderRadius: R.sm }}>
              Enviar Pré-Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SearchPage