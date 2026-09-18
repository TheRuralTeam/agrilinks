import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageWelcomeBanner } from "./components/LanguageWelcomeBanner";
import Loader from "./components/ui/Loader";
import AppLayout from "./layouts/AppLayout";
import { GuestGateProvider } from "./contexts/GuestGateContext";
import GuestCTABar from "./components/GuestCTABar";
import { purgeExpiredGuestSession } from "./lib/guestSession";

const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Registration = lazy(() => import("./pages/Registration"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
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
const Wallet = lazy(() => import("./pages/Wallet"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const FichaRecebimento = lazy(() => import("./pages/FichaRecebimento"));
const CriarContratoFuturos = lazy(() => import("./pages/CriarContratoFuturos"));
const ContratosFuturos = lazy(() => import("./pages/ContratosFuturos"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const EmailConfirmation = lazy(() => import("./pages/EmailConfirmation"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const B2BProfile = lazy(() => import("./pages/B2BProfile"));
const CompletarPerfil = lazy(() => import("./pages/CompletarPerfil"));
const PublicProductLocation = lazy(() => import("./pages/PublicProductLocation"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const MeusContratos = lazy(() => import("./pages/MeusContratos"));
const ProximasCargas = lazy(() => import("./pages/ProximasCargas"));

const queryClient = new QueryClient();

const isProfileComplete = (p: any) =>
  !!(p && p.user_type && p.identity_document && p.province_id && p.municipality_id);

// Protected Route component
const ProtectedRoute = ({ children, allowIncomplete = false, allowUnverified = false }: { children: React.ReactNode; allowIncomplete?: boolean; allowUnverified?: boolean }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Supabase Auth é a fonte de verdade; o perfil público pode estar alguns ms atrasado.
  const emailConfirmed = Boolean(user.email_confirmed_at) || userProfile?.email_verified === true;
  if (!allowUnverified && !emailConfirmed) {
    return <Navigate to="/confirmar-email" replace />;
  }

  if (!allowIncomplete && userProfile && !isProfileComplete(userProfile)) {
    return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};

/**
 * Rota aberta: utilizadores autenticados passam pelas mesmas validações do
 * ProtectedRoute; visitantes entram em Modo Convidado (dados locais, 2h).
 */
const OpenRoute = ({ children, allowIncomplete = false }: { children: React.ReactNode; allowIncomplete?: boolean }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    const emailConfirmed = Boolean(user.email_confirmed_at) || userProfile?.email_verified === true;
    if (!emailConfirmed) return <Navigate to="/confirmar-email" replace />;
    if (!allowIncomplete && userProfile && !isProfileComplete(userProfile)) return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();


  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/index" element={<Navigate to="/app" replace />} />
        <Route path="/home" element={<Navigate to="/app" replace />} />
        <Route path="/site" element={<Index />} />
        <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
        <Route path="/cadastro" element={<Registration />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/confirmar-email" element={<EmailConfirmation />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/termos-publicidade" element={<TermsOfService />} />
        <Route path="/produto/:id/localizacao" element={<PublicProductLocation />} />
        <Route path="/mapa" element={<MapView />} />

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
            <OpenRoute>
              <AppLayout>
                <MapView />
              </AppLayout>
            </OpenRoute>
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
          path="/perfil/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <UserProfile />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/empresa/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <B2BProfile />
              </AppLayout>
            </ProtectedRoute>
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
              <AppLayout>
                <Wallet />
              </AppLayout>
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admindashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppLayout>
                <ProximasCargas />
              </AppLayout>
            </ProtectedRoute>
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
            <ProtectedRoute>
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
            <LanguageWelcomeBanner />
            <BrowserRouter>
              <GuestGateProvider>
                <AppRoutes />
                <GuestCTABar />
              </GuestGateProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;