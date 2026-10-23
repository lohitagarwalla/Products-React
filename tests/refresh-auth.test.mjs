import assert from "node:assert/strict";
import { test, before } from "node:test";
import vm from "node:vm";
import { build } from "vite";

let bundle;
before(async () => {
  const result = await build({ configFile: false, logLevel: "silent",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://localhost:7030") },
    build: { write: false, minify: false, lib: { entry: "tests/fixtures/auth-entry.js", formats: ["iife"], name: "AuthTest" } },
  });
  bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === "chunk").code;
});
const jwt = (label, seconds = 900) => `header.${Buffer.from(JSON.stringify({ sub: "alice", role: "User", label, exp: Math.floor(Date.now() / 1000) + seconds })).toString("base64url")}.signature`;
const authData = label => ({ token: jwt(label), email: "alice@example.test", firstName: "Alice",
  accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 604800000).toISOString() });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

// Separate JS realms model tab-local memory; only metadata, locks and messages are shared.
function browser(fetcher) {
  const values = new Map();
  const channels = [];
  let queue = Promise.resolve();
  let handler = fetcher;
  const requests = [];
  function tab() {
    const window = new EventTarget();
    window.navigator = { locks: { request: (_name, action) => {
      const result = queue.then(action);
      queue = result.catch(() => {});
      return result;
    } } };
    window.BroadcastChannel = class {
      constructor() { channels.push(this); }
      postMessage(data) {
        for (const target of channels) if (target !== this) queueMicrotask(() => target.onmessage?.({ data: structuredClone(data) }));
      }
    };
    const localStorage = {
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    };
    const context = vm.createContext({ window, localStorage, Event, Headers, Response, AbortSignal,
      TextDecoder, Uint8Array, atob, crypto: globalThis.crypto, setTimeout, clearTimeout,
      fetch: async (url, options) => { requests.push({ url, ...options }); return handler(url, options); },
    });
    vm.runInContext(bundle, context);
    return context.AuthTest;
  }
  return { tab, values, requests, setFetch: next => { handler = next; } };
}
function loginFixture(tab, label = "old") {
  const data = authData(label);
  tab.saveSession(data.token, { email: data.email }, data);
  return data;
}

test("login/register accept cookies, retain expiry and never persist tokens", async () => {
  const env = browser(() => json(authData("login")));
  env.values.set("shopHub.auth", "legacy-jwt");
  const tab = env.tab();
  await tab.authenticate("login", { email: "alice@example.test", password: "fixture" });
  const req = env.requests[0];
  assert.equal(req.credentials, "include");
  assert.equal(req.headers.has("Authorization"), false);
  assert.equal(tab.getSession().user.email, "alice@example.test");
  assert.equal(env.values.has("shopHub.auth"), false);
  assert.equal([...env.values.values()].join("").includes("signature"), false);
  await tab.authenticate("register", { email: "alice@example.test", password: "fixture" });
  assert.equal(env.requests[1].credentials, "include");
});

test("concurrent 401s share one refresh, preserve session identity and retry exact checkout payload", async () => {
  const renewed = authData("new");
  const env = browser((url, options) => url.endsWith("/refresh") ? json(renewed)
    : options.headers.get("Authorization") === `Bearer ${renewed.token}` ? json({ ok: true }) : json({}, 401));
  const tab = env.tab();
  loginFixture(tab);
  const id = tab.getSession().sessionKey;
  const payload = { requestId: "same-request", items: [{ productId: 1, quantity: 2 }], deliveryAddress: { city: "Bengaluru" } };
  const orderRequest = tab.apiRequest("/api/orders", { method: "POST", json: payload });
  payload.deliveryAddress.city = "Edited while waiting";
  const results = await Promise.all([orderRequest, tab.apiRequest("/api/cart")]);
  assert.equal(results.every(result => result.data.ok), true);
  assert.equal(env.requests.filter(req => req.url.endsWith("/refresh")).length, 1);
  const refresh = env.requests.find(req => req.url.endsWith("/refresh"));
  assert.equal(refresh.credentials, "include");
  assert.equal(refresh.headers.get("X-Refresh-Token"), "1");
  assert.equal(refresh.headers.has("Authorization"), false);
  assert.equal(refresh.body, undefined);
  const orders = env.requests.filter(req => req.url.endsWith("/orders"));
  assert.equal(orders.length, 2);
  assert.equal(orders[0].body, orders[1].body);
  assert.equal(JSON.parse(orders[1].body).deliveryAddress.city, "Bengaluru");
  assert.equal(tab.getSession().sessionKey, id);
});

