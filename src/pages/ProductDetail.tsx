import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import Loader from '../components/ui/Loader';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../components/ProductCard';
import { fetchProductById } from '../features/products/productsService';
import { useAuth } from '../contexts/AuthContext';
import { T } from '../lib/brand';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadProduct = useCallback(async () => {
    if (!id) {
      setProduct(null);
      setLoadError('O endereço do produto é inválido.');
      setLoading(false);
      return;
    }

    const requestId = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchProductById(id, user?.id);
      if (requestId !== requestSequence.current) return;
      setProduct(result as Product | null);
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      console.error('[AgriLink] Não foi possível consultar o produto partilhado:', error);
      setProduct(null);
      setLoadError('Não foi possível consultar este produto. Verifique a ligação e tente novamente.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    void loadProduct();
    return () => { requestSequence.current += 1; };
  }, [loadProduct]);

  return (
    <main className="min-h-screen pb-20" style={{ background: T.canvas }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: 'rgba(247,249,247,0.94)', borderColor: T.rule, backdropFilter: 'blur(16px)' }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <button type="button" aria-label="Voltar" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/app')} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}>
            <ArrowLeft size={17} />
          </button>
          <h1 className="text-sm font-bold" style={{ color: T.ink }}>Produto</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader compact /></div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: T.rule }}>
            <p className="font-semibold" style={{ color: T.ink }}>Não foi possível carregar o produto</p>
            <p className="mt-2 text-sm" style={{ color: T.muted }}>{loadError}</p>
            <Button className="mt-4" onClick={() => void loadProduct()}>Tentar novamente</Button>
          </div>
        ) : !product ? (
          <div className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: T.rule }}>
            <Package size={32} className="mx-auto mb-3" color={T.faint} />
            <p className="font-semibold" style={{ color: T.ink }}>Este produto já não está disponível.</p>
            <p className="mt-2 text-sm" style={{ color: T.muted }}>Pode procurar outras publicações no Marketplace.</p>
            <Button className="mt-4" onClick={() => navigate('/app')}>Ir para o Feed</Button>
          </div>
        ) : (
          <ProductCard product={product} onProductUpdate={setProduct} />
        )}
      </div>
    </main>
  );
};

export default ProductDetail;
