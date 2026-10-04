import { readJwt } from "./jwt";

const SESSION_KEY = "shopHub.auth";
export const AUTH_CHANGED_EVENT = "shopHub:auth-changed";

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    const claims = readJwt(session?.token);
    return claims && typeof session?.user?.email === "string"
      ? { token: session.token, expiresAt: claims.expiresAt,
        user: { id: claims.userId, email: session.user.email,
          firstName: typeof session.user.firstName === "string" && session.user.firstName.trim()
            ? session.user.firstName.trim() : claims.firstName, roles: claims.roles } } : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
