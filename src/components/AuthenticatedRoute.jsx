import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthenticatedRoute() {
  const { isAuthenticated, sessionKey } = useAuth();
  const location = useLocation();
  return isAuthenticated ? <Outlet key={sessionKey} />
    : <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
}
