import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
  const { isAuthenticated, isAdmin, sessionKey, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <p role="status">Restoring your session…</p>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (!isAdmin) return <main className="page"><div className="container">
    <h1>Access denied</h1><p>You need the Admin role to access this page.</p><Link to="/">Back to shop</Link>
  </div></main>;
  return <Outlet key={sessionKey} />;
}
