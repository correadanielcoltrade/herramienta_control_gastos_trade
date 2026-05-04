import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import type { RoleName } from "../types";

interface ProtectedRouteProps {
  allowedRoles?: RoleName[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const { token, user, isLoading } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-brand-700">Cargando sesion...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role.name)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

