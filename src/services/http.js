import { parseMoneyJson } from "./money";

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
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("VITE_API_BASE_URL is not configured.");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("API paths must start with a single '/'.");
  }
  return `${baseUrl}${path}`;
}
// Cookie endpoints use this transport directly and never recursively refresh.
export async function httpRequest(path, { token, json, responseType = "json", ...options } = {}) {
  const headers = new Headers(options.headers);
  headers.delete("Authorization");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(apiUrl(path), {
    ...options, headers, ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  if (response.ok && responseType === "blob") return { status: response.status, data: await response.blob() };
  const text = await response.text();
  let data = text || null;
  if (text && response.headers.get("content-type")?.includes("json")) {
    try { data = parseMoneyJson(text); }
    catch { if (response.ok) throw new Error("The API returned invalid JSON."); }
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return { status: response.status, data };
}