test("two tabs serialize rotation, share fresh tokens and propagate logout", async () => {
  const renewed = authData("rotated");
  const env = browser(url => url.endsWith("/logout") ? json({ message: "done" }) : json(renewed));
  const a = env.tab(), b = env.tab();
  b.initializeAuthStorage();
  const old = loginFixture(a);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(b.getSession().token, old.token);
  await Promise.all([a.refreshSession(old.token), b.refreshSession(old.token)]);
  assert.equal(env.requests.length, 1);
  assert.equal(a.getSession().token, b.getSession().token);
  await b.logout();
  assert.equal(a.getSession(), null);
  assert.equal(b.getSession(), null);
  const count = env.requests.length;
  assert.equal(await a.restoreSession(), null);
  assert.equal(env.requests.length, count);
});

test("simultaneous startup in empty tabs restores once and gives both the same identity", async () => {
  const env = browser(() => json(authData("restored")));
  const a = env.tab(), b = env.tab();
  await Promise.all([a.restoreSession(), b.restoreSession()]);
  assert.equal(env.requests.length, 1);
  assert.equal(a.getSession().sessionKey, b.getSession().sessionKey);
});

test("refresh 401 ends session; a failed retry cannot recurse; 403 never refreshes", async () => {
  const env = browser(() => json({}, 401));
  const tab = env.tab();
  loginFixture(tab);
  await assert.rejects(tab.apiRequest("/api/cart"), error => error.status === 401);
  assert.equal(env.requests.length, 2);
  assert.equal(tab.getSession(), null);
  loginFixture(tab);
  env.setFetch(url => url.endsWith("/refresh") ? json(authData("new")) : json({}, 401));
  await assert.rejects(tab.apiRequest("/api/cart"), error => error.status === 401);
  assert.equal(env.requests.length, 5);
  assert.equal(tab.getSession(), null);
  loginFixture(tab);
  env.setFetch(() => json({}, 403));
  await assert.rejects(tab.apiRequest("/api/cart"), error => error.status === 403);
  assert.equal(env.requests.length, 6);
  assert.ok(tab.getSession());
});

test("lost refresh response and interrupted tab allow recovery on a later request or reload", async () => {
  const env = browser(() => { throw new TypeError("Failed to fetch"); });
  const tab = env.tab();
  const old = loginFixture(tab);
  await assert.rejects(tab.refreshSession(old.token), /Failed to fetch/);
  await assert.rejects(tab.refreshSession(old.token));
  const reloaded = env.tab();
  await assert.rejects(reloaded.restoreSession(), /Failed to fetch/);
  assert.equal(env.requests.length, 3);
  assert.equal(tab.authMetadata().blocked, false);
  assert.equal(tab.getSession().token, old.token);
  tab.setAuthMetadata({ id: "interrupted", pending: true });
  env.setFetch(() => json(authData("recovered")));
  await reloaded.restoreSession();
  assert.equal(reloaded.getAuthState().status, "authenticated");
  assert.equal(env.requests.length, 4);
});

test("logout during refresh clears immediately and cannot be undone by its response", async () => {
  const started = deferred(), response = deferred();
  const env = browser(url => {
    if (url.endsWith("/refresh")) { started.resolve(); return response.promise; }
    return json({ message: "logged out" });
  });
  const a = env.tab(), b = env.tab();
  b.initializeAuthStorage();
  const old = loginFixture(a);
  const refresh = a.refreshSession(old.token);
  const rejected = assert.rejects(refresh, /session changed/);
  await started.promise;
  const logout = b.logout();
  assert.equal(a.getSession(), null);
  response.resolve(json(authData("late")));
  await Promise.all([rejected, logout]);
  assert.equal(a.getSession(), null);
  assert.equal(b.getSession(), null);
  assert.equal(env.requests.at(-1).url.endsWith("/logout"), true);
});

