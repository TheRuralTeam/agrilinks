import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import Loader from "../ui/Loader";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import {
  Crown,
  Shield,
  ShieldCheck,
  ShieldX,
  Users,
  Package,
  ShoppingCart,
  MessageSquare,
  TrendingUp,
  BarChart3,
  UserCog,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles,
  Headphones,
} from "lucide-react";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

// Permission definitions with metadata
const PERMISSIONS = [
  { 
    key: "manage_users", 
    label: "Gerenciar Usuários", 
    description: "Verificar e gerenciar perfis de usuários",
    icon: Users,
    color: "text-blue-500"
  },
  { 
    key: "manage_products", 
    label: "Gerenciar Produtos", 
    description: "Visualizar e moderar produtos publicados",
    icon: Package,
    color: "text-green-500"
  },
  { 
    key: "manage_orders", 
    label: "Gerenciar Pedidos", 
    description: "Visualizar e atualizar status de pedidos",
    icon: ShoppingCart,
    color: "text-amber-500"
  },
  { 
    key: "manage_support", 
    label: "Gerenciar Suporte", 
    description: "Responder mensagens de suporte",
    icon: MessageSquare,
    color: "text-purple-500"
  },
  { 
    key: "manage_sourcing", 
    label: "Gerenciar Sourcing", 
    description: "Gerenciar pedidos especiais de sourcing",
    icon: TrendingUp,
    color: "text-indigo-500"
  },
  { 
    key: "view_analytics", 
    label: "Ver Analytics", 
    description: "Acesso a dados de mercado e estatísticas",
    icon: BarChart3,
    color: "text-pink-500"
  },
  { 
    key: "manage_admins", 
    label: "Gerenciar Admins", 
    description: "Promover e gerenciar outros administradores (apenas Root)",
    icon: UserCog,
    color: "text-red-500"
  },
] as const;

type PermissionKey = typeof PERMISSIONS[number]["key"];

interface AdminUser {
  id: string;
  full_name: string;
  email: string | null;
  user_type: string | null;
  is_root_admin: boolean;
  is_super_root: boolean;
  permissions: PermissionKey[];
  created_at: string;
}

interface User {
  id: string;
  full_name: string;
  email?: string | null;
  user_type?: string | null;
  is_root_admin?: boolean;
  is_super_root?: boolean;
}

interface AdminManagementProps {
  currentUserId: string;
  isRootAdmin: boolean;
  isSuperRoot: boolean;
  hasManageAdminsPermission?: boolean;
  users: User[];
  onRefresh: () => void;
}

