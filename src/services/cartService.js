import { apiRequest } from "./api";

export function mapCart(cart) {
  return { ...cart, items: cart.items.map(item => ({
    id: item.productId, quantity: item.quantity, available: item.available,
    product: { id: item.productId, title: item.productTitle ?? `Product #${item.productId}`,
      price: item.unitPrice, currency: item.currency, isPublished: item.available,
      images: item.imageUrl ? [{ url: item.imageUrl }] : [] },
  })) };
}

async function request(path = "", options = {}) {
  return mapCart((await apiRequest(`/api/cart${path}`, { ...options, cache: "no-store" })).data);
}
export const getCart = options => request("", options);
export const setCartItem = (id, quantity) => request(`/items/${encodeURIComponent(id)}`, { method: "PUT", json: { quantity } });
export const removeCartItem = id => request(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });
export const clearCart = () => request("/items", { method: "DELETE" });
export const setCartAddress = addressId => request("/address", { method: "PUT", json: { addressId } });

export function cartError(error) {
  if (error.status === 401) return "Your session expired. Please log in again.";
  if (error.status === 404) return "The cart, product, or address is no longer available.";
  if (error.status === 409) return "The cart is being changed by another request.";
  if (error.status == null || error.status >= 500) return "The cart result could not be confirmed.";
  return error.message || "Unable to update your cart.";
}