test("old API response cannot refresh or replay under a newer login", async () => {
  const response = deferred(), started = deferred();
  const env = browser(() => { started.resolve(); return response.promise; });
  const tab = env.tab();
  loginFixture(tab);
  const pending = tab.apiRequest("/api/orders", { method: "POST", json: { requestId: "old" } });
  await started.promise;
  loginFixture(tab, "new-login");
  response.resolve(json({}, 401));
  await assert.rejects(pending, /session changed/);
  assert.equal(env.requests.length, 1);
  assert.equal(tab.getSession().token, jwt("new-login"));
});

test("near-expiry tokens refresh before request; cancelling a waiter does not cancel shared refresh", async () => {
  const started = deferred(), response = deferred();
  const env = browser(url => {
    if (url.endsWith("/refresh")) { started.resolve(); return response.promise; }
    return json({ ok: true });
  });
  const tab = env.tab();
  tab.saveSession(jwt("near", 2), { email: "alice@example.test" });
  const controller = new AbortController();
  const first = tab.apiRequest("/api/cart", { signal: controller.signal });
  const rejected = assert.rejects(first, error => error.name === "AbortError");
  const second = tab.apiRequest("/api/orders");
  await started.promise;
  controller.abort();
  response.resolve(json(authData("new")));
  await rejected;
  assert.equal((await second).data.ok, true);
  assert.equal(env.requests.length, 2);
});

test("failed logout stays signed out across reloads", async () => {
  const env = browser(() => { throw new TypeError("offline"); });
  const tab = env.tab();
  loginFixture(tab);
  await assert.rejects(tab.logout(), /offline/);
  assert.equal(tab.getSession(), null);
  assert.match(tab.authMetadata().message, /server logout/);
  assert.equal(await env.tab().restoreSession(), null);
  assert.equal(env.requests.length, 1);
});

test("refresh configuration failures and malformed success do not loop or erase an access session", async () => {
  for (const response of [() => json({}, 400), () => json({}, 403), () => json({ token: jwt("new") })]) {
    const env = browser(response);
    const tab = env.tab();
    const old = loginFixture(tab);
    await assert.rejects(tab.refreshSession(old.token));
    await assert.rejects(tab.refreshSession(old.token));
    assert.equal(env.requests.length, 1);
    assert.equal(tab.getSession().token, old.token);
    assert.equal(tab.authMetadata().blocked, true);
  }
});

test("late 401 reuses the current token and preserves multipart and binary behavior", async () => {
  const delayed = deferred();
  const renewed = authData("new");
  let businessCalls = 0;
  const env = browser((url, options) => {
    if (url.endsWith("/refresh")) return json(renewed);
    if (options.headers.get("Authorization") === `Bearer ${renewed.token}`) {
      return new Response(new Uint8Array([1, 2, 3]));
    }
    return ++businessCalls === 1 ? delayed.promise : json({}, 401);
  });
  const tab = env.tab();
  loginFixture(tab);
  const body = new FormData();
  body.set("file", new Blob(["image"]), "test.png");
  const first = tab.apiRequest("/api/images", { method: "POST", body, responseType: "blob" });
  await tab.apiRequest("/api/images", { responseType: "blob" });
  delayed.resolve(json({}, 401));
  const result = await first;
  assert.deepEqual([...new Uint8Array(await result.data.arrayBuffer())], [1, 2, 3]);
  assert.equal(env.requests.filter(req => req.url.endsWith("/refresh")).length, 1);
  const uploads = env.requests.filter(req => req.method === "POST" && req.url.endsWith("/images"));
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].body, uploads[1].body);
  assert.equal(uploads[1].headers.has("Content-Type"), false);
});

