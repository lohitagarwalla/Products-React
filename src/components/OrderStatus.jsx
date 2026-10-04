export default function OrderStatus({ status }) {
  return <span className={`badge order-status-${status.toLowerCase()}`}>{status}</span>;
}
