export function deliveryAddressSnapshot(address) {
  if (!address) throw new Error("Select a delivery address before placing your order.");
  const snapshot = Object.fromEntries(["recipientName", "addressLine1", "addressLine2", "city", "state", "postalCode", "countryCode"]
    .map(field => [field, address[field] ?? (field === "addressLine2" ? null : "")]));
  // Keep older pending attempts without a phone unchanged when they are retried.
  if (address.phoneNumber !== undefined) snapshot.phoneNumber = address.phoneNumber;
  return snapshot;
}

export function buildOrderRequest({ requestId, items, addressId }) {
  if (!Number.isInteger(addressId) || addressId <= 0) throw new Error("This older checkout has no saved address ID. Review My orders before starting a new checkout.");
  return { requestId, items: items.map(({ productId, quantity }) => ({ productId, quantity })),
    addressId };
}
