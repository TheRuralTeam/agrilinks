import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock3, Eye, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Avatar, AvatarFallback } from "../ui/avatar";
import Loader from "../ui/Loader";
import { toast } from "sonner";
import agrilinkLogo from "../../assets/agrilink-logo.png";
import { getAdminPreOrderStatusLabel } from "../../features/orders/adminPreOrderStatus";

interface TrashOrder {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  location: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
  deleted_until: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
  unit_price?: number | null;
  total_price?: number | null;
  payment_status?: string | null;
  stock_reserved?: boolean | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
}

interface UserSummary {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
}

interface ProductSummary {
  id: string;
  product_type: string;
  user_id: string;
}

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-AO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const getDaysRemaining = (until?: string | null) => {
  if (!until) return null;
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000));
};

const AdminOrderTrash = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<TrashOrder[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<TrashOrder | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringOrderId, setRestoringOrderId] = useState<string | null>(null);

  const loadTrash = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [ordersRes, usersRes, productsRes] = await Promise.all([
        supabase
          .from("pre_orders")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false }),
        supabase.from("users").select("id,full_name,email,phone"),
        supabase.from("products").select("id,product_type,user_id"),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (usersRes.error) throw usersRes.error;
      if (productsRes.error) throw productsRes.error;

      setOrders((ordersRes.data ?? []) as TrashOrder[]);
      setUsers((usersRes.data ?? []) as UserSummary[]);
      setProducts((productsRes.data ?? []) as ProductSummary[]);
    } catch (error) {
      console.error("Erro ao carregar lixeira de pedidos:", error);
      toast.error("Não foi possível carregar a lixeira de pedidos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const restoreOrder = useCallback(async (order: TrashOrder) => {
    if (!order.deleted_until || getDaysRemaining(order.deleted_until) === 0) {
      toast.error("O prazo de recuperação deste registo já terminou.");
      return;
    }

    setRestoringOrderId(order.id);
    try {
      const { error } = await supabase.rpc("admin_restore_pre_order", {
        p_order_id: order.id,
      });
      if (error) throw error;

      toast.success("Registo retirado da lixeira com sucesso.");
      setSelectedOrder((current) => current?.id === order.id ? null : current);
      await loadTrash(true);
    } catch (error) {
      console.error("Erro ao restaurar registo da lixeira:", error);
      toast.error("Não foi possível restaurar o registo. Verifique as permissões, o prazo e o estado financeiro.");
    } finally {
      setRestoringOrderId(null);
    }
  }, [loadTrash]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => {
      const buyer = users.find((user) => user.id === order.user_id);
      const product = products.find((item) => item.id === order.product_id);
      return [
        order.id,
        buyer?.full_name,
        buyer?.email,
        buyer?.phone,
        product?.product_type,
        order.location,
        order.deletion_reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [orders, products, search, users]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F9F6] flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  const selectedBuyer = selectedOrder ? users.find((user) => user.id === selectedOrder.user_id) : null;
  const selectedProduct = selectedOrder ? products.find((product) => product.id === selectedOrder.product_id) : null;
  const selectedDeletedBy = selectedOrder ? users.find((user) => user.id === selectedOrder.deleted_by) : null;

  return (
    <div className="min-h-screen bg-[#F6F9F6] text-[#111714]">
      <header className="sticky top-0 z-20 border-b border-[#DCE8DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admindashboard")} aria-label="Voltar ao painel administrativo">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={agrilinkLogo} alt="AgriLink" className="h-8 w-auto object-contain" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2c863b]">Administração · Pedidos</p>
              <h1 className="truncate text-lg font-extrabold sm:text-xl">Lixeira de pedidos</h1>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void loadTrash(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <Card className="border-[#DCE8DE] shadow-sm">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Pedidos movidos para a lixeira
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Os pedidos removidos administrativamente permanecem aqui durante 15 dias antes da limpeza definitiva.
              </p>
            </div>
            <Badge variant="outline" className="w-fit">{orders.length} {orders.length === 1 ? "pedido" : "pedidos"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar por pedido, cliente, produto ou motivo…"
                className="pl-9"
              />
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CFE0D2] bg-[#FAFCFA] px-6 py-14 text-center">
                <Trash2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h2 className="mt-3 font-bold">{orders.length === 0 ? "A lixeira está vazia" : "Nenhum pedido encontrado"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {orders.length === 0 ? "Quando um pedido for movido para a lixeira, ele aparecerá aqui." : "Altere os termos da pesquisa para encontrar o pedido."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5EDE6]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F7FAF7]">
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Removido em</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Acção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const buyer = users.find((user) => user.id === order.user_id);
                      const product = products.find((item) => item.id === order.product_id);
                      const days = getDaysRemaining(order.deleted_until);
                      return (
                        <TableRow key={order.id} className="hover:bg-[#F8FBF8]">
                          <TableCell className="font-mono text-xs">#{order.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{buyer?.full_name || "Cliente não encontrado"}</div>
                            <div className="text-xs text-muted-foreground">{buyer?.phone || buyer?.email || "Sem contacto"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{product?.product_type || "Produto removido"}</div>
                            <div className="text-xs text-muted-foreground">{order.quantity} kg</div>
                          </TableCell>
                          <TableCell><Badge variant="secondary">{getAdminPreOrderStatusLabel(order.status)}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(order.deleted_at)}</TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1.5 text-xs font-semibold ${days === 0 ? "text-red-600" : "text-amber-700"}`}>
                              <Clock3 className="h-3.5 w-3.5" />
                              {days === 0 ? "A expirar" : `${days} dia(s)`}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSelectedOrder(order)}>
                                <Eye className="h-4 w-4" />
                                Detalhes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={!order.deleted_until || days === 0 || restoringOrderId === order.id}
                                onClick={() => void restoreOrder(order)}
                              >
                                <RotateCcw className={`h-4 w-4 ${restoringOrderId === order.id ? "animate-spin" : ""}`} />
                                Restaurar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Pedido na lixeira
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback>{(selectedBuyer?.full_name || "C").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold">{selectedBuyer?.full_name || "Cliente não encontrado"}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {selectedBuyer?.phone || "Telefone não disponível"} · {selectedBuyer?.email || "Email não disponível"}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">{selectedOrder.id}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Produto</span><p className="mt-1 font-semibold">{selectedProduct?.product_type || "Produto removido"}</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Quantidade</span><p className="mt-1 font-semibold">{selectedOrder.quantity} kg</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Preço unitário</span><p className="mt-1 font-semibold">{selectedOrder.unit_price != null ? `${Number(selectedOrder.unit_price).toLocaleString("pt-AO")} Kz` : "—"}</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Valor total</span><p className="mt-1 font-semibold">{selectedOrder.total_price != null ? `${Number(selectedOrder.total_price).toLocaleString("pt-AO")} Kz` : "—"}</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Estado anterior</span><p className="mt-1 font-semibold">{getAdminPreOrderStatusLabel(selectedOrder.status)}</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Pagamento</span><p className="mt-1 font-semibold">{selectedOrder.payment_status || "—"}</p></div>
                <div className="rounded-xl border p-3 sm:col-span-2"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Local de entrega</span><p className="mt-1 font-semibold break-words">{selectedOrder.location || "—"}</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Removido em</span><p className="mt-1 font-semibold">{formatDate(selectedOrder.deleted_at)}</p></div>
                <div className="rounded-xl border p-3"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Limpeza prevista</span><p className="mt-1 font-semibold">{formatDate(selectedOrder.deleted_until)}</p></div>
                <div className="rounded-xl border p-3 sm:col-span-2"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Removido por</span><p className="mt-1 font-semibold">{selectedDeletedBy?.full_name || selectedOrder.deleted_by || "—"}</p></div>
              </div>

              <div className="rounded-xl border border-[#E5EDE6] bg-[#FAFCFA] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Motivo da remoção</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{selectedOrder.deletion_reason || "Removido pelo administrador."}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrderTrash;
