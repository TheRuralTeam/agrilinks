import React, { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/ui/Loader";
import type { AdminPermission } from "../features/auth/authorization";
import type { User as UserProfile } from "../types/database";

type ProfileCompletenessFields = Pick<UserProfile, "user_type" | "identity_document" | "province_id" | "municipality_id">;
type UserRole = NonNullable<UserProfile["user_type"]>;

export const isProfileComplete = (profile: ProfileCompletenessFields | null | undefined): boolean =>
  Boolean(profile?.user_type && profile.identity_document && profile.province_id && profile.municipality_id);

// Protected Route component
export const ProtectedRoute = ({ children, allowIncomplete = true, allowUnverified = false }: { children: React.ReactNode; allowIncomplete?: boolean; allowUnverified?: boolean }) => {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  // Supabase Auth é a fonte de verdade; o perfil público pode estar alguns ms atrasado.
  const emailConfirmed = Boolean(user.email_confirmed_at);
  if (!allowUnverified && !emailConfirmed) {
    return <Navigate to="/confirmar-email" replace />;
  }

  if (!allowIncomplete && userProfile && !isProfileComplete(userProfile)) {
    return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};

const MAP_PREVIEW_STORAGE_KEY = 'agrilink-map-preview-expires-at';
const MAP_PREVIEW_DURATION_MS = 60_000;

export const MapPreviewRoute = ({ render }: { render: (readOnly: boolean) => React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [expired, setExpired] = React.useState(false);
  const from = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (loading || user) return;

    let expiresAt: number;
    try {
      const storedExpiry = Number(sessionStorage.getItem(MAP_PREVIEW_STORAGE_KEY));
      expiresAt = storedExpiry > 0 ? storedExpiry : Date.now() + MAP_PREVIEW_DURATION_MS;
      if (storedExpiry <= 0) sessionStorage.setItem(MAP_PREVIEW_STORAGE_KEY, String(expiresAt));
    } catch {
      expiresAt = Date.now() + MAP_PREVIEW_DURATION_MS;
    }

    const remaining = expiresAt - Date.now();
    const requireLogin = () => navigate('/login', { replace: true, state: { from } });
    if (remaining <= 0) {
      setExpired(true);
      requireLogin();
      return;
    }

    const timeout = window.setTimeout(() => {
      setExpired(true);
      requireLogin();
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [loading, user, navigate, from]);

  if (loading || expired) return <Loader />;
  if (user) return <ProtectedRoute>{render(false)}</ProtectedRoute>;
  return render(true);
};

/**
 * Rota aberta: utilizadores autenticados passam pelas mesmas validações do
 * ProtectedRoute; visitantes entram em Modo Convidado (dados locais, 2h).
 */
export const OpenRoute = ({ children, allowIncomplete = true }: { children: React.ReactNode; allowIncomplete?: boolean }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    const emailConfirmed = Boolean(user.email_confirmed_at);
    if (!emailConfirmed) return <Navigate to="/confirmar-email" replace />;
    if (!allowIncomplete && userProfile && !isProfileComplete(userProfile)) return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};

export const PermissionRoute = ({ children, permissions, requireAll = false, allowSupportAgent = false, allowRootAdmins = false }: { children: React.ReactNode; permissions: AdminPermission[]; requireAll?: boolean; allowSupportAgent?: boolean; allowRootAdmins?: boolean }) => {
  const { user, loading, isAdmin, isRootAdmin, isSuperRoot, isSupportAgent, hasAnyPermission, hasAllPermissions } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin && !isRootAdmin && !isSuperRoot) return <Navigate to="/app" replace />;
  const allowedByPermission = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  const allowed = allowedByPermission || (allowSupportAgent && isSupportAgent) || (allowRootAdmins && (isRootAdmin || isSuperRoot));
  if (!allowed) return <Navigate to="/app" replace />;
  return <>{children}</>;
};


export const RoleRoute = ({ children, allowedRole }: { children: React.ReactNode; allowedRole: UserRole }) => {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.email_confirmed_at) return <Navigate to="/confirmar-email" replace />;
  if (String(userProfile?.user_type ?? "").toLowerCase() !== allowedRole) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
};
