import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { ChevronLeft, Search, Package, User } from 'lucide-react'
import { angolaProvinces } from '@/data/angola-locations'
import { ProductCard, Product as ProductCardType } from '@/components/ProductCard'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = 'pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY283Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA'

interface Product extends ProductCardType {}

interface User {
  id: string
  username: string
  full_name: string
  email: string
}

const SearchPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<string>('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [userResults, setUserResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [preOrderModalOpen, setPreOrderModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderData, setOrderData] = useState({ quantity: 1, location: '' })
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<mapboxgl.Map | null>(null)

  const searchData = async (term: string, province?: string) => {
    setLoading(true)
    try {
      // Buscar produtos
      let query = supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
      
      // Aplicar filtro de província se selecionado
      if (province) {
        query = query.eq('province_id', province)
      }
      
      // Aplicar filtro de busca se houver termo
      if (term.trim()) {
        query = query.or(`product_type.ilike.%${term}%,description.ilike.%${term}%,farmer_name.ilike.%${term}%`)
      }

      const { data: products } = await query

      // Enriquecer produtos com likes e comentários
      const productsWithData = await Promise.all(
        (products || []).map(async (product) => {
          const { count: likesCount } = await supabase
            .from('product_likes')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', product.id)

          const { data: userLike } = await supabase
            .from('product_likes')
            .select('id')
            .eq('product_id', product.id)
            .eq('user_id', user?.id || '')
            .maybeSingle()

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

      // Buscar usuários apenas se houver termo de busca
      if (term.trim()) {
        const { data: users } = await supabase
          .from('users')
          .select('*')
          .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)

        setUserResults((users || []) as any)
      } else {
        setUserResults([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchData(searchTerm, selectedProvince)
  }, [searchTerm, selectedProvince])

  const handleProvinceClick = (provinceId: string) => {
    if (selectedProvince === provinceId) {
      setSelectedProvince('')
    } else {
      setSelectedProvince(provinceId)
    }
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
    setPreOrderModalOpen(true)
  }

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !user) return toast.error('Erro ao processar pré-compra')

    try {
      const { error } = await supabase.from('pre_orders').insert({
        product_id: selectedProduct.id,
        user_id: user.id,
        quantity: orderData.quantity,
        location: orderData.location,
        status: 'pending'
      })

      if (error) throw error

      // Criar notificação para o produtor
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

      // Buscar admin users (AgriLink) e criar notificação
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('user_type', 'admin')
      
      if (adminUsers && adminUsers.length > 0) {
        for (const admin of adminUsers) {
          await supabase.rpc('create_notification', {
            p_user_id: admin.id,
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

  React.useEffect(() => {
    if (!mapModalOpen || !selectedProduct?.location_lat || !selectedProduct?.location_lng) return
    if (!mapContainerRef.current) return

    try {
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
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-muted transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold">Pesquisar</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar produtos ou usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        
        {/* Filtro por Província */}
        <div className="mt-3">
          <p className="text-sm font-medium mb-2 text-muted-foreground">Filtrar por Província</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {angolaProvinces.map((province) => (
              <Button
                key={province.id}
                variant={selectedProvince === province.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleProvinceClick(province.id)}
                className="whitespace-nowrap shrink-0"
              >
                {province.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!loading && searchTerm && productResults.length === 0 && userResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum resultado encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Tente buscar por outro termo</p>
          </div>
        )}

        {/* Resultados de Usuários */}
        {userResults.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Usuários</h2>
              <Badge variant="secondary">{userResults.length}</Badge>
            </div>
            <div className="space-y-2">
              {userResults.map(user => (
                <Card 
                  key={user.id} 
                  className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                  onClick={() => navigate(`/perfil/${user.id}`)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {(user.full_name || user.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{user.full_name || user.username}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Resultados de Produtos */}
        {productResults.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Produtos</h2>
              <Badge variant="secondary">{productResults.length}</Badge>
            </div>
            <div className="space-y-6">
              {productResults.map(product => (
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
      </div>

      {/* MAP MODAL */}
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Localização do Produto</DialogTitle>
            <DialogDescription>
              {selectedProduct?.product_type} - {selectedProduct?.farmer_name}
            </DialogDescription>
          </DialogHeader>
          <div ref={mapContainerRef} className="w-full h-[400px] rounded-lg" />
        </DialogContent>
      </Dialog>

      {/* PRE-ORDER MODAL */}
      <Dialog open={preOrderModalOpen} onOpenChange={setPreOrderModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-Compra de {selectedProduct?.product_type}</DialogTitle>
            <DialogDescription>
              Preencha os dados para solicitar a pré-compra deste produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Quantidade (kg)</label>
              <Input
                type="number"
                min="1"
                max={selectedProduct?.quantity}
                value={orderData.quantity}
                onChange={(e) => setOrderData({ ...orderData, quantity: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Disponível: {selectedProduct?.quantity.toLocaleString()} kg
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Local de Entrega</label>
              <Input
                placeholder="Digite o local de entrega"
                value={orderData.location}
                onChange={(e) => setOrderData({ ...orderData, location: e.target.value })}
              />
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Preço por kg:</span>
                <span>{selectedProduct?.price.toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{(orderData.quantity * (selectedProduct?.price || 0)).toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Taxa (10%):</span>
                <span>{(orderData.quantity * (selectedProduct?.price || 0) * TAX_RATE).toLocaleString()} Kz</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>{totalPrice.toLocaleString()} Kz</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreOrderModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePreOrderSubmit}>
              Confirmar Pré-Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SearchPage