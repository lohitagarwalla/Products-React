import { createContext, useState, useContext, useEffect } from "react";
import * as authService from "../services/authService";
import { getAuthState, subscribeAuth } from "../services/authStore";

const AuthContext = createContext(null);
export default function AuthProvider({ children }) {
  const [state, setState] = useState(getAuthState);
  useEffect(() => {
    const sync = () => setState(getAuthState());
    const unsubscribe = subscribeAuth(sync);
    sync();
    // Restoration failures are recorded in the shared state.
    authService.restoreSession().catch(() => {});
    return unsubscribe;
  }, []);
  async function authenticate(action, credentials) {
    try {
      await action(credentials);
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  }
  const isAuthenticated = state.status === "authenticated";
  const session = isAuthenticated ? state.session : null;
  return (
    <AuthContext.Provider value={{
      signUp: credentials => authenticate(authService.signUp, credentials),
      login: credentials => authenticate(authService.login, credentials),
      logout: () => authService.logout().catch(() => {}),
      retrySession: () => authenticate(authService.retrySession),
      canRetry: state.canRetry, retrying: state.retrying,
      status: state.status, error: state.error,
      user: session?.user ?? null, roles: session?.user.roles ?? [],
      isAdmin: session?.user.roles.includes("Admin") ?? false,
      isAuthenticated, initializing: state.status === "initializing",
      sessionKey: session?.sessionKey ?? "",
    }}>{children}</AuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
