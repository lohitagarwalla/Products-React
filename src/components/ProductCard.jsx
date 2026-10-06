import { Link } from "react-router-dom";
import CartAction from "./CartAction";
import ProductImage from "./ProductImage";
import { formatPrice } from "../services/productService";

export default function ProductCard({ product }) {
  return <article className="product-card">
    <ProductImage image={product.images[0]} title={product.title} className="product-card-image" />
    <div className="product-card-content">
      <p className="muted">{product.brand}</p>
      <h3 className="product-card-name">{product.title}</h3>
      <p className="product-card-price">{formatPrice(product.price, product.currency)}</p>
      <div className="product-card-actions">
        <Link className="btn btn-secondary" to={`/products/${product.id}`}>View Details</Link>
        <CartAction product={product} />
      </div>
    </div>
  </article>;
}
