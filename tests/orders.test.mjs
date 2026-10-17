import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { parseMoneyJson, toMinor, fromMinor, multiplyMoney, formatMoney } from "../src/services/money.js";
import { readCheckout, saveCheckout, clearCheckout, newRequestId, checkoutValidation } from "../src/services/checkoutStorage.js";
import { readJwt } from "../src/services/jwt.js";

test("money parsing and calculations preserve .NET decimal precision", () => {
  const data = parseMoneyJson('{"totalAmount":9999999999999999.99,"items":[{"unitPrice":0.29,"quantity":3,"lineTotal":0.87}],"description":"\\\"price\\\":123","id":12}');
  assert.equal(data.totalAmount, "9999999999999999.99");
  assert.equal(data.items[0].unitPrice, "0.29");
  assert.equal(data.items[0].quantity, 3);
  assert.equal(data.description, '"price":123');
  assert.equal(data.id, 12);
  assert.equal(multiplyMoney("0.29", 3), "0.87");
  assert.equal(fromMinor(toMinor(data.totalAmount)), data.totalAmount);
  assert.match(formatMoney(data.totalAmount, "INR"), /99\.99/);
  assert.equal(formatMoney("12.50", "JPY").endsWith("12.50"), true);
  assert.throws(() => parseMoneyJson('{"price":01}'));
  assert.throws(() => parseMoneyJson('{"price":2oops}'));
  assert.throws(() => toMinor("0.001"));
});

test("checkout recovery retains the exact request and isolates accounts", () => {
  const originalWindow = globalThis.window;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map();
  globalThis.window = new EventTarget();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } });
  try {
    const pending = { requestId: newRequestId(), deliveryAddress: { recipientName: "Alice", addressLine1: "1 Main St", city: "Bengaluru", state: "Karnataka", postalCode: "560001", countryCode: "IN", addressLine2: null }, items: [{ productId: 42, quantity: 2 }] };
    assert.match(pending.requestId, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
    saveCheckout("alice", pending);
    assert.deepEqual(readCheckout("alice"), pending);
    assert.equal(readCheckout("bob"), null);
    assert.equal(readCheckout(null), null);
    assert.notEqual(newRequestId(), pending.requestId);
    assert.throws(() => saveCheckout(null, pending));
    clearCheckout("bob");
    assert.deepEqual(readCheckout("alice"), pending);
    clearCheckout("alice");
    assert.equal(readCheckout("alice"), null);
    values.set("shopHub.checkout.alice", "bad JSON");
    assert.throws(() => readCheckout("alice"));
  } finally {
    globalThis.window = originalWindow;
    if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
    else delete globalThis.sessionStorage;
  }
});

test("checkout validates quantities, publication, currencies and product count", () => {
  const item = { id: 1, quantity: 1, available: true, product: { currency: "INR" } };
  assert.equal(checkoutValidation([item]), "");
  for (const items of [[], [{ ...item, quantity: 1001 }], [{ ...item, quantity: 0.5 }], [{ ...item, available: false }],
    [item, { ...item, id: 2, product: { currency: "USD" } }], Array.from({ length: 101 }, (_, id) => ({ ...item, id }))]) {
    assert.ok(checkoutValidation(items));
  }
});

