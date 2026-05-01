import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import orbisLinkLogo from '@/assets/orbislink-logo.png'
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MapPin,
  Filter,
  DollarSign,
  Calendar,
  Package,
  Search,
  X,
  Leaf,
  TrendingUp,
  Users,
  Phone,
  Mail,
  Star,
  Heart,
  Share2,
  ArrowRight,
  ArrowLeft,
  Droplet,
  Wind,
  Cloud,
  Navigation,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  User,
  Briefcase,
  MessageSquare,
  Map,
  Zap,
  Eye,
  EyeOff,
  Sliders,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import axios from 'axios';

// --- Tipos ---

interface Product {
  id: string;
  product_type: string;
  quantity: number;
  harvest_date: string;
  price: number;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  farmer_id?: string;
  farmer_phone?: string;
  farmer_email?: string;
  farmer_rating?: number;
  images?: string[];
  image_url?: string;
  contact?: string;
  description?: string;
  logistics_access?: string;
  photos?: string[] | null;
  user_id?: string;
  updated_at?: string;
  location_lat: number | null;
  location_lng: number | null;
  weatherData?: any;
  roadCondition?: string;
  status?: string;
  created_at?: string;
}

interface Farmer {
  id: string;
  name: string;
  email: string;
  phone: string;
  province_id: string;
  municipality_id: string;
  avatar_url?: string;
  rating?: number;
  products_count?: number;
  location_lat?: number;
  location_lng?: number;
}

interface Buyer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name?: string;
  avatar_url?: string;
  rating?: number;
  location_lat?: number;
  location_lng?: number;
}

interface FilterOptions {
  productType: string;
  priceRange: [number, number];
  radius: number;
  userType: 'all' | 'farmers' | 'buyers';
}

// --- Componentes Auxiliares ---

interface ProductCardProps {
  product: Product;
  onClose: () => void;
  onContact: (product: Product) => void;
  onFavorite: (productId: string) => void;
}

/**
 * Card de Produto Modernizado
 * Apresenta informações detalhadas do produto com design elegante
 */
