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
  const savedAddress = { ...address, phoneNumber: "+919123456789" };
  const attempt = { requestId: "request", items: [{ productId: 7, quantity: 2, price: 123 }],
    deliveryAddress: deliveryAddressSnapshot(savedAddress), selectedAddressId: 2, cartInstance: "cart" };
  const first = buildOrderRequest(attempt);
  savedAddress.addressLine1 = "Changed after submitting";
  savedAddress.phoneNumber = "+918123456789";
  const recoveredAttempt = JSON.parse(JSON.stringify(attempt));
  assert.deepEqual(buildOrderRequest(recoveredAttempt), first);
  assert.equal(first.deliveryAddress.addressLine1, "1 Main St");
  assert.equal(first.deliveryAddress.phoneNumber, "+919123456789");
  assert.deepEqual(first.items, [{ productId: 7, quantity: 2 }]);
  assert.deepEqual(Object.keys(first), ["requestId", "items", "deliveryAddress"]);
});

test("checkout snapshots and requests preserve optional phone numbers", () => {
  for (const phoneNumber of ["+919123456789", null, ""]) {
    const snapshot = deliveryAddressSnapshot({ ...address, phoneNumber });
    assert.equal(snapshot.phoneNumber, phoneNumber);
    const request = buildOrderRequest({ requestId: "request", items: [{ productId: 7, quantity: 2 }], deliveryAddress: snapshot });
    assert.equal(request.deliveryAddress.phoneNumber, phoneNumber);
  }
});

test("older pending addresses without phones retain their original request on retry", () => {
  const attempt = { requestId: "old", items: [{ productId: 7, quantity: 2 }], deliveryAddress: deliveryAddressSnapshot(address) };
  const request = buildOrderRequest(JSON.parse(JSON.stringify(attempt)));
  assert.equal(Object.hasOwn(request.deliveryAddress, "phoneNumber"), false);
  assert.deepEqual(request, attempt);
});

test("legacy pending checkouts cannot silently gain a different delivery address", () => {
  assert.throws(() => buildOrderRequest({ requestId: "old", items: [{ productId: 7, quantity: 2 }] }), /older checkout/);
});
