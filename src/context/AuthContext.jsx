import { createContext, useState, useContext, useEffect } from "react";
import * as authService from "../services/authService";
import {
  AUTH_CHANGED_EVENT, getSession, saveSession, clearSession,
} from "../services/authStorage";

const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user ?? null);

  useEffect(() => {
    const syncSession = () => setUser(getSession()?.user ?? null);
    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  async function authenticate(action, credentials) {
    try {
      const { token, user } = await action(credentials);
      saveSession(token, user);
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  const login = (credentials) => authenticate(authService.login, credentials);
  const signUp = (registration) => authenticate(authService.signUp, registration);

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ signUp, user, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

// Keep the existing hook import path used by the application.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
