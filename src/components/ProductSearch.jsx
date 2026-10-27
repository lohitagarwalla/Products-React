import { useId } from "react";

export default function ProductSearch({ search, onSearch }) {
  const inputId = useId();
  return <form className="product-search" onSubmit={event => {
    event.preventDefault();
    onSearch(new FormData(event.currentTarget).get("search").trim());
  }}>
    <label className="sr-only" htmlFor={inputId}>Search title or brand</label>
    <input key={search} id={inputId} className="form-input" name="search" defaultValue={search} maxLength={200} placeholder="Search by title or brand" type="search" />
    <button className="btn btn-primary" aria-label="Search">
      <svg className="product-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>
      <span className="product-search-button-text">Search</span>
    </button>
    {search && <button className="btn btn-secondary" type="button" aria-label="Clear search" onClick={() => onSearch("")}>
      <svg className="product-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      <span className="product-search-button-text">Clear</span>
    </button>}
  </form>;
}
