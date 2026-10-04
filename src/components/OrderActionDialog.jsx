import { useEffect, useRef, useState } from "react";

const labels = { ship: "Ship order", deliver: "Mark delivered", cancel: "Cancel order" };

export default function OrderActionDialog({ action, status, busy, onConfirm, onClose }) {
  const dialog = useRef(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="order-dialog" aria-labelledby="order-action-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); onConfirm(reason); }}>
      <h2 id="order-action-title">{labels[action]}</h2>
      <p>{action === "cancel" ? "Confirm that you want to cancel this order." : action === "ship" ? "Confirm that this order has been shipped." : "Confirm that this order has been delivered."}</p>
      {action === "cancel" && status === "Shipped" && <p>Cancelling updates the order status. It does not recall the shipment or issue a refund.</p>}
      {action === "cancel" && <label className="form-label">Reason (optional)
        <textarea className="form-input" maxLength={1000} rows={4} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} />
        <span className="muted">{reason.length}/1000</span>
      </label>}
      <div className="toolbar">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Go back</button>
        <button className={`btn ${action === "cancel" ? "btn-danger" : "btn-primary"}`} disabled={busy}>{busy ? "Updating…" : labels[action]}</button>
      </div>
    </form>
  </dialog>;
}
