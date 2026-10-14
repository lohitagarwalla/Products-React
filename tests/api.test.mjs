import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

const jwt = label => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, label })).toString("base64url")}.signature`;
const testToken = jwt("test");
const oldToken = jwt("old");
const newToken = jwt("new");

test("JWT requests, response statuses, and session lifecycle", async () => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  const originals = {
    fetch: globalThis.fetch,
    window: globalThis.window,
  };
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  globalThis.window = new EventTarget(); globalThis.window.location = { origin: "http://localhost:5173" };
  window.navigator = { locks: { request: async (_name, action) => action() } };
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
      return nextResponse.clone();
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });

    storage.saveSession(testToken, { email: "test@example.com" });
    nextResponse = json([{ id: 1 }]);
    assert.deepEqual(await apiRequest("/api/products"), { status: 200, data: [{ id: 1 }] });
    assert.equal(request.headers.get("Authorization"), `Bearer ${testToken}`);

    const addresses = await server.ssrLoadModule("/src/services/addressService.js");
    const savedAddress = { id: 7, isDefault: false, rowVersion: "AAAAAAAAB+E=" };
    nextResponse = json([savedAddress]);
    assert.deepEqual(await addresses.listAddresses(), [savedAddress]);
    assert.equal(new URL(request.url).pathname, "/api/profile/addresses");
    assert.equal(request.cache, "no-store");
    assert.equal(request.headers.get("Authorization"), `Bearer ${testToken}`);
    nextResponse = json({ ...savedAddress, isDefault: true });
    assert.equal((await addresses.makeDefaultAddress(savedAddress.id, savedAddress.rowVersion)).isDefault, true);
    assert.equal(new URL(request.url).pathname, "/api/profile/addresses/7/default");
    assert.equal(request.method, "PUT");
    assert.deepEqual(JSON.parse(request.body), { rowVersion: savedAddress.rowVersion });
    nextResponse = json({ title: "Concurrent update" }, 409);
    await assert.rejects(addresses.makeDefaultAddress(7, savedAddress.rowVersion), error => error.status === 409);

    const addressValues = { label: "Home", recipientName: "Test User", addressLine1: "12 Main Road",
      addressLine2: null, city: "Bengaluru", state: "Karnataka", postalCode: "560001", countryCode: "IN" };
    nextResponse = json({ ...savedAddress, ...addressValues }, 201);
    await addresses.createAddress({ ...addressValues, makeDefault: true });
    assert.equal(request.method, "POST");
    assert.equal(new URL(request.url).pathname, "/api/profile/addresses");
    assert.deepEqual(JSON.parse(request.body), { ...addressValues, makeDefault: true });
    nextResponse = json({ ...savedAddress, ...addressValues });
    await addresses.getAddress(7);
    assert.equal(new URL(request.url).pathname, "/api/profile/addresses/7");
    assert.equal(request.body, undefined);
    nextResponse = json({ ...savedAddress, ...addressValues });
    await addresses.updateAddress(7, addressValues, savedAddress.rowVersion);
    assert.equal(request.method, "PUT");
    assert.deepEqual(JSON.parse(request.body), { ...addressValues, rowVersion: savedAddress.rowVersion });
    nextResponse = new Response(null, { status: 204 });
    await addresses.deleteAddress(7, savedAddress.rowVersion);
    assert.equal(request.method, "DELETE");
    assert.deepEqual(JSON.parse(request.body), { rowVersion: savedAddress.rowVersion });
    assert.equal(request.headers.get("Authorization"), `Bearer ${testToken}`);

    const credentials = { email: "test@example.com", password: "password" };
    const registration = {
      firstname: "Test", lastname: "User", ...credentials, confirmPassword: "password",
      phoneNumber: "+919876543210",
    };
    for (const [method, path, payload] of [
      [auth.login, "/api/auth/login", credentials],
      [auth.signUp, "/api/auth/register", registration],
    ]) {
      const expiry = { accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 604800000).toISOString() };
      nextResponse = json({ token: newToken, ...expiry }, 201);
      assert.deepEqual(await method({ ...registration, phoneNumber: `  ${registration.phoneNumber}  ` }), {
        token: newToken, ...expiry, user: { email: "test@example.com", firstName: "", lastName: "", phoneNumber: "" },
      });
      assert.equal(request.headers.has("Authorization"), false);
      assert.equal(request.credentials, "include");
      assert.equal(request.method, "POST");
      assert.equal(new URL(request.url).pathname, path);
      assert.deepEqual(JSON.parse(request.body), payload);
    }
    nextResponse = json({ token: newToken, firstName: "  Mary Jane  ", lastName: "  Smith  ", phoneNumber: "  +919876543210  ", accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 604800000).toISOString() });
    const namedSession = await auth.login(credentials);
    storage.saveSession(namedSession.token, namedSession.user);
    assert.equal(storage.getSession().user.firstName, "Mary Jane");
    assert.equal(storage.getSession().user.lastName, "Smith");
    assert.equal(storage.getSession().user.phoneNumber, "+919876543210");
    storage.saveSession(testToken, { email: "test@example.com" });
    nextResponse = json({});
    await assert.rejects(auth.login(credentials), /did not contain a token/);
    assert.equal(storage.getSession(), null);
    storage.saveSession(testToken, { email: "test@example.com" });

    nextResponse = new Response(null, { status: 204 });
    assert.deepEqual(await apiRequest("/api/products/1", { method: "DELETE" }), { status: 204, data: null });
    nextResponse = json({ pending: true }, 202);
    assert.equal((await apiRequest("/api/products/1", { method: "DELETE" })).status, 202);

    for (const status of [400, 403, 404, 409, 500]) {
      nextResponse = json({ title: "Expected error" }, status);
      await assert.rejects(apiRequest("/api/products"), error =>
        error instanceof ApiError && error.status === status && error.message === "Expected error");
      assert.equal(storage.getSession().token, testToken);
    }
    nextResponse = json({ errors: { Email: ["Invalid email"] } }, 400);
    await assert.rejects(apiRequest("/api/products"), /Invalid email/);

    nextResponse = new Response(null, { status: 401 });
    await assert.rejects(auth.login(credentials));
    assert.equal(storage.getSession().token, testToken);
    nextResponse = new Response(null, { status: 401 });
    await assert.rejects(apiRequest("/api/products"), error => error.status === 401);
    assert.equal(storage.getSession(), null);

    storage.saveSession(oldToken, { email: "test@example.com" });
    globalThis.fetch = async () => {
      storage.saveSession(newToken, { email: "test@example.com" });
      return new Response(null, { status: 401 });
    };
    await assert.rejects(apiRequest("/api/products"));
    assert.equal(storage.getSession().token, newToken);

    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(apiRequest("/api/products"), /Failed to fetch/);
    assert.equal(storage.getSession().token, newToken);
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