test("a refresh cannot change accounts inside an existing frontend session", async () => {
  const data = authData("other");
  data.token = `header.${Buffer.from(JSON.stringify({ sub: "bob", exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url")}.signature`;
  const env = browser(() => json(data));
  const tab = env.tab();
  const old = loginFixture(tab);
  await assert.rejects(tab.refreshSession(old.token), /another account/);
  assert.equal(tab.getSession().user.id, "alice");
  assert.equal(tab.authMetadata().blocked, true);
});

test("an uncertain login cannot restore an unconfirmed cookie into the previous session", async () => {
  const env = browser(() => json({ token: jwt("new") }));
  const tab = env.tab();
  loginFixture(tab);
  await assert.rejects(tab.authenticate("login", { email: "bob@example.test", password: "fixture" }), /expiry/);
  assert.equal(tab.getSession(), null);
  assert.equal(await env.tab().restoreSession(), null);
  assert.equal(env.requests.length, 1);
});

test("UI state follows restore, uncertain renewal, successful login and logout", async () => {
  const env = browser(() => json(authData("restored")));
  const tab = env.tab();
  const states = [];
  const unsubscribe = tab.subscribeAuth(() => states.push(tab.getAuthState().status));
  assert.equal(tab.getAuthState().status, "initializing");
  await tab.restoreSession();
  assert.equal(tab.getAuthState().status, "authenticated");
  const key = tab.getSession().sessionKey;
  assert.equal(tab.isCurrentSession(key), true);
  env.setFetch(() => { throw new TypeError("private diagnostic detail"); });
  await assert.rejects(tab.refreshSession(tab.getSession().token));
  assert.equal(tab.getAuthState().status, "authenticated");
  assert.equal(tab.getAuthState().error.code, "renewal_retryable");
  assert.equal(tab.isCurrentSession(key), true);
  assert.equal(tab.getAuthState().error.message.includes("private diagnostic"), false);
  env.setFetch(() => json(authData("login")));
  await tab.login({ email: "alice@example.test", password: "fixture" });
  assert.equal(tab.getAuthState().status, "authenticated");
  assert.equal(tab.getAuthState().error, null);
  assert.equal(tab.isCurrentSession(key), false);
  await tab.logout();
  assert.equal(tab.getAuthState().status, "anonymous");
  assert.equal(tab.isCurrentSession(""), false);
  unsubscribe();
  assert.ok(states.includes("authenticated"));
});

test("malformed metadata requires login without replaying an unknown refresh cookie", async () => {
  for (const value of ["{broken", "null", "[]", '"text"', '{"id":42}', '{"id":null,"pending":"false"}']) {
    const env = browser(() => json(authData("login")));
    env.values.set("shopHub.auth-state", value);
    const tab = env.tab();
    assert.equal(await tab.restoreSession(), null);
    assert.equal(env.requests.length, 0);
    assert.equal(tab.getAuthState().status, "reauthenticationRequired");
    assert.equal(tab.getAuthState().error.code, "storage_unavailable");
    await tab.login({ email: "alice@example.test", password: "fixture" });
    assert.equal(tab.getAuthState().status, "authenticated");
    assert.equal(tab.getAuthState().error, null);
  }
});

test("missing cookie restores anonymously and token renewal preserves authenticated state", async () => {
  const env = browser(() => json({}, 401));
  const tab = env.tab();
  await tab.restoreSession();
  assert.equal(tab.getAuthState().status, "anonymous");
  assert.equal(tab.getAuthState().error, null);
  env.setFetch(() => json(authData("login")));
  await tab.login({ email: "alice@example.test", password: "fixture" });
  const key = tab.getSession().sessionKey;
  const response = deferred(), started = deferred();
  env.setFetch(() => { started.resolve(); return response.promise; });
  const refresh = tab.refreshSession(tab.getSession().token);
  await started.promise;
  assert.equal(tab.getAuthState().status, "authenticated");
  response.resolve(json(authData("renewed")));
  await refresh;
  assert.equal(tab.getAuthState().status, "authenticated");
  assert.equal(tab.getSession().sessionKey, key);
});

