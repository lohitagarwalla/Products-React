import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderRequest, deliveryAddressSnapshot } from "../src/services/checkoutAddress.js";

const address = { id: 2, recipientName: "Alice", addressLine1: "1 Main St", city: "Bengaluru",
  state: "Karnataka", postalCode: "560001", countryCode: "IN", rowVersion: "version", isDefault: true };

test("checkout snapshots delivery fields and strips profile metadata", () => {
  const snapshot = deliveryAddressSnapshot(address);
  assert.deepEqual(snapshot, { recipientName: "Alice", addressLine1: "1 Main St", addressLine2: null,
    city: "Bengaluru", state: "Karnataka", postalCode: "560001", countryCode: "IN" });
  const edited = { ...address, addressLine1: "New street" };
  assert.notEqual(snapshot.addressLine1, edited.addressLine1);
  assert.throws(() => deliveryAddressSnapshot(null), /Select a delivery address/);
});

test("order retries retain the original delivery snapshot and exclude local metadata", () => {
  const attempt = { requestId: "request", items: [{ productId: 7, quantity: 2, price: 123 }],
    deliveryAddress: deliveryAddressSnapshot(address), selectedAddressId: 2, cartInstance: "cart" };
  const first = buildOrderRequest(attempt);
  address.addressLine1 = "Changed after submitting";
  assert.deepEqual(buildOrderRequest(attempt), first);
  assert.equal(first.deliveryAddress.addressLine1, "1 Main St");
  assert.deepEqual(first.items, [{ productId: 7, quantity: 2 }]);
  assert.deepEqual(Object.keys(first), ["requestId", "items", "deliveryAddress"]);
});

test("legacy pending checkouts cannot silently gain a different delivery address", () => {
  assert.throws(() => buildOrderRequest({ requestId: "old", items: [{ productId: 7, quantity: 2 }] }), /older checkout/);
});
