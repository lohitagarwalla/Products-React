import { apiRequest } from "./api";

const root = "/api/products";
export const PRODUCT_CHANGED_EVENT = "shopHub:products-changed";

async function write(path, options) {
  const { data } = await apiRequest(path, options);
  window.dispatchEvent(new Event(PRODUCT_CHANGED_EVENT));
  return data;
}

export async function listProducts({ search = "", page = 1, pageSize = 12, manage = false, signal } = {}) {
  const query = new URLSearchParams({ search, page, pageSize });
  const { data } = await apiRequest(`${root}${manage ? "/manage" : ""}?${query}`, { auth: manage, signal });
  return data;
}

export async function getProduct(id, { signal, auth = true } = {}) {
  const { data } = await apiRequest(`${root}/${encodeURIComponent(id)}`, { signal, auth });
  return data;
}

export function productPayload(product) {
  return {
    title: product.title.trim(), description: product.description?.trim() ?? "",
    brand: product.brand.trim(), price: Number(product.price),
    currency: product.currency.trim().toUpperCase(), isPublished: !!product.isPublished,
  };
}

export const createProduct = product => write(root, { method: "POST", json: productPayload(product) });
export const updateProduct = (id, product) => write(`${root}/${id}`, { method: "PUT", json: productPayload(product) });
export const deleteProduct = id => write(`${root}/${id}`, { method: "DELETE" });

export async function setPublished(id, isPublished) {
  // PUT is a full update. Read the current fields before changing publication status.
  const product = await getProduct(id);
  return updateProduct(id, { ...product, isPublished });
}

export function uploadImage(id, file, altText = "", signal) {
  const body = new FormData();
  body.append("file", file);
  body.append("altText", altText);
  return write(`${root}/${id}/images`, { method: "POST", body, signal });
}
export const deleteImage = (id, imageId) => write(`${root}/${id}/images/${imageId}`, { method: "DELETE" });
export const updateImage = (id, imageId, altText) => write(`${root}/${id}/images/${imageId}`, { method: "PUT", json: { altText } });
export const reorderImages = (id, imageIds) => write(`${root}/${id}/images/order`, { method: "PUT", json: { imageIds } });

export function productError(error) {
  if (error.status === 401) return "Your session expired. Please log in again.";
  if (error.status === 403) return "You need the Admin role to perform this action.";
  if (error.status === 404) return "This product or image is no longer available.";
  if (error.status === 409) return "This product changed during your request. Reload it and retry.";
  return error.message || "The request failed. Please try again.";
}

export function formatPrice(price, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${Number(price).toFixed(2)}`;
  }
}
