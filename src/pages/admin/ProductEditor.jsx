import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useProduct from "../../hooks/useProduct";
import ProductForm from "../../components/ProductForm";
import ProductImageManager from "../../components/ProductImageManager";
import { createProduct, updateProduct, deleteProduct, setPublished, productError } from "../../services/productService";

export default function ProductEditor() {
  const { id } = useParams();
  return id ? <ExistingProduct key={id} id={id} /> : <Editor key="new" />;
}

function ExistingProduct({ id }) {
  const { product, loading, error, reload, key } = useProduct(id);
  if (product) return <Editor key={key} initialProduct={product} reload={reload} />;
  return <main className="page"><div className="container"><Link to="/admin/products">Back to products</Link>
    {loading && <p role="status">Loading product…</p>}
    {error && <div className="error-message" role="alert">{error} <button className="btn btn-secondary" onClick={reload}>Retry</button></div>}
  </div></main>;
}

function Editor({ initialProduct, reload }) {
  const [product, setProduct] = useState(initialProduct);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const actionInFlight = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const warn = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  async function runAction(action, successMessage = "") {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await action();
      setMessage(successMessage);
      return result;
    } catch (error) { setError(productError(error)); }
    finally { actionInFlight.current = false; setBusy(false); }
  }

  async function save(values) {
    return runAction(async () => {
      const saved = product
        ? await updateProduct(product.id, { ...values, isPublished: product.isPublished })
        : await createProduct({ ...values, isPublished: false });
      setDirty(false);
      if (!product) navigate(`/admin/products/${saved.id}/edit`, { replace: true });
      else setProduct(saved);
      return saved;
    }, "Product details saved.");
  }

  async function remove() {
    if (!window.confirm(`Delete "${product.title}"? It will be removed from the shop and management list.`)) return;
    await runAction(async () => { await deleteProduct(product.id); navigate("/admin/products", { replace: true }); });
  }

  return <main className="page"><div className="container editor-container">
    <Link to="/admin/products">Back to products</Link>
    <div className="page-heading"><h1>{product ? "Edit product" : "Add product"}</h1>{product && <span className={`badge ${product.isPublished ? "published" : ""}`}>{product.isPublished ? "Published" : "Draft"}</span>}</div>
    {error && <div className="error-message" role="alert">{error}</div>}
    {message && <p className="success-message" role="status">{message}</p>}
    <section className="panel"><h2>Product details</h2>
      {!product && <p className="muted">Create a draft first, then upload images and publish it.</p>}
      <ProductForm product={product} onSave={save} busy={busy} onDirtyChange={setDirty} />
    </section>
    {product && <>
      <ProductImageManager product={product} setProduct={setProduct} busy={busy} runAction={runAction} />
      <section className="panel"><h2>Publication</h2><p className="muted">Published products are visible to everyone. Drafts are visible only to Admins. Save product details before publishing.</p>
        <div className="toolbar">
          <button className="btn btn-primary" disabled={busy || dirty} onClick={() => runAction(async () => {
            const saved = await setPublished(product.id, !product.isPublished); setProduct(saved);
          }, product.isPublished ? "Product unpublished." : "Product published.")}>{product.isPublished ? "Unpublish" : "Publish"}</button>
          <Link className="btn btn-secondary" to={`/products/${product.id}`}>View product</Link>
          <button className="btn btn-secondary" disabled={busy} onClick={() => { if (window.confirm("Reload saved product? Unsaved details and queued uploads will be discarded.")) reload(); }}>Reload saved product</button>
          <button className="btn btn-danger" disabled={busy} onClick={remove}>Delete product</button>
        </div>
      </section>
    </>}
  </div></main>;
}
