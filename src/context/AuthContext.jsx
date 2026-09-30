import { createContext, useState, useContext, useEffect } from "react";
import * as authService from "../services/authService";
import {
  AUTH_CHANGED_EVENT, getSession, saveSession, clearSession,
} from "../services/authStorage";

const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession());

  useEffect(() => {
    const syncSession = () => setSession(getSession());
    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      if (!getSession()) clearSession();
      else setSession(getSession());
    }, Math.min(Math.max(session.expiresAt - Date.now(), 0), 2147483647));
    return () => window.clearTimeout(timer);
  }, [session]);

  async function authenticate(action, credentials) {
    try {
      const { token, user } = await action(credentials);
      saveSession(token, user);
      setSession(getSession());
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  const login = (credentials) => authenticate(authService.login, credentials);
  const signUp = (registration) => authenticate(authService.signUp, registration);

  function logout() {
    clearSession();
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ signUp, user: session?.user ?? null, logout, login,
      roles: session?.user.roles ?? [], isAdmin: session?.user.roles.includes("Admin") ?? false,
      isAuthenticated: !!session, sessionKey: session?.token ?? "" }}>
      {children}
    </AuthContext.Provider>
  );
}

// Keep the existing hook import path used by the application.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
