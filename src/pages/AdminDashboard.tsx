import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell } from "lucide-react";
import AgrilinkLogo from "@/assets/agrilink-logo.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertTargetUser, setAlertTargetUser] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "users" | "transactions" | "notifications">("dashboard");

  const openAlertModal = (userId: string, defaultMessage = "") => {
    setAlertTargetUser(userId);
    setAlertMessage(defaultMessage);
    setAlertModalOpen(true);
  };

  const sendAlert = async () => {
    if (!alertTargetUser || !alertMessage.trim()) return alert("Mensagem não pode estar vazia!");
    await supabase.from("notifications").insert({
      id: crypto.randomUUID(),
      user_id: alertTargetUser,
      type: "alert",
      title: "Equipe Agrilink",
      message: alertMessage,
      read: false,
      metadata: {},
      created_at: new Date().toISOString(),
    });
    setAlertModalOpen(false);
    alert("Usuário notificado com sucesso!");
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [prod, usrs, trans, nots] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("users").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("notifications").select("*")
      ]);
      setProducts(prod.data || []);
      setUsers(usrs.data || []);
      setTransactions(trans.data || []);
      setNotifications(nots.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const getLogisticsBadge = (logistics: string) => {
    if (logistics === "sim") return <Badge className="bg-green-100 text-green-800">Fácil</Badge>;
    if (logistics === "parcial") return <Badge className="bg-yellow-100 text-yellow-800">Médio</Badge>;
    if (logistics === "não") return <Badge className="bg-red-100 text-red-800">Difícil</Badge>;
    return <Badge>{logistics || "-"}</Badge>;
  };

  const handleDelete = async (table: string, id: string, setter: Function) => {
    if (!confirm("Deseja realmente apagar?")) return;
    await supabase.from(table as any).delete().eq("id", id);
    setter((prev: any[]) => prev.filter((item: any) => item.id !== id));
  };

  const handlePrePurchase = async (userId: string, productType: string) => {
    await supabase.from("notifications").insert({
      id: crypto.randomUUID(),
      user_id: "AGRILINK_ADMIN_ID",
      type: "pre_purchase",
      title: "Nova Pré-Compra",
      message: `O usuário ${userId} selecionou pré-compra do produto ${productType}`,
      read: false,
      created_at: new Date().toISOString(),
    });
    alert("Agrilink notificada sobre pré-compra!");
  };

  if (loading) return <p className="p-4 text-center text-gray-500">Carregando dashboard...</p>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <img src={AgrilinkLogo} alt="Agrilink Logo" className="h-10" />
          <span className="text-2xl font-bold text-gray-700">Admin Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          {["dashboard","products","users","transactions","notifications"].map(tab => (
            <Button key={tab} variant={activeTab===tab?"default":"ghost"} onClick={() => setActiveTab(tab as any)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[{title:"Total de Produtos", value: products.length},
              {title:"Total de Usuários", value: users.length},
              {title:"Total Transações", value: transactions.length},
              {title:"Notificações", value: notifications.length}
            ].map((metric, idx) => (
              <Card key={idx} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{metric.title}</CardTitle>
                  <p className="text-2xl font-bold mt-2">{metric.value}</p>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === "products" && (
          <Card className="shadow-md">
            <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="border-collapse border border-gray-200">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Logística</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(product => (
                    <TableRow key={product.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-2">{product.product_type}</TableCell>
                      <TableCell className="py-2">{product.quantity}</TableCell>
                      <TableCell className="py-2">{product.price ? `${product.price} Kz/kg` : "-"}</TableCell>
                      <TableCell className="py-2">{getLogisticsBadge(product.logistics_access)}</TableCell>
                      <TableCell className="flex gap-2 py-2">
                        <Button size="sm" variant="outline" onClick={() => openAlertModal(product.user_id)}>
                          <Bell className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => handlePrePurchase(product.user_id, product.product_type)}>Pré-Compra</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete("products", product.id, setProducts)}>Apagar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* USERS */}
        {activeTab === "users" && (
          <Card className="shadow-md">
            <CardHeader><CardTitle>Usuários</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="border-collapse border border-gray-200">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Província</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-2">{u.name}</TableCell>
                      <TableCell className="py-2">{u.email}</TableCell>
                      <TableCell className="py-2">{u.province_id}</TableCell>
                      <TableCell className="py-2">{u.municipality_id}</TableCell>
                      <TableCell className="flex gap-2 py-2">
                        <Button size="sm" variant="outline" onClick={() => openAlertModal(u.id)}>
                          <Bell className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete("users", u.id, setUsers)}>Apagar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* TRANSACTIONS */}
        {activeTab === "transactions" && (
          <Card className="shadow-md">
            <CardHeader><CardTitle>Transações</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="border-collapse border border-gray-200">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(t => (
                    <TableRow key={t.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-2">{t.id}</TableCell>
                      <TableCell className="py-2">{t.type}</TableCell>
                      <TableCell className="py-2">{t.status}</TableCell>
                      <TableCell className="py-2">{t.amount}</TableCell>
                      <TableCell className="py-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDelete("transactions", t.id, setTransactions)}>Apagar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <Card className="shadow-md">
            <CardHeader><CardTitle>Notificações</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="border-collapse border border-gray-200">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Lida</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map(n => (
                    <TableRow key={n.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-2">{n.id}</TableCell>
                      <TableCell className="py-2">{n.title}</TableCell>
                      <TableCell className="py-2">{n.message}</TableCell>
                      <TableCell className="py-2">{n.read ? "Sim" : "Não"}</TableCell>
                      <TableCell className="py-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDelete("notifications", n.id, setNotifications)}>Apagar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* MODAL ALERTA */}
        <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Enviar Notificação</DialogTitle></DialogHeader>
            <Input
              placeholder="Digite a mensagem"
              value={alertMessage}
              onChange={e => setAlertMessage(e.target.value)}
              className="mb-4"
            />
            <DialogFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAlertModalOpen(false)}>Cancelar</Button>
              <Button onClick={sendAlert}>Enviar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;