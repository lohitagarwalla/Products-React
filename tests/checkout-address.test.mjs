import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderRequest, reconcileAddressSelection } from "../src/services/checkoutAddress.js";

const addresses = [{ id: 1, isDefault: false }, { id: 2, isDefault: true }];

test("initial checkout selects only an explicit default", () => {
  assert.equal(reconcileAddressSelection(addresses, null, false), 2);
  assert.equal(reconcileAddressSelection([{ id: 1, isDefault: false }], null, false), null);
  assert.equal(reconcileAddressSelection([], null, false), null);
});

test("refresh preserves a checkout choice even when the profile default changes", () => {
  assert.equal(reconcileAddressSelection(addresses, 1, true), 1);
  assert.equal(reconcileAddressSelection([{ id: 1, isDefault: true }, { id: 2, isDefault: false }], 2, true), 2);
});

test("deleted selections require an explicit replacement instead of silently choosing another address", () => {
  assert.equal(reconcileAddressSelection(addresses, 3, true), null);
  assert.equal(reconcileAddressSelection(addresses, null, true), null);
  assert.equal(reconcileAddressSelection([], 1, true), null);
});

test("current order requests exclude address data and checkout recovery metadata", () => {
  const attempt = { requestId: "request", items: [{ productId: 7, quantity: 2 }],
    cartInstance: "cart", cartRevision: 3, selectedAddressId: 2, address: { recipientName: "Private" } };
  assert.deepEqual(buildOrderRequest(attempt), { requestId: "request", items: [{ productId: 7, quantity: 2 }] });
  assert.equal(attempt.selectedAddressId, 2);
});
