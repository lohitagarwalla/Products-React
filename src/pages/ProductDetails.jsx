import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import CartAction from "../components/CartAction";
import { useAuth } from "../context/AuthContext";
import useProduct from "../hooks/useProduct";
import ProductImage from "../components/ProductImage";
import { formatPrice } from "../services/productService";

export default function ProductDetails() {
  const { id } = useParams();
  const { product, error, loading, reload, key } = useProduct(id);
  return <main className="page"><div className="container">
    {loading && <p role="status">Loading product…</p>}
    {error && <div role="alert" className="error-message">{error} <button className="btn btn-secondary" onClick={reload}>Retry</button></div>}
    {product && <Details key={key} product={product} />}
  </div></main>;
}

function Details({ product }) {
  const [selected, setSelected] = useState(product.images[0]?.id);
  const { isAdmin } = useAuth();
  const image = product.images.find(item => item.id === selected) || product.images[0];
  return <div className="product-detail">
    <div className="product-detail-image">
      <ProductImage image={image} title={product.title} privateImage={!product.isPublished} className="gallery-main" />
      <div className="gallery-thumbnails">{product.images.map(item => <button key={item.id} className="thumbnail-button" aria-label={`View image ${item.sortOrder + 1}`} aria-pressed={item.id === image?.id} onClick={() => setSelected(item.id)}>
        <ProductImage image={item} title={product.title} privateImage={!product.isPublished} />
      </button>)}</div>
    </div>
    <div className="product-detail-content">
      {!product.isPublished && <span className="badge">Draft · Admin preview</span>}
      <p>{product.brand}</p><h1 className="product-detail-name">{product.title}</h1>
      <p className="product-detail-price">{formatPrice(product.price, product.currency)}</p>
      <p className="product-detail-description">{product.description}</p>
      <div className="toolbar">
        {product.isPublished && <CartAction product={product} />}
        {isAdmin && <Link className="btn btn-secondary" to={`/admin/products/${product.id}/edit`}>Edit product</Link>}
      </div>
    </div>
  </div>;
}