test("order contracts, retry semantics, authorization headers, filters and concurrency", async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  globalThis.window = new EventTarget();
  globalThis.window.location = { origin: "http://localhost:5173" };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } });
  try {
    const orders = await server.ssrLoadModule("/src/services/orderService.js");
    const { orderFilters } = await server.ssrLoadModule("/src/services/orderFilters.js");
    const storage = await server.ssrLoadModule("/src/services/authStore.js");
    const token = `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600,
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "alice",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "Alice Customer", role: "Admin" })).toString("base64url")}.signature`;
    assert.equal(readJwt(token).userId, "alice");
    storage.saveSession(token, { email: "alice@example.test" });
    assert.equal(storage.getSession().user.id, "alice");
    assert.equal(storage.getSession().user.firstName, "Alice");
    const requests = [];
    let reply;
    globalThis.fetch = async (url, options) => {
      requests.push({ url: new URL(url), ...options });
      if (reply instanceof Error) throw reply;
      return reply;
    };
    const json = (body, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const attempt = { requestId: newRequestId(), deliveryAddress: { recipientName: "Alice", addressLine1: "1 Main St", city: "Bengaluru", state: "Karnataka", postalCode: "560001", countryCode: "IN", addressLine2: null }, items: [{ productId: 42, quantity: 2 }], userId: "forged", totalAmount: 1, cartInstance: "local" };
    reply = new TypeError("Lost response");
    await assert.rejects(orders.createOrder(attempt));
    const firstBody = requests.at(-1).body;
    for (const status of [200, 201]) {
      reply = json('{"id":7,"totalAmount":9999999999999999.99,"status":"Placed","rowVersion":"AAAAAAAAAAE="}', status);
      const order = await orders.createOrder(attempt);
      assert.equal(order.totalAmount, "9999999999999999.99");
      assert.equal(requests.at(-1).body, firstBody);
      assert.deepEqual(JSON.parse(firstBody), { requestId: attempt.requestId, items: attempt.items, deliveryAddress: attempt.deliveryAddress });
      assert.equal(requests.at(-1).headers.get("Authorization"), `Bearer ${token}`);
    }
    reply = json({ items: [], page: 1, pageSize: 20, totalCount: 0 });
    await orders.listOrders({ manage: true, search: "a&b", status: "Shipped", page: 1, pageSize: 20 });
    assert.equal(requests.at(-1).url.pathname, "/api/orders/manage");
    assert.equal(requests.at(-1).url.searchParams.get("search"), "a&b");
    assert.equal(requests.at(-1).cache, "no-store");
    reply = json({ id: 7, rowVersion: "AAAAAAAAAAI=" });
    for (const action of ["ship", "deliver", "cancel"]) {
      await orders.changeOrderStatus(7, action, "AAAAAAAAAAE=", "  Requested  ");
      assert.equal(requests.at(-1).url.pathname, `/api/orders/7/${action}`);
      assert.deepEqual(JSON.parse(requests.at(-1).body), { rowVersion: "AAAAAAAAAAE=", ...(action === "cancel" ? { reason: "Requested" } : {}) });
      reply = json({ id: 7, rowVersion: "AAAAAAAAAAI=" });
    }
    for (const status of [400, 403, 404, 409, 500]) {
      reply = json({ detail: "Expected error" }, status);
      const count = requests.length;
      await assert.rejects(orders.changeOrderStatus(7, "ship", "AAAAAAAAAAE="), error => error.status === status);
      assert.equal(requests.length, count + 1, "Conflicting writes must not automatically retry");
    }
    assert.deepEqual(orders.allowedOrderActions("Placed", true), ["ship", "cancel"]);
    assert.deepEqual(orders.allowedOrderActions("Shipped", false), ["cancel"]);
    assert.deepEqual(orders.allowedOrderActions("Delivered", true), []);
    assert.deepEqual(orders.allowedOrderActions("Cancelled", false), []);
    const query = orderFilters(new URLSearchParams("from=2026-10-01&to=2026-10-01&page=2"));
    assert.equal(query.fromUtc, new Date(2026, 9, 1).toISOString());
    assert.equal(query.toUtc, new Date(2026, 9, 2).toISOString());
    for (const invalid of ["from=2026-02-30", "from=2026-10-02&to=2026-10-01", "page=0", "pageSize=101", "status=Paid"]) {
      assert.throws(() => orderFilters(new URLSearchParams(invalid)));
    }
  } finally {
    globalThis.window = originalWindow; globalThis.fetch = originalFetch;
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
    await server.close();
  }
});
