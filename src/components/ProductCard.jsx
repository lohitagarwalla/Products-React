import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import ProductImage from "./ProductImage";
import { formatPrice } from "../services/productService";

export default function ProductCard({ product }) {
  const { addToCart, cartItems, locked } = useCart();
  const quantity = cartItems.find(item => item.id === product.id)?.quantity;
  return <article className="product-card">
    <ProductImage image={product.images[0]} title={product.title} className="product-card-image" />
    <div className="product-card-content">
      <p className="muted">{product.brand}</p>
      <h3 className="product-card-name">{product.title}</h3>
      <p className="product-card-price">{formatPrice(product.price, product.currency)}</p>
      <div className="product-card-actions">
        <Link className="btn btn-secondary" to={`/products/${product.id}`}>View Details</Link>
        <button className="btn btn-primary" disabled={locked || quantity >= 1000 || (!quantity && cartItems.length >= 100)} onClick={() => addToCart(product)}>Add to Cart {quantity ? `(${quantity})` : ""}</button>
      </div>
    </div>
  </article>;
}
