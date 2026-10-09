import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { readJwt } from "../src/services/jwt.js";
import { validatePrice } from "../src/services/price.js";
import { parseMoneyJson, fromMinor, toMinor } from "../src/services/money.js";

test("history amounts retain decimal precision and nullable baseline fields", () => {
  const data = parseMoneyJson('{"items":[{"previousPrice":9999999999999999.99,"newPrice":0.29},{"previousPrice":null,"newPrice":12,"changedByUserId":null}],"totalCount":2,"page":1,"pageSize":20}');
  assert.equal(data.items[0].previousPrice, "9999999999999999.99");
  assert.equal(fromMinor(toMinor(data.items[0].previousPrice)), "9999999999999999.99");
  assert.equal(fromMinor(toMinor(data.items[0].newPrice)), "0.29");
  assert.equal(data.items[1].previousPrice, null);
  assert.equal(fromMinor(toMinor(data.items[1].newPrice)), "12.00");
  assert.equal(data.items[1].changedByUserId, null);
  assert.equal(data.page, 1);
});

const roleClaim = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const token = claims => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })).toString("base64url")}.signature`;

test("price validation rejects precision loss and invalid decimal amounts", () => {
  for (const value of [0, "0.29", "12.50", "999999.99"]) assert.equal(validatePrice(value), true);
  for (const value of ["", "-1", "1.234", "1e3", "9999999999999999.99", "90071992547409.91"]) assert.notEqual(validatePrice(value), true);
});

test("JWT roles handle .NET claims, arrays, malformed and expired tokens", () => {
  assert.deepEqual(readJwt(token({ [roleClaim]: "Admin", name: "नमस्ते" })).roles, ["Admin"]);
  assert.deepEqual(readJwt(token({ [roleClaim]: ["User", "Admin"], role: "Admin" })).roles, ["User", "Admin"]);
  assert.deepEqual(readJwt(token({ role: "User" })).roles, ["User"]);
  assert.deepEqual(readJwt(token({})).roles, []);
  for (const invalid of [undefined, "bad.jwt", "a.bad.c", token({ exp: 1 }), token({ exp: "9999999999" }), token({ nbf: 9999999999 })]) {
    assert.equal(readJwt(invalid), null);
  }
});

test("product API contract, publication payload, multipart uploads, binary reads and session roles", async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  globalThis.window = new EventTarget(); globalThis.window.location = { origin: "http://localhost:5173" };
  window.navigator = { locks: { request: async (_name, action) => action() } };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } });
  try {
    const products = await server.ssrLoadModule("/src/services/productService.js");
    const storage = await server.ssrLoadModule("/src/services/authStorage.js");
    const { apiRequest } = await server.ssrLoadModule("/src/services/api.js");
    const adminToken = token({ [roleClaim]: "Admin" });
    storage.saveSession(adminToken, { email: "admin@example.com", roles: ["Fake"] });
    assert.deepEqual(storage.getSession().user.roles, ["Admin"]);
    const requests = [];
    const replies = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url: new URL(url), ...options });
      assert.ok(replies.length, "Unexpected API call");
      return replies.shift();
    };
    const json = body => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const product = { id: 42, title: "Phone", brand: "Brand", description: "Details", price: 12.50, currency: "INR", isPublished: false, images: [] };

    const controller = new AbortController();
    replies.push(json({ items: [{ id: 1, newPrice: 100, changedByUserId: "actor-id", changedByUserName: "Ada Lovelace" }], totalCount: 21, page: 2, pageSize: 20 }));
    const history = await products.getProductPriceHistory(42, { page: 2, signal: controller.signal });
    assert.equal(requests.at(-1).url.pathname, "/api/products/42/price-history");
    assert.equal(requests.at(-1).url.searchParams.get("page"), "2");
    assert.equal(requests.at(-1).url.searchParams.get("pageSize"), "20");
    assert.equal(requests.at(-1).headers.get("Authorization"), `Bearer ${adminToken}`);
    assert.equal(requests.at(-1).signal, controller.signal);
    assert.equal(history.totalCount, 21);
    assert.equal(history.items[0].changedByUserName, "Ada Lovelace");
    for (const status of [403, 404, 500]) {
      replies.push(new Response(JSON.stringify({ title: "History unavailable" }), { status, headers: { "content-type": "application/json" } }));
      await assert.rejects(products.getProductPriceHistory(42), error => error.status === status);
    }

    replies.push(json({ items: [], totalCount: 0, page: 2, pageSize: 12 }));
    await products.listProducts({ search: "a&b", page: 2 });
    assert.equal(requests.at(-1).url.pathname, "/api/products");
    assert.equal(requests.at(-1).url.searchParams.get("search"), "a&b");
    assert.equal(requests.at(-1).headers.has("Authorization"), false);
    replies.push(json({ items: [product] }));
    await products.listProducts({ manage: true });
    assert.equal(requests.at(-1).url.pathname, "/api/products/manage");
    assert.equal(requests.at(-1).headers.get("Authorization"), `Bearer ${adminToken}`);

    replies.push(json(product));
    await products.createProduct({ ...product, title: " Phone ", currency: "inr" });
    assert.equal(requests.at(-1).method, "POST");
    assert.deepEqual(JSON.parse(requests.at(-1).body), { title: "Phone", brand: "Brand", description: "Details", price: 12.5, currency: "INR", isPublished: false });

    replies.push(json(product), json({ ...product, isPublished: true }));
    await products.setPublished(42, true);
    assert.equal(requests.at(-2).url.pathname, "/api/products/42");
    assert.equal(requests.at(-1).method, "PUT");
    assert.deepEqual(JSON.parse(requests.at(-1).body), { title: "Phone", brand: "Brand", description: "Details", price: 12.5, currency: "INR", isPublished: true });

    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    replies.push(json({ id: 5, url: "/api/images/5/content" }));
    await products.uploadImage(42, file, "Front view");
    assert.equal(requests.at(-1).url.pathname, "/api/products/42/images");
    assert.equal(requests.at(-1).headers.has("Content-Type"), false);
    assert.equal(requests.at(-1).body.get("file").name, "photo.png");
    assert.equal(requests.at(-1).body.get("altText"), "Front view");

    replies.push(new Response(JSON.stringify({ detail: "Image is corrupt" }), { status: 400, headers: { "content-type": "application/json" } }));
    await assert.rejects(products.uploadImage(42, file), /Image is corrupt/);
    assert.equal(storage.getSession().token, adminToken);

    replies.push(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } }));
    const image = await apiRequest("/api/images/5/content", { responseType: "blob" });
    assert.deepEqual([...new Uint8Array(await image.data.arrayBuffer())], [137, 80, 78, 71]);
    assert.equal(requests.at(-1).headers.get("Authorization"), `Bearer ${adminToken}`);

    replies.push(new Response(JSON.stringify({ title: "Image not found" }), { status: 404, headers: { "content-type": "application/json" } }));
    await assert.rejects(apiRequest("/api/images/999/content", { responseType: "blob" }), error => error.status === 404 && error.message === "Image not found");

    for (const [action, path, method, body] of [
      [() => products.reorderImages(42, [5, 7]), "/api/products/42/images/order", "PUT", { imageIds: [5, 7] }],
      [() => products.updateImage(42, 5, "Back"), "/api/products/42/images/5", "PUT", { altText: "Back" }],
      [() => products.deleteImage(42, 5), "/api/products/42/images/5", "DELETE"],
      [() => products.deleteProduct(42), "/api/products/42", "DELETE"],
    ]) {
      replies.push(new Response(null, { status: 204 }));
      await action();
      assert.equal(requests.at(-1).url.pathname, path);
      assert.equal(requests.at(-1).method, method);
      if (body) assert.deepEqual(JSON.parse(requests.at(-1).body), body);
    }
    replies.push(new Response(null, { status: 401 }));
    replies.push(new Response(null, { status: 401 }));
    await assert.rejects(products.getProductPriceHistory(42), error => error.status === 401);
    assert.equal(storage.getSession(), null);
    storage.saveSession(token({ exp: 1 }), { email: "expired@example.com" });
    assert.equal(storage.getSession(), null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
    await server.close();
  }
});
