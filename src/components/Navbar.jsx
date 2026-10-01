import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProductSearch from "./ProductSearch";

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
          {isAdmin && <Link to="/admin/products" className="navbar-link">Manage products</Link>}
        </div>
        <div className="navbar-search">
          <ProductSearch key={pathname} search={search} onSearch={searchProducts} />
        </div>
        <div className="navbar-auth">
          {!user ? (
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
              <span className="navbar-greeting">Hello, {user.email}</span>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
