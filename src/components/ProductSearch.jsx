export default function ProductSearch({ search, onSearch }) {
  return <form className="product-search" onSubmit={event => {
    event.preventDefault();
    onSearch(new FormData(event.currentTarget).get("search").trim());
  }}>
    <label className="sr-only" htmlFor="product-search">Search title or brand</label>
    <input key={search} id="product-search" className="form-input" name="search" defaultValue={search} maxLength={200} placeholder="Search by title or brand" type="search" />
    <button className="btn btn-primary">Search</button>
    {search && <button className="btn btn-secondary" type="button" onClick={() => onSearch("")}>Clear</button>}
  </form>;
}
