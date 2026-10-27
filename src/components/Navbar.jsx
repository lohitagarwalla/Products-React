import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProductSearch from "./ProductSearch";
import AdminMenu from "./AdminMenu";
import AccountMenu from "./AccountMenu";

function NavIcon({ name }) {
  const paths = {
    shopping: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /></>,
    cab: <><path d="m5 6-2 7v6h2v-3h14v3h2v-6l-2-7H5Z" /><path d="M3 12h18M10 3h4M6 14h1m10 0h1" /></>,
    food: <><path d="M4 3v6a2 2 0 0 0 4 0V3M6 3v18M19 21V3c-4 2-5 9 0 10" /></>,
    cart: <><path d="M2 3h3l3 12h11l3-9H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

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
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-container navbar-upper">
        <Link to="/" className="navbar-brand">
          ShopHub
        </Link>
        <div className="navbar-services" aria-label="Services">
          <Link to="/" className="navbar-service navbar-service-active">
            <NavIcon name="shopping" /><span>Shop</span>
          </Link>
          <button type="button" className="navbar-service" disabled title="Cab — coming soon" aria-label="Cab, coming soon">
            <NavIcon name="cab" /><span>Cab</span>
          </button>
          <button type="button" className="navbar-service" disabled title="Food — coming soon" aria-label="Food, coming soon">
            <NavIcon name="food" /><span>Food</span>
          </button>
        </div>
      </div>
      <div className="navbar-lower">
        <div className="navbar-container navbar-tools">
        <div className="navbar-search">
          <ProductSearch key={pathname} search={search} onSearch={searchProducts} />
        </div>
        <div className="navbar-links">
          <Link to="/cart" className="navbar-link" aria-current={pathname === "/cart" ? "page" : undefined}>
            <NavIcon name="cart" /><span>Cart</span>
          </Link>
              <AccountMenu
                key={`account-${locationKey}-${user?.id ?? "guest"}`}
                user={user}
                logout={logout}
                initializing={initializing}
              />
              {!initializing && user && isAdmin && <AdminMenu key={`admin-${locationKey}`} />}
        </div>
        </div>
      </div>
    </nav>
  );
}