test("server and network failures recover on the next API request without retrying in a loop", async () => {
  for (const failure of [() => json({}, 500), () => json({}, 502), () => json({}, 503),
    () => { throw new TypeError("offline"); }, () => { throw new DOMException("timeout", "TimeoutError"); }]) {
    const env = browser(() => json(authData("initial")));
    const tab = env.tab();
    await tab.restoreSession();
    env.setFetch(failure);
    await assert.rejects(tab.refreshSession(tab.getSession().token));
    assert.equal(tab.getAuthState().canRetry, true);
    assert.equal(tab.authMetadata().blocked, false);
    const count = env.requests.length;
    await assert.rejects(tab.apiRequest("/api/cart"));
    assert.equal(env.requests.length, count + 1);
    assert.equal(env.requests.at(-1).url.endsWith("/refresh"), true);
    env.setFetch(url => url.endsWith("/refresh") ? json(authData("recovered")) : json({ ok: true }));
    assert.equal((await tab.apiRequest("/api/cart")).data.ok, true);
    assert.equal(tab.getAuthState().error, null);
    assert.equal(env.requests.length, count + 3);
    env.setFetch(failure);
    await assert.rejects(tab.refreshSession(tab.getSession().token));
    const reloaded = env.tab();
    env.setFetch(() => json(authData("restored")));
    await reloaded.restoreSession();
    assert.equal(reloaded.getAuthState().status, "authenticated");
    assert.equal(reloaded.getAuthState().canRetry, false);
    assert.equal(reloaded.getAuthState().error, null);
    assert.equal(env.requests.length, count + 5);
  }
});

test("manual retry handles another 503, then 401 requires login", async () => {
  const env = browser(() => json({}, 503));
  const tab = env.tab();
  const old = loginFixture(tab);
  await assert.rejects(tab.refreshSession(old.token));
  await assert.rejects(tab.retrySession());
  assert.equal(tab.getAuthState().canRetry, true);
  assert.equal(env.requests.length, 2);
  env.setFetch(() => json({}, 401));
  await assert.rejects(tab.retrySession());
  assert.equal(tab.getSession(), null);
  assert.equal(tab.getAuthState().canRetry, false);
  await assert.rejects(tab.retrySession());
  assert.equal(env.requests.length, 3);
});

test("manual retry cannot bypass rejected, malformed, legacy or signed-out states", async () => {
  for (const failure of [() => json({}, 400), () => json({}, 403), () => json({}, 429),
    () => json({ token: jwt("invalid-response") })]) {
    const env = browser(failure);
    const tab = env.tab();
    const old = loginFixture(tab);
    await assert.rejects(tab.refreshSession(old.token));
    assert.equal(tab.getAuthState().canRetry, false);
    await assert.rejects(tab.retrySession());
    assert.equal(env.requests.length, 1);
  }
  const env = browser(() => json(authData("unexpected")));
  const tab = env.tab();
  tab.blockRefresh("Old uncertain failure", "renewal_uncertain");
  await assert.rejects(tab.retrySession());
  tab.clearSession();
  await assert.rejects(tab.retrySession());
  assert.equal(env.requests.length, 0);
});

test("double clicks and simultaneous tab retries send only one attempt per failure", async () => {
  for (const succeeds of [true, false]) {
    const env = browser(() => json({}, 503));
    const a = env.tab(), b = env.tab();
    b.initializeAuthStorage();
    const old = loginFixture(a);
    await assert.rejects(a.refreshSession(old.token));
    const started = deferred(), response = deferred();
    env.setFetch(() => { started.resolve(); return response.promise; });
    const attempts = Promise.allSettled([a.retrySession(), a.retrySession(), b.retrySession()]);
    await started.promise;
    assert.equal(a.getAuthState().retrying, true);
    response.resolve(succeeds ? json(authData("recovered")) : json({}, 503));
    await attempts;
    assert.equal(env.requests.length, 2);
    assert.equal(a.getAuthState().retrying, false);
    assert.equal(a.getAuthState().canRetry, !succeeds);
    assert.equal(b.getAuthState().canRetry, !succeeds);
  }
});

