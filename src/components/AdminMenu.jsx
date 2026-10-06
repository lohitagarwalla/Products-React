import { Link } from "react-router-dom";
import NavDropdown from "./NavDropdown";

export default function AdminMenu() {
  return (
    <NavDropdown label="Manage">
      {close => <>
        <Link to="/admin/products" onClick={close}>Manage products</Link>
        <Link to="/admin/orders" onClick={close}>Manage orders</Link>
      </>}
    </NavDropdown>
  );
}
