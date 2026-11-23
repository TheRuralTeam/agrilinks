import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute, MapPreviewRoute, OpenRoute, PermissionRoute, RoleRoute } from "./routes/RouteGuards";
import { ThemeProvider } from "./contexts/ThemeContext";
import Loader from "./components/ui/Loader";
import AppLayout from "./layouts/AppLayout";
import { GuestGateProvider } from "./contexts/GuestGateContext";
import { purgeExpiredGuestSession } from "./lib/guestSession";
import NotificationRuntime from "./components/NotificationRuntime";

const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Registration = lazy(() => import("./pages/Registration"));
const ProformaInvoices = lazy(() => import("./pages/ProformaInvoices"));
const TechnicalSheet = lazy(() => import("./pages/TechnicalSheet"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AppHome = lazy(() => import("./pages/AppHome"));
const MapView = lazy(() => import("./pages/MapView"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const Profile = lazy(() => import("./pages/Profile"));
const ConversationsList = lazy(() => import("./pages/ConversationsList"));
const Support = lazy(() => import("./pages/Support"));
const PublishProduct = lazy(() => import("./pages/PublishProduct"));
const MarketData = lazy(() => import("./pages/MarketData"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminOrderTrash = lazy(() => import("./components/admin/AdminOrderTrash"));
const FichaRecebimento = lazy(() => import("./pages/FichaRecebimento"));
const CriarContratoFuturos = lazy(() => import("./pages/CriarContratoFuturos"));
const ContratosFuturos = lazy(() => import("./pages/ContratosFuturos"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const EmailConfirmation = lazy(() => import("./pages/EmailConfirmation"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const AdminPasswordResets = lazy(() => import("./pages/AdminPasswordResets"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const B2BProfile = lazy(() => import("./pages/B2BProfile"));
const CompletarPerfil = lazy(() => import("./pages/CompletarPerfil"));
const PublicProductLocation = lazy(() => import("./pages/PublicProductLocation"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const MeusContratos = lazy(() => import("./pages/MeusContratos"));
const ProximasCargas = lazy(() => import("./pages/ProximasCargas"));
const FreightLoadScan = lazy(() => import("./pages/FreightLoadScan"));
const P2PBeneficiary = lazy(() => import("./pages/P2PBeneficiary"));
const MyPurchases = lazy(() => import("./pages/MyPurchases"));
const BuyerCart = lazy(() => import("./pages/BuyerCart"));

const queryClient = new QueryClient();


const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (user?.app_metadata?.must_change_password === true && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/app" replace /> : <Index />} />
        <Route path="/index" element={user ? <Navigate to="/app" replace /> : <Index />} />
        <Route path="/home" element={user ? <Navigate to="/app" replace /> : <Index />} />
        <Route path="/site" element={<Index />} />
        <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
        <Route path="/cadastro" element={user ? <Navigate to="/app" replace /> : <Registration />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/confirmar-email" element={<EmailConfirmation />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/admin-password-resets" element={<PermissionRoute permissions={["manage_users"]} allowRootAdmins><AdminPasswordResets /></PermissionRoute>} />
        <Route path="/termos-publicidade" element={<TermsOfService />} />
        <Route path="/produto/:id" element={<ProductDetail />} />
        <Route path="/produto/:id/localizacao" element={<PublicProductLocation />} />
        <Route path="/mapa" element={<MapPreviewRoute render={(readOnly) => <MapView readOnly={readOnly} />} />} />

        {/* App Routes */}
        <Route
          path="/app"
          element={
            <OpenRoute allowIncomplete>
              <AppLayout>
                <AppHome />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/mapa-app"
          element={
            <MapPreviewRoute render={(readOnly) => (
              <AppLayout>
                <MapView readOnly={readOnly} />
              </AppLayout>
            )} />
          }
        />
        <Route
          path="/notificacoes"
          element={
            <OpenRoute>
              <AppLayout>
                <Notifications />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/messages/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Messages />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/listamensagens"
          element={
            <OpenRoute>
              <AppLayout>
                <ConversationsList />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <OpenRoute>
              <AppLayout>
                <Profile />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/carrinho"
          element={
            <RoleRoute allowedRole="comprador">
              <AppLayout>
                <BuyerCart />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/minhas-compras"
          element={
            <RoleRoute allowedRole="comprador">
              <AppLayout>
                <MyPurchases />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/perfil/:id"
          element={
            <OpenRoute>
              <AppLayout>
                <UserProfile />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/empresa/:id"
          element={
            <OpenRoute>
              <AppLayout>
                <B2BProfile />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/suporte"
          element={
            <OpenRoute>
              <AppLayout>
                <Support />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/mercado"
          element={
            <OpenRoute>
              <AppLayout>
                <MarketData />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/carteira"
          element={
            <ProtectedRoute>
              <Navigate to="/perfil" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/publicar-produto"
          element={
            <OpenRoute>
              <PublishProduct />
            </OpenRoute>
          }
        />
        <Route
          path="/facturas-proforma"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProformaInvoices />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PermissionRoute permissions={['view_analytics']}>
              <Navigate to="/admindashboard" replace />
            </PermissionRoute>
          }
        />
        <Route
          path="/admindashboard"
          element={
            <PermissionRoute permissions={['view_analytics']}>
              <AdminDashboard />
            </PermissionRoute>
          }
        />
        <Route
          path="/admindashboard/pedidos/lixeira"
          element={
            <PermissionRoute permissions={['manage_orders']} allowSupportAgent>
              <AdminOrderTrash />
            </PermissionRoute>
          }
        />
        <Route
          path="/search"
          element={
            <OpenRoute>
              <AppLayout>
                <SearchPage />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/contratos-futuros/novo"
          element={
            <ProtectedRoute>
              <CriarContratoFuturos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contratos"
          element={
            <OpenRoute>
              <AppLayout>
                <MeusContratos />
              </AppLayout>
            </OpenRoute>
          }
        />
        <Route
          path="/cargas"
          element={
            <RoleRoute allowedRole="motorista">
              <AppLayout>
                <ProximasCargas />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/cargas/scan/:token"
          element={
            <RoleRoute allowedRole="motorista">
              <AppLayout>
                <FreightLoadScan />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/contratos-futuros"
          element={
            <ProtectedRoute>
              <ContratosFuturos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ficharecebimento"
          element={
            <OpenRoute>
              <FichaRecebimento />
            </OpenRoute>
          }
        />
        <Route
          path="/ficha-tecnica/:id"
          element={
            <ProtectedRoute allowIncomplete>
              <TechnicalSheet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/completar-perfil"
          element={
            <ProtectedRoute allowIncomplete>
              <CompletarPerfil />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  useEffect(() => {
    purgeExpiredGuestSession();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          console.log('SW já ativo:', registration);
        })
        .catch((error) => {
          console.warn('Service worker not ready yet:', error);
        });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <GuestGateProvider>
                <NotificationRuntime />
                <AppRoutes />
              </GuestGateProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;