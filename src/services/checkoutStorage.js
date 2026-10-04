export const CHECKOUT_CHANGED_EVENT = "shopHub:checkout-changed";
const key = userId => `shopHub.checkout.${userId}`;

export function newRequestId() {
  // getRandomValues also works on HTTP LAN development origins.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function readCheckout(userId) {
  if (!userId) return null;
  const text = sessionStorage.getItem(key(userId));
  if (!text) return null;
  const pending = JSON.parse(text);
  if (!pending.requestId || !Array.isArray(pending.items) || !pending.items.length) {
    throw new Error("The saved checkout could not be read. Review My orders before starting another checkout.");
  }
  return pending;
}

export function saveCheckout(userId, pending) {
  if (!userId) throw new Error("Please log in again before placing an order.");
  sessionStorage.setItem(key(userId), JSON.stringify(pending));
  window.dispatchEvent(new Event(CHECKOUT_CHANGED_EVENT));
}

export function clearCheckout(userId) {
  sessionStorage.removeItem(key(userId));
  window.dispatchEvent(new Event(CHECKOUT_CHANGED_EVENT));
}

export function checkoutValidation(items) {
  if (!items.length || items.length > 100) return "An order must contain between 1 and 100 different products.";
  if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000)) {
    return "Each quantity must be between 1 and 1000.";
  }
  if (items.some(item => !item.available)) return "Remove unavailable products before placing your order.";
  if (new Set(items.map(item => item.product.currency.toUpperCase())).size !== 1) {
    return "An order must use one currency. Remove products in other currencies to continue.";
  }
  return "";
}
