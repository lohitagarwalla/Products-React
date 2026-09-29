const SESSION_KEY = "shopHub.auth";
export const AUTH_CHANGED_EVENT = "shopHub:auth-changed";

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return typeof session?.token === "string" && session.token.trim()
      && typeof session?.user?.email === "string" ? session : null;
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
