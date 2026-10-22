import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthNotice() {
  const { error, canRetry, retrying, retrySession } = useAuth();
  return error ? <div role="alert" className="error-message">
    {error.message}{" "}
    {(canRetry || retrying) && <button type="button" className="btn btn-secondary btn-small"
      disabled={retrying} onClick={retrySession}>{retrying ? "Retrying…" : "Retry session"}</button>}{" "}
    <Link to="/login">Log in</Link>
  </div> : null;
}
