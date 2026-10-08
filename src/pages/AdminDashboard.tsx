import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Checkbox } from "../components/ui/checkbox";
import Loader from "../components/ui/Loader";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Download,
  Menu,
  X,
  Users,
  ShoppingCart,
  DollarSign,
  Activity,
  Send,
  MessageSquare,
  Eye,
  Trash2,
  Search,
  CheckCircle, XCircle,
  Clock,
  MapPin,
  MoreVertical,
  Package,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  BadgeCheck,
  ShieldCheck,
  ShieldX,
  Check,
  AlertCircle,
  Crown,
  Shield,
  UserCog,
  Lock,
  Star,
  Truck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import agrilinkLogo from "../assets/agrilink-logo.png";
import AdminManagement from "../components/admin/AdminManagement";
import DeliveryTracking from "../components/admin/DeliveryTracking";
import WorkSessionTimer from "../components/admin/WorkSessionTimer";
import MarketPricesManager from "../components/admin/MarketPricesManager";
import { downloadFichaRecebimentoPdf } from "../lib/fichaRecebimentoPdf";
import { downloadMarketplaceTransactionReceipt } from "../features/orders/transactionReceipts";

import { useWorkSession } from "../hooks/useWorkSession";
import {
  getAdminPreOrderStatusLabel,
  isAdminPreOrderStatusFinal,
  type AdminPreOrderStatus,
} from "../features/orders/adminPreOrderStatus";
import { setAdminPreOrderStatus } from "../features/orders/adminPreOrderService";

type AdminPermission = "manage_users" | "manage_products" | "manage_orders" | "manage_support" | "manage_sourcing" | "view_analytics" | "manage_admins";

// --- Tipos ---
interface Product {
  id: string;
  product_type: string;
  quantity: number;
  price: number;
  logistics_access: string;
  user_id: string;
  created_at: string;
}

interface User {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  user_type?: string | null;
  created_at?: string | null;
  verified?: boolean;
  verified_at?: string | null;
  is_root_admin?: boolean;
}

interface Order {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  location: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  unit_price?: number | null;
  payment_status?: string | null;
  stock_reserved?: boolean | null;
  reservation_expires_at?: string | null;
}

