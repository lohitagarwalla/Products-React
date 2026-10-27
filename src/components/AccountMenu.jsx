import { Link } from "react-router-dom";
import NavDropdown from "./NavDropdown";

export default function AccountMenu({ user, logout, initializing }) {
  return (
    <NavDropdown icon label={<>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </svg>
      <span>Profile</span>
    </>}>
      {close => <>
        {initializing ? <p className="navbar-profile-greeting" role="status">Restoring your session…</p> : user ? <>
        <p className="navbar-profile-greeting">{user.firstName ? `Hello, ${user.firstName}` : "Hello"}</p>
        <Link to="/profile" onClick={close}>Profile</Link>
        <Link to="/orders" onClick={close}>Orders</Link>
        <button type="button" onClick={() => { close(); logout(); }}>Logout</button>
        </> : <>
          <Link to="/login" onClick={close}>Login</Link>
          <Link to="/signup" onClick={close}>Signup</Link>
        </>}
      </>}
    </NavDropdown>
  );
}
