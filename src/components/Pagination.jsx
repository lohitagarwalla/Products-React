export default function Pagination({ page, pageSize, totalCount, onPage }) {
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return <nav className="toolbar pagination" aria-label="Product pages">
    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span>{totalCount} products · Page {page} of {pages}</span>
    <button className="btn btn-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
  </nav>;
}
