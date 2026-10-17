// Cross-tab coordination only. Access tokens are never written to storage.
export const AUTH_META_KEY = "shopHub.auth-state";
let channel;
let initialized = false;

export function authMetadata() {
  try {
    const raw = localStorage.getItem(AUTH_META_KEY);
    if (!raw) return { id: null, blocked: false };
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)
      || !(value.id === null || typeof value.id === "string")
      || (value.blocked !== undefined && typeof value.blocked !== "boolean")
      || (value.pending !== undefined && typeof value.pending !== "boolean")
      || (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || value.revision < 0))) throw new Error();
    return value;
  } catch {
    // Unknown rotation state must not trigger an automatic cookie replay.
    return { id: null, blocked: true, code: "storage_unavailable",
      message: "Your saved session could not be read. Please log in again." };
  }
}
export function setAuthMetadata(value) {
  localStorage.setItem(AUTH_META_KEY, JSON.stringify(value));
}
export function broadcastSession(session) { channel?.postMessage({ type: "session", session }); }
export function broadcastChange() { channel?.postMessage({ type: "changed" }); }

export function initializeCoordinator({ getSession, receiveSession, changed }) {
  if (initialized) return;
  localStorage.removeItem("shopHub.auth");
  if (window.BroadcastChannel) {
    channel = new window.BroadcastChannel("shopHub.auth");
    channel.onmessage = ({ data }) => {
      if (data?.type === "request") {
        const current = getSession();
        if (current && current.expiresAt > Date.now()) broadcastSession(current);
      } else if (data?.type === "session") receiveSession(data.session);
      else if (data?.type === "changed") changed();
    };
  }
  window.addEventListener("storage", event => {
    if (event.key === AUTH_META_KEY || event.key === null) changed();
  });
  initialized = true;
}
export async function requestPeerSession() {
  if (!channel) return;
  channel.postMessage({ type: "request" });
  await new Promise(resolve => setTimeout(resolve, 100));
}
export function coordinated(action) {
  if (!window.navigator?.locks) {
    return Promise.reject(new Error("Secure sign-in is unavailable in this browser. Open the site on HTTPS or localhost in a current browser."));
  }
  return window.navigator.locks.request("shopHub.auth", action);
}
