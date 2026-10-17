import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthNotice() {
  const { error } = useAuth();
  return error ? <p role="alert" className="error-message">{error.message} <Link to="/login">Log in</Link></p> : null;
}
