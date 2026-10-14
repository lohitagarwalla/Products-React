import { useState } from "react";
import { Link } from "react-router-dom";
import useProducts from "../../hooks/useProducts";
import useProductQuery from "../../hooks/useProductQuery";
import ProductSearch from "../../components/ProductSearch";
import Pagination from "../../components/Pagination";
import ProductImage from "../../components/ProductImage";
import { deleteProduct, setPublished, productError, formatPrice } from "../../services/productService";

export default function ProductList() {
  const query = useProductQuery();
  const { data, loading, error, reload } = useProducts({ ...query, manage: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  async function act(product, remove = false) {
    if (busy) return;
    if (remove && !window.confirm(`Delete "${product.title}"? It will be removed from the shop and management list.`)) return;
    setBusy(true); setActionError(""); setMessage("");
    try {
      if (remove) await deleteProduct(product.id);
      else await setPublished(product.id, !product.isPublished);
      setMessage(remove ? "Product deleted." : product.isPublished ? "Product unpublished." : "Product published.");
      if (remove && data.items.length === 1 && query.page > 1) query.onPage(query.page - 1);
    } catch (error) { setActionError(productError(error)); }
    finally { setBusy(false); }
  }
  return <main className="page"><div className="container">
    <div className="page-heading"><div><h1>Manage products</h1></div><Link className="btn btn-primary" to="/admin/products/new">Add product</Link></div>
    <ProductSearch {...query} />
    {message && <p className="success-message" role="status">{message}</p>}
    {(error || actionError) && <div className="error-message" role="alert">{error || actionError} <button className="btn btn-secondary" onClick={reload} disabled={busy}>Reload list</button></div>}
    {loading && <p role="status">Loading products…</p>}
    {data && <>
      {!data.items.length && <p className="empty-state">No products found.</p>}
      <div className="table-scroll"><table className="product-table"><thead><tr><th>Product</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {data.items.map(product => <tr key={product.id}>
          <td><div className="product-cell"><ProductImage image={product.images[0]} title={product.title} privateImage={!product.isPublished} className="list-image" /><div><Link to={`/products/${product.id}`}>{product.title}</Link><p className="muted">#{product.id} · {product.brand}</p></div></div></td>
          <td>{formatPrice(product.price, product.currency)}</td><td><span className={`badge ${product.isPublished ? "published" : ""}`}>{product.isPublished ? "Published" : "Draft"}</span></td>
          <td><div className="toolbar"><Link className="btn btn-secondary btn-small" to={`/admin/products/${product.id}/edit`}>Edit</Link><button disabled={busy} className="btn btn-secondary btn-small" onClick={() => act(product)}>{product.isPublished ? "Unpublish" : "Publish"}</button><button disabled={busy} className="btn btn-danger btn-small" onClick={() => act(product, true)}>Delete</button></div></td>
        </tr>)}
      </tbody></table></div>
      <Pagination {...data} onPage={query.onPage} />
    </>}
  </div></main>;
}
