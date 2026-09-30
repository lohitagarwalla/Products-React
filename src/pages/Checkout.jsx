import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import ProductImage from "../components/ProductImage";
import { formatPrice, PRODUCT_CHANGED_EVENT } from "../services/productService";

export default function Checkout() {
  const { cartItems, updateQuantity, removeFromCart, totals, clearCart, refreshCart, refreshing, cartError } = useCart();
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    refreshCart();
    window.addEventListener(PRODUCT_CHANGED_EVENT, refreshCart);
    return () => window.removeEventListener(PRODUCT_CHANGED_EVENT, refreshCart);
  }, [refreshCart]);

  return <main className="page"><div className="container">
    <h1 className="page-title">Checkout</h1>
    <p className="muted">Demo checkout. Orders and payments are not submitted to the backend.</p>
    {completed && <p className="success-message" role="status">Demo checkout completed.</p>}
    {refreshing && <p role="status">Checking current prices and availability…</p>}
    {cartError && <div className="error-message" role="alert">{cartError} <button className="btn btn-secondary" onClick={refreshCart}>Retry</button></div>}
    {!cartItems.length ? <p className="empty-state">Your cart is empty. <Link to="/">Browse products</Link></p> :
      <div className="checkout-container"><section className="checkout-items"><h2>Order summary</h2>
        {cartItems.map(item => <div className="checkout-item" key={item.id}>
          <ProductImage image={item.available ? item.product.images[0] : null} title={item.product.title} className="checkout-item-image" />
          <div className="checkout-item-details"><h3>{item.product.title}</h3><p>{formatPrice(item.product.price, item.product.currency)} each</p>
            {!item.available && <p className="form-error">This product is no longer available. Remove it to continue.</p>}
          </div>
          <div className="checkout-item-controls"><div className="quantity-controls">
            <button className="quantity-btn" aria-label={`Decrease ${item.product.title} quantity`} onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button><span>{item.quantity}</span>
            <button className="quantity-btn" aria-label={`Increase ${item.product.title} quantity`} disabled={!item.available} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
          </div><p>{formatPrice(item.product.price * item.quantity, item.product.currency)}</p>
            <button className="btn btn-secondary btn-small" onClick={() => removeFromCart(item.id)}>Remove</button>
          </div>
        </div>)}
      </section><section className="checkout-summary"><h2>Totals</h2>
        {Object.entries(totals).map(([currency, total]) => <div className="checkout-total" key={currency}><span>{currency}</span><strong>{formatPrice(total, currency)}</strong></div>)}
        <button className="btn btn-primary btn-block" disabled={refreshing || !!cartError || cartItems.some(item => !item.available)} onClick={() => { clearCart(); setCompleted(true); }}>Complete demo checkout</button>
      </section></div>}
  </div></main>;
}
