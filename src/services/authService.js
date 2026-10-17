import { httpRequest, ApiError } from "./http";
import { readJwt } from "./jwt";
import { authMetadata, setAuthMetadata, requestPeerSession, coordinated } from "./authCoordinator";
import { initializeAuthStorage, getSession, saveSession, clearSession, blockRefresh, finishInitialization } from "./authStore";
export { isCurrentSession } from "./authStore";

let refreshing;
const changedError = () => new Error("Your session changed. Please try again.");
function readSession(data, email) {
  if (typeof data?.token !== "string" || !data.token.trim()) throw new Error("The authentication response did not contain a token.");
  const accessExpiry = Date.parse(data.accessTokenExpiresAt);
  const refreshExpiry = Date.parse(data.refreshTokenExpiresAt);
  if (!Number.isFinite(accessExpiry) || !Number.isFinite(refreshExpiry) || accessExpiry <= Date.now() || refreshExpiry <= Date.now()) {
    throw new Error("The authentication response did not contain valid expiry timestamps.");
  }
  return { ...data, email: data.email || email || "" };
}
function cookieRequest(path, json) {
  return httpRequest(`/api/auth/${path}`, {
    method: "POST", credentials: "include", cache: "no-store", json,
    headers: json === undefined ? { "X-Refresh-Token": "1" } : undefined,
    signal: AbortSignal.timeout(30000),
  });
}
export function authenticate(path, json) {
  initializeAuthStorage();
  const expected = authMetadata().id;
  return coordinated(async () => {
    if (authMetadata().id !== expected) throw changedError();
    try {
      const { data } = await cookieRequest(path, json);
      if (authMetadata().id !== expected) throw changedError();
      const result = readSession(data, json.email);
      const session = saveSession(result.token, result, result);
      if (!session) throw new Error("The authentication token is invalid or expired. Please log in again.");
      return session;
    } catch (error) {
      // A network/parse failure may have replaced the cookie without confirming
      // the account. Never silently refresh that cookie into the previous account.
      if (authMetadata().id === expected && (!error.status || error.status >= 500)) {
        clearSession("Sign-in could not be confirmed. Please log in again.", "signin_uncertain");
      }
      throw error;
    }
  });
}
export function refreshSession(failedToken) {
  initializeAuthStorage();
  if (refreshing) return refreshing;
  let expected = authMetadata().id;
  refreshing = coordinated(async () => {
    let meta = authMetadata();
    // A second tab can finish restoring while this startup waits for the lock.
    if (!failedToken && !meta.blocked) expected = meta.id;
    if (meta.id !== expected) throw changedError();
    if (meta.blocked) throw new ApiError(401, { message: meta.message || "Please log in again." });
    if (meta.pending) {
      blockRefresh("Session renewal was interrupted. Please log in again.", "renewal_interrupted");
      throw new Error("Session renewal was interrupted. Please log in again.");
    }
    await requestPeerSession();
    meta = authMetadata();
    if (meta.id !== expected || meta.blocked) throw changedError();
    const current = getSession();
    if (current && current.token !== failedToken && current.expiresAt > Date.now() + 5000) return current;
    if (current?.refreshTokenExpiresAt && Date.parse(current.refreshTokenExpiresAt) <= Date.now()) {
      clearSession("Your session expired. Please log in again.");
      throw new ApiError(401, { message: "Your session expired. Please log in again." });
    }
    // A closed tab or lost rotation response must not cause automatic replay.
    setAuthMetadata({ ...meta, pending: true });
    try {
      const { data } = await cookieRequest("refresh");
      if (authMetadata().id !== expected) throw changedError();
      const result = readSession(data, current?.user.email);
      const claims = readJwt(result.token);
      if (!claims) throw new Error("The authentication token is invalid or expired. Please log in again.");
      if (current && claims.userId !== current.user.id) {
        throw new Error("The renewed session belongs to another account. Please log in again.");
      }
      return saveSession(result.token, result, { ...result, sessionKey: meta.id || crypto.randomUUID() });
    } catch (error) {
      if (authMetadata().id === expected) {
        if (error.status === 401) clearSession(current || meta.id ? "Your session expired. Please log in again." : "");
        else blockRefresh(error.status === 400 || error.status === 403
          ? "Session renewal was rejected. Please log in again. If this continues, contact support."
          : "Session renewal could not be confirmed. Please log in again.",
        error.status === 400 || error.status === 403 ? "renewal_rejected" : "renewal_uncertain");
      }
      throw error;
    }
  }).finally(() => { refreshing = null; });
  return refreshing;
}
export async function restoreSession() {
  let failure;
  try {
    initializeAuthStorage();
    if (authMetadata().blocked) return getSession();
    return await refreshSession();
  } catch (error) {
    if (error.status === 401) return null;
    failure = error;
    throw error;
  } finally {
    finishInitialization(failure);
  }
}
export function logout() {
  clearSession();
  const expected = authMetadata().id;
  return coordinated(async () => {
    if (authMetadata().id !== expected) return;
    await cookieRequest("logout");
  }).catch(error => {
    if (authMetadata().id === expected) blockRefresh("You are signed out here, but server logout could not be confirmed. Please log in again before continuing.", "logout_uncertain");
    throw error;
  });
}

export function login({ email, password }) {
  return authenticate("login", { email, password });
}
export function signUp({ firstname, lastname, email, phoneNumber, password, confirmPassword }) {
  return authenticate("register", { firstname, lastname, email, phoneNumber: phoneNumber.trim(), password, confirmPassword });
}
export async function getAccessSession(failedToken) {
  const current = getSession();
  if (current && (current.token === failedToken || current.expiresAt <= Date.now() + 5000)) {
    return refreshSession(failedToken || current.token);
  }
  return current;
}
