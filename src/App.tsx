import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import SearchPage from "./pages/SearchPage";
import EmailConfirmation from "./pages/EmailConfirmation";
import ResetPassword from "./pages/ResetPassword";
import UserProfile from "./pages/UserProfile";
 import B2BProfile from "./pages/B2BProfile";
import CompletarPerfil from "./pages/CompletarPerfil";

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

  // Bloqueia acesso se email não estiver confirmado
  const emailConfirmed = !!(user as any)?.email_confirmed_at || !!userProfile?.email_verified;
  if (!allowUnverified && !emailConfirmed) {
    return <Navigate to="/confirmar-email" replace />;
  }

  if (!allowIncomplete && userProfile && !isProfileComplete(userProfile)) {
    return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  const rootElement = loading ? (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  ) : user ? (
    <Navigate to="/app" replace />
  ) : (
    <Navigate to="/login" replace />
  );

  return (
    <Routes>
      <Route path="/" element={rootElement} />
      <Route path="/index" element={<Navigate to="/" replace />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/site" element={<Index />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/cadastro" element={<Registration />} />
      <Route path="/confirmar-email" element={<EmailConfirmation />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/termos-publicidade" element={<TermsOfService />} />

      {/* App Routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AppHome />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mapa"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MapView />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notificacoes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Notifications />
            </AppLayout>
          </ProtectedRoute>
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
          <ProtectedRoute>
            <AppLayout>
              <ConversationsList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Profile />
            </AppLayout>
          </ProtectedRoute>
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
          <ProtectedRoute>
            <AppLayout>
              <Support />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mercado"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MarketData />
            </AppLayout>
          </ProtectedRoute>
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
          <ProtectedRoute>
            <PublishProduct />
          </ProtectedRoute>
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
          <ProtectedRoute>
            <AppLayout>
              <SearchPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ficharecebimento"
        element={
          <ProtectedRoute>
            <FichaRecebimento />
          </ProtectedRoute>
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      console.log("SW já ativo:", registration);
    });
  }
}, []);



  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LanguageWelcomeBanner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;