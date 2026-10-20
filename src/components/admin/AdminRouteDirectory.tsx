import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, LockKeyhole, Route as RouteIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

type RouteEntry = {
  label: string;
  path: string;
  audience: string;
  category: string;
  note?: string;
  link?: boolean;
};

const ROUTES: RouteEntry[] = [
  { label: "Página inicial", path: "/", audience: "Público", category: "Público" },
  { label: "Página inicial (alias /index)", path: "/index", audience: "Público", category: "Público" },
  { label: "Página inicial (alias /home)", path: "/home", audience: "Público", category: "Público" },
  { label: "Página pública do site", path: "/site", audience: "Público", category: "Público" },
  { label: "Cadastro", path: "/cadastro", audience: "Público", category: "Autenticação" },
  { label: "Retorno de autenticação", path: "/auth/callback", audience: "Fluxo de autenticação", category: "Autenticação" },
  { label: "Aplicação / Marketplace", path: "/app", audience: "Utilizadores autenticados ou convidados", category: "Marketplace" },
  { label: "Mapa", path: "/mapa", audience: "Público (pré-visualização) / autenticados", category: "Mapa e logística" },
  { label: "Mapa dentro da aplicação", path: "/mapa-app", audience: "Utilizadores autenticados ou convidados", category: "Mapa e logística" },
  { label: "Pesquisar", path: "/search", audience: "Público/autenticado", category: "Marketplace" },
  { label: "Mercado e preços", path: "/mercado", audience: "Público/autenticado", category: "Marketplace" },
  { label: "Publicar produto", path: "/publicar-produto", audience: "Agricultores/fornecedores", category: "Fornecedor" },
  { label: "Minhas compras", path: "/minhas-compras", audience: "Compradores", category: "Comprador" },
  { label: "Perfil", path: "/perfil", audience: "Utilizadores autenticados ou convidados", category: "Conta" },
  { label: "Carteira (redirecciona para perfil)", path: "/carteira", audience: "Utilizadores autenticados", category: "Conta" },
  { label: "Perfil público de utilizador", path: "/perfil/:id", audience: "Público/autenticado", category: "Conta", link: false, note: "Substituir :id por um ID real." },
  { label: "Perfil de empresa", path: "/empresa/:id", audience: "Público/autenticado", category: "Conta", link: false, note: "Substituir :id por um ID real." },
  { label: "Completar perfil", path: "/completar-perfil", audience: "Utilizadores autenticados", category: "Conta" },
  { label: "Notificações", path: "/notificacoes", audience: "Utilizadores autenticados/convidados conforme o modo", category: "Comunicação" },
  { label: "Lista de mensagens", path: "/listamensagens", audience: "Utilizadores autenticados/convidados conforme o modo", category: "Comunicação" },
  { label: "Conversa", path: "/messages/:id", audience: "Utilizadores autenticados", category: "Comunicação", link: false, note: "Substituir :id por um ID real." },
  { label: "Suporte", path: "/suporte", audience: "Público/autenticado", category: "Comunicação" },
  { label: "Contratos", path: "/contratos", audience: "Público/autenticado", category: "Contratos" },
  { label: "Criar contrato futuro", path: "/contratos-futuros/novo", audience: "Utilizadores autenticados", category: "Contratos" },
  { label: "Contratos futuros", path: "/contratos-futuros", audience: "Utilizadores autenticados", category: "Contratos" },
  { label: "Cargas e entregas do motorista", path: "/cargas", audience: "Motoristas", category: "Motorista" },
  { label: "Leitura/validação de carga", path: "/cargas/scan/:token", audience: "Motoristas", category: "Motorista", link: false, note: "Exige token de carga válido." },
  { label: "Facturas proforma", path: "/facturas-proforma", audience: "Utilizadores autenticados", category: "Documentos" },
  { label: "Ficha de recebimento", path: "/ficharecebimento", audience: "Público/autenticado", category: "Documentos" },
  { label: "Ficha técnica de produto", path: "/ficha-tecnica/:id", audience: "Utilizadores autenticados", category: "Documentos", link: false, note: "Substituir :id por um ID real." },
  { label: "Dashboard pessoal", path: "/dashboard", audience: "Utilizadores autenticados", category: "Conta" },
  { label: "Painel administrativo", path: "/admindashboard", audience: "Administradores com permissões", category: "Administração" },
  { label: "Lixeira de pedidos", path: "/admindashboard/pedidos/lixeira", audience: "Administração com gestão de pedidos/suporte", category: "Administração" },
  { label: "Redefinição de senhas", path: "/admin-password-resets", audience: "Administração com gestão de utilizadores", category: "Administração" },
  { label: "Termos de publicidade", path: "/termos-publicidade", audience: "Público", category: "Público" },
  { label: "Localização pública de produto", path: "/produto/:id/localizacao", audience: "Público", category: "Marketplace", link: false, note: "Substituir :id por um ID real." },
  { label: "Confirmação de e-mail", path: "/confirmar-email", audience: "Utilizadores em confirmação", category: "Autenticação" },
  { label: "Recuperar palavra-passe", path: "/reset-password", audience: "Público", category: "Autenticação" },
  { label: "Alterar palavra-passe", path: "/change-password", audience: "Utilizadores obrigados a alterar senha", category: "Autenticação" },
  { label: "Login", path: "/login", audience: "Público", category: "Autenticação" },
];

const AdminRouteDirectory = () => {
  const navigate = useNavigate();
  const groups = Array.from(new Set(ROUTES.map((route) => route.category)));

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RouteIcon className="h-5 w-5 text-primary" /> Catálogo de rotas da AgriLink
          </CardTitle>
          <CardDescription>
            Índice das rotas declaradas na aplicação para facilitar a navegação administrativa. A visibilidade neste catálogo não concede permissões; cada rota mantém as suas próprias regras de acesso.
          </CardDescription>
        </CardHeader>
      </Card>
      {groups.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ROUTES.filter((route) => route.category === group).map((route) => (
              <Card key={route.path} className="border border-border/70 shadow-none">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{route.label}</div>
                    <code className="mt-1 block break-all text-xs text-muted-foreground">{route.path}</code>
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{route.audience}</span>
                    </div>
                    {route.note && <p className="mt-2 text-xs text-muted-foreground">{route.note}</p>}
                  </div>
                  <div className="mt-auto">
                    {route.link === false ? (
                      <Button variant="outline" size="sm" disabled className="w-full">Rota parametrizada</Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(route.path)}>
                        Abrir rota <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default AdminRouteDirectory;
