import { apiRequest } from "./api";

const root = "/api/profile/addresses";

export async function listAddresses({ signal } = {}) {
  return (await apiRequest(root, { signal, cache: "no-store" })).data;
}

export async function getAddress(id, { signal } = {}) {
  return (await apiRequest(`${root}/${encodeURIComponent(id)}`, { signal, cache: "no-store" })).data;
}

export async function createAddress(values, { signal } = {}) {
  return (await apiRequest(root, { method: "POST", json: values, signal, cache: "no-store" })).data;
}

export async function updateAddress(id, values, rowVersion, { signal } = {}) {
  return (await apiRequest(`${root}/${encodeURIComponent(id)}`, {
    method: "PUT", json: { ...values, rowVersion }, signal, cache: "no-store",
  })).data;
}

export async function deleteAddress(id, rowVersion, { signal } = {}) {
  await apiRequest(`${root}/${encodeURIComponent(id)}`, {
    method: "DELETE", json: { rowVersion }, signal, cache: "no-store",
  });
}

export async function makeDefaultAddress(id, rowVersion, { signal } = {}) {
  return (await apiRequest(`${root}/${encodeURIComponent(id)}/default`, {
    method: "PUT", json: { rowVersion }, signal, cache: "no-store",
  })).data;
}

export function addressError(error) {
  if (error.status === 401) return "Your session expired. Please log in again.";
  if (error.status === 403) return "You do not have permission to change this address.";
  if (error.status === 404) return "Address not found or unavailable to this account.";
  return error.message || "Unable to complete the address request. Please try again.";
}
