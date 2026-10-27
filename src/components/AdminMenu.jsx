import { Link } from "react-router-dom";
import NavDropdown from "./NavDropdown";

export default function AdminMenu() {
  return (
    <NavDropdown icon label={<>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </svg>
      <span>Admin</span>
    </>}>
      {close => <>
        <Link to="/admin/products" onClick={close}>Manage products</Link>
        <Link to="/admin/orders" onClick={close}>Manage orders</Link>
      </>}
    </NavDropdown>
  );
}
