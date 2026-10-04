import { useEffect, useId, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getProductPriceHistory, productError } from "../services/productService";
import { fromMinor, toMinor } from "../services/money";
import Pagination from "./Pagination";

const entryLabels = { Created: "Created", PriceChanged: "Price changed", Baseline: "Baseline" };

export default function ProductPriceHistory({ productId, revision }) {
  const { sessionKey } = useAuth();
  // A new product or login must never inherit the previous history cache.
  return <History key={`${productId}:${sessionKey}`} productId={productId} revision={revision} />;
}

function History({ productId, revision }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState({ revision, page: 1, attempt: 0 });
  const [result, setResult] = useState(null);
  const panelId = useId();
  // A saved price change invalidates all pages, including while the panel is hidden.
  const page = query.revision === revision ? query.page : 1;
  const requestKey = `${revision}:${page}:${query.attempt}`;
  const current = result?.key === requestKey ? result : null;

  useEffect(() => {
    if (!open || result?.key === requestKey) return;
    const controller = new AbortController();
    getProductPriceHistory(productId, { page, signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key: requestKey, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestKey, error: productError(error) });
    });
    return () => controller.abort();
  }, [open, productId, page, requestKey, result]);

  function goToPage(nextPage) {
    setQuery(previous => ({ revision, page: nextPage, attempt: previous.attempt + 1 }));
  }

  return <section className="panel price-history-panel">
    <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}>{open ? "Hide price history" : "View price history"}</button>
    <div id={panelId} hidden={!open}>
      {open && <>
        <h2>Price history</h2>
        <p className="muted">Newest entries first. Times are shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
          {" "}Currency was not recorded, so amounts have no currency symbol. A baseline is the starting price when tracking began; earlier changes are unavailable.</p>
        {!current && <p role="status">Loading price history…</p>}
        {current?.error && <div className="error-message" role="alert">{current.error}{" "}
          <button type="button" className="btn btn-secondary" onClick={() => goToPage(page)}>Retry</button>
        </div>}
        {current?.data && <>
          {current.data.items.length === 0 ? <p className="empty-state">No price history entries on this page.</p> :
            <div className="table-scroll"><table className="product-table price-history-table">
              <caption className="sr-only">Product price history</caption>
              <thead><tr><th scope="col">Changed at</th><th scope="col">Entry type</th><th scope="col">New price</th><th scope="col">Changed by</th></tr></thead>
              <tbody>{current.data.items.map(entry => <tr key={entry.id}>
                <td><time dateTime={entry.changedAtUtc}>{new Date(entry.changedAtUtc).toLocaleString()}</time></td>
                <td>{entryLabels[entry.entryType] || entry.entryType}</td>
                <td>{fromMinor(toMinor(entry.newPrice))}</td>
                <td>{entry.changedByUserName?.trim() || "Not recorded"}</td>
              </tr>)}</tbody>
            </table></div>}
          <Pagination page={current.data.page} pageSize={current.data.pageSize} totalCount={current.data.totalCount}
            onPage={goToPage} noun="history entries" />
        </>}
      </>}
    </div>
  </section>;
}
