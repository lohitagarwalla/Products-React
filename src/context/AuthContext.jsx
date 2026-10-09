import { createContext, useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import * as authService from "../services/authService";
import { AUTH_CHANGED_EVENT, getSession, authMetadata } from "../services/authStorage";

const AuthContext = createContext(null);
export default function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession());
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    const syncSession = () => {
      setSession(getSession());
      setAuthError(authMetadata().message || "");
    };
    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);
    authService.restoreSession().catch(error => {
      if (active) setAuthError(error.message);
    }).finally(() => {
      if (active) {
        setSession(getSession());
        setAuthError(previous => authMetadata().message || previous);
        setInitializing(false);
      }
    });
    return () => { active = false; window.removeEventListener(AUTH_CHANGED_EVENT, syncSession); };
  }, []);
  async function authenticate(action, credentials) {
    try {
      await action(credentials);
      setAuthError("");
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  }
  async function logout() {
    try { await authService.logout(); }
    catch { setAuthError("You are signed out here, but server logout could not be confirmed. Please log in again before continuing."); }
  }
  return (
    <AuthContext.Provider value={{ signUp: credentials => authenticate(authService.signUp, credentials),
      login: credentials => authenticate(authService.login, credentials), logout,
      user: session?.user ?? null, roles: session?.user.roles ?? [],
      isAdmin: session?.user.roles.includes("Admin") ?? false,
      isAuthenticated: !!session, initializing, sessionKey: session?.sessionKey ?? "" }}>
      {authError && <p role="alert" className="error-message">{authError} <Link to="/login">Log in</Link></p>}
      {initializing ? <p role="status">Restoring your session…</p> : children}
    </AuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
