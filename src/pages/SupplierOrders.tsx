import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Package, Phone, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { respondToPreOrder } from '../features/orders/adminPreOrderService';
import { R, T } from '../lib/brand';
import SupplierHandoverEvidenceForm from '../components/SupplierHandoverEvidenceForm';
import SupplierHandoverEvidenceForm from '../components/SupplierHandoverEvidenceForm';

interface SupplierOrder {
  id: string;
  product_id: string;
  user_id: string;
  quantity: number;
  location: string;
  status: string;
  payment_status: string | null;
  total_price: number | null;
  created_at: string;
  product_name: string;
  buyer_name: string;
  buyer_phone: string;
  freight_load_id?: string | null;
  freight_status?: string | null;
  freight_driver_id?: string | null;
  freight_weight_kg?: number | null;
  supplier_handover_confirmed_at?: string | null;
}

const statusLabel: Record<string, string> = {
  pending: 'Aguardando resposta',
  aguardando: 'Aguardando resposta',
  accepted: 'Aceite',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
};

export default function SupplierOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id,product_type')
        .eq('user_id', user.id);
      if (productsError) throw productsError;

      const productIds = (products || []).map((product) => product.id);
      if (productIds.length === 0) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from('pre_orders')
        .select('id,product_id,user_id,quantity,location,status,payment_status,total_price,created_at')
        .in('product_id', productIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const buyerIds = [...new Set((data || []).map((order) => order.user_id).filter(Boolean))];
      const productNames = new Map((products || []).map((product) => [product.id, product.product_type]));
      let buyerNames = new Map<string, { full_name: string; phone: string }>();

      if (buyerIds.length > 0) {
        const { data: buyers, error: buyerError } = await supabase
          .from('users')
          .select('id,full_name,phone')
          .in('id', buyerIds);
        if (buyerError) throw buyerError;
        buyerNames = new Map((buyers || []).map((buyer) => [buyer.id, { full_name: buyer.full_name, phone: buyer.phone || '' }]));
      }

      const orderIds = (data || []).map((order) => order.id);
      const freightByOrder = new Map<string, { id: string; status: string; driver_id: string | null; weight_kg: number; supplier_handover_confirmed_at: string | null }>();
      if (orderIds.length > 0) {
        const { data: freightLoads, error: freightError } = await supabase.from('freight_loads')
          .select('id,pre_order_id,status,driver_id,weight_kg,supplier_handover_confirmed_at')
          .eq('supplier_id', user.id).in('pre_order_id', orderIds);
        if (freightError) throw freightError;
        (freightLoads || []).forEach((load) => {
          if (load.pre_order_id) freightByOrder.set(load.pre_order_id, {
            id: load.id, status: load.status, driver_id: load.driver_id,
            weight_kg: Number(load.weight_kg || 0), supplier_handover_confirmed_at: load.supplier_handover_confirmed_at,
          });
        });
      }
      setOrders((data || []).map((order) => {
        const buyer = buyerNames.get(order.user_id), freight = freightByOrder.get(order.id);
        return {
          ...order, product_name: productNames.get(order.product_id) || 'Produto',
          buyer_name: buyer?.full_name || 'Comprador', buyer_phone: buyer?.phone || '',
          freight_load_id: freight?.id || null, freight_status: freight?.status || null,
          freight_driver_id: freight?.driver_id || null, freight_weight_kg: freight?.weight_kg || null,
          supplier_handover_confirmed_at: freight?.supplier_handover_confirmed_at || null,
        } as SupplierOrder;
      }));
    } catch (error) {
      console.error('Erro ao carregar pedidos do fornecedor:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`supplier-preorders-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_orders' },
        () => { void loadOrders(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadOrders]);

  const respond = async (order: SupplierOrder, status: 'accepted' | 'rejected') => {
    if (busyId) return;
    setBusyId(order.id);
    try {
      await respondToPreOrder(order.id, status);
      toast.success(status === 'accepted' ? 'Pedido aceite.' : 'Pedido recusado.');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível actualizar o pedido.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = orders.filter((order) => order.status === 'pending' || order.status === 'aguardando');
  const closed = orders.filter((order) => !['pending', 'aguardando'].includes(order.status));

  const orderCard = (order: SupplierOrder) => (
    <article
      key={order.id}
      className="overflow-hidden"
      style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.g600 }}>Pedido de compra</p>
            <h3 className="mt-1 font-bold" style={{ color: T.ink }}>{order.product_name}</h3>
            <p className="mt-1 text-sm" style={{ color: T.muted }}>{order.buyer_name}{order.buyer_phone ? ` · ${order.buyer_phone}` : ''}</p>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: order.status === 'accepted' ? T.g50 : order.status === 'rejected' ? T.dangerBg : T.goldBg, color: order.status === 'accepted' ? T.g600 : order.status === 'rejected' ? T.danger : T.gold }}>
            {statusLabel[order.status] || order.status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg p-3" style={{ background: T.canvas, border: `1px solid ${T.rule}` }}>
            <p className="text-[10px]" style={{ color: T.faint }}>Quantidade</p>
            <p className="mt-1 font-bold" style={{ color: T.ink }}>{Number(order.quantity).toLocaleString('pt-AO')} kg</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: T.canvas, border: `1px solid ${T.rule}` }}>
            <p className="text-[10px]" style={{ color: T.faint }}>Total estimado</p>
            <p className="mt-1 font-bold" style={{ color: T.ink }}>{Number(order.total_price || 0).toLocaleString('pt-AO')} Kz</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed" style={{ color: T.muted }}>Entrega: {order.location || 'A combinar'}</p>
        {order.freight_load_id && order.freight_status === 'at_pickup' && order.freight_driver_id && !order.supplier_handover_confirmed_at && (
          <SupplierHandoverEvidenceForm freightLoadId={order.freight_load_id} supplierId={user!.id} expectedQuantityKg={order.freight_weight_kg || 0} onSubmitted={() => void loadOrders()} />
        )}
        {order.freight_load_id && order.supplier_handover_confirmed_at && order.freight_status === 'at_pickup' && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Nota de entrega emitida. Aguardando o motorista confirmar a recepção para iniciar o rastreamento.</div>
        )}
        {order.freight_load_id && order.freight_status === 'at_pickup' && order.freight_driver_id && !order.supplier_handover_confirmed_at && (
          <SupplierHandoverEvidenceForm freightLoadId={order.freight_load_id} supplierId={user!.id} driverId={order.freight_driver_id} expectedQuantityKg={order.freight_weight_kg || order.quantity} onSubmitted={() => void loadOrders()} />
        )}
        {order.freight_load_id && order.supplier_handover_confirmed_at && order.freight_status === 'at_pickup' && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Nota de entrega emitida. Aguardando o motorista confirmar a recepção para iniciar o rastreamento.</div>
        )}

        {['pending', 'aguardando'].includes(order.status) && (
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busyId === order.id} onClick={() => void respond(order, 'rejected')} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-bold" style={{ borderColor: T.danger, color: T.danger, background: T.white }}>
              <Trash2 size={15} /> Recusar
            </button>
            <button type="button" disabled={busyId === order.id} onClick={() => void respond(order, 'accepted')} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold text-white" style={{ background: T.g600 }}>
              <Check size={15} /> Aceitar
            </button>
          </div>
        )}
      </div>
    </article>
  );

  return (
    <main className="min-h-screen pb-28" style={{ background: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: T.white, borderColor: T.rule }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Voltar" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: T.g50, color: T.g600 }}><ArrowLeft size={17} /></button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.g600 }}>AgriLink fornecedor</p>
              <h1 className="text-xl font-bold" style={{ color: T.ink }}>Pedidos de compra</h1>
            </div>
          </div>
          <button type="button" onClick={() => void loadOrders()} className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold" style={{ borderColor: T.rule, color: T.mid }}><RefreshCw size={14} /> Actualizar</button>
        </div>
      </header>

      {loading ? (
        <div className="mx-auto flex max-w-7xl items-center justify-center py-20" style={{ color: T.muted }}>A carregar pedidos…</div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center gap-2"><ShoppingCart size={17} color={T.g600} /><h2 className="font-bold" style={{ color: T.ink }}>Pendentes ({pending.length})</h2></div>
            <div className="grid gap-3">{pending.length ? pending.map(orderCard) : <div className="rounded-xl border p-8 text-center" style={{ borderColor: T.rule, background: T.white, color: T.muted }}><Package className="mx-auto mb-3 h-7 w-7" />Nenhum pedido pendente.</div>}</div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2"><Package size={17} color={T.g600} /><h2 className="font-bold" style={{ color: T.ink }}>Histórico ({closed.length})</h2></div>
            <div className="grid gap-3">{closed.length ? closed.map(orderCard) : <div className="rounded-xl border p-8 text-center" style={{ borderColor: T.rule, background: T.white, color: T.muted }}>Nenhum pedido fechado.</div>}</div>
          </section>
        </div>
      )}
    </main>
  );
}
