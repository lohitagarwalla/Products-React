import { readJwt } from "./jwt";
import { authMetadata, setAuthMetadata, initializeCoordinator, broadcastSession, broadcastChange } from "./authCoordinator";

let session = null;
let initializing = true;
let startupError = null;
let retrying = false;
const listeners = new Set();
function changed() { for (const listener of listeners) listener(); }
export function subscribeAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getAuthState() {
  const current = getSession();
  const meta = authMetadata();
  const error = meta.message
    ? { code: meta.code || "reauthentication_required", message: String(meta.message) }
    : startupError;
  const status = initializing ? "initializing"
    : error ? "reauthenticationRequired" : current ? "authenticated" : "anonymous";
  return { status, session: current, error, retrying,
    canRetry: meta.blocked === true && meta.code === "renewal_retryable" && !meta.pending };
}
export function setRetrying(value) { retrying = value; changed(); }
export function finishInitialization(error) {
  initializing = false;
  startupError = error ? { code: "restore_failed", message: error.message } : null;
  changed();
}
export function initializeAuthStorage() {
  initializeCoordinator({ getSession, changed, receiveSession(incoming) {
    const meta = authMetadata();
    if (!meta.blocked && !meta.pending && incoming?.sessionKey === meta.id && readJwt(incoming.token)
      && incoming.revision === meta.revision && (!session || incoming.revision >= session.revision)) {
      session = incoming;
      startupError = null;
      changed();
    }
  } });
}
export function getSession() {
  if (session && authMetadata().id !== session.sessionKey) session = null;
  return session;
}
export function isCurrentSession(key) {
  return !!key && !authMetadata().blocked && getSession()?.sessionKey === key;
}

// The single place that maps token claims and API profile fields into a session.
export function saveSession(token, user, details = {}) {
  initializeAuthStorage();
  const claims = readJwt(token);
  if (!claims) { session = null; changed(); return null; }
  const sessionKey = details.sessionKey || crypto.randomUUID();
  const accessExpiry = Date.parse(details.accessTokenExpiresAt);
  const next = {
    token, sessionKey, revision: (authMetadata().revision ?? 0) + 1,
    expiresAt: Number.isFinite(accessExpiry) ? Math.min(accessExpiry, claims.expiresAt) : claims.expiresAt,
    accessTokenExpiresAt: details.accessTokenExpiresAt,
    refreshTokenExpiresAt: details.refreshTokenExpiresAt ?? null,
    user: { id: claims.userId, email: user.email || "",
      firstName: typeof user.firstName === "string" ? user.firstName.trim() || claims.firstName : claims.firstName,
      lastName: typeof user.lastName === "string" ? user.lastName.trim() : "",
      phoneNumber: typeof user.phoneNumber === "string" ? user.phoneNumber.trim() : "", roles: claims.roles },
  };
  setAuthMetadata({ id: sessionKey, revision: next.revision, blocked: false });
  session = next;
  startupError = null;
  broadcastSession(session);
  changed();
  return session;
}
export function clearSession(message = "", code = "session_expired") {
  initializeAuthStorage();
  session = null;
  startupError = null;
  setAuthMetadata({ id: crypto.randomUUID(), blocked: true, message, code });
  broadcastChange();
  changed();
}
export function blockRefresh(message, code = "renewal_uncertain") {
  setAuthMetadata({ ...authMetadata(), blocked: true, pending: false, message, code,
    failureId: crypto.randomUUID() });
  broadcastChange();
  changed();
}
