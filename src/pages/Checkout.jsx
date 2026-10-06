import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getSession } from "../services/authStorage";
import ProductImage from "../components/ProductImage";
import { formatPrice, PRODUCT_CHANGED_EVENT } from "../services/productService";
import { multiplyMoney } from "../services/money";
import { createOrder, orderError } from "../services/orderService";
import { checkoutValidation, clearCheckout, newRequestId, readCheckout, saveCheckout } from "../services/checkoutStorage";
import usePendingCheckout from "../hooks/usePendingCheckout";
import useCheckoutAddress from "../hooks/useCheckoutAddress";
import CheckoutAddress from "../components/CheckoutAddress";

export default function Checkout() {
  const { sessionKey } = useAuth();
  return <CheckoutContent key={sessionKey} />;
}

function CheckoutContent() {
  const { cartItems, updateQuantity, removeFromCart, totals, refreshCart, refreshing,
    cartError, cartInstance, cartRevision, completeCheckout, locked } = useCart();
  const { user, isAuthenticated, sessionKey } = useAuth();
  const addressState = useCheckoutAddress(isAuthenticated ? user?.id : null);
  const { pending, error: storageError } = usePendingCheckout(user?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const submitting = useRef(false);
  const navigate = useNavigate();
  const validation = checkoutValidation(cartItems);
  const pendingId = pending?.requestId;

  useEffect(() => {
    if (pendingId || storageError) return;
    refreshCart();
    window.addEventListener(PRODUCT_CHANGED_EVENT, refreshCart);
    return () => window.removeEventListener(PRODUCT_CHANGED_EVENT, refreshCart);
  }, [refreshCart, pendingId, storageError]);

  async function submit() {
    if (submitting.current || !user?.id) return;
    submitting.current = true; setBusy(true); setError(""); setRejected(false);
    let attempt;
    let sent = false;
    try {
      attempt = readCheckout(user.id);
      if (!attempt) {
        if (validation || refreshing || cartError) throw new Error(validation || cartError || "Please wait for the cart to refresh.");
        // When the API supports addresses, capture addressState.selectedId here
        // in the new attempt so recovery retries keep the original selection.
        attempt = { requestId: newRequestId(), cartInstance, cartRevision,
          items: cartItems.map(item => ({ productId: item.id, quantity: item.quantity })),
        };
        saveCheckout(user.id, attempt);
      }
      sent = true;
      const order = await createOrder(attempt);
      if (getSession()?.token !== sessionKey) return;
      clearCheckout(user.id);
      completeCheckout(attempt);
      navigate(`/orders/${order.id}`, { replace: true, state: { orderConfirmed: true } });
    } catch (failure) {
      if (getSession()?.token !== sessionKey) return;
      setRejected(failure.status === 400);
      setError(failure.status === 409
        ? "This checkout ID is associated with different items. Review My orders before resolving the saved checkout."
        : failure.status == null && sent
          ? "The order result could not be confirmed. Retry this checkout to recover it safely."
          : orderError(failure));
    } finally {
      submitting.current = false;
      if (getSession()?.token === sessionKey) setBusy(false);
    }
  }

  function editRejectedCheckout() {
    try { clearCheckout(user.id); setRejected(false); setReviewed(false); setError(""); }
    catch { setError("Unable to update checkout recovery storage."); }
  }

  return <main className="page"><div className="container">
    <h1 className="page-title">Checkout</h1>
    <p className="muted">Review your items before placing an order. Final prices are calculated when your order is placed.</p>
    {(error || storageError) && <p className="error-message" role="alert">{error || storageError}</p>}
    {pending && <section className="panel" aria-label="Pending checkout">
      <h2>Finish your pending checkout</h2>
      <p>This attempt contains {pending.items.reduce((sum, item) => sum + item.quantity, 0)} items. Retry to confirm its result before editing your cart.</p>
      <ul>{pending.items.map(item => <li key={item.productId}>Product #{item.productId} · Quantity {item.quantity}</li>)}</ul>
      <div className="toolbar">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Confirming order…" : "Retry checkout"}</button>
        {rejected && <button className="btn btn-secondary" disabled={busy} onClick={editRejectedCheckout}>Edit rejected checkout</button>}
        <Link to="/orders">My orders</Link>
      </div>
      {!rejected && !busy && <details className="checkout-recovery-options"><summary>Start a different checkout</summary>
        <p>The pending attempt may already have created an order. Check My orders first. Starting again can create an additional order.</p>
        <label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I have reviewed My orders and want to start a new checkout.</label>
        <button className="btn btn-secondary" disabled={!reviewed} onClick={editRejectedCheckout}>Start new checkout</button>
      </details>}
    </section>}
    {refreshing && <p role="status">Checking current prices and availability…</p>}
    {cartError && <div className="error-message" role="alert">{cartError} <button className="btn btn-secondary" disabled={busy || locked} onClick={refreshCart}>Retry</button></div>}
    {!cartItems.length ? <p className="empty-state">Your cart is empty. <Link to="/">Browse products</Link></p> :
      <div className="checkout-container"><div className="checkout-main">
      <CheckoutAddress isAuthenticated={isAuthenticated} userId={user?.id} addressState={addressState} disabled={busy || locked} />
      <section className="checkout-items"><h2>Order summary</h2>
        {cartItems.map(item => <div className="checkout-item" key={item.id}>
          <ProductImage image={item.available ? item.product.images[0] : null} title={item.product.title} className="checkout-item-image" />
          <div className="checkout-item-details"><h3>{item.product.title}</h3><p>{formatPrice(item.product.price, item.product.currency)} each</p>
            {!item.available && <p className="form-error">This product is no longer available. Remove it to continue.</p>}
          </div>
          <div className="checkout-item-controls"><div className="quantity-controls">
            <button className="quantity-btn" disabled={locked || busy} aria-label={`Decrease ${item.product.title} quantity`} onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button><span>{item.quantity}</span>
            <button className="quantity-btn" aria-label={`Increase ${item.product.title} quantity`} disabled={locked || busy || !item.available || item.quantity >= 1000} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
          </div><p>{formatPrice(multiplyMoney(item.product.price, item.quantity), item.product.currency)}</p>
            <button className="btn btn-secondary btn-small" disabled={locked || busy} onClick={() => removeFromCart(item.id)}>Remove</button>
          </div>
        </div>)}
      </section></div><section className="checkout-summary"><h2>Estimated total</h2>
        {Object.entries(totals).map(([currency, total]) => <div className="checkout-total" key={currency}><span>{currency}</span><strong>{formatPrice(total, currency)}</strong></div>)}
        {validation && <p className="form-error">{validation}</p>}
        {!isAuthenticated ? <Link className="btn btn-primary btn-block" to="/login" state={{ from: "/checkout" }}>Log in to place order</Link> :
          <button className="btn btn-primary btn-block" disabled={busy || locked || refreshing || !!cartError || !!validation || !user?.id} onClick={submit}>{busy ? "Placing order…" : "Place order"}</button>}
        {isAuthenticated && !user?.id && <p role="alert">Please log out and log in again to place an order.</p>}
      </section></div>}
  </div></main>;
}
