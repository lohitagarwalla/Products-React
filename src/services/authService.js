import { httpRequest, ApiError } from "./http";
import { readJwt } from "./jwt";
import { authMetadata, setAuthMetadata, requestPeerSession, coordinated, broadcastChange } from "./authCoordinator";
import { initializeAuthStorage, getSession, saveSession, clearSession, blockRefresh, finishInitialization, setRetrying, allowRefreshRecovery } from "./authStore";
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
    signal: AbortSignal.timeout(path === "refresh" ? 120000 : 30000),
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
export function retrySession() {
  const meta = authMetadata();
  if (refreshing) return refreshing;
  if (meta.code !== "renewal_retryable" || meta.pending || !meta.failureId) {
    return Promise.reject(new Error(meta.message || "Please log in again."));
  }
  setRetrying(true);
  return runRefresh(undefined, meta.failureId).finally(() => setRetrying(false));
}
export function refreshSession(failedToken) {
  return runRefresh(failedToken);
}
function runRefresh(failedToken, retryFailureId) {
  initializeAuthStorage();
  if (refreshing) return refreshing;
  let expected = authMetadata().id;
  const observedFailure = authMetadata().failureId;
  refreshing = coordinated(async () => {
    let meta = authMetadata();
    // A second tab can finish restoring while this startup waits for the lock.
    if (!retryFailureId && !failedToken && !meta.blocked) expected = meta.id;
    if (meta.id !== expected) throw changedError();
    // Requests already waiting for the lock share the failed attempt. A later
    // request may try again, but queued tabs must not produce a retry cascade.
    if (meta.code === "renewal_retryable" && meta.failureId !== observedFailure) {
      throw new Error(meta.message);
    }
    if (retryFailureId && (meta.failureId !== retryFailureId || meta.code !== "renewal_retryable")) {
      if (!meta.blocked) { await requestPeerSession(); return getSession(); }
      throw changedError();
    }
    if (meta.blocked && meta.code !== "renewal_retryable" && meta.code !== "renewal_interrupted") {
      throw new ApiError(401, { message: meta.message || "Please log in again." });
    }
    // Under the lock, pending means the previous holder ended without a response.
    // Also recover metadata written by the earlier manual-only retry policy.
    if (meta.pending || meta.blocked) {
      allowRefreshRecovery();
      meta = authMetadata();
    }
    await requestPeerSession();
    meta = authMetadata();
    if (meta.id !== expected || (meta.blocked && !retryFailureId)) throw changedError();
    const current = getSession();
    if (!retryFailureId && meta.code !== "renewal_retryable" && current && current.token !== failedToken && current.expiresAt > Date.now() + 5000) return current;
    if (current?.refreshTokenExpiresAt && Date.parse(current.refreshTokenExpiresAt) <= Date.now()) {
      clearSession("Your session expired. Please log in again.");
      throw new ApiError(401, { message: "Your session expired. Please log in again." });
    }
    // The lock serializes rotation; pending records an unfinished attempt.
    setAuthMetadata({ ...meta, pending: true });
    broadcastChange();
    let retryableFailure = false;
    try {
      let response;
      try { response = await cookieRequest("refresh"); }
      catch (error) {
        // A later request may recover from transport or server failures.
        if (authMetadata().id === expected && (error.status >= 500 && error.status <= 599
          || error.name === "TypeError" || error.name === "TimeoutError" || error.name === "AbortError")) {
          retryableFailure = true;
          allowRefreshRecovery();
        }
        throw error;
      }
      const { data } = response;
      if (authMetadata().id !== expected) throw changedError();
      const result = readSession(data, current?.user.email);
      const claims = readJwt(result.token);
      if (!claims) throw new Error("The authentication token is invalid or expired. Please log in again.");
      if (current && claims.userId !== current.user.id) {
        throw new Error("The renewed session belongs to another account. Please log in again.");
      }
      return saveSession(result.token, result, { ...result, sessionKey: meta.id || crypto.randomUUID() });
    } catch (error) {
      if (authMetadata().id === expected && !retryableFailure) {
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
    if (authMetadata().blocked && !["renewal_retryable", "renewal_interrupted"].includes(authMetadata().code)) {
      return getSession();
    }
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
  const meta = authMetadata();
  if (["renewal_retryable", "renewal_interrupted"].includes(meta.code)) return refreshSession(failedToken);
  if (meta.blocked && getSession()) throw new ApiError(401, { message: meta.message || "Please log in again." });
  const current = getSession();
  if (current && (current.token === failedToken || current.expiresAt <= Date.now() + 5000)) {
    return refreshSession(failedToken || current.token);
  }
  return current;
}
