import { clearSession, getSession } from "./authStorage";

export class ApiError extends Error {
  constructor(status, data) {
    const validationErrors = data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors).flat().join(" ") : null;
    super(validationErrors || data?.detail || data?.message || data?.title
      || (typeof data === "string" && data) || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function apiUrl(path) {
  // const baseUrl =  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  const baseUrl = import.meta.env.DEV
  ? window.location.origin
  : import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("VITE_API_BASE_URL is not configured.");
  // Only backend paths are accepted, never arbitrary external URLs.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("API paths must start with a single '/'.");
  }
  return `${baseUrl}${path}`;
}

export async function apiRequest(path, { auth = true, json, responseType = "json", ...options } = {}) {
  const url = apiUrl(path);
  const headers = new Headers(options.headers);
  const token = auth ? getSession()?.token : null;
  headers.delete("Authorization");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    ...options, headers,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  // An old request must not clear a newer login.
  if (response.status === 401 && token && getSession()?.token === token) {
    clearSession();
  }
  if (response.ok && responseType === "blob") {
    return { status: response.status, data: await response.blob() };
  }
  const text = await response.text();
  let data = text || null;
  if (text && response.headers.get("content-type")?.includes("json")) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) throw new Error("The API returned invalid JSON.");
      // Preserve the status for malformed HTTP error responses.
    }
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return { status: response.status, data };
}