const ProductCard: React.FC<ProductCardProps> = ({ product, onClose, onContact, onFavorite }) => {
  const [isFavorited, setIsFavorited] = useState(false);

  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    onFavorite(product.id);
  };

  const pricePerKg = (product.price / product.quantity).toFixed(2);

  return (
    <div className="absolute bottom-6 right-6 z-40 animate-in slide-in-from-right duration-300">
      <Card className="w-full max-w-sm shadow-2xl bg-white border-0 overflow-hidden hover:shadow-3xl transition-shadow">
        {/* Header com Imagem e Overlay */}
        <div className="relative h-40 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 overflow-hidden">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.product_type}
              className="w-full h-full object-cover opacity-40 hover:opacity-60 transition-opacity"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          
          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full transition-all shadow-lg hover:shadow-xl"
          >
            <X className="h-4 w-4 text-gray-700" />
          </button>

          {/* Badge de Status */}
          {product.status && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-white/95 text-emerald-700 border-0 shadow-lg">
                <Zap className="h-3 w-3 mr-1" />
                {product.status}
              </Badge>
            </div>
          )}

          {/* Título e Agricultor */}
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="text-2xl font-bold text-white drop-shadow-lg">{product.product_type}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-white/95 font-medium">{product.farmer_name}</span>
              {product.farmer_rating && (
                <div className="flex items-center gap-1 ml-auto">
                  <Star className="h-3 w-3 text-yellow-300 fill-yellow-300" />
                  <span className="text-xs text-white/90">{product.farmer_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-5">
          {/* Preço Principal */}
          <div className="mb-5 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Preço Total</p>
                <p className="text-3xl font-bold text-emerald-600">{product.price.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{pricePerKg} AOA/kg</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600 font-medium mb-1">Quantidade</p>
                <p className="text-2xl font-bold text-gray-800">{product.quantity}</p>
                <p className="text-xs text-gray-500">kg</p>
              </div>
            </div>
          </div>

          {/* Informações de Localização e Data */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-gray-600 font-medium">Localização</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 truncate">{product.municipality_id}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-gray-600 font-medium">Colheita</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(product.harvest_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          </div>

          {/* Dados Meteorológicos */}
          {product.weatherData && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 mb-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-900">Condições Meteorológicas</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Temperatura</p>
                  <p className="text-lg font-bold text-blue-600">{Math.round(product.weatherData.main?.temp || 0)}°C</p>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Humidade</p>
                  <p className="text-lg font-bold text-blue-600">{product.weatherData.main?.humidity}%</p>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Vento</p>
                  <p className="text-lg font-bold text-blue-600">{Math.round(product.weatherData.wind?.speed || 0)} m/s</p>
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-2 capitalize">
                {product.weatherData.weather?.[0]?.description}
              </p>
            </div>
          )}

          {/* Contacto do Agricultor */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-5">
            <p className="text-xs text-gray-600 font-medium mb-2">Contacto</p>
            <div className="space-y-2">
              {product.farmer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a href={`tel:${product.farmer_phone}`} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                    {product.farmer_phone}
                  </a>
                </div>
              )}
              {product.farmer_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${product.farmer_email}`} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                    {product.farmer_email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button
              onClick={() => onContact(product)}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 rounded-lg font-medium transition-all hover:shadow-xl"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Contactar
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleFavorite}
              className={`transition-all rounded-lg ${
                isFavorited 
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' 
                  : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600'
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-600' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-gray-200 text-gray-500 hover:border-emerald-200 hover:text-emerald-600 rounded-lg transition-all"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Painel de Estatísticas
 * Mostra informações resumidas sobre os produtos encontrados
 */
interface StatsProps {
  count: number;
  avgPrice: number;
  totalQuantity: number;
}

const StatsPanel: React.FC<StatsProps> = ({ count, avgPrice, totalQuantity }) => (
  <div className="grid grid-cols-3 gap-2">
    <div className="p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-100">
      <p className="text-xs text-gray-600 mb-1">Produtos</p>
      <p className="text-xl font-bold text-emerald-600">{count}</p>
    </div>
    <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
      <p className="text-xs text-gray-600 mb-1">Preço Médio</p>
      <p className="text-xl font-bold text-blue-600">{avgPrice.toLocaleString()}</p>
    </div>
    <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-100">
      <p className="text-xs text-gray-600 mb-1">Total (kg)</p>
      <p className="text-xl font-bold text-amber-600">{totalQuantity}</p>
    </div>
  </div>
);

// --- Componente Principal ---

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const userMarker = useRef<mapboxgl.Marker | null>(null);

  // Estados
  const [mapboxToken] = useState(
    'pk.eyJ1IjoibHVjYW1iYSIsImEiOiJjbWdqY293Z2QwaGRwMmlyNGlwNW4xYXhwIn0.qOjQNe8kbbfmdK5G0MHWDA'
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Busca e Filtros
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showProductsList, setShowProductsList] = useState(true);

  // Filtros
  const [filters, setFilters] = useState<FilterOptions>({
    productType: '',
    priceRange: [0, 10000],
    radius: 50,
    userType: 'all',
  });

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';

  // --- Funções Auxiliares ---

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(100);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      setMapError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesType = !filters.productType || p.product_type.toLowerCase().includes(filters.productType.toLowerCase());
      const matchesPrice = p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1];
      return matchesType && matchesPrice;
    });
  }, [products, filters]);

  const statsData = useMemo(() => {
    if (filteredProducts.length === 0) {
      return { count: 0, avgPrice: 0, totalQuantity: 0 };
    }
    const avgPrice = Math.round(
      filteredProducts.reduce((sum, p) => sum + p.price, 0) / filteredProducts.length
    );
    const totalQuantity = filteredProducts.reduce((sum, p) => sum + p.quantity, 0);
    return { count: filteredProducts.length, avgPrice, totalQuantity };
  }, [filteredProducts]);

  const handleSearch = useCallback(async (value: string) => {
    setSearchText(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${value}.json`,
        { params: { access_token: mapboxToken, limit: 5 } }
      );
      setSearchResults(response.data.features || []);
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setSearchLoading(false);
    }
  }, [mapboxToken]);

  const selectSearchResult = useCallback((result: any) => {
    if (result.center) {
      map.current?.flyTo({ center: result.center, zoom: 12 });
      setSearchText('');
      setSearchResults([]);
    }
  }, []);

  const handleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  const handleContact = useCallback((product: Product) => {
    console.log('Contactar:', product.farmer_name);
  }, []);

  // --- Efeitos ---

  useEffect(() => {
    if (user) fetchProducts();
  }, [user, fetchProducts]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    if (!mapboxgl.supported({ failIfMajorPerformanceCaveat: true } as any)) {
      setMapError('Seu navegador não suporta o mapa.');
      return;
    }

    try {
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [13.234444, -8.838333],
        zoom: 6,
        pitch: 0,
        bearing: 0,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Geolocalização
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setUserLocation([longitude, latitude]);

            const el = document.createElement('div');
            el.className = 'user-marker';
            el.style.width = '32px';
            el.style.height = '32px';
            el.style.backgroundColor = '#10b981';
            el.style.border = '3px solid white';
            el.style.borderRadius = '50%';
            el.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.9)';

            userMarker.current = new mapboxgl.Marker(el)
              .setLngLat([longitude, latitude])
              .addTo(map.current!);
          },
          (error) => console.warn('Geolocalização não disponível:', error)
        );
      }
    } catch (error) {
      console.error('Erro ao inicializar mapa:', error);
      setMapError('Erro ao inicializar mapa');
    }
  }, [mapboxToken]);

  // Adicionar marcadores
  useEffect(() => {
    if (!map.current) return;

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    filteredProducts.forEach((product) => {
      if (product.location_lat && product.location_lng) {
        const el = document.createElement('div');
        el.className = 'product-marker';
        el.style.width = '40px';
        el.style.height = '40px';
        el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%2310b981' stroke='white' stroke-width='2'/%3E%3Ctext x='20' y='26' font-size='16' font-weight='bold' fill='white' text-anchor='middle'%3E%F0%9F%8C%BE%3C/text%3E%3C/svg%3E")`;
        el.style.backgroundSize = 'contain';
        el.style.cursor = 'pointer';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([product.location_lng, product.location_lat])
          .addTo(map.current);

        el.addEventListener('click', () => {
          setSelectedProduct(product);
        });

        markers.current.push(marker);
      }
    });
  }, [filteredProducts]);

  if (mapError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-bold text-gray-900 mb-2">Erro ao Carregar Mapa</p>
            <p className="text-gray-600 text-sm mb-6">{mapError}</p>
            <Button 
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      {/* Mapa */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Header Moderno */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                <Map className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Mapa de Produtos</h1>
                <p className="text-xs text-gray-500">Explore produtos agrícolas locais</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              onClick={() => setShowProductsList(!showProductsList)}
              title={showProductsList ? "Ocultar lista" : "Mostrar lista"}
            >
              {showProductsList ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Sliders className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Barra de Pesquisa Moderna */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 w-11/12 max-w-2xl">
        <div className="relative">
          <div className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow">
            <div className="flex items-center px-6 py-4">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg mr-4 flex-shrink-0">
                <Search className="h-5 w-5 text-white" />
              </div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Pesquisar localização, produto..."
                className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base font-medium"
              />
              {searchLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent mr-2" />
              )}
              {searchText && (
                <button
                  onClick={() => {
                    setSearchText('');
                    setSearchResults([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              )}
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2 px-6 pb-4 overflow-x-auto scrollbar-hide">
              {['Milho', 'Feijão', 'Banana', 'Mandioca'].map((item) => (
                <button
                  key={item}
                  onClick={() => setFilters({ ...filters, productType: item })}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    filters.productType === item
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item}
                </button>
              ))}
              {filters.productType && (
                <button
                  onClick={() => setFilters({ ...filters, productType: '' })}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 whitespace-nowrap transition-all"
                >
                  <X className="h-3 w-3 inline mr-1" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Resultados de Busca */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl max-h-80 overflow-auto border border-gray-100 z-50">
              {searchResults.map((r, index) => (
                <button
                  key={r.id}
                  onClick={() => selectSearchResult(r)}
                  className={`w-full text-left p-4 hover:bg-emerald-50 transition-colors flex items-center gap-3 ${
                    index !== searchResults.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.text || r.place_name?.split(',')[0]}</p>
                    <p className="text-sm text-gray-500 truncate">{r.place_name}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Painel de Filtros Moderno */}
      {showFilters && (
        <div className="absolute top-56 left-6 z-40 bg-white rounded-2xl shadow-2xl p-6 w-96 border border-gray-100 animate-in slide-in-from-left duration-200 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                <Filter className="h-4 w-4 text-white" />
              </div>
              Filtros Avançados
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Tipo de Produto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-emerald-600" />
                Tipo de Produto
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: Milho, Feijão..."
                  value={filters.productType}
                  onChange={(e) =>
                    setFilters({ ...filters, productType: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Faixa de Preço */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Preço Máximo
              </label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">0 AOA</span>
                  <span className="text-lg font-bold text-emerald-600">{filters.priceRange[1].toLocaleString()} AOA</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.priceRange[1]}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      priceRange: [filters.priceRange[0], parseInt(e.target.value)],
                    })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
            </div>

            {/* Raio de Busca */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-emerald-600" />
                Raio de Busca
              </label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">5 km</span>
                  <span className="text-lg font-bold text-emerald-600">{filters.radius} km</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={filters.radius}
                  onChange={(e) =>
                    setFilters({ ...filters, radius: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
            </div>

            {/* Tipo de Usuário */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Mostrar
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'all', label: 'Todos', icon: Users },
                  { value: 'farmers', label: 'Agricultores', icon: Leaf },
                  { value: 'buyers', label: 'Compradores', icon: Briefcase },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        userType: opt.value as FilterOptions['userType'],
                      })
                    }
                    className={`p-3 rounded-lg text-center transition-all font-medium ${
                      filters.userType === opt.value
                        ? 'bg-gradient-to-br from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <opt.icon className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-xs">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setShowFilters(false)}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-6 rounded-lg shadow-lg shadow-emerald-500/30 font-medium transition-all"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
          </div>
        </div>
      )}

      {/* Painel de Produtos Encontrados */}
      {showProductsList && (
        <div className="absolute bottom-6 left-6 z-30 w-96 max-h-96 animate-in slide-in-from-bottom duration-200">
          <Card className="shadow-2xl border-0 overflow-hidden hover:shadow-3xl transition-shadow">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-600 p-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produtos Encontrados
                </CardTitle>
                <Badge className="bg-white/20 text-white border-0 text-sm font-bold px-3">
                  {filteredProducts.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Estatísticas */}
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <StatsPanel 
                  count={statsData.count}
                  avgPrice={statsData.avgPrice}
                  totalQuantity={statsData.totalQuantity}
                />
              </div>

              {/* Lista de Produtos */}
              <div className="max-h-64 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium mb-1">Nenhum produto encontrado</p>
                    <p className="text-gray-500 text-sm">Ajuste os filtros e tente novamente</p>
                  </div>
                ) : (
                  filteredProducts.slice(0, 8).map((p, index) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        if (p.location_lat && p.location_lng) {
                          map.current?.flyTo({ center: [p.location_lng, p.location_lat], zoom: 14 });
                        }
                      }}
                      className={`w-full text-left p-4 hover:bg-emerald-50 transition-all flex items-center gap-3 ${
                        index !== Math.min(filteredProducts.length, 8) - 1 ? 'border-b border-gray-100' : ''
                      }`}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 border border-gray-200">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.product_type} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Leaf className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.product_type}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-emerald-600 font-bold text-sm">{p.price.toLocaleString()} AOA</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500 text-xs">{p.quantity} kg</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500 truncate">{p.farmer_name}</span>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400 -rotate-90 flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>

              {filteredProducts.length > 8 && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-600 font-medium">
                    +{filteredProducts.length - 8} outros produtos
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal do Produto */}
      {selectedProduct && (
        <ProductCard
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onContact={handleContact}
          onFavorite={handleFavorite}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-semibold">Carregando mapa...</p>
            <p className="text-gray-500 text-sm mt-1">Aguarde um momento</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
