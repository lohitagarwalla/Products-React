import { apiRequest } from "./api";

export const ORDER_STATUSES = ["Placed", "Shipped", "Delivered", "Cancelled"];
export const ORDER_CHANGED_EVENT = "shopHub:orders-changed";
const root = "/api/orders";

export async function listOrders({ manage = false, signal, ...filters } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value != null) query.set(key, value);
  }
  return (await apiRequest(`${root}${manage ? "/manage" : ""}?${query}`, { signal, cache: "no-store" })).data;
}

export async function getOrder(id, { signal } = {}) {
  return (await apiRequest(`${root}/${encodeURIComponent(id)}`, { signal, cache: "no-store" })).data;
}

async function write(path, json) {
  const { data } = await apiRequest(path, { method: "POST", json, cache: "no-store" });
  window.dispatchEvent(new Event(ORDER_CHANGED_EVENT));
  return data;
}

export const createOrder = ({ requestId, items }) => write(root, { requestId, items });
export function changeOrderStatus(id, action, rowVersion, reason = "") {
  if (!["cancel", "ship", "deliver"].includes(action)) throw new Error("Invalid order action.");
  return write(`${root}/${encodeURIComponent(id)}/${action}`, {
    rowVersion, ...(action === "cancel" ? { reason: reason.trim() || null } : {}),
  });
}

export function allowedOrderActions(status, isAdmin) {
  if (status === "Placed") return isAdmin ? ["ship", "cancel"] : ["cancel"];
  if (status === "Shipped") return isAdmin ? ["deliver", "cancel"] : ["cancel"];
  return [];
}

export function orderError(error) {
  if (error.status === 401) return "Your session expired. Please log in again.";
  if (error.status === 403) return "You do not have permission to perform this action.";
  if (error.status === 404) return "Order not found or unavailable to this account.";
  return error.message || "Unable to load the order. Please try again.";
}
