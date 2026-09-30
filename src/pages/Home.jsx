import ProductCard from "../components/ProductCard";
import ProductSearch from "../components/ProductSearch";
import Pagination from "../components/Pagination";
import useProducts from "../hooks/useProducts";
import useProductQuery from "../hooks/useProductQuery";

export default function Home() {
  const query = useProductQuery();
  const { data, loading, error, reload } = useProducts(query);
  return <main className="page"><div className="home-hero">
    <h1 className="home-title">Welcome to ShopHub</h1>
    <p className="home-subtitle">Discover amazing products at great prices</p>
  </div><div className="container">
    <h2 className="page-title">Our Products</h2>
    <ProductSearch {...query} />
    {loading && <p role="status">Loading products…</p>}
    {error && <div className="error-message" role="alert">{error} <button className="btn btn-secondary" onClick={reload}>Retry</button></div>}
    {data && <>
      {!data.items.length && <p className="empty-state">No products found.</p>}
      <div className="product-grid">{data.items.map(product => <ProductCard key={product.id} product={product} />)}</div>
      <Pagination {...data} onPage={query.onPage} />
    </>}
  </div></main>;
}
