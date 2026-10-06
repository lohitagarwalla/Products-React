import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function CartAction({ product }) {
  const { isAuthenticated } = useAuth();
  const { addToCart, cartItems, locked, saving, refreshing, cartError, refreshCart } = useCart();
  const quantity = cartItems.find(item => item.id === product.id)?.quantity;
  if (!isAuthenticated) return <Link className="btn btn-primary" to="/login" state={{ from: `/products/${product.id}` }}>Log in to add to cart</Link>;
  return <div>
    <button className="btn btn-primary" disabled={locked || quantity >= 1000 || (!quantity && cartItems.length >= 100)} onClick={() => addToCart(product)}>
      {saving ? "Saving cart…" : refreshing ? "Loading cart…" : `Add to Cart${quantity ? ` (${quantity})` : ""}`}
    </button>
    {cartError && <p className="error-message" role="alert">{cartError} <button className="btn btn-secondary btn-small" disabled={saving || refreshing} onClick={refreshCart}>Reload cart</button></p>}
  </div>;
}
