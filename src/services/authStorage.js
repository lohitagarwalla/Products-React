import { readJwt } from "./jwt";

export const AUTH_CHANGED_EVENT = "shopHub:auth-changed";
export const AUTH_META_KEY = "shopHub.auth-state";
let session = null;
let channel;
let initialized = false;

export function authMetadata() {
  return JSON.parse(localStorage.getItem(AUTH_META_KEY)) || { id: null, blocked: false };
}
export function setAuthMetadata(value) {
  // Persist coordination metadata only, never access or refresh tokens.
  localStorage.setItem(AUTH_META_KEY, JSON.stringify(value));
}
function changed() { window.dispatchEvent(new Event(AUTH_CHANGED_EVENT)); }

export function initializeAuthStorage() {
  if (initialized) return;
  localStorage.removeItem("shopHub.auth");
  if (window.BroadcastChannel) {
    channel = new window.BroadcastChannel("shopHub.auth");
    channel.onmessage = ({ data }) => {
      if (data?.type === "request") {
        const current = getSession();
        if (current && readJwt(current.token)) channel.postMessage({ type: "session", session: current });
      } else if (data?.type === "session") {
        const incoming = data.session;
        const meta = authMetadata();
        if (!meta.blocked && !meta.pending && incoming?.sessionKey === meta.id && readJwt(incoming.token)
          && incoming.revision === meta.revision && (!session || incoming.revision >= session.revision)) {
          session = incoming;
          changed();
        }
      } else if (data?.type === "changed") { getSession(); changed(); }
    };
  }
  window.addEventListener("storage", event => {
    if (event.key === AUTH_META_KEY) { getSession(); changed(); }
  });
  initialized = true;
}
export async function requestPeerSession() {
  initializeAuthStorage();
  if (!channel) return;
  channel.postMessage({ type: "request" });
  // A suspended peer is harmless: refresh remains serialized by Web Locks.
  await new Promise(resolve => setTimeout(resolve, 100));
}
export function getSession() {
  if (session && authMetadata().id !== session.sessionKey) session = null;
  // Expiry is handled by the coordinator without losing session identity.
  return session;
}
export function saveSession(token, user, details = {}) {
  initializeAuthStorage();
  const claims = readJwt(token);
  if (!claims) { session = null; changed(); return null; }
  const sessionKey = details.sessionKey || crypto.randomUUID();
  const accessExpiry = Date.parse(details.accessTokenExpiresAt);
  session = {
    token, sessionKey, revision: (authMetadata().revision ?? 0) + 1,
    expiresAt: Number.isFinite(accessExpiry) ? Math.min(accessExpiry, claims.expiresAt) : claims.expiresAt,
    refreshTokenExpiresAt: details.refreshTokenExpiresAt ?? null,
    user: { id: claims.userId, email: user.email, firstName: user.firstName?.trim() || claims.firstName,
      lastName: typeof user.lastName === "string" ? user.lastName.trim() : "",
      phoneNumber: typeof user.phoneNumber === "string" ? user.phoneNumber.trim() : "", roles: claims.roles },
  };
  setAuthMetadata({ id: sessionKey, revision: session.revision, blocked: false });
  channel?.postMessage({ type: "session", session });
  changed();
  return session;
}
export function clearSession(message = "") {
  initializeAuthStorage();
  session = null;
  setAuthMetadata({ id: crypto.randomUUID(), blocked: true, message });
  channel?.postMessage({ type: "changed" });
  changed();
}
export function blockRefresh(message) {
  setAuthMetadata({ ...authMetadata(), blocked: true, pending: false, message });
  channel?.postMessage({ type: "changed" });
  changed();
}
