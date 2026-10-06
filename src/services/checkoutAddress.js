export function deliveryAddressSnapshot(address) {
  if (!address) throw new Error("Select a delivery address before placing your order.");
  return Object.fromEntries(["recipientName", "addressLine1", "addressLine2", "city", "state", "postalCode", "countryCode"]
    .map(field => [field, address[field] ?? (field === "addressLine2" ? null : "")]));
}

export function buildOrderRequest({ requestId, items, deliveryAddress }) {
  if (!deliveryAddress) throw new Error("This older checkout has no saved delivery address. Review My orders before starting a new checkout.");
  return { requestId, items: items.map(({ productId, quantity }) => ({ productId, quantity })),
    deliveryAddress: deliveryAddressSnapshot(deliveryAddress) };
}