const AdminManagement: React.FC<AdminManagementProps> = ({
  currentUserId,
  isRootAdmin,
  isSuperRoot,
  hasManageAdminsPermission = false,
  users,
  onRefresh,
}) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [supportAgents, setSupportAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editPermissions, setEditPermissions] = useState<PermissionKey[]>([]);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [adminToRevoke, setAdminToRevoke] = useState<AdminUser | null>(null);
  const [promoteToRootDialogOpen, setPromoteToRootDialogOpen] = useState(false);
  const [userToPromoteRoot, setUserToPromoteRoot] = useState<AdminUser | null>(null);
  const [promoteToSupportAgentDialogOpen, setPromoteToSupportAgentDialogOpen] = useState(false);
  const [userToPromoteSupportAgent, setUserToPromoteSupportAgent] = useState<User | null>(null);
  const [revokeSupportAgentDialogOpen, setRevokeSupportAgentDialogOpen] = useState(false);
  const [agentToRevoke, setAgentToRevoke] = useState<User | null>(null);
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      // Get all roles
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Separate admin roles and support agent roles
      const adminUserIds = (allRoles || []).filter(r => r.role === "admin").map((r) => r.user_id);
      const supportAgentUserIds = (allRoles || []).filter(r => r.role === "support_agent").map((r) => r.user_id);

      if (adminUserIds.length === 0) {
        setAdmins([]);
      } else {
        // Get user details for admins
        const { data: adminUsers, error: usersError } = await supabase
          .from("users")
          .select("id, full_name, email, user_type, is_root_admin, is_super_root, created_at")
          .in("id", adminUserIds);

        if (usersError) throw usersError;

        // Get permissions for each admin
        const { data: permissions, error: permError } = await supabase
          .from("admin_permissions")
          .select("user_id, permission")
          .in("user_id", adminUserIds);

        if (permError) throw permError;

        // Combine data
        const adminList: AdminUser[] = (adminUsers || []).map((user) => ({
          ...user,
          is_root_admin: user.is_root_admin || false,
          is_super_root: (user as any).is_super_root || false,
          permissions: (permissions || [])
            .filter((p) => p.user_id === user.id)
            .map((p) => p.permission as PermissionKey),
        }));

        // Sort: super roots first, then root admins, then by name
        adminList.sort((a, b) => {
          if (a.is_super_root && !b.is_super_root) return -1;
          if (!a.is_super_root && b.is_super_root) return 1;
          if (a.is_root_admin && !b.is_root_admin) return -1;
          if (!a.is_root_admin && b.is_root_admin) return 1;
          return a.full_name.localeCompare(b.full_name);
        });

        setAdmins(adminList);
      }

      // Fetch support agents
      if (supportAgentUserIds.length > 0) {
        const { data: agentUsers, error: agentError } = await supabase
          .from("users")
          .select("id, full_name, email, user_type")
          .in("id", supportAgentUserIds);

        if (!agentError && agentUsers) {
          setSupportAgents(agentUsers);
        }
      } else {
        setSupportAgents([]);
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
      toast.error("Erro ao carregar administradores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const promoteToAdmin = async () => {
    if (!selectedUser || selectedPermissions.length === 0) {
      toast.error("Selecione pelo menos uma permissão");
      return;
    }

    try {
      // Add admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: selectedUser.id, role: "admin" });

      if (roleError && !roleError.message.includes("duplicate")) throw roleError;

      // Add permissions
      const permissionInserts = selectedPermissions.map((permission) => ({
        user_id: selectedUser.id,
        permission,
        granted_by: currentUserId,
      }));

      const { error: permError } = await supabase
        .from("admin_permissions")
        .insert(permissionInserts);

      if (permError) throw permError;

      toast.success(`${selectedUser.full_name} promovido a sub-admin!`);
      setPromoteDialogOpen(false);
      setSelectedUser(null);
      setSelectedPermissions([]);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error promoting user:", error);
      toast.error("Erro ao promover usuário");
    }
  };

  const updatePermissions = async () => {
    if (!editingAdmin) return;

    try {
      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from("admin_permissions")
        .delete()
        .eq("user_id", editingAdmin.id);

      if (deleteError) throw deleteError;

      // Insert new permissions
      if (editPermissions.length > 0) {
        const permissionInserts = editPermissions.map((permission) => ({
          user_id: editingAdmin.id,
          permission,
          granted_by: currentUserId,
        }));

        const { error: insertError } = await supabase
          .from("admin_permissions")
          .insert(permissionInserts);

        if (insertError) throw insertError;
      }

      toast.success("Permissões atualizadas!");
      setEditingAdmin(null);
      setEditPermissions([]);
      fetchAdmins();
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error("Erro ao atualizar permissões");
    }
  };

  const revokeAdmin = async () => {
    if (!adminToRevoke) return;

    try {
      // Remove admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", adminToRevoke.id)
        .eq("role", "admin");

      if (roleError) throw roleError;

      // Remove all permissions
      const { error: permError } = await supabase
        .from("admin_permissions")
        .delete()
        .eq("user_id", adminToRevoke.id);

      if (permError) throw permError;

      toast.success(`Privilégios de admin removidos de ${adminToRevoke.full_name}`);
      setRevokeDialogOpen(false);
      setAdminToRevoke(null);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error revoking admin:", error);
      toast.error("Erro ao revogar privilégios");
    }
  };

  const promoteToRoot = async () => {
    if (!userToPromoteRoot) return;

    try {
      // Update user to be root admin
      const { error: updateError } = await supabase
        .from("users")
        .update({ is_root_admin: true })
        .eq("id", userToPromoteRoot.id);

      if (updateError) throw updateError;

      toast.success(`${userToPromoteRoot.full_name} promovido a Root Admin!`);
      setPromoteToRootDialogOpen(false);
      setUserToPromoteRoot(null);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error promoting to root:", error);
      toast.error("Erro ao promover a Root Admin");
    }
  };

  const promoteToSuperRoot = async (admin: AdminUser) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_super_root: true })
        .eq("id", admin.id);

      if (error) throw error;

      toast.success(`${admin.full_name} promovido a Super Root!`);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error promoting to super root:", error);
      toast.error("Erro ao promover a Super Root");
    }
  };

  const demoteFromRoot = async (admin: AdminUser) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_root_admin: false, is_super_root: false })
        .eq("id", admin.id);

      if (error) throw error;

      toast.success(`${admin.full_name} rebaixado de Root Admin!`);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error demoting from root:", error);
      toast.error("Erro ao rebaixar de Root Admin");
    }
  };

  // Promote to Support Agent
  const promoteToSupportAgent = async () => {
    if (!userToPromoteSupportAgent) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userToPromoteSupportAgent.id, role: "support_agent" });

      if (error && !error.message.includes("duplicate")) throw error;

      toast.success(`${userToPromoteSupportAgent.full_name} promovido a Assistente de Atendimento!`);
      setPromoteToSupportAgentDialogOpen(false);
      setUserToPromoteSupportAgent(null);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error promoting to support agent:", error);
      toast.error("Erro ao promover a Assistente de Atendimento");
    }
  };

  // Revoke Support Agent role
  const revokeSupportAgent = async () => {
    if (!agentToRevoke) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", agentToRevoke.id)
        .eq("role", "support_agent");

      if (error) throw error;

      toast.success(`${agentToRevoke.full_name} removido de Assistente de Atendimento`);
      setRevokeSupportAgentDialogOpen(false);
      setAgentToRevoke(null);
      fetchAdmins();
      onRefresh();
    } catch (error) {
      console.error("Error revoking support agent:", error);
      toast.error("Erro ao revogar Assistente de Atendimento");
    }
  };

  const nonAdminUsers = users.filter(
    (u) => !admins.find((a) => a.id === u.id)
  );

  // Get agents (user_type === 'agente') that are not already support agents
  const availableAgents = users.filter(
    (u) => u.user_type === "agente" && !supportAgents.find((a) => a.id === u.id)
  );

  const filteredNonAdminUsers = nonAdminUsers.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Allow access for root admins or users with manage_admins permission
  const canManageAdmins = isRootAdmin || hasManageAdminsPermission;

  if (!canManageAdmins) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Você não tem permissão para gerenciar administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Gerenciamento de Administradores</h2>
              <p className="text-sm text-muted-foreground">
                Como Root Admin, você pode promover sub-admins e definir suas permissões
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Admins */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Administradores Ativos ({admins.length})
            </CardTitle>
            <CardDescription>
              Gerencie as permissões de cada administrador
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAdmins}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setPromoteDialogOpen(true)}>
              <UserCog className="h-4 w-4 mr-1" /> Promover Novo Admin
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader compact label="A carregar administradores" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhum administrador encontrado</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {admins.map((admin) => (
                <AccordionItem
                  key={admin.id}
                  value={admin.id}
                  className="border rounded-xl px-4 bg-white shadow-sm"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${admin.is_super_root ? "bg-gradient-to-br from-purple-100 to-amber-100" : admin.is_root_admin ? "bg-amber-100" : "bg-primary/10"}`}>
                        {admin.is_super_root ? (
                          <Sparkles className="h-5 w-5 text-purple-600" />
                        ) : admin.is_root_admin ? (
                          <Crown className="h-5 w-5 text-amber-600" />
                        ) : (
                          <Shield className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{admin.full_name}</span>
                          {admin.is_super_root && (
                            <Badge className="bg-gradient-to-r from-purple-500 to-amber-500 text-white text-xs">Super Root</Badge>
                          )}
                          {admin.is_root_admin && !admin.is_super_root && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">Root Admin</Badge>
                          )}
                          {admin.id === currentUserId && (
                            <Badge variant="outline" className="text-xs">Você</Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{admin.email || "Sem email"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mr-4">
                      <Badge variant="outline" className="text-xs">
                        {admin.is_root_admin ? "Todas" : admin.permissions.length} permissões
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4">
                      {/* Permission List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {PERMISSIONS.map((perm) => {
                          const Icon = perm.icon;
                          const hasPermission = admin.is_root_admin || admin.permissions.includes(perm.key);
                          const isManageAdmins = perm.key === "manage_admins";
                          
                          return (
                            <div
                              key={perm.key}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                hasPermission 
                                  ? "bg-primary/5 border-primary/20" 
                                  : "bg-gray-50 border-gray-100"
                              }`}
                            >
                              <Icon className={`h-5 w-5 ${hasPermission ? perm.color : "text-gray-400"}`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${hasPermission ? "text-gray-900" : "text-gray-500"}`}>
                                  {perm.label}
                                  {isManageAdmins && (
                                    <span className="ml-1 text-xs text-amber-600">(Root)</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{perm.description}</p>
                              </div>
                              {hasPermission ? (
                                <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
                              ) : (
                                <ShieldX className="h-5 w-5 text-gray-300 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      {!admin.is_root_admin && admin.id !== currentUserId && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingAdmin(admin);
                              setEditPermissions([...admin.permissions]);
                            }}
                          >
                            <UserCog className="h-4 w-4 mr-1" /> Editar Permissões
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setAdminToRevoke(admin);
                              setRevokeDialogOpen(true);
                            }}
                          >
                            <ShieldX className="h-4 w-4 mr-1" /> Revogar Admin
                          </Button>
                        </div>
                      )}

                      {/* Root Admin Actions - Only Super Root can modify other roots */}
                      {admin.is_root_admin && !admin.is_super_root && admin.id !== currentUserId && isSuperRoot && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => promoteToSuperRoot(admin)}
                          >
                            <Sparkles className="h-4 w-4 mr-1" /> Promover a Super Root
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => demoteFromRoot(admin)}
                          >
                            <ShieldX className="h-4 w-4 mr-1" /> Rebaixar de Root
                          </Button>
                        </div>
                      )}

                      {/* Sub-admin actions - Promote to root */}
                      {!admin.is_root_admin && admin.id !== currentUserId && isSuperRoot && (
                        <div className="pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => {
                              setUserToPromoteRoot(admin);
                              setPromoteToRootDialogOpen(true);
                            }}
                          >
                            <Crown className="h-4 w-4 mr-1" /> Promover a Root Admin
                          </Button>
                        </div>
                      )}

                      {admin.is_root_admin && !isSuperRoot && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 pt-2 border-t">
                          <Crown className="h-4 w-4" />
                          Administradores Root têm acesso total. Apenas Super Roots podem modificá-los.
                        </p>
                      )}

                      {admin.is_super_root && (
                        <p className="text-xs text-purple-600 flex items-center gap-1 pt-2 border-t">
                          <Sparkles className="h-4 w-4" />
                          Super Root - Nível máximo de acesso com poder de gerenciar outros roots
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Support Agents Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Headphones className="h-5 w-5 text-green-600" /> Assistentes de Atendimento ({supportAgents.length})
            </CardTitle>
            <CardDescription>
              Funcionários da AgriLink que auxiliam usuários e gerenciam entregas
            </CardDescription>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50"
            onClick={() => setPromoteToSupportAgentDialogOpen(true)}
          >
            <Headphones className="h-4 w-4 mr-1" /> Promover Assistente
          </Button>
        </CardHeader>
        <CardContent>
          {supportAgents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Headphones className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhum assistente de atendimento</p>
              <p className="text-sm mt-1">Promova agentes para que trabalhem como assistentes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {supportAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 rounded-xl border bg-green-50/50 border-green-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Headphones className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{agent.full_name}</p>
                      <p className="text-sm text-muted-foreground">{agent.email || "Sem email"}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      Assistente
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setAgentToRevoke(agent);
                      setRevokeSupportAgentDialogOpen(true);
                    }}
                  >
                    <ShieldX className="h-4 w-4 mr-1" /> Revogar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promote User Dialog */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" /> Promover Novo Sub-Admin
            </DialogTitle>
            <DialogDescription>
              Selecione um usuário e defina suas permissões de administrador
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Selecionar Usuário</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                {filteredNonAdminUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 p-3 text-center">
                    Nenhum usuário disponível
                  </p>
                ) : (
                  filteredNonAdminUsers.slice(0, 10).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 border-b last:border-0 ${
                        selectedUser?.id === user.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email || "Sem email"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{user.user_type || "user"}</Badge>
                    </button>
                  ))
                )}
              </div>
              {selectedUser && (
                <div className="mt-2 p-2 bg-primary/10 rounded-lg flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Selecionado: {selectedUser.full_name}</span>
                </div>
              )}
            </div>

            {/* Permission Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Permissões</label>
              <div className="space-y-2">
                {PERMISSIONS.filter((p) => p.key !== "manage_admins").map((perm) => {
                  const Icon = perm.icon;
                  const isSelected = selectedPermissions.includes(perm.key);
                  
                  return (
                    <button
                      key={perm.key}
                      onClick={() => {
                        setSelectedPermissions((prev) =>
                          isSelected
                            ? prev.filter((p) => p !== perm.key)
                            : [...prev, perm.key]
                        );
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Switch checked={isSelected} />
                      <Icon className={`h-5 w-5 ${isSelected ? perm.color : "text-gray-400"}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium">{perm.label}</p>
                        <p className="text-xs text-gray-500">{perm.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={promoteToAdmin} disabled={!selectedUser || selectedPermissions.length === 0}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Promover a Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingAdmin} onOpenChange={(open) => !open && setEditingAdmin(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" /> Editar Permissões
            </DialogTitle>
            <DialogDescription>
              Modificar permissões de {editingAdmin?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {PERMISSIONS.filter((p) => p.key !== "manage_admins").map((perm) => {
              const Icon = perm.icon;
              const isSelected = editPermissions.includes(perm.key);
              
              return (
                <button
                  key={perm.key}
                  onClick={() => {
                    setEditPermissions((prev) =>
                      isSelected
                        ? prev.filter((p) => p !== perm.key)
                        : [...prev, perm.key]
                    );
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Switch checked={isSelected} />
                  <Icon className={`h-5 w-5 ${isSelected ? perm.color : "text-gray-400"}`} />
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium">{perm.label}</p>
                    <p className="text-xs text-gray-500">{perm.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAdmin(null)}>
              Cancelar
            </Button>
            <Button onClick={updatePermissions}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Admin Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Revogar Privilégios de Admin
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover os privilégios de administrador de{" "}
              <strong>{adminToRevoke?.full_name}</strong>?
              <br />
              Esta ação removerá todas as permissões e o acesso ao painel admin.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={revokeAdmin}>
              <ShieldX className="h-4 w-4 mr-1" /> Revogar Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Root Dialog */}
      <Dialog open={promoteToRootDialogOpen} onOpenChange={setPromoteToRootDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Crown className="h-5 w-5" /> Promover a Root Admin
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja promover{" "}
              <strong>{userToPromoteRoot?.full_name}</strong> a Root Admin?
              <br />
              Root Admins têm acesso total a todas as funcionalidades do sistema.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteToRootDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              onClick={promoteToRoot}
            >
              <Crown className="h-4 w-4 mr-1" /> Promover a Root
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Support Agent Dialog */}
      <Dialog open={promoteToSupportAgentDialogOpen} onOpenChange={setPromoteToSupportAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Headphones className="h-5 w-5" /> Promover a Assistente de Atendimento
            </DialogTitle>
            <DialogDescription>
              Selecione um agente para promover a Assistente de Atendimento AgriLink.
              O tempo de trabalho será rastreado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Selecionar Agente</label>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {availableAgents.length === 0 ? (
                  <p className="text-sm text-gray-500 p-3 text-center">
                    Nenhum agente disponível para promoção
                  </p>
                ) : (
                  availableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setUserToPromoteSupportAgent(agent)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 border-b last:border-0 ${
                        userToPromoteSupportAgent?.id === agent.id ? "bg-green-50" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{agent.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{agent.email || "Sem email"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">agente</Badge>
                    </button>
                  ))
                )}
              </div>
              {userToPromoteSupportAgent && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Selecionado: {userToPromoteSupportAgent.full_name}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPromoteToSupportAgentDialogOpen(false);
              setUserToPromoteSupportAgent(null);
            }}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={promoteToSupportAgent}
              disabled={!userToPromoteSupportAgent}
            >
              <Headphones className="h-4 w-4 mr-1" /> Promover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Support Agent Dialog */}
      <Dialog open={revokeSupportAgentDialogOpen} onOpenChange={setRevokeSupportAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldX className="h-5 w-5" /> Revogar Assistente de Atendimento
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover{" "}
              <strong>{agentToRevoke?.full_name}</strong> da equipe de Assistentes de Atendimento?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRevokeSupportAgentDialogOpen(false);
              setAgentToRevoke(null);
            }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={revokeSupportAgent}>
              <ShieldX className="h-4 w-4 mr-1" /> Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManagement;
