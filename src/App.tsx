import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageWelcomeBanner } from "@/components/LanguageWelcomeBanner";
// Pages
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import Registration from "./pages/Registration";
import Dashboard from "./pages/Dashboard";
import TechnicalSheet from "./pages/TechnicalSheet";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import AppHome from "./pages/AppHome";
import MapView from "./pages/MapView";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import ConversationsList from "./pages/ConversationsList";
import Support from "./pages/Support";
import PublishProduct from "./pages/PublishProduct";
import MarketData from "./pages/MarketData";
import Wallet from "./pages/Wallet";
import AppLayout from "./layouts/AppLayout";
import AdminDashboard from "./pages/AdminDashboard";
import FichaRecebimento from "./pages/FichaRecebimento";
import CriarContratoFuturos from "./pages/CriarContratoFuturos";
import ContratosFuturos from "./pages/ContratosFuturos";
import SearchPage from "./pages/SearchPage";
import EmailConfirmation from "./pages/EmailConfirmation";
import ResetPassword from "./pages/ResetPassword";
import UserProfile from "./pages/UserProfile";
 import B2BProfile from "./pages/B2BProfile";
import CompletarPerfil from "./pages/CompletarPerfil";
import PublicProductLocation from "./pages/PublicProductLocation";
import AuthCallback from "./pages/AuthCallback";
import MeusContratos from "./pages/MeusContratos";
import ProximasCargas from "./pages/ProximasCargas";
import { GuestGateProvider } from "@/contexts/GuestGateContext";
import GuestCTABar from "@/components/GuestCTABar";
import { purgeExpiredGuestSession } from "@/lib/guestSession";

const queryClient = new QueryClient();

const isProfileComplete = (p: any) =>
  !!(p && p.user_type && p.identity_document && p.province_id && p.municipality_id);

// Protected Route component
const ProtectedRoute = ({ children, allowIncomplete = false, allowUnverified = false }: { children: React.ReactNode; allowIncomplete?: boolean; allowUnverified?: boolean }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Bloqueia ações da plataforma até a confirmação real por OTP AgriLink
  const emailConfirmed = userProfile?.email_verified === true;
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
const OpenRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    const emailConfirmed = userProfile?.email_verified === true;
    if (!emailConfirmed) return <Navigate to="/confirmar-email" replace />;
    if (userProfile && !isProfileComplete(userProfile)) return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();


  return (
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
          <OpenRoute>
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
  );
};

const App = () => {
useEffect(() => {
  purgeExpiredGuestSession();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      console.log("SW já ativo:", registration);
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