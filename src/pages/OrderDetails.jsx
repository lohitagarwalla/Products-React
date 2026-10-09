import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOrder } from "../hooks/useOrders";
import { getSession } from "../services/authStorage";
import { allowedOrderActions, changeOrderStatus, orderError } from "../services/orderService";
import { formatMoney } from "../services/money";
import { formatOrderDate } from "../services/orderFilters";
import ProductImage from "../components/ProductImage";
import OrderStatus from "../components/OrderStatus";
import OrderActionDialog from "../components/OrderActionDialog";

export default function OrderDetails({ manage = false }) {
  const { id } = useParams();
  return <Details key={id} id={id} manage={manage} />;
}

function Details({ id, manage }) {
  const { order, error, loading, reload, replaceOrder } = useOrder(id);
  const { isAdmin, sessionKey } = useAuth();
  const location = useLocation();
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const inFlight = useRef(false);
  const root = manage ? "/admin/orders" : "/orders";
  const from = location.state?.from;
  const back = typeof from === "string" && (from === root || from.startsWith(`${root}?`)) ? from : root;

  async function confirm(reason) {
    if (inFlight.current || !order) return;
    inFlight.current = true; setBusy(true); setNotice(null);
    try {
      const updated = await changeOrderStatus(order.id, action, order.rowVersion, reason);
      if (getSession()?.sessionKey !== sessionKey) return;
      replaceOrder(updated);
      setNotice({ text: `Order updated: ${updated.status}.`, success: true });
    } catch (failure) {
      if (getSession()?.sessionKey !== sessionKey) return;
      setNotice({
        text: failure.status === 409
          ? "This order changed or the action is no longer allowed. Review the refreshed order before choosing another action."
          : failure.status == null || failure.status >= 500
            ? "The update result could not be confirmed. Review the refreshed order before trying again."
            : orderError(failure)
      });
      reload();
    } finally {
      inFlight.current = false;
      if (getSession()?.sessionKey === sessionKey) { setBusy(false); setAction(null); }
    }
  }

  return <main className="page"><div className="container">
    <div className="page-heading"><h1>Order details</h1><button className="btn btn-secondary" disabled={loading || busy} onClick={() => { setAction(null); reload(); }}>Refresh</button></div>
    {location.state?.orderConfirmed && <p className="success-message" role="status">Your order is confirmed. The saved details and final total are shown below.</p>}
    {notice && <p className={notice.success ? "success-message" : "error-message"} role={notice.success ? "status" : "alert"}>{notice.text}</p>}
    {loading && <p role="status">Loading order…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {order && <>
      <section className="panel">
        <div className="page-heading"><h2 className="order-identifier">{order.orderNumber}</h2><OrderStatus status={order.status} /></div>
        <dl className="order-facts">
          {manage && <><dt>Customer</dt><dd>{order.userFirstName || "Name unavailable"}</dd></>}
          <dt>Placed</dt><dd>{formatOrderDate(order.createdAt)}</dd>
          {order.shippedAt && <><dt>Shipped</dt><dd>{formatOrderDate(order.shippedAt)}</dd></>}
          {order.deliveredAt && <><dt>Delivered</dt><dd>{formatOrderDate(order.deliveredAt)}</dd></>}
          {order.cancelledAt && <><dt>Cancelled</dt><dd>{formatOrderDate(order.cancelledAt)}</dd><dt>Cancelled by</dt><dd>{order.cancelledByFirstName || "Name unavailable"}</dd></>}
          {order.cancellationReason && <><dt>Reason</dt><dd className="order-reason">{order.cancellationReason}</dd></>}
        </dl>
        <div className="toolbar order-actions">{allowedOrderActions(order.status, isAdmin && manage).map(value => <button key={value} disabled={busy}
          className={`btn ${value === "cancel" ? "btn-danger" : "btn-primary"}`} onClick={() => setAction(value)}>
          {{ ship: "Ship order", deliver: "Mark delivered", cancel: "Cancel order" }[value]}
        </button>)}</div>
      </section>
      {order.deliveryAddress && <section className="panel"><h2>Delivery address</h2>
        <p><strong>{order.deliveryAddress.recipientName}</strong>{", "}{[order.deliveryAddress.addressLine1, order.deliveryAddress.addressLine2, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.postalCode, order.deliveryAddress.countryCode].filter(Boolean).join(", ")}</p>
      </section>}
      <section className="panel"><h2>Items</h2>
        {order.items.map(item => <article className="order-item" key={item.id}>
          <ProductImage image={item.imageUrl ? { url: item.imageUrl } : null} title={item.productTitle} className="list-image" />
          <div><h3>{item.productTitle}</h3><p>{formatMoney(item.unitPrice, order.currency)} × {item.quantity}</p></div>
          <strong className="money">{formatMoney(item.lineTotal, order.currency)}</strong>
        </article>)}
        <div className="order-total"><span>Total ({order.currency})</span><strong>{formatMoney(order.totalAmount, order.currency)}</strong></div>
      </section>
      <section className="panel"><h2>Status history</h2><ol className="order-history">
        {order.statusHistory.map(entry => <li key={entry.id}>
          <p><strong>{entry.previousStatus ? `${entry.previousStatus} → ` : ""}{entry.newStatus}</strong> · <time dateTime={entry.changedAtUtc}>{formatOrderDate(entry.changedAtUtc)}</time></p>
          <p className="muted">Changed by {entry.changedByFirstName || "Name unavailable"}</p>
          {entry.reason && <p className="order-reason">{entry.reason}</p>}
        </li>)}
      </ol></section>
      {action && <OrderActionDialog key={action} action={action} status={order.status} busy={busy} onClose={() => setAction(null)} onConfirm={confirm} />}
    </>}
  </div></main>;
}
