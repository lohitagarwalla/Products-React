import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("saved cart API uses authenticated absolute quantities and preserves decimal/null product data", async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  globalThis.window = new EventTarget();
  window.location = { origin: "http://localhost:5173" };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } });
  try {
    const carts = await server.ssrLoadModule("/src/services/cartService.js");
    const auth = await server.ssrLoadModule("/src/services/authStorage.js");
    const token = `fixture.${Buffer.from(JSON.stringify({ sub: "alice", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
    auth.saveSession(token, { email: "alice@example.test" });
    const requests = [];
    let status = 200;
    globalThis.fetch = async (url, options) => {
      requests.push({ url, ...options });
      return new Response(status === 200
        ? '{"id":1,"selectedAddressId":2,"selectedAddress":{"id":2},"items":[{"productId":7,"quantity":3,"available":true,"productTitle":"Headphones","unitPrice":9999999999999999.99,"currency":"INR","imageUrl":"/api/images/1/content"},{"productId":8,"quantity":1,"available":false,"productTitle":null,"unitPrice":null,"currency":null,"imageUrl":null}]}'
        : '{"detail":"Expected failure"}', { status, headers: { "Content-Type": "application/json" } });
    };
    const cart = await carts.getCart();
    assert.equal(cart.items[0].product.price, "9999999999999999.99");
    assert.deepEqual(cart.items[0].product.images, [{ url: "/api/images/1/content" }]);
    assert.equal(cart.items[1].product.title, "Product #8");
    assert.equal(cart.items[1].product.price, null);
    assert.equal(cart.selectedAddressId, 2);
    for (const [action, path, method, body] of [
      [() => carts.setCartItem(7, 4), "/items/7", "PUT", { quantity: 4 }],
      [() => carts.removeCartItem(7), "/items/7", "DELETE", undefined],
      [() => carts.clearCart(), "/items", "DELETE", undefined],
      [() => carts.setCartAddress(2), "/address", "PUT", { addressId: 2 }],
      [() => carts.setCartAddress(null), "/address", "PUT", { addressId: null }],
    ]) {
      await action();
      const request = requests.at(-1);
      assert.equal(new URL(request.url).pathname, `/api/cart${path}`);
      assert.equal(request.method, method);
      assert.equal(request.headers.get("Authorization"), `Bearer ${token}`);
      assert.equal(request.cache, "no-store");
      assert.deepEqual(request.body && JSON.parse(request.body), body);
    }
    for (status of [400, 404, 409, 500]) {
      const before = requests.length;
      await assert.rejects(carts.setCartItem(7, 4), failure => failure.status === status);
      assert.equal(requests.length, before + 1, "uncertain writes must not automatically retry");
    }
  } finally {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
    await server.close();
  }
});
