import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProductSearch from "./ProductSearch";
import AdminMenu from "./AdminMenu";
import AccountMenu from "./AccountMenu";

export default function Navbar() {
  const { user, logout, isAdmin, initializing } = useAuth();
  const navigate = useNavigate();
  const { pathname, key: locationKey } = useLocation();
  const [params] = useSearchParams();
  const search = pathname === "/" ? (params.get("search") || "").slice(0, 200) : "";

  function searchProducts(value) {
    const query = new URLSearchParams({ ...(value ? { search: value } : {}), page: "1" });
    navigate({ pathname: "/", search: `?${query}` });
  }
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          ShopHub
        </Link>
        <div className="navbar-links">
          <Link to="/" className="navbar-link">
            Home
          </Link>
          <Link to="/checkout" className="navbar-link">
            Cart
          </Link>
        </div>
        <div className="navbar-search">
          <ProductSearch key={pathname} search={search} onSearch={searchProducts} />
        </div>
        <div className="navbar-auth">
          {initializing ? <span role="status">Restoring your session…</span> : !user ? (
            <div className="navbar-auth-links">
              <Link to="/login" className="btn btn-secondary">
                Login
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Signup
              </Link>
            </div>
          ) : (
            <div className="navbar-user">
              <AccountMenu
                key={`account-${locationKey}`}
                user={user}
                logout={logout}
              />
              {isAdmin && <AdminMenu key={`admin-${locationKey}`} />}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
