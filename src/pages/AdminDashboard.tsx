import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
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
  CheckCircle,
  Clock,
  MapPin,
  MoreVertical,
  Package,
  FileText,
  TrendingUp,
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import OrbisLinkLogo from "@/assets/orbislink-logo.png";
import AdminManagement from "@/components/admin/AdminManagement";
import DeliveryTracking from "@/components/admin/DeliveryTracking";
import WorkSessionTimer from "@/components/admin/WorkSessionTimer";
import { useWorkSession } from "@/hooks/useWorkSession";

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
  is_super_root?: boolean;
}

interface Order {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  location: string;
  status: string;
  created_at: string;
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
  qualidade?: string;
  telefone?: string;
  created_at: string;
}

type TabType = "dashboard" | "products" | "users" | "transactions" | "notifications" | "orders" | "fichas" | "sourcing" | "market" | "admins" | "referrals" | "deliveries";

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

interface ReferralRow {
  id: string;
  agent_id: string;
  referred_user_id: string;
  points: number;
  created_at: string;
}

interface ReferralAgentStats {
  agent_id: string;
  agent_name: string;
  agent_avatar: string | null;
  agent_code: string;
  total_referrals: number;
  total_points: number;
  referred_users: string[];
}

type GenericRow = { id: string };
type DeletableTable = "transactions" | "notifications" | "fichas_recebimento" | "sourcing_requests" | "pre_orders";

// --- Componentes Auxiliares ---
const MetricCard = ({ title, value, icon, trend, color }: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  color: string;
}) => (
  <div className={`rounded-2xl p-3 sm:p-5 ${color} transition-all hover:scale-[1.02] hover:shadow-lg`}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-white/80 truncate">{title}</p>
        <p className="text-xl sm:text-3xl font-bold text-white mt-1">{value}</p>
        {trend !== undefined && (
          <p className="text-xs sm:text-sm mt-1 text-white/70 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {trend >= 0 ? "+" : ""}{trend}%
          </p>
        )}
      </div>
      <div className="p-2 sm:p-3 bg-white/20 rounded-xl text-white flex-shrink-0">
        {icon}
      </div>
    </div>
  </div>
);

