import { Link } from "react-router-dom";
import NavDropdown from "./NavDropdown";

export default function AccountMenu({ user, logout }) {
  return (
    <NavDropdown label={user.firstName ? `Hello, ${user.firstName}` : "Hello"}>
      {close => <>
        <Link to="/profile" onClick={close}>Profile</Link>
        <Link to="/orders" onClick={close}>Orders</Link>
        <button type="button" onClick={() => { close(); logout(); }}>Logout</button>
      </>}
    </NavDropdown>
  );
}