interface Transaction {
  id: string;
  wallet_id: string;
  type: string;
  status: string;
  amount: number;
  description?: string | null;
  related_user_id?: string | null;
  created_at: string;
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Ficha {
  id: string;
  user_id: string;
  nome_ficha: string;
  produto: string;
  tipo_negocio: string;
  qualidade?: string | null;
  embalagem?: string | null;
  transporte?: string | null;
  locais_entrega?: unknown;
  telefone?: string | null;
  descricao_final?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

type TabType = "dashboard" | "products" | "users" | "transactions" | "notifications" | "orders" | "fichas" | "sourcing" | "market" | "prices" | "admins" | "referrals" | "deliveries";

interface SourcingRequest {
  id: string;
  user_id: string;
  product_name: string;
  quantity: number;
  delivery_date: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface TopAgent {
  agent_id: string;
  agent_name: string;
  agent_avatar: string | null;
  total_referrals: number;
  total_points: number;
}

interface Referral {
  id: string;
  agent_id: string;
  referred_user_id: string;
  points: number;
  created_at: string;
  agent_name: string;
  agent_avatar: string | null;
  agent_code: string;
  referred_user_name: string;
}

const TAB_TITLES: Record<TabType, string> = {
  dashboard: "Dashboard",
  orders: "Pedidos",
  products: "Produtos",
  users: "Usuários",
  transactions: "Transações",
  notifications: "Notificações",
  fichas: "Fichas de Recebimento",
  sourcing: "AgriLink Sourcing",
  market: "Mercado",
  prices: "Preços de Mercado",
  admins: "Administradores",
  referrals: "Indicações",
  deliveries: "Entregas",
};

// --- Componentes Auxiliares ---
const Detail = ({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) => (
  <div className="rounded-xl border border-[#E5EDE6] bg-white p-3.5">
    <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#758A79]">{label}</div>
    <div className={multiline ? "mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#111714]" : "mt-1 break-words text-sm font-semibold text-[#111714]"}>{value}</div>
  </div>
);

const MetricCard = ({ title, value, trend, trendLabel = "30 dias", icon, color }: {
  title: string;
  value: number | string;
  trend?: number | null;
  trendLabel?: string;
  icon: React.ReactNode;
  color: string;
}) => {
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  return (
    <div className="rounded-2xl p-3 sm:p-5 bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 tracking-tight">{value}</p>
          {trend != null && TrendIcon && (
            <p className={`text-xs sm:text-sm mt-1 flex items-center gap-1 font-semibold ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-gray-500"}`}>
              <TrendIcon className="h-3 w-3" />
              {trend >= 0 ? "+" : ""}{trend}% · {trendLabel}
            </p>
          )}
          {trend == null && (
            <p className="text-[11px] text-gray-400 mt-1">Sem histórico comparável</p>
          )}
        </div>
        <div className={`p-2 sm:p-3 rounded-xl text-white flex-shrink-0 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

/* ── Item de navegação vertical (sidebar) ── */
const SidebarItem = ({ active, onClick, icon, children, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
      active
        ? "bg-primary/10 text-primary"
        : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
    }`}
  >
    <span className={`flex-shrink-0 ${active ? "text-primary" : "text-gray-400"}`}>{icon}</span>
    <span className="flex-1 text-left truncate">{children}</span>
    {badge !== undefined && badge > 0 && (
      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center flex-shrink-0">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
);

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];

// --- Componente Principal ---
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(() => new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedFicha, setSelectedFicha] = useState<Ficha | null>(null);
  const [changingUserType, setChangingUserType] = useState<Set<string>>(() => new Set());
  const [orderRemovalTarget, setOrderRemovalTarget] = useState<Order | null>(null);
  const [adminDeleteTarget, setAdminDeleteTarget] = useState<{ table: string; ids: string[] } | null>(null);
  const [adminDeleteLoading, setAdminDeleteLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([]);
  const [sourcingNoteTarget, setSourcingNoteTarget] = useState<SourcingRequest | null>(null);
  const [sourcingNote, setSourcingNote] = useState("");
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationType, setNotificationType] = useState("info");
  const [targetUser, setTargetUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzingMarket, setAnalyzingMarket] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [isSuperRoot, setIsSuperRoot] = useState(false);
  const [isSupportAgent, setIsSupportAgent] = useState(false);
  const [userPermissions, setUserPermissions] = useState<AdminPermission[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  // Work session tracking for support agents
  const {
    elapsedTimeFormatted,
    isSessionActive,
    stats: workSessionStats,
    endSession
  } = useWorkSession(currentUserId, isSupportAgent);

  // Check admin permissions on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      // Check if root admin or super root
      const { data: userData } = await supabase
        .from("users")
        .select("is_root_admin, is_super_root")
        .eq("id", user.id)
        .single();
      
      if (userData?.is_root_admin) {
        setIsRootAdmin(true);
        setUserPermissions(["manage_users", "manage_products", "manage_orders", "manage_support", "manage_sourcing", "view_analytics", "manage_admins"]);
      }
      
      if ((userData as any)?.is_super_root) {
        setIsSuperRoot(true);
      }

      // Check if support agent
      const { data: isSupportAgentData } = await supabase.rpc('is_support_agent', { _user_id: user.id });
      if (isSupportAgentData) {
        setIsSupportAgent(true);
      }

      // Get specific permissions for non-root admins
      if (!userData?.is_root_admin) {
        const { data: permissions } = await supabase
          .from("admin_permissions")
          .select("permission")
          .eq("user_id", user.id);
        
        if (permissions) {
          setUserPermissions(permissions.map((p) => p.permission as AdminPermission));
        }
      }
    };
    
    checkAdminStatus();
  }, []);

  // Helper to check if user has a specific permission
  const hasPermission = useCallback((permission: AdminPermission) => {
    return isRootAdmin || userPermissions.includes(permission);
  }, [isRootAdmin, userPermissions]);

  useEffect(() => {
    void fetchAllData();
    const interval = setInterval(() => {
      void fetchAllData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAllData = async (silent = false) => {
    // Atualizações periódicas não devem desmontar o painel nem interromper a interação.
    if (!silent) setLoading(true);
    try {
      const [prodRes, usersRes, transRes, notRes, fichasRes, sourcingRes, topAgentsRes, referralsRes, ordersRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
        supabase.from("fichas_recebimento").select("*").order("created_at", { ascending: false }),
        supabase.from("sourcing_requests").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_top_agents_by_referrals", { limit_count: 3 }),
        supabase.from("agent_referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("pre_orders").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      ]);
      // Preservar os dados actuais quando uma consulta falha; não transformar falhas
      // temporárias de rede/RLS em listas vazias no painel.
      if (prodRes.error) console.error("Erro ao carregar produtos:", prodRes.error);
      else setProducts(prodRes.data || []);

      if (usersRes.error) console.error("Erro ao carregar utilizadores:", usersRes.error);
      else setUsers(usersRes.data || []);

      if (transRes.error) console.error("Erro ao carregar transações:", transRes.error);
      else setTransactions(transRes.data || []);

      if (notRes.error) console.error("Erro ao carregar notificações:", notRes.error);
      else setNotifications(notRes.data || []);

      if (fichasRes.error) console.error("Erro ao carregar fichas:", fichasRes.error);
      else setFichas(fichasRes.data || []);

      if (sourcingRes.error) console.error("Erro ao carregar pedidos de sourcing:", sourcingRes.error);
      else setSourcingRequests(sourcingRes.data || []);

      if (topAgentsRes.error) console.error("Erro ao carregar agentes:", topAgentsRes.error);
      else setTopAgents(topAgentsRes.data || []);
      if (ordersRes.error) {
        console.error("Erro ao carregar pedidos:", ordersRes.error);
        toast.error("Não foi possível carregar os pedidos.");
      } else {
        setOrders(ordersRes.data || []);
      }
      
      // Process referrals with user data
      if (referralsRes.data && usersRes.data) {
        const usersMap = new Map(usersRes.data.map(u => [u.id, u]));
        const processedReferrals: Referral[] = referralsRes.data.map((r: any) => {
          const agent = usersMap.get(r.agent_id);
          const referred = usersMap.get(r.referred_user_id);
          return {
            id: r.id,
            agent_id: r.agent_id,
            referred_user_id: r.referred_user_id,
            points: r.points,
            created_at: r.created_at,
            agent_name: agent?.full_name || 'Agente não encontrado',
            agent_avatar: agent?.avatar_url || null,
            agent_code: agent?.agent_code || 'N/A',
            referred_user_name: referred?.full_name || 'Usuário não encontrado',
          };
        });
        setAllReferrals(processedReferrals);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const sendNotification = useCallback(async () => {
    if (!targetUser || !notificationMessage.trim() || !notificationTitle.trim()) {
      toast.error("Preencha todos os campos!");
      return;
    }
    try {
      const { error } = await supabase.rpc("create_notification", {
        p_user_id: targetUser,
        p_type: notificationType,
        p_title: notificationTitle,
        p_message: notificationMessage,
        p_metadata: {}
      });
      if (error) throw error;
      setNotificationModalOpen(false);
      setNotificationMessage("");
      setNotificationTitle("");
      setTargetUser(null);
      toast.success("Notificação enviada!");
    } catch {
      toast.error("Erro ao enviar notificação");
    }
  }, [targetUser, notificationMessage, notificationTitle, notificationType]);

  const handleDelete = useCallback((table: string, id: string) => {
    setAdminDeleteTarget({ table, ids: [id] });
  }, []);

  const handleBulkDelete = useCallback((table: string, ids: Set<string>) => {
    if (ids.size === 0) {
      toast.error("Nenhum item selecionado");
      return;
    }
    setAdminDeleteTarget({ table, ids: Array.from(ids) });
  }, []);

  const confirmAdminDelete = useCallback(async () => {
    const target = adminDeleteTarget;
    if (!target || adminDeleteLoading) return;
    setAdminDeleteLoading(true);
    try {
      const ids = target.ids;
      if (target.table === "users") {
        const { data, error } = await supabase.rpc(ids.length === 1 ? "admin_delete_user" : "admin_bulk_delete_users",
          ids.length === 1 ? { p_user_id: ids[0] } : { p_user_ids: ids });
        if (error) throw error;
        setUsers((prev) => prev.filter((item) => !ids.includes(item.id)));
        setProducts((prev) => prev.filter((p) => !ids.includes(p.user_id)));
        setSelectedUsers(new Set());
        toast.success(`${Number(data || ids.length)} utilizador(es) removido(s).`);
      } else if (target.table === "products") {
        const { data, error } = await supabase.rpc(ids.length === 1 ? "admin_delete_product" : "admin_bulk_delete_products",
          ids.length === 1 ? { p_product_id: ids[0] } : { p_product_ids: ids });
        if (error) throw error;
        setProducts((prev) => prev.filter((item) => !ids.includes(item.id)));
        setSelectedProducts(new Set());
        toast.success(`${Number(data || ids.length)} produto(s) removido(s).`);
      } else if (target.table === "fichas_recebimento") {
        const { data, error } = await supabase.rpc(
          ids.length === 1 ? "admin_delete_ficha_recebimento" : "admin_bulk_delete_fichas_recebimento",
          ids.length === 1 ? { p_ficha_id: ids[0] } : { p_ficha_ids: ids },
        );
        if (error) throw error;
        setFichas((prev) => prev.filter((item) => !ids.includes(item.id)));
        toast.success(`${Number(data || ids.length)} ficha(s) removida(s).`);
      } else {
        throw new Error("Tipo de registo administrativo não suportado.");
      }
      setAdminDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao remover registos:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a remoção.");
    } finally {
      setAdminDeleteLoading(false);
    }
  }, [adminDeleteTarget, adminDeleteLoading]);

  const toggleSelectUser = useCallback((id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllUsers = useCallback((allUsers: User[]) => {
    setSelectedUsers(prev => prev.size === allUsers.length ? new Set() : new Set(allUsers.map(u => u.id)));
  }, []);

  const toggleSelectAllProducts = useCallback((allProducts: Product[]) => {
    setSelectedProducts(prev => prev.size === allProducts.length ? new Set() : new Set(allProducts.map(p => p.id)));
  }, []);

  const markNotificationAsRead = useCallback(async (id: string) => {
    if (!hasPermission("manage_support") && !isSupportAgent) {
      toast.error("Não tem permissão para gerir notificações.");
      return;
    }

    const previous = notifications.find((notification) => notification.id === id);
    if (!previous || previous.read) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      toast.error("Não foi possível atualizar a notificação.");
      return;
    }

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, [hasPermission, isSupportAgent, notifications]);

  const requestRemovePreOrder = useCallback((order: Order) => {
    if (!hasPermission("manage_orders") && !isSupportAgent) {
      toast.error("Sem permissão para remover pedidos.");
      return;
    }
    setSelectedOrder(null);
    setOrderRemovalTarget(order);
  }, [hasPermission, isSupportAgent]);

  const confirmRemovePreOrder = useCallback(async () => {
    const order = orderRemovalTarget;
    if (!order) return;
    setOrderRemovalTarget(null);
    setUpdatingOrders((previous) => new Set(previous).add(order.id));
    try {
      const { error } = await supabase.rpc("admin_remove_pre_order", {
        p_order_id: order.id,
        p_reason: "Removido pelo painel administrativo",
      });
      if (error) throw error;
      setOrders((prev) => prev.filter((item) => item.id !== order.id));
      toast.success("Pedido movido para a lixeira por 15 dias.");
    } catch (error) {
      console.error("Erro ao remover pedido:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o pedido.");
    } finally {
      setUpdatingOrders((previous) => {
        const next = new Set(previous);
        next.delete(order.id);
        return next;
      });
    }
  }, [orderRemovalTarget]);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: AdminPreOrderStatus) => {
    if (!isSupportAgent && !hasPermission("manage_orders")) {
      toast.error("Não tem permissão para gerir pedidos.");
      return;
    }

    setUpdatingOrders((previous) => new Set(previous).add(orderId));
    try {
      const updatedOrder = await setAdminPreOrderStatus(orderId, newStatus);

      setOrders((previous) => previous.map((order) => (
        order.id === updatedOrder.id
          ? { ...order, status: updatedOrder.status }
          : order
      )));
      toast.success(`Pedido atualizado: ${getAdminPreOrderStatusLabel(updatedOrder.status)}.`);
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.");
    } finally {
      setUpdatingOrders((previous) => {
        const next = new Set(previous);
        next.delete(orderId);
        return next;
      });
    }
  }, [hasPermission, isSupportAgent]);

  const updateSourcingStatus = useCallback(async (id: string, newStatus: string, adminNotes?: string) => {
    if (!hasPermission("manage_sourcing")) {
      toast.error("Não tem permissão para gerir pedidos de sourcing.");
      return;
    }

    const allowedStatuses = new Set(["pending", "in_progress", "completed", "rejected"]);
    if (!allowedStatuses.has(newStatus)) {
      toast.error("Estado de sourcing inválido.");
      return;
    }

    const updateData: { status: string; admin_notes?: string } = { status: newStatus };
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
    
    const { error } = await supabase.from("sourcing_requests").update(updateData).eq("id", id);
    if (!error) {
      setSourcingRequests((prev) => prev.map((s) => (s.id === id ? { ...s, ...updateData } : s)));
      toast.success(`Pedido de sourcing atualizado`);
    } else {
      toast.error("Erro ao atualizar pedido");
    }
  }, [hasPermission]);

  const changeUserType = useCallback(async (userId: string, userType: User["user_type"]) => {
    if (!userType || !hasPermission("manage_users")) {
      toast.error("Não tem permissão para alterar o tipo de utilizador.");
      return;
    }
    setChangingUserType((prev) => new Set(prev).add(userId));
    try {
      const enumMap: Record<string, string> = {
        agricultor: "agricultor",
        comprador: "comprador",
        agente: "agente",
        motorista: "motorista",
      };
      const nextType = enumMap[userType];
      if (!nextType) throw new Error("Tipo de utilizador inválido.");
      const { data, error } = await supabase.rpc("admin_set_user_type", {
        p_user_id: userId,
        p_user_type: nextType,
      });
      if (error) throw error;
      const updated = data?.[0];
      if (!updated) throw new Error("O servidor não confirmou a alteração.");
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, user_type: updated.user_type } : u));
      toast.success("Tipo de utilizador atualizado.");
    } catch (error) {
      console.error("Erro ao alterar tipo de utilizador:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o tipo.");
    } finally {
      setChangingUserType((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  }, [hasPermission]);

  const toggleUserVerification = useCallback(async (userId: string, currentVerified: boolean) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ 
          verified: !currentVerified,
          verified_at: !currentVerified ? new Date().toISOString() : null
        })
        .eq("id", userId);
      
      if (error) throw error;
      
      setUsers((prev) => prev.map((u) => 
        u.id === userId ? { ...u, verified: !currentVerified, verified_at: !currentVerified ? new Date().toISOString() : null } : u
      ));
      
      toast.success(!currentVerified ? "Usuário verificado com sucesso!" : "Verificação removida");
    } catch (error) {
      console.error("Erro ao atualizar verificação:", error);
      toast.error("Erro ao atualizar status de verificação");
    }
  }, []);

  const generateMarketAnalysis = useCallback(async () => {
    if (products.length === 0) {
      toast.error("Sem produtos para analisar");
      return;
    }
    setAnalyzingMarket(true);
    try {
      const savedLang = localStorage.getItem('orbislink_language') || 'pt';
      const { data, error } = await supabase.functions.invoke('market-analysis', {
        body: { products, language: savedLang }
      });
      if (error) throw error;
      setAiAnalysis(data.analysis);
      toast.success("Análise gerada com sucesso!");
    } catch (error) {
      console.error("Error generating analysis:", error);
      toast.error("Erro ao gerar análise");
    } finally {
      setAnalyzingMarket(false);
    }
  }, [products]);

  const get30DayTrend = useCallback((items: Array<{ created_at: string | null | undefined }>) => {
    const now = Date.now();
    const currentStart = now - 30 * 24 * 60 * 60 * 1000;
    const previousStart = now - 60 * 24 * 60 * 60 * 1000;
    const current = items.filter((item) => {
      const t = item.created_at ? new Date(item.created_at).getTime() : NaN;
      return Number.isFinite(t) && t >= currentStart;
    }).length;
    const previous = items.filter((item) => {
      const t = item.created_at ? new Date(item.created_at).getTime() : NaN;
      return Number.isFinite(t) && t >= previousStart && t < currentStart;
    }).length;
    if (previous === 0) return current === 0 ? null : null;
    return Math.round(((current - previous) / previous) * 100);
  }, []);

  const productTrend = useMemo(() => get30DayTrend(products), [products, get30DayTrend]);
  const userTrend = useMemo(() => get30DayTrend(users), [users, get30DayTrend]);
  const orderTrend = useMemo(() => get30DayTrend(orders), [orders, get30DayTrend]);
  const transactionTrend = useMemo(() => get30DayTrend(transactions), [transactions, get30DayTrend]);

  // --- Dados para Gráficos ---
  const chartDataRevenue = useMemo(() => {
    const data: Record<string, number> = {};
    transactions.forEach((t) => {
      const date = new Date(t.created_at).toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
      data[date] = (data[date] || 0) + t.amount;
    });
    return Object.entries(data).slice(-7).map(([date, amount]) => ({ date, amount }));
  }, [transactions]);

  const chartDataProducts = useMemo(() => {
    const data: Record<string, number> = {};
    products.forEach((p) => { data[p.product_type] = (data[p.product_type] || 0) + 1; });
    return Object.entries(data).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [products]);

  const chartDataTransactionStatus = useMemo(() => {
    const data: Record<string, number> = { completed: 0, pending: 0, failed: 0, blocked: 0 };
    transactions.forEach((t) => { if (data[t.status] !== undefined) data[t.status]++; });
    return Object.entries(data).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterStatus === "unread") return !n.read;
      if (filterStatus === "read") return n.read;
      return true;
    });
  }, [notifications, filterStatus]);

  const filteredProducts = useMemo(() => products.filter((p) => p.product_type.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);
  const filteredUsers = useMemo(() => users.filter((u) => (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())), [users, searchTerm]);
  const filteredFichas = useMemo(() => fichas.filter((f) => f.nome_ficha.toLowerCase().includes(searchTerm.toLowerCase()) || f.produto.toLowerCase().includes(searchTerm.toLowerCase())), [fichas, searchTerm]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-100 text-green-700",
      concluida: "bg-green-100 text-green-700",
      accepted: "bg-green-100 text-green-700",
      pending: "bg-amber-100 text-amber-700",
      aguardando: "bg-amber-100 text-amber-700",
      rejected: "bg-red-100 text-red-700",
      in_progress: "bg-blue-100 text-blue-700",
      failed: "bg-red-100 text-red-700",
      cancelado: "bg-red-100 text-red-700",
      cancelled: "bg-red-100 text-red-700",
      blocked: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-600";
  };

  if (loading && products.length === 0) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-[#F7F9F7]">

      {/* ═══ SIDEBAR (navegação vertical) ═══════════════════════════════════ */}
      <aside className={`fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100 flex-shrink-0">
          <img src={agrilinkLogo} alt="AgriLink" className="h-8 w-auto object-contain" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">Painel Admin</p>
            <p className="text-[11px] text-gray-400 leading-tight">AgriLink</p>
          </div>
          <button className="md:hidden ml-auto p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0" onClick={() => setMenuOpen(false)}>
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <SidebarItem active={activeTab === "dashboard"} onClick={() => { setActiveTab("dashboard"); setMenuOpen(false); }} icon={<Activity className="h-4 w-4" />}>
            Dashboard
          </SidebarItem>
          <SidebarItem active={activeTab === "orders"} onClick={() => { setActiveTab("orders"); setMenuOpen(false); }} icon={<ShoppingCart className="h-4 w-4" />}>
            Pedidos
          </SidebarItem>
          {hasPermission("manage_products") && (
            <SidebarItem active={activeTab === "products"} onClick={() => { setActiveTab("products"); setMenuOpen(false); }} icon={<Package className="h-4 w-4" />}>
              Produtos
            </SidebarItem>
          )}
          {hasPermission("manage_users") && (
            <SidebarItem active={activeTab === "users"} onClick={() => { setActiveTab("users"); setMenuOpen(false); }} icon={<Users className="h-4 w-4" />}>
              Usuários
            </SidebarItem>
          )}
          <SidebarItem active={activeTab === "transactions"} onClick={() => { setActiveTab("transactions"); setMenuOpen(false); }} icon={<DollarSign className="h-4 w-4" />}>
            Transações
          </SidebarItem>
          <SidebarItem active={activeTab === "notifications"} onClick={() => { setActiveTab("notifications"); setMenuOpen(false); }} icon={<Bell className="h-4 w-4" />} badge={unreadCount}>
            Notificações
          </SidebarItem>
          <SidebarItem active={activeTab === "fichas"} onClick={() => { setActiveTab("fichas"); setMenuOpen(false); }} icon={<FileText className="h-4 w-4" />}>
            Fichas
          </SidebarItem>
          {hasPermission("manage_sourcing") && (
            <SidebarItem active={activeTab === "sourcing"} onClick={() => { setActiveTab("sourcing"); setMenuOpen(false); }} icon={<TrendingUp className="h-4 w-4" />} badge={sourcingRequests.filter(s => s.status === 'pending').length}>
              Sourcing
            </SidebarItem>
          )}
          {hasPermission("view_analytics") && (
            <SidebarItem active={activeTab === "market"} onClick={() => { setActiveTab("market"); setMenuOpen(false); }} icon={<Activity className="h-4 w-4" />}>
              Mercado
            </SidebarItem>
          )}
          <SidebarItem active={activeTab === "prices"} onClick={() => { setActiveTab("prices"); setMenuOpen(false); }} icon={<DollarSign className="h-4 w-4" />}>
            Preços de Mercado
          </SidebarItem>
          {(isRootAdmin || hasPermission("manage_admins")) && (
            <SidebarItem active={activeTab === "admins"} onClick={() => { setActiveTab("admins"); setMenuOpen(false); }} icon={<Crown className="h-4 w-4" />}>
              Admins
            </SidebarItem>
          )}
          {hasPermission("view_analytics") && (
            <SidebarItem active={activeTab === "referrals"} onClick={() => { setActiveTab("referrals"); setMenuOpen(false); }} icon={<Star className="h-4 w-4" />} badge={allReferrals.length}>
              Indicações
            </SidebarItem>
          )}
          {(isSupportAgent || hasPermission("manage_orders")) && (
            <SidebarItem active={activeTab === "deliveries"} onClick={() => { setActiveTab("deliveries"); setMenuOpen(false); }} icon={<Truck className="h-4 w-4" />}>
              Entregas
            </SidebarItem>
          )}
        </nav>

        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          {isRootAdmin && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl bg-amber-50 border border-amber-100">
              <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-amber-700 truncate">Root Admin</span>
            </div>
          )}
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </button>
        </div>
      </aside>

      {/* Overlay para fechar a sidebar em mobile */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/25 z-30 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* ═══ CONTEÚDO PRINCIPAL ═══════════════════════════════════════════════ */}
      <div className="md:pl-64">

        {/* Top bar fina */}
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button className="md:hidden p-2 hover:bg-gray-100 rounded-xl flex-shrink-0" onClick={() => setMenuOpen(true)}>
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{TAB_TITLES[activeTab]}</h1>
            </div>
            <button
              onClick={() => setActiveTab("notifications")}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Support Agent Work Timer */}
        {isSupportAgent && (
          <WorkSessionTimer
            elapsedTimeFormatted={elapsedTimeFormatted}
            isSessionActive={isSessionActive}
            stats={workSessionStats}
            onEndSession={endSession}
          />
        )}

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <MetricCard title="Produtos" value={products.length} icon={<Package className="h-5 w-5 sm:h-6 sm:w-6" />} trend={productTrend} color="bg-primary" />
              <MetricCard title="Usuários" value={users.length} icon={<Users className="h-5 w-5 sm:h-6 sm:w-6" />} trend={userTrend} color="bg-primary" />
              <MetricCard title="Pedidos" value={orders.length} icon={<ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />} trend={orderTrend} color="bg-primary" />
              <MetricCard title="Transações" value={transactions.length} icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />} trend={transactionTrend} color="bg-primary" />
            </div>

            {/* Top 3 Agentes Leaderboard */}
            <Card className="border border-border shadow-soft bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Top 3 Agentes - Maiores Indicadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topAgents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">Nenhum agente com indicações ainda</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {topAgents.map((agent, index) => (
                      <div
                        key={agent.agent_id}
                        className={`relative p-3 sm:p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                          index === 0 
                            ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-700' 
                            : index === 1 
                            ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800/50 dark:to-slate-700/50 dark:border-slate-600'
                            : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 dark:border-orange-700'
                        }`}
                      >
                        <div className={`absolute -top-2 -left-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                          index === 0 
                            ? 'bg-amber-500 text-white' 
                            : index === 1 
                            ? 'bg-slate-400 text-white'
                            : 'bg-orange-400 text-white'
                        }`}>
                          {index + 1}º
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-2">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-primary/20">
                            <AvatarImage src={agent.agent_avatar || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm font-bold">
                              {agent.agent_name?.charAt(0) || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs sm:text-sm truncate">{agent.agent_name}</p>
                            <div className="flex items-center gap-2 sm:gap-3 mt-1">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-primary" />
                                <span className="text-xs font-medium">{agent.total_referrals}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-amber-500" />
                                <span className="text-xs font-medium">{agent.total_points} pts</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="border border-border shadow-soft bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base font-semibold">Receita por Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartDataRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-soft bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base font-semibold">Top Produtos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartDataProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-soft bg-card lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base font-semibold">Status das Transações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={chartDataTransactionStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ value }) => `${value}`}>
                          {chartDataTransactionStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {chartDataTransactionStatus.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs sm:text-sm text-muted-foreground capitalize">{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* PEDIDOS */}
        {activeTab === "orders" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Pedidos ({orders.length})
              </CardTitle>
              {(hasPermission("manage_orders") || isSupportAgent) && (
                <Button variant="outline" size="sm" onClick={() => navigate("/admindashboard/pedidos/lixeira")}>
                  <Trash2 className="h-4 w-4 mr-2" /> Lixeira · 15 dias
                </Button>
              )}
            </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const user = users.find((u) => u.id === order.user_id);
                    const product = products.find((p) => p.id === order.product_id);
                    return (
                      <TableRow key={order.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                        <TableCell className="font-medium">
                          <button type="button" className="text-left text-primary hover:underline font-semibold" onClick={() => setSelectedOrder(order)}>
                            {product?.product_type || "Produto não encontrado"}
                          </button>
                        </TableCell>
                        <TableCell>
                          <button type="button" className="text-left hover:underline" onClick={() => setSelectedOrder(order)}>
                            {user?.full_name || "Cliente não encontrado"}
                          </button>
                        </TableCell>
                        <TableCell>{order.quantity} kg</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>{getAdminPreOrderStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:bg-primary/10 hover:text-primary"
                              aria-label="Ver detalhes do pedido"
                              title="Ver detalhes"
                              onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                              aria-label="Mover pedido para a lixeira"
                              title="Mover para lixeira por 15 dias"
                              onClick={(e) => { e.stopPropagation(); requestRemovePreOrder(order); }}
                              disabled={updatingOrders.has(order.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600"
                              aria-label="Aceitar pedido"
                              title="Aceitar pedido"
                              onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "accepted"); }}
                              disabled={updatingOrders.has(order.id) || isAdminPreOrderStatusFinal(order.status) || order.status === "accepted"}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-amber-600"
                              aria-label="Voltar pedido para pendente"
                              title="Voltar para pendente"
                              onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, "pending"); }}
                              disabled={updatingOrders.has(order.id) || isAdminPreOrderStatusFinal(order.status) || order.status === "pending" || order.status === "aguardando"}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

<Dialog open={!!orderRemovalTarget} onOpenChange={(open) => { if (!open) setOrderRemovalTarget(null); }}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-2xl border-primary/20 p-0 overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <div className="p-6">
              <DialogHeader>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white border border-primary/15 shadow-sm p-2">
                  <img src={agrilinkLogo} alt="AgriLink" className="h-full w-full object-contain" />
                </div>
                <DialogTitle className="text-center text-lg">Mover pedido para a lixeira?</DialogTitle>
              </DialogHeader>
              {orderRemovalTarget && (
                <div className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 text-center">
                  <p className="font-semibold text-gray-900">{products.find((p) => p.id === orderRemovalTarget.product_id)?.product_type || "Pedido"}</p>
                  <p className="mt-1 text-xs text-gray-500">{users.find((u) => u.id === orderRemovalTarget.user_id)?.full_name || "Cliente"} · {orderRemovalTarget.quantity} kg</p>
                  <p className="mt-3 text-xs leading-5 text-gray-500">O pedido ficará no histórico de lixo durante 15 dias antes da limpeza automática.</p>
                </div>
              )}
              <DialogFooter className="mt-5 gap-2 sm:justify-end">
                <Button variant="ghost" onClick={() => setOrderRemovalTarget(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => void confirmRemovePreOrder()} disabled={!!orderRemovalTarget && updatingOrders.has(orderRemovalTarget.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Mover para lixeira
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader><DialogTitle>Detalhes da pré-compra</DialogTitle></DialogHeader>
            {selectedOrder && (() => {
              const buyer = users.find((u) => u.id === selectedOrder.user_id);
              const product = products.find((p) => p.id === selectedOrder.product_id);
              const total = selectedOrder.unit_price != null ? Number(selectedOrder.unit_price) * Number(selectedOrder.quantity) : null;
              return <div className="space-y-4 text-sm">
                <div className="rounded-xl border p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">CLIENTE</p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback>{(buyer?.full_name || "C").slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{buyer?.full_name || "Cliente não encontrado"}</p>
                      <p className="text-xs text-gray-500 break-all">{buyer?.phone || "Telefone não disponível"} · {buyer?.email || "Email não disponível"}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 rounded-xl bg-gray-50 p-3"><span className="text-xs text-gray-500">ID DO PEDIDO</span><p className="font-medium break-all">{selectedOrder.id}</p></div>
                  <div><span className="text-xs text-gray-500">Produto</span><p className="font-medium">{product?.product_type || "Produto não encontrado"}</p></div>
                  <div><span className="text-xs text-gray-500">Quantidade</span><p className="font-medium">{selectedOrder.quantity} kg</p></div>
                  <div><span className="text-xs text-gray-500">Preço unitário</span><p className="font-medium">{selectedOrder.unit_price != null ? Number(selectedOrder.unit_price).toLocaleString("pt-AO") + " Kz" : "—"}</p></div>
                  <div><span className="text-xs text-gray-500">Valor total estimado</span><p className="font-medium">{total != null ? total.toLocaleString("pt-AO") + " Kz" : "—"}</p></div>
                  <div><span className="text-xs text-gray-500">Estado</span><p className="font-medium">{getAdminPreOrderStatusLabel(selectedOrder.status)}</p></div>
                  <div><span className="text-xs text-gray-500">Pagamento</span><p className="font-medium">{selectedOrder.payment_status || "—"}</p></div>
                  <div className="sm:col-span-2"><span className="text-xs text-gray-500">Local de entrega</span><p className="font-medium break-words">{selectedOrder.location || "—"}</p></div>
                  <div><span className="text-xs text-gray-500">Coordenadas de entrega</span><p className="font-medium">{selectedOrder.destination_lat != null && selectedOrder.destination_lng != null ? selectedOrder.destination_lat + ", " + selectedOrder.destination_lng : "—"}</p></div>
                  <div><span className="text-xs text-gray-500">Stock reservado</span><p className="font-medium">{selectedOrder.stock_reserved ? "Sim" : "Não"}</p></div>
                  <div><span className="text-xs text-gray-500">Criado em</span><p className="font-medium">{new Date(selectedOrder.created_at).toLocaleString("pt-AO")}</p></div>
                  <div><span className="text-xs text-gray-500">Atualizado em</span><p className="font-medium">{selectedOrder.updated_at ? new Date(selectedOrder.updated_at).toLocaleString("pt-AO") : "—"}</p></div>
                  <div className="sm:col-span-2"><span className="text-xs text-gray-500">ID do cliente</span><p className="font-medium break-all">{selectedOrder.user_id}</p></div>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-[#E5EDE6] pt-4 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => { if (selectedOrder) void downloadMarketplaceTransactionReceipt(selectedOrder.id) }}>
                    <FileText className="mr-2 h-4 w-4" /> Comprovante PDF
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedOrder(null)}>Fechar</Button>
                  {(hasPermission("manage_orders") || isSupportAgent) && !["accepted", "completed", "concluida"].includes(selectedOrder.status) && (
                    <Button variant="destructive" onClick={() => requestRemovePreOrder(selectedOrder)} disabled={updatingOrders.has(selectedOrder.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Mover para lixeira
                    </Button>
                  )}
                </div>
              </div>;
            })()}
          </DialogContent>
        </Dialog>

        {/* PRODUTOS */}
        {activeTab === "products" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Produtos ({filteredProducts.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedProducts.size > 0 && (
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleBulkDelete("products", selectedProducts)}>
                    <Trash2 className="h-4 w-4" /> Apagar ({selectedProducts.size})
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-48 h-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                        onCheckedChange={() => toggleSelectAllProducts(filteredProducts)}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const user = users.find((u) => u.id === product.user_id);
                    return (
                      <TableRow key={product.id} className={`hover:bg-gray-50/50 ${selectedProducts.has(product.id) ? "bg-primary/5" : ""}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => toggleSelectProduct(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.product_type}</TableCell>
                        <TableCell>{product.quantity} kg</TableCell>
                        <TableCell>{product.price?.toFixed(2)} Kz</TableCell>
                        <TableCell>{user?.full_name || "-"}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            (product as any).status === 'active' ? 'bg-green-100 text-green-700' :
                            (product as any).status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                            (product as any).status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {(product as any).status === 'pending_approval' ? 'Pendente' :
                             (product as any).status === 'active' ? 'Aprovado' :
                             (product as any).status === 'rejected' ? 'Rejeitado' : (product as any).status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(product.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(product as any).status === 'pending_approval' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const { error } = await supabase.rpc('admin_approve_product', { p_product_id: product.id });
                                      if (error) return toast.error(error.message);
                                      setProducts((prev) => prev.map((p: any) => p.id === product.id ? { ...p, status: 'active' } : p));
                                      toast.success('Produto aprovado e visível no feed');
                                    }}
                                    className="text-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" /> Aprovar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const { error } = await supabase.rpc('admin_reject_product', { p_product_id: product.id });
                                      if (error) return toast.error(error.message);
                                      setProducts((prev) => prev.map((p: any) => p.id === product.id ? { ...p, status: 'rejected' } : p));
                                      toast.success('Produto rejeitado');
                                    }}
                                    className="text-amber-700"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" /> Rejeitar
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem onClick={() => { setTargetUser(product.user_id); setNotificationModalOpen(true); }}>
                                <Bell className="h-4 w-4 mr-2" /> Notificar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete("products", product.id)} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" /> Apagar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* USUÁRIOS */}
        {activeTab === "users" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Usuários ({filteredUsers.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedUsers.size > 0 && (
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleBulkDelete("users", selectedUsers)}>
                    <Trash2 className="h-4 w-4" /> Apagar ({selectedUsers.size})
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-48 h-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                        onCheckedChange={() => toggleSelectAllUsers(filteredUsers)}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className={`hover:bg-gray-50/50 ${selectedUsers.has(user.id) ? "bg-primary/5" : ""}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={() => toggleSelectUser(user.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.full_name}
                          {user.verified && (
                            <BadgeCheck className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{user.email || "-"}</TableCell>
                      <TableCell className="text-sm">{user.phone || "-"}</TableCell>
                      <TableCell>
  <select
    value={user.user_type || ""}
    disabled={!hasPermission("manage_users") || changingUserType.has(user.id) || user.is_root_admin}
    onChange={(e) => void changeUserType(user.id, e.target.value as User["user_type"])}
    className="h-8 min-w-[125px] rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold capitalize outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
    aria-label={`Tipo de utilizador de ${user.full_name}`}
  >
    <option value="" disabled>Definir tipo</option>
    <option value="agricultor">Fornecedor</option>
    <option value="comprador">Comprador</option>
    <option value="agente">Agente</option>
    <option value="motorista">Motorista</option>
  </select>
</TableCell>
                      <TableCell>
                        {user.verified ? (
                          <Badge className="bg-primary/10 text-primary flex items-center gap-1 w-fit">
                            <BadgeCheck className="h-3 w-3" /> Verificado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Não verificado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{user.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.verified ? (
                              <DropdownMenuItem onClick={() => toggleUserVerification(user.id, true)} className="text-amber-600">
                                <ShieldX className="h-4 w-4 mr-2" /> Remover Verificação
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => toggleUserVerification(user.id, false)} className="text-primary">
                                <ShieldCheck className="h-4 w-4 mr-2" /> Verificar Usuário
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setTargetUser(user.id); setNotificationModalOpen(true); }}>
                              <Bell className="h-4 w-4 mr-2" /> Notificar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete("users", user.id)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" /> Apagar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* TRANSAÇÕES */}
        {activeTab === "transactions" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Transações ({transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-mono text-xs">{t.id.substring(0, 8)}...</TableCell>
                      <TableCell className="capitalize text-sm">{t.type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="font-semibold">{t.amount.toFixed(2)} Kz</TableCell>
                      <TableCell><Badge className={getStatusColor(t.status)}>{t.status}</Badge></TableCell>
                      <TableCell className="text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* NOTIFICAÇÕES */}
        {activeTab === "notifications" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Notificações
              </CardTitle>
              <div className="flex gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                  <button onClick={() => setFilterStatus("all")} className={`px-3 py-1.5 text-xs ${filterStatus === "all" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>Todas</button>
                  <button onClick={() => setFilterStatus("unread")} className={`px-3 py-1.5 text-xs ${filterStatus === "unread" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>Não Lidas</button>
                  <button onClick={() => setFilterStatus("read")} className={`px-3 py-1.5 text-xs ${filterStatus === "read" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>Lidas</button>
                </div>
                <Button size="sm" onClick={() => setNotificationModalOpen(true)}>
                  <Send className="h-4 w-4 mr-1" /> Enviar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma notificação</p>
              ) : (
                filteredNotifications.map((n) => (
                  <div key={n.id} className={`p-4 rounded-xl border transition-all cursor-pointer ${n.read ? "bg-gray-50 border-gray-100" : "bg-blue-50 border-blue-200"}`} onClick={() => markNotificationAsRead(n.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">{n.title}</h4>
                          {!n.read && <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Novo</span>}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      {n.read ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* FICHAS */}
        {activeTab === "fichas" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Fichas de Recebimento ({filteredFichas.length})
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-48 h-9" />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead>Nome</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Negócio</TableHead>
                    <TableHead>Qualidade</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFichas.map((f) => (
                    <TableRow key={f.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedFicha(f)}>
                      <TableCell className="font-medium">{f.nome_ficha}</TableCell>
                      <TableCell>{f.produto}</TableCell>
                      <TableCell><Badge className={f.tipo_negocio === "compra" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>{f.tipo_negocio}</Badge></TableCell>
                      <TableCell>{f.qualidade || "-"}</TableCell>
                      <TableCell>{f.telefone || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-500">{new Date(f.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
  <div className="flex gap-1">
    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setSelectedFicha(f); }} aria-label="Ver ficha">
      <Eye className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-primary" onClick={(e) => { e.stopPropagation(); void downloadFichaRecebimentoPdf({ ...f, user_name: users.find(u => u.id === f.user_id)?.full_name, user_phone: users.find(u => u.id === f.user_id)?.phone, user_email: users.find(u => u.id === f.user_id)?.email }); }} aria-label="Baixar ficha em PDF">
      <Download className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete("fichas_recebimento", f.id); }}>
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* AGRILINK SOURCING */}
        {activeTab === "sourcing" && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> AgriLink Sourcing - Pedidos Especiais ({sourcingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {sourcingRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum pedido de sourcing</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd (kg)</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourcingRequests.map((req) => {
                      const user = users.find((u) => u.id === req.user_id);
                      return (
                        <TableRow key={req.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-medium">{user?.full_name || "-"}</TableCell>
                          <TableCell>{req.product_name}</TableCell>
                          <TableCell>{req.quantity}</TableCell>
                          <TableCell className="text-sm">{new Date(req.delivery_date).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(req.status)}>{req.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{new Date(req.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => updateSourcingStatus(req.id, "in_progress")}>
                                  <Clock className="h-4 w-4 mr-2 text-amber-500" /> Em Progresso
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateSourcingStatus(req.id, "completed")}>
                                  <Check className="h-4 w-4 mr-2 text-green-500" /> Concluído
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateSourcingStatus(req.id, "cancelled")}>
                                  <X className="h-4 w-4 mr-2 text-red-500" /> Cancelado
                                </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => {
                                   setSourcingNoteTarget(req);
                                   setSourcingNote(req.admin_notes || "");
                                 }}>
                                  <MessageSquare className="h-4 w-4 mr-2" /> Adicionar Notas
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setTargetUser(req.user_id); setNotificationModalOpen(true); }}>
                                  <Bell className="h-4 w-4 mr-2" /> Notificar Cliente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              
              {/* Detalhes expandidos */}
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Detalhes dos Pedidos</h3>
                {sourcingRequests.filter(r => r.description || r.admin_notes).map((req) => {
                  const user = users.find((u) => u.id === req.user_id);
                  return (
                    <div key={req.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium">{req.product_name}</span>
                          <span className="text-sm text-gray-500 ml-2">- {user?.full_name}</span>
                        </div>
                        <Badge className={getStatusColor(req.status)}>{req.status}</Badge>
                      </div>
                      {req.description && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 font-medium">Descrição do Cliente:</p>
                          <p className="text-sm text-gray-700">{req.description}</p>
                        </div>
                      )}
                      {req.admin_notes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium">Notas do Admin:</p>
                          <p className="text-sm text-blue-800">{req.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* MARKET DATA */}
        {activeTab === "market" && (
          <div className="space-y-6">
            {/* Estatísticas do Mercado */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard
                title="Total Produtos"
                value={products.length}
                icon={<Package className="h-6 w-6" />}
                color="bg-primary"
              />
              <MetricCard
                title="Volume Total (kg)"
                value={products.reduce((acc, p) => acc + p.quantity, 0).toLocaleString()}
                icon={<TrendingUp className="h-6 w-6" />}
                color="bg-primary"
              />
              <MetricCard
                title="Preço Médio (AOA)"
                value={products.length > 0 ? Math.round(products.reduce((acc, p) => acc + p.price, 0) / products.length).toLocaleString() : 0}
                icon={<DollarSign className="h-6 w-6" />}
                color="bg-primary"
              />
              <MetricCard
                title="Tipos de Produtos"
                value={new Set(products.map(p => p.product_type)).size}
                icon={<Activity className="h-6 w-6" />}
                color="bg-primary"
              />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Preços por Produto */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" /> Preço Médio por Produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const grouped: Record<string, { total: number; count: number }> = {};
                      products.forEach(p => {
                        if (!grouped[p.product_type]) grouped[p.product_type] = { total: 0, count: 0 };
                        grouped[p.product_type].total += p.price;
                        grouped[p.product_type].count++;
                      });
                      return Object.entries(grouped)
                        .map(([name, data]) => ({ name, avgPrice: Math.round(data.total / data.count) }))
                        .sort((a, b) => b.avgPrice - a.avgPrice)
                        .slice(0, 8);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [`${value.toLocaleString()} AOA`, 'Preço Médio']} />
                      <Bar dataKey="avgPrice" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Volume por Produto */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" /> Volume por Produto (kg)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const grouped: Record<string, number> = {};
                      products.forEach(p => {
                        grouped[p.product_type] = (grouped[p.product_type] || 0) + p.quantity;
                      });
                      return Object.entries(grouped)
                        .map(([name, volume]) => ({ name, volume }))
                        .sort((a, b) => b.volume - a.volume)
                        .slice(0, 8);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Volume']} />
                      <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Distribuição por Tipo */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Distribuição por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartDataProducts}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {chartDataProducts.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Histórico de Preços */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Tendência de Publicações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(() => {
                      const grouped: Record<string, number> = {};
                      products.forEach(p => {
                        const date = new Date(p.created_at).toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
                        grouped[date] = (grouped[date] || 0) + 1;
                      });
                      return Object.entries(grouped).slice(-14).map(([date, count]) => ({ date, count }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Preços por Produto */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" /> Tabela de Preços do Mercado
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd Ofertas</TableHead>
                      <TableHead>Preço Min</TableHead>
                      <TableHead>Preço Médio</TableHead>
                      <TableHead>Preço Máx</TableHead>
                      <TableHead>Volume Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const grouped: Record<string, { prices: number[]; quantities: number[] }> = {};
                      products.forEach(p => {
                        if (!grouped[p.product_type]) grouped[p.product_type] = { prices: [], quantities: [] };
                        grouped[p.product_type].prices.push(p.price);
                        grouped[p.product_type].quantities.push(p.quantity);
                      });
                      return Object.entries(grouped)
                        .map(([name, data]) => ({
                          name,
                          count: data.prices.length,
                          minPrice: Math.min(...data.prices),
                          avgPrice: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
                          maxPrice: Math.max(...data.prices),
                          totalVolume: data.quantities.reduce((a, b) => a + b, 0)
                        }))
                        .sort((a, b) => b.count - a.count);
                    })().map((item) => (
                      <TableRow key={item.name} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.count}</TableCell>
                        <TableCell className="text-green-600">{item.minPrice.toLocaleString()} AOA</TableCell>
                        <TableCell className="font-semibold">{item.avgPrice.toLocaleString()} AOA</TableCell>
                        <TableCell className="text-red-600">{item.maxPrice.toLocaleString()} AOA</TableCell>
                        <TableCell>{item.totalVolume.toLocaleString()} kg</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Análise IA */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Análise de Mercado com IA (Google Gemini)
                  </CardTitle>
                  <Button onClick={generateMarketAnalysis} disabled={analyzingMarket} className="gap-2">
                    {analyzingMarket ? (
                      <>
                        <Loader compact className="[&_svg]:text-primary-foreground" />
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4" /> Gerar Análise
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {aiAnalysis ? (
                  <div className="prose prose-sm max-w-none">
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/15">
                      <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                        {aiAnalysis}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Clique em "Gerar Análise" para obter insights do mercado com IA</p>
                    <p className="text-sm mt-2">A análise inclui: resumo do mercado, preços, tendências e recomendações</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ADMIN MANAGEMENT */}
        {activeTab === "prices" && <MarketPricesManager />}

        {activeTab === "admins" && currentUserId && (

          <AdminManagement
            currentUserId={currentUserId}
            isRootAdmin={isRootAdmin}
            isSuperRoot={isSuperRoot}
            hasManageAdminsPermission={hasPermission("manage_admins")}
            users={users}
            onRefresh={fetchAllData}
          />
        )}

        {/* REFERRALS TAB */}
        {activeTab === "referrals" && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-primary/15 rounded-2xl p-4 text-foreground shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Indicações</p>
                    <p className="text-2xl font-bold mt-1">{allReferrals.length}</p>
                  </div>
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-primary/15 rounded-2xl p-4 text-foreground shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Pontos</p>
                    <p className="text-2xl font-bold mt-1">{allReferrals.reduce((sum, r) => sum + r.points, 0)}</p>
                  </div>
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <Star className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-primary/15 rounded-2xl p-4 text-foreground shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Agentes Ativos</p>
                    <p className="text-2xl font-bold mt-1">{new Set(allReferrals.map(r => r.agent_id)).size}</p>
                  </div>
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-primary/15 rounded-2xl p-4 text-foreground shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Média Pts/Indicação</p>
                    <p className="text-2xl font-bold mt-1">
                      {allReferrals.length > 0 ? Math.round(allReferrals.reduce((sum, r) => sum + r.points, 0) / allReferrals.length) : 0}
                    </p>
                  </div>
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Top 3 Agents Leaderboard */}
            <Card className="border border-border shadow-soft bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Ranking de Agentes - Dados em Tempo Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topAgents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma indicação registrada no banco de dados</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {topAgents.map((agent, index) => (
                      <div
                        key={agent.agent_id}
                        className={`relative p-3 sm:p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                          index === 0 
                            ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-700' 
                            : index === 1 
                            ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-800/50 dark:to-slate-700/50 dark:border-slate-600'
                            : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 dark:border-orange-700'
                        }`}
                      >
                        <div className={`absolute -top-2 -left-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                          index === 0 
                            ? 'bg-amber-500 text-white' 
                            : index === 1 
                            ? 'bg-slate-400 text-white'
                            : 'bg-orange-400 text-white'
                        }`}>
                          {index + 1}º
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-2">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-primary/20">
                            <AvatarImage src={agent.agent_avatar || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm font-bold">
                              {agent.agent_name?.charAt(0) || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs sm:text-sm truncate">{agent.agent_name}</p>
                            <div className="flex items-center gap-2 sm:gap-3 mt-1">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-primary" />
                                <span className="text-xs font-medium">{agent.total_referrals} indicações</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-amber-500" />
                                <span className="text-xs font-medium">{agent.total_points} pts</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Complete Referrals Table */}
            <Card className="border border-border shadow-soft bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Histórico Completo de Indicações ({allReferrals.length} registros)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allReferrals.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">Nenhuma indicação registrada no banco de dados</p>
                    <p className="text-xs text-muted-foreground mt-1">As indicações aparecerão aqui quando os agentes indicarem novos usuários</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Agente</TableHead>
                          <TableHead className="text-xs">Código</TableHead>
                          <TableHead className="text-xs">Usuário Indicado</TableHead>
                          <TableHead className="text-xs">Pontos</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allReferrals.map((referral, idx) => (
                          <TableRow key={referral.id} className="hover:bg-muted/50">
                            <TableCell className="text-xs font-mono text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={referral.agent_avatar || ""} />
                                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                    {referral.agent_name?.charAt(0) || 'A'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium truncate max-w-[120px]">{referral.agent_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {referral.agent_code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{referral.referred_user_name}</TableCell>
                            <TableCell>
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                {referral.points}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(referral.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats by Agent */}
            <Card className="border border-border shadow-soft bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Estatísticas por Agente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allReferrals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">Sem dados para exibir</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from(
                      allReferrals.reduce((acc, r) => {
                        if (!acc.has(r.agent_id)) {
                          acc.set(r.agent_id, {
                            agent_id: r.agent_id,
                            agent_name: r.agent_name,
                            agent_avatar: r.agent_avatar,
                            agent_code: r.agent_code,
                            total_referrals: 0,
                            total_points: 0,
                            referred_users: [] as string[]
                          });
                        }
                        const agent = acc.get(r.agent_id)!;
                        agent.total_referrals += 1;
                        agent.total_points += r.points;
                        agent.referred_users.push(r.referred_user_name);
                        return acc;
                      }, new Map<string, any>())
                    ).map(([agentId, stats]) => (
                      <div key={agentId} className="p-3 border rounded-xl bg-muted/20">
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={stats.agent_avatar || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {stats.agent_name?.charAt(0) || 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm truncate">{stats.agent_name}</p>
                            <Badge variant="outline" className="font-mono text-xs">{stats.agent_code}</Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-background p-2 rounded-lg">
                            <p className="text-lg font-bold text-primary">{stats.total_referrals}</p>
                            <p className="text-xs text-muted-foreground">Indicações</p>
                          </div>
                          <div className="bg-background p-2 rounded-lg">
                            <p className="text-lg font-bold text-amber-500">{stats.total_points}</p>
                            <p className="text-xs text-muted-foreground">Pontos</p>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Usuários indicados:</p>
                          <div className="flex flex-wrap gap-1">
                            {stats.referred_users.slice(0, 3).map((name: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                            ))}
                            {stats.referred_users.length > 3 && (
                              <Badge variant="secondary" className="text-xs">+{stats.referred_users.length - 3}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* DELIVERIES TAB */}
        {activeTab === "deliveries" && currentUserId && (
          <DeliveryTracking currentUserId={currentUserId} />
        )}
      </main>
      </div>

      <Dialog open={!!selectedFicha} onOpenChange={(open) => !open && setSelectedFicha(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-2xl border-[#DCE8DE] p-0">
          {selectedFicha && (() => {
            const fichaUser = users.find((u) => u.id === selectedFicha.user_id);
            const places = Array.isArray(selectedFicha.locais_entrega)
              ? selectedFicha.locais_entrega.map((x: any) => typeof x === "string" ? x : [x?.label, x?.name, x?.location].filter(Boolean).join(" — ")).filter(Boolean)
              : [];
            return (
              <>
                <div className="border-b border-[#DCE8DE] bg-[#F4FAF5] px-5 py-5">
                  <div className="flex items-start gap-3">
                    <img src={agrilinkLogo} alt="AgriLink" className="h-8 w-auto object-contain" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2c863b]">Ficha de recebimento</div>
                      <h2 className="mt-1 break-words text-xl font-extrabold text-[#111714]">{selectedFicha.nome_ficha}</h2>
                      <p className="mt-1 text-sm text-[#758A79]">{selectedFicha.produto}</p>
                    </div>
                  </div>
                </div>
                <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Cliente" value={fichaUser?.full_name || "Não identificado"} />
                     <Detail label="ID do cliente" value={selectedFicha.user_id} />
                    <Detail label="Telefone" value={selectedFicha.telefone || fichaUser?.phone || "Não indicado"} />
                    <Detail label="Email" value={fichaUser?.email || "Não indicado"} />
                    <Detail label="Tipo de negócio" value={selectedFicha.tipo_negocio || "Não indicado"} />
                    <Detail label="Qualidade" value={selectedFicha.qualidade || "Não indicada"} />
                    <Detail label="Embalagem" value={selectedFicha.embalagem || "Não indicada"} />
                    <Detail label="Transporte" value={selectedFicha.transporte || "Não indicado"} />
                    <Detail label="ID da ficha" value={selectedFicha.id} />
                     <Detail label="Criada em" value={new Date(selectedFicha.created_at).toLocaleString("pt-AO")} />
                     <Detail label="Atualizada em" value={selectedFicha.updated_at ? new Date(selectedFicha.updated_at).toLocaleString("pt-AO") : "—"} />
                  </div>
                  <Detail label="Locais de entrega" value={places.length ? places.join(", ") : "Não indicados"} multiline />
                  <Detail label="Descrição final" value={selectedFicha.descricao_final || "Não indicada"} multiline />
                  <Detail label="Observações" value={selectedFicha.observacoes || "Não há observações."} multiline />
                </div>
                <DialogFooter className="border-t border-[#E5EDE6] px-5 py-4">
                  <Button variant="ghost" onClick={() => setSelectedFicha(null)}>Fechar</Button>
                  <Button
                    onClick={() => void downloadFichaRecebimentoPdf({ ...selectedFicha, user_name: fichaUser?.full_name, user_phone: fichaUser?.phone, user_email: fichaUser?.email })}
                    className="gap-2 rounded-full bg-[#2c863b] text-white hover:bg-[#246f32]"
                  >
                    <Download className="h-4 w-4" /> Baixar PDF
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!adminDeleteTarget} onOpenChange={(open) => !open && !adminDeleteLoading && setAdminDeleteTarget(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-md rounded-2xl border-[#DCE8DE]">
          <DialogHeader>
            <div className="mb-3 flex items-center gap-3">
              <img src={agrilinkLogo} alt="AgriLink" className="h-7 w-auto object-contain" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2c863b]">Acção administrativa</span>
            </div>
            <DialogTitle>Confirmar remoção</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-900">
            Esta remoção será executada no servidor. {adminDeleteTarget?.ids.length === 1 ? "O registo selecionado será removido." : `${adminDeleteTarget?.ids.length} registos serão removidos.`} Não será usado o diálogo do navegador.
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={adminDeleteLoading} onClick={() => setAdminDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={adminDeleteLoading} onClick={() => void confirmAdminDelete()}>
              {adminDeleteLoading ? "A remover…" : "Confirmar remoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Notificação */}
        <Dialog open={!!sourcingNoteTarget} onOpenChange={(open) => { if (!open) setSourcingNoteTarget(null); }}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg overflow-hidden rounded-2xl border-[#DCE8DE] p-0">
            <div className="h-1.5 bg-primary" />
            <div className="p-6">
              <DialogHeader>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.05] p-2">
                    <img src={agrilinkLogo} alt="AgriLink" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">Notas do pedido de sourcing</DialogTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{sourcingNoteTarget?.product_name || "Pedido de sourcing"}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-4 space-y-2">
                <label htmlFor="admin-sourcing-note" className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Nota administrativa</label>
                <Textarea
                  id="admin-sourcing-note"
                  value={sourcingNote}
                  onChange={(e) => setSourcingNote(e.target.value)}
                  placeholder="Registe aqui o acompanhamento, decisão ou observação operacional."
                  rows={6}
                  className="resize-none rounded-xl"
                  autoFocus
                />
              </div>
              <DialogFooter className="mt-5 gap-2">
                <Button variant="ghost" onClick={() => setSourcingNoteTarget(null)}>Cancelar</Button>
                <Button
                  onClick={() => {
                    if (!sourcingNoteTarget) return;
                    updateSourcingStatus(sourcingNoteTarget.id, sourcingNoteTarget.status, sourcingNote.trim());
                    setSourcingNoteTarget(null);
                  }}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  Guardar nota
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

      <Dialog open={notificationModalOpen} onOpenChange={setNotificationModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Notificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Usuário</label>
              <select value={targetUser || ""} onChange={(e) => setTargetUser(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                <option value="">Selecione um usuário</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                <option value="info">Informação</option>
                <option value="alert">Alerta</option>
                <option value="success">Sucesso</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Título</label>
              <Input placeholder="Título" value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mensagem</label>
              <Textarea placeholder="Digite a mensagem" value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotificationModalOpen(false)}>Cancelar</Button>
            <Button onClick={sendNotification}><Send className="h-4 w-4 mr-1" /> Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;