test("logout or a new login during manual retry cannot be overwritten", async () => {
  for (const change of ["logout", "login"]) {
    const env = browser(() => json({}, 503));
    const tab = env.tab();
    const old = loginFixture(tab);
    await assert.rejects(tab.refreshSession(old.token));
    const started = deferred(), response = deferred();
    env.setFetch(url => {
      if (url.endsWith("/refresh")) { started.resolve(); return response.promise; }
      return json({ message: "done" });
    });
    const retry = assert.rejects(tab.retrySession(), /session changed/);
    await started.promise;
    const logout = change === "logout" ? tab.logout() : Promise.resolve(loginFixture(tab, "new-login"));
    response.resolve(json(authData("late")));
    await Promise.all([retry, logout]);
    assert.equal(tab.getSession()?.token ?? null, change === "logout" ? null : jwt("new-login"));
  }
});

test("a tab opened during manual retry waits for its result without marking it interrupted", async () => {
  const env = browser(() => json({}, 503));
  const a = env.tab();
  const old = loginFixture(a);
  await assert.rejects(a.refreshSession(old.token));
  const started = deferred(), response = deferred();
  env.setFetch(() => { started.resolve(); return response.promise; });
  const retry = a.retrySession();
  await started.promise;
  const b = env.tab();
  const restore = b.restoreSession();
  response.resolve(json(authData("recovered")));
  await Promise.all([retry, restore]);
  assert.equal(b.getAuthState().status, "authenticated");
  assert.equal(env.requests.length, 2);
});

test("automatic recovery receiving 401 ends the session without calling the business endpoint", async () => {
  const env = browser(() => json({}, 503));
  const tab = env.tab();
  const old = loginFixture(tab);
  await assert.rejects(tab.refreshSession(old.token));
  env.setFetch(() => json({}, 401));
  await assert.rejects(tab.apiRequest("/api/cart"), error => error.status === 401);
  assert.equal(env.requests.length, 2);
  assert.ok(env.requests.every(req => req.url.endsWith("/refresh")));
  assert.equal(tab.getSession(), null);
  const count = env.requests.length;
  await tab.restoreSession();
  assert.equal(env.requests.length, count);
});

test("previously saved retryable and interrupted blocks recover automatically on reload", async () => {
  for (const code of ["renewal_retryable", "renewal_interrupted"]) {
    const env = browser(() => json(authData("recovered")));
    const tab = env.tab();
    tab.setAuthMetadata({ id: "old-session", blocked: true, pending: false, code,
      failureId: "old-failure", message: "Previous policy blocked refresh" });
    await tab.restoreSession();
    assert.equal(tab.getAuthState().status, "authenticated");
    assert.equal(tab.authMetadata().blocked, false);
    assert.equal(env.requests.length, 1);
  }
});

test("concurrent automatic recovery shares one failed rotation across tabs", async () => {
  const env = browser(() => json({}, 503));
  const a = env.tab(), b = env.tab();
  b.initializeAuthStorage();
  const old = loginFixture(a);
  await assert.rejects(a.refreshSession(old.token));
  const started = deferred(), response = deferred();
  env.setFetch(() => { started.resolve(); return response.promise; });
  const attempts = Promise.allSettled([a.apiRequest("/api/cart"), a.apiRequest("/api/orders"), b.apiRequest("/api/cart")]);
  await started.promise;
  response.resolve(json({}, 503));
  const results = await attempts;
  assert.ok(results.every(result => result.status === "rejected"));
  assert.equal(env.requests.length, 2);
  assert.equal(a.authMetadata().blocked, false);
  env.setFetch(url => url.endsWith("/refresh") ? json(authData("recovered")) : json({ ok: true }));
  assert.equal((await a.apiRequest("/api/cart")).data.ok, true);
  assert.equal(env.requests.length, 4);
});
