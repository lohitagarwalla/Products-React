// Preserve an explicit choice when refreshing; never silently substitute a deleted address.
export function reconcileAddressSelection(addresses, selectedId, initialized) {
  if (!initialized) return addresses.find(address => address.isDefault)?.id ?? null;
  return addresses.some(address => address.id === selectedId) ? selectedId : null;
}

// This is the single boundary to extend with addressId once the order API supports it.
// Checkout-only state must not leak into the current API contract.
export function buildOrderRequest({ requestId, items }) {
  return { requestId, items };
}