const TabButton = ({ active, onClick, children, badge }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) => (
  <button
    onClick={onClick}
    className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
      active 
        ? "bg-primary text-primary-foreground shadow-md" 
        : "bg-card text-foreground hover:bg-muted border border-border"
    }`}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="bg-destructive text-destructive-foreground text-[10px] sm:text-xs font-bold rounded-full min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 flex items-center justify-center">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];

// --- Componente Principal ---
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([]);
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
      
      if (userData?.is_super_root) {
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
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
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

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase.from("pre_orders").select("*").order("created_at", { ascending: false });
      if (data) setOrders(data);
    };
    fetchOrders();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [prodRes, usersRes, transRes, notRes, fichasRes, sourcingRes, topAgentsRes, referralsRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
        supabase.from("fichas_recebimento").select("*").order("created_at", { ascending: false }),
        supabase.from("sourcing_requests").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_top_agents_by_referrals", { limit_count: 3 }),
        supabase.from("agent_referrals").select("*").order("created_at", { ascending: false }),
      ]);
      setProducts(prodRes.data || []);
      setUsers(usersRes.data || []);
      setTransactions(transRes.data || []);
      setNotifications(notRes.data || []);
      setFichas(fichasRes.data || []);
      setSourcingRequests(sourcingRes.data || []);
      setTopAgents(topAgentsRes.data || []);
      
      // Process referrals with user data
      if (referralsRes.data && usersRes.data) {
        const usersMap = new Map(usersRes.data.map(u => [u.id, u]));
        const processedReferrals: Referral[] = (referralsRes.data as ReferralRow[]).map((r) => {
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
      setLoading(false);
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

  const handleDelete = useCallback(async <T extends GenericRow>(table: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    if (!confirm("Deseja realmente apagar? Esta ação não pode ser desfeita.")) return;
    try {
      if (table === "users") {
        const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });
        if (error) {
          console.error("Erro ao apagar usuário:", error);
          toast.error("Erro ao apagar usuário: " + error.message);
          return;
        }
        setter((prev) => prev.filter((item) => item.id !== id));
        setProducts((prev) => prev.filter((p) => p.user_id !== id));
        toast.success("Usuário e dados relacionados apagados com sucesso");
      } else if (table === "products") {
        const { error } = await supabase.rpc("admin_delete_product", { p_product_id: id });
        if (error) {
          console.error("Erro ao apagar produto:", error);
          toast.error("Erro ao apagar produto: " + error.message);
          return;
        }
        setter((prev) => prev.filter((item) => item.id !== id));
        toast.success("Produto e dados relacionados apagados com sucesso");
      } else {
        const { error } = await supabase.from(table as DeletableTable).delete().eq("id", id);
        if (error) {
          console.error("Erro ao apagar:", error);
          toast.error("Erro ao apagar: " + error.message);
          return;
        }
        setter((prev) => prev.filter((item) => item.id !== id));
        toast.success("Item apagado com sucesso");
      }
    } catch (err) {
      console.error("Erro ao apagar:", err);
      toast.error("Erro ao apagar");
    }
  }, []);

  const handleBulkDelete = useCallback(async <T extends GenericRow>(table: string, ids: Set<string>, setter: React.Dispatch<React.SetStateAction<T[]>>, clearSelection: () => void) => {
    if (ids.size === 0) { toast.error("Nenhum item selecionado"); return; }
    if (!confirm(`Deseja realmente apagar ${ids.size} item(s)? Esta ação não pode ser desfeita.`)) return;
    try {
      const idsArray = Array.from(ids);
      if (table === "users") {
        const { data, error } = await supabase.rpc("admin_bulk_delete_users", { p_user_ids: idsArray });
        if (error) {
          console.error("Erro ao apagar usuários:", error);
          toast.error("Erro ao apagar usuários: " + error.message);
          return;
        }
        setter((prev) => prev.filter((item) => !ids.has(item.id)));
        setProducts((prev) => prev.filter((p) => !ids.has(p.user_id)));
        clearSelection();
        toast.success(`${data || idsArray.length} usuário(s) e dados relacionados apagados com sucesso`);
      } else if (table === "products") {
        const { data, error } = await supabase.rpc("admin_bulk_delete_products", { p_product_ids: idsArray });
        if (error) {
          console.error("Erro ao apagar produtos:", error);
          toast.error("Erro ao apagar produtos: " + error.message);
          return;
        }
        setter((prev) => prev.filter((item) => !ids.has(item.id)));
        clearSelection();
        toast.success(`${data || idsArray.length} produto(s) e dados relacionados apagados com sucesso`);
      } else {
        const { error } = await supabase.from(table as DeletableTable).delete().in("id", idsArray);
        if (error) {
          console.error("Erro ao apagar itens:", error);
          toast.error("Erro ao apagar itens: " + error.message);
          return;
        }
        setter((prev) => prev.filter((item) => !ids.has(item.id)));
        clearSelection();
        toast.success(`${idsArray.length} item(s) apagado(s) com sucesso`);
      }
    } catch (err) {
      console.error("Erro ao apagar itens:", err);
      toast.error("Erro ao apagar itens");
    }
  }, []);

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
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from("pre_orders").update({ status: newStatus }).eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      toast.success(`Status atualizado para ${newStatus}`);
    }
  }, []);

  const updateSourcingStatus = useCallback(async (id: string, newStatus: string, adminNotes?: string) => {
    const updateData: { status: string; admin_notes?: string } = { status: newStatus };
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
    
    const { error } = await supabase.from("sourcing_requests").update(updateData).eq("id", id);
    if (!error) {
      setSourcingRequests((prev) => prev.map((s) => (s.id === id ? { ...s, ...updateData } : s)));
      toast.success(`Pedido de sourcing atualizado`);
    } else {
      toast.error("Erro ao atualizar pedido");
    }
  }, []);

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
      pending: "bg-amber-100 text-amber-700",
      aguardando: "bg-amber-100 text-amber-700",
      in_progress: "bg-blue-100 text-blue-700",
      failed: "bg-red-100 text-red-700",
      cancelado: "bg-red-100 text-red-700",
      cancelled: "bg-red-100 text-red-700",
      blocked: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-600";
  };

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Moderno */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={OrbisLinkLogo} alt="OrbisLink" className="h-9" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">Painel Admin</h1>
                <p className="text-xs text-muted-foreground">Gerenciamento OrbisLink</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("notifications")}
                className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Bell className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => navigate("/")} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <button className="md:hidden p-2 hover:bg-gray-100 rounded-xl" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className={`mt-3 overflow-x-auto pb-1 ${menuOpen ? "flex" : "hidden md:flex"} flex-wrap gap-2`}>
            <TabButton active={activeTab === "dashboard"} onClick={() => { setActiveTab("dashboard"); setMenuOpen(false); }}>
              <Activity className="h-4 w-4" /> Dashboard
            </TabButton>
            <TabButton active={activeTab === "orders"} onClick={() => { setActiveTab("orders"); setMenuOpen(false); }}>
              <ShoppingCart className="h-4 w-4" /> Pedidos
            </TabButton>
            {hasPermission("manage_products") && (
              <TabButton active={activeTab === "products"} onClick={() => { setActiveTab("products"); setMenuOpen(false); }}>
                <Package className="h-4 w-4" /> Produtos
              </TabButton>
            )}
            {hasPermission("manage_users") && (
              <TabButton active={activeTab === "users"} onClick={() => { setActiveTab("users"); setMenuOpen(false); }}>
                <Users className="h-4 w-4" /> Usuários
              </TabButton>
            )}
            <TabButton active={activeTab === "transactions"} onClick={() => { setActiveTab("transactions"); setMenuOpen(false); }}>
              <DollarSign className="h-4 w-4" /> Transações
            </TabButton>
            <TabButton active={activeTab === "notifications"} onClick={() => { setActiveTab("notifications"); setMenuOpen(false); }} badge={unreadCount}>
              <Bell className="h-4 w-4" /> Notificações
            </TabButton>
            <TabButton active={activeTab === "fichas"} onClick={() => { setActiveTab("fichas"); setMenuOpen(false); }}>
              <FileText className="h-4 w-4" /> Fichas
            </TabButton>
            {hasPermission("manage_sourcing") && (
              <TabButton active={activeTab === "sourcing"} onClick={() => { setActiveTab("sourcing"); setMenuOpen(false); }} badge={sourcingRequests.filter(s => s.status === 'pending').length}>
                <TrendingUp className="h-4 w-4" /> Sourcing
              </TabButton>
            )}
            {hasPermission("view_analytics") && (
              <TabButton active={activeTab === "market"} onClick={() => { setActiveTab("market"); setMenuOpen(false); }}>
                <Activity className="h-4 w-4" /> Mercado
              </TabButton>
            )}
            {(isRootAdmin || hasPermission("manage_admins")) && (
              <TabButton active={activeTab === "admins"} onClick={() => { setActiveTab("admins"); setMenuOpen(false); }}>
                <Crown className="h-4 w-4" /> Admins
              </TabButton>
            )}
            {hasPermission("view_analytics") && (
              <TabButton active={activeTab === "referrals"} onClick={() => { setActiveTab("referrals"); setMenuOpen(false); }} badge={allReferrals.length}>
                <Star className="h-4 w-4" /> Indicações
              </TabButton>
            )}
            {(isSupportAgent || hasPermission("manage_orders")) && (
              <TabButton active={activeTab === "deliveries"} onClick={() => { setActiveTab("deliveries"); setMenuOpen(false); }}>
                <Truck className="h-4 w-4" /> Entregas
              </TabButton>
            )}
          </div>
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

        {/* Root Admin Badge */}
        {isRootAdmin && (
          <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl">
            <Crown className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Você é um Root Admin - Acesso total ao sistema
            </span>
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <MetricCard title="Produtos" value={products.length} icon={<Package className="h-5 w-5 sm:h-6 sm:w-6" />} trend={12} color="bg-gradient-to-br from-emerald-500 to-green-600" />
              <MetricCard title="Usuários" value={users.length} icon={<Users className="h-5 w-5 sm:h-6 sm:w-6" />} trend={8} color="bg-gradient-to-br from-blue-500 to-indigo-600" />
              <MetricCard title="Pedidos" value={orders.length} icon={<ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />} trend={15} color="bg-gradient-to-br from-amber-500 to-orange-600" />
              <MetricCard title="Transações" value={transactions.length} icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />} trend={5} color="bg-gradient-to-br from-purple-500 to-pink-600" />
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
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Pedidos ({orders.length})
              </CardTitle>
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
                      <TableRow key={order.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium">{product?.product_type || "-"}</TableCell>
                        <TableCell>{user?.full_name || "-"}</TableCell>
                        <TableCell>{order.quantity} kg</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={() => updateOrderStatus(order.id, "concluida")} disabled={order.status === "concluida"}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => updateOrderStatus(order.id, "cancelado")} disabled={order.status === "cancelado"}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600" onClick={() => updateOrderStatus(order.id, "aguardando")} disabled={order.status === "aguardando"}>
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

        {/* PRODUTOS */}
        {activeTab === "products" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Produtos ({filteredProducts.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedProducts.size > 0 && (
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleBulkDelete("products", selectedProducts, setProducts, () => setSelectedProducts(new Set()))}>
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
                        <TableCell className="text-sm text-gray-500">{new Date(product.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setTargetUser(product.user_id); setNotificationModalOpen(true); }}>
                                <Bell className="h-4 w-4 mr-2" /> Notificar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete("products", product.id, setProducts)} className="text-red-600">
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
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleBulkDelete("users", selectedUsers, setUsers, () => setSelectedUsers(new Set()))}>
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
                      <TableCell><Badge variant="outline" className="capitalize">{user.user_type || "user"}</Badge></TableCell>
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
                            <DropdownMenuItem onClick={() => handleDelete("users", user.id, setUsers)} className="text-red-600">
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
                    <TableRow key={f.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-medium">{f.nome_ficha}</TableCell>
                      <TableCell>{f.produto}</TableCell>
                      <TableCell><Badge className={f.tipo_negocio === "compra" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>{f.tipo_negocio}</Badge></TableCell>
                      <TableCell>{f.qualidade || "-"}</TableCell>
                      <TableCell>{f.telefone || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-500">{new Date(f.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setTargetUser(f.user_id); setNotificationModalOpen(true); }}>
                            <Bell className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => handleDelete("fichas_recebimento", f.id, setFichas)}>
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
                <TrendingUp className="h-5 w-5 text-primary" /> OrbisLink Sourcing - Pedidos Especiais ({sourcingRequests.length})
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
                                  const notes = prompt("Notas do Admin:", req.admin_notes || "");
                                  if (notes !== null) updateSourcingStatus(req.id, req.status, notes);
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
                color="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <MetricCard
                title="Volume Total (kg)"
                value={products.reduce((acc, p) => acc + p.quantity, 0).toLocaleString()}
                icon={<TrendingUp className="h-6 w-6" />}
                color="bg-gradient-to-br from-green-500 to-green-600"
              />
              <MetricCard
                title="Preço Médio (AOA)"
                value={products.length > 0 ? Math.round(products.reduce((acc, p) => acc + p.price, 0) / products.length).toLocaleString() : 0}
                icon={<DollarSign className="h-6 w-6" />}
                color="bg-gradient-to-br from-amber-500 to-amber-600"
              />
              <MetricCard
                title="Tipos de Produtos"
                value={new Set(products.map(p => p.product_type)).size}
                icon={<Activity className="h-6 w-6" />}
                color="bg-gradient-to-br from-purple-500 to-purple-600"
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
                        <RefreshCw className="h-4 w-4 animate-spin" /> Analisando...
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
                    <div className="p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-100">
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
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white/80">Total Indicações</p>
                    <p className="text-2xl font-bold mt-1">{allReferrals.length}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white/80">Total Pontos</p>
                    <p className="text-2xl font-bold mt-1">{allReferrals.reduce((sum, r) => sum + r.points, 0)}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Star className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white/80">Agentes Ativos</p>
                    <p className="text-2xl font-bold mt-1">{new Set(allReferrals.map(r => r.agent_id)).size}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-xl">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white/80">Média Pts/Indicação</p>
                    <p className="text-2xl font-bold mt-1">
                      {allReferrals.length > 0 ? Math.round(allReferrals.reduce((sum, r) => sum + r.points, 0) / allReferrals.length) : 0}
                    </p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-xl">
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
                      }, new Map<string, ReferralAgentStats>())
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

      {/* Modal de Notificação */}
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
