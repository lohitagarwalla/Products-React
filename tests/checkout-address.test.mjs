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

test("order retries retain the address ID and exclude client address details and metadata", () => {
  const savedAddress = { ...address, phoneNumber: "+919123456789" };
  const attempt = { requestId: "request", addressId: savedAddress.id,
    items: [{ productId: 7, quantity: 2, price: 123 }],
    deliveryAddress: deliveryAddressSnapshot(savedAddress), cartInstance: "cart" };
  const first = buildOrderRequest(attempt);
  savedAddress.id = 9;
  savedAddress.addressLine1 = "Changed after submitting";
  assert.deepEqual(buildOrderRequest(JSON.parse(JSON.stringify(attempt))), first);
  assert.deepEqual(first, { requestId: "request", items: [{ productId: 7, quantity: 2 }], addressId: 2 });
});

test("checkout display snapshots preserve optional phone numbers", () => {
  for (const phoneNumber of ["+919123456789", null, ""]) {
    const snapshot = deliveryAddressSnapshot({ ...address, phoneNumber });
    assert.equal(snapshot.phoneNumber, phoneNumber);

  }
});

test("legacy pending checkouts and invalid IDs cannot silently select a different address", () => {
  for (const addressId of [undefined, null, 0, -1, 1.5, "2"]) {
    const attempt = { requestId: "old", addressId, items: [{ productId: 7, quantity: 2 }],
      deliveryAddress: deliveryAddressSnapshot(address) };
    assert.throws(() => buildOrderRequest(attempt), /older checkout/);
  }
});
