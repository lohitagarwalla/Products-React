import { clearSession, getSession } from "./authStorage";
import { refreshSession } from "./authSession";
import { httpRequest } from "./http";
export { ApiError, apiUrl } from "./http";

export async function apiRequest(path, { auth = true, json, ...options } = {}) {
  options.signal?.throwIfAborted();
  // Capture write payloads before any await so authentication retries send the
  // original checkout RequestId/address even if the caller later edits its object.
  if (json !== undefined) {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    options = { ...options, headers, body: JSON.stringify(json) };
  }
  const original = auth ? getSession() : null;
  let current = original;
  if (current && current.expiresAt <= Date.now() + 5000) current = await refreshSession(current.token);
  const assertCurrent = () => {
    options.signal?.throwIfAborted();
    if (original && getSession()?.sessionKey !== original.sessionKey) throw new Error("Your session changed. Please try again.");
  };
  assertCurrent();
  try {
    const result = await httpRequest(path, { ...options, token: current?.token });
    assertCurrent();
    return result;
  } catch (error) {
    if (error.status !== 401 || !current || !auth) throw error;
    assertCurrent();
    const latest = getSession();
    const renewed = latest?.token !== current.token && latest?.expiresAt > Date.now()
      ? latest : await refreshSession(current.token);
    assertCurrent();
    try {
      const result = await httpRequest(path, { ...options, token: renewed.token });
      assertCurrent();
      return result;
    } catch (retryError) {
      if (retryError.status === 401 && getSession()?.token === renewed.token) clearSession("Your session expired. Please log in again.");
      throw retryError;
    }
  }
}
