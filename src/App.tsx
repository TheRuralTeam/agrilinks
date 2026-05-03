import React, { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
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
import ChooseAccountType from "./pages/ChooseAccountType";

const queryClient = new QueryClient();

const isEmailConfirmed = (user: User | null) => Boolean(user?.email_confirmed_at)

// OAuth callback handler – processes PKCE/implicit token at the root URL
const OAuthCallbackHandler = () => {
  const { user, loading, profileLoading, userProfile, completePendingGoogleOnboarding } = useAuth();
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loading || profileLoading || completing || done) return;
    if (!user) return;

    const hasPending = localStorage.getItem('pendingGoogleOnboarding');
    if (!hasPending) return; // no pending data – let render logic handle redirect

    // If user already has a profile (returning user), just clear pending data and go to /app
    if (userProfile) {
      localStorage.removeItem('pendingGoogleOnboarding');
      setDone(true);
      return;
    }

    // New user: create profile from pending onboarding data
    setCompleting(true);
    completePendingGoogleOnboarding(user).then(({ completed }) => {
      setDone(completed);
      setCompleting(false);
    });
  }, [user, loading, profileLoading, userProfile]);

  // Show spinner while auth, profile, or onboarding completion is in progress
  if (loading || profileLoading || completing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">A autenticar...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Profile was just created from pending onboarding data OR already existed
  if (done || userProfile) return <Navigate to="/app" replace />;

  // No pending data and no profile → go to account setup
  return <Navigate to="/escolher-tipo-conta" replace />;
};

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, profileLoading, userProfile } = useAuth();

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

  if (!user) return <Navigate to="/login" replace />;

  if (!isEmailConfirmed(user)) {
    const email = user.email ? `&email=${encodeURIComponent(user.email)}` : ""
    return <Navigate to={`/confirmar-email?pending=1${email}`} replace />;
  }

  // Wait for profile to load before deciding if user needs to set up account
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // OAuth user with no profile → send to account setup
  if (!userProfile) return <Navigate to="/escolher-tipo-conta" replace />;

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Handle OAuth callback: PKCE usually sends ?code=, implicit sends #access_token.
  // Also support legacy Google redirects landing on /confirmar-email?oauth=google.
  const isPKCECallback = location.search.includes('code=')
  const isImplicitCallback = location.hash.includes('access_token=')
  const isLegacyGoogleOauthRoute =
    location.pathname === '/confirmar-email' && location.search.includes('oauth=google')

  if (isPKCECallback || isImplicitCallback || isLegacyGoogleOauthRoute) {
    return (
      <Routes>
        <Route path="*" element={<OAuthCallbackHandler />} />
      </Routes>
    );
  }

  const rootElement = loading ? (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  ) : user ? (
    isEmailConfirmed(user)
      ? <Navigate to="/app" replace />
      : <Navigate to={`/confirmar-email?pending=1${user.email ? `&email=${encodeURIComponent(user.email)}` : ""}`} replace />
  ) : (
    <Navigate to="/login" replace />
  );

  return (
    <Routes>
      <Route path="/" element={rootElement} />
      <Route path="/site" element={<Index />} />
      <Route
        path="/escolher-tipo-conta"
        element={<ChooseAccountType />}
      />
      <Route
        path="/login"
        element={
          user
            ? isEmailConfirmed(user)
              ? <Navigate to="/app" replace />
              : <Navigate to={`/confirmar-email?pending=1${user.email ? `&email=${encodeURIComponent(user.email)}` : ""}`} replace />
            : <LoginPage />
        }
      />
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