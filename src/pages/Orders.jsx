import { Link, useSearchParams } from "react-router-dom";
import useOrders from "../hooks/useOrders";
import { ORDER_STATUSES } from "../services/orderService";
import { formatOrderDate, orderFilters } from "../services/orderFilters";
import { formatMoney } from "../services/money";
import Pagination from "../components/Pagination";
import OrderStatus from "../components/OrderStatus";

export default function Orders({ manage = false }) {
  const [params, setParams] = useSearchParams();
  let filters = {};
  let validationError = "";
  try { filters = orderFilters(params); } catch (error) { validationError = error.message; }
  const { data, error, loading, reload } = useOrders({ ...filters, manage }, validationError);
  const root = manage ? "/admin/orders" : "/orders";

  function applyFilters(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (String(value).trim()) query.set(key, String(value).trim());
    query.set("page", "1"); setParams(query);
  }
  function onPage(page) {
    const query = new URLSearchParams(params); query.set("page", page); setParams(query);
  }

  return <main className="page"><div className="container">
    <div className="page-heading"><h1>{manage ? "Manage orders" : "My orders"}</h1><button className="btn btn-secondary" disabled={loading} onClick={reload}>Refresh</button></div>
    <form key={params.toString()} className="panel order-filters" onSubmit={applyFilters}>
      <label>Search orders<input name="search" className="form-input" maxLength={200} placeholder="Order number or product title" defaultValue={params.get("search") || ""} /></label>
      <label>Status<select name="status" className="form-input" defaultValue={params.get("status") || ""}><option value="">All statuses</option>{ORDER_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
      <label>From date<input type="date" name="from" className="form-input" defaultValue={params.get("from") || ""} /></label>
      <label>Through date<input type="date" name="to" className="form-input" defaultValue={params.get("to") || ""} /></label>
      <label>Per page<select name="pageSize" className="form-input" defaultValue={params.get("pageSize") || "20"}>{[10, 20, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label>
      <div className="toolbar"><button className="btn btn-primary">Apply filters</button><button type="button" className="btn btn-secondary" onClick={() => setParams({})}>Clear</button></div>
      <p className="muted">Dates use your local time zone and filter when orders were placed.</p>
    </form>
    {loading && <p role="status">Loading orders…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {data && <>
      {!data.items.length ? <p className="empty-state">No orders found. {data.totalCount === 0 && !manage && <Link to="/">Browse products</Link>}</p> :
        <div className="table-scroll"><table className="product-table order-table"><thead><tr><th>Order</th><th>Placed</th>{manage && <th>Customer</th>}<th>Status</th><th>Quantity</th><th>Total</th></tr></thead><tbody>
          {data.items.map(order => <tr key={order.id}>
            <td><Link to={`${root}/${order.id}`} state={{ from: `${root}?${params}` }}>{order.orderNumber}</Link></td>
            <td>{formatOrderDate(order.createdAt)}</td>{manage && <td>{order.userFirstName || "Name unavailable"}</td>}
            <td><OrderStatus status={order.status} /></td><td>{order.totalQuantity}</td><td className="money">{formatMoney(order.totalAmount, order.currency)}</td>
          </tr>)}
        </tbody></table></div>}
      <Pagination {...data} onPage={onPage} noun="orders" />
    </>}
  </div></main>;
}
