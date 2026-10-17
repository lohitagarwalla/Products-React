import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthenticatedRoute() {
  const { isAuthenticated, sessionKey, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <p role="status">Restoring your session…</p>;
  return isAuthenticated ? <Outlet key={sessionKey} />
    : <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
}
