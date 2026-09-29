import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("JWT requests, response statuses, and session lifecycle", async () => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
  const originals = {
    fetch: globalThis.fetch,
    window: globalThis.window,
  };
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  globalThis.window = new EventTarget();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });

  try {
    const { apiRequest, ApiError } = await server.ssrLoadModule("/src/services/api.js");
    const storage = await server.ssrLoadModule("/src/services/authStorage.js");
    const auth = await server.ssrLoadModule("/src/services/authService.js");
    let request;
    let nextResponse;
    globalThis.fetch = async (url, options) => {
      request = { url, ...options };
      return nextResponse;
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });

    storage.saveSession("test-jwt", { email: "test@example.com" });
    nextResponse = json([{ id: 1 }]);
    assert.deepEqual(await apiRequest("/api/products"), { status: 200, data: [{ id: 1 }] });
    assert.equal(request.headers.get("Authorization"), "Bearer test-jwt");

    const credentials = { email: "test@example.com", password: "password" };
    const registration = {
      firstname: "Test", lastname: "User", ...credentials, confirmPassword: "password",
    };
    for (const [method, path, payload] of [
      [auth.login, "/api/auth/login", credentials],
      [auth.signUp, "/api/auth/register", registration],
    ]) {
      nextResponse = json({ token: "new-jwt" }, 201);
      assert.deepEqual(await method(registration), {
        token: "new-jwt", user: { email: "test@example.com" },
      });
      assert.equal(request.headers.has("Authorization"), false);
      assert.equal(request.method, "POST");
      assert.equal(new URL(request.url).pathname, path);
      assert.deepEqual(JSON.parse(request.body), payload);
    }
    nextResponse = json({});
    await assert.rejects(auth.login(credentials), /did not contain a token/);

    nextResponse = new Response(null, { status: 204 });
    assert.deepEqual(await apiRequest("/api/products/1", { method: "DELETE" }), { status: 204, data: null });
    nextResponse = json({ pending: true }, 202);
    assert.equal((await apiRequest("/api/products/1", { method: "DELETE" })).status, 202);

    for (const status of [400, 403, 404, 409, 500]) {
      nextResponse = json({ title: "Expected error" }, status);
      await assert.rejects(apiRequest("/api/products"), error =>
        error instanceof ApiError && error.status === status && error.message === "Expected error");
      assert.equal(storage.getSession().token, "test-jwt");
    }
    nextResponse = json({ errors: { Email: ["Invalid email"] } }, 400);
    await assert.rejects(apiRequest("/api/products"), /Invalid email/);

    nextResponse = new Response(null, { status: 401 });
    await assert.rejects(auth.login(credentials));
    assert.equal(storage.getSession().token, "test-jwt");
    nextResponse = new Response(null, { status: 401 });
    await assert.rejects(apiRequest("/api/products"), error => error.status === 401);
    assert.equal(storage.getSession(), null);

    storage.saveSession("old-jwt", { email: "test@example.com" });
    globalThis.fetch = async () => {
      storage.saveSession("new-jwt", { email: "test@example.com" });
      return new Response(null, { status: 401 });
    };
    await assert.rejects(apiRequest("/api/products"));
    assert.equal(storage.getSession().token, "new-jwt");

    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(apiRequest("/api/products"), /Failed to fetch/);
    assert.equal(storage.getSession().token, "new-jwt");
    await assert.rejects(apiRequest("https://other.example/api"), /API paths/);
    storage.clearSession();
    assert.equal(storage.getSession(), null);
  } finally {
    Object.assign(globalThis, originals);
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else delete globalThis.localStorage;
    await server.close();
  }
});
