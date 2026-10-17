// Manual browser test server only. No real accounts, database, or persistent writes.
// Run: node tests/fixture-server.mjs, then open http://localhost:5174.
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { orderFixture } from "./order-fixture.mjs";
import { cartFixture } from "./cart-fixture.mjs";
import { randomUUID } from "node:crypto";

const roleClaim = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const products = new Map();
const savedCarts = cartFixture(products);
const handleOrders = orderFixture(products, savedCarts.purchased);
const images = new Map();
let nextProduct = 1;
let nextImage = 1;
let failNextUpload = false;
const published = { id: nextProduct++, title: "Fixture headphones", brand: "Test brand", description: "An in-memory test product.", price: 1299.50, currency: "INR", isPublished: true, createdAt: new Date().toISOString(), images: [] };
products.set(published.id, published);
// Optional generated images let gallery checks run even when browser file access is disabled.
const draft = { ...published, id: nextProduct++, title: "Fixture draft gallery", isPublished: false, images: [] };
for (const name of ["product-workflow-front.png", "product-workflow-back.png"]) {
  try {
    const bytes = readFileSync(join(tmpdir(), name));
    const id = nextImage++;
    images.set(id, { id, type: "image/png", bytes });
    draft.images.push({ id, sortOrder: draft.images.length, altText: name, width: 240, height: 180, contentType: "image/png", size: bytes.length, url: `/api/images/${id}/content`, downloadUrl: `/api/images/${id}/download` });
  } catch { /* Image fixtures are optional. */ }
}
products.set(draft.id, draft);
const priceHistory = new Map();
let nextHistory = 1;
function recordPrice(product, previousPrice, userId, entryType) {
  const entries = priceHistory.get(product.id) || [];
  entries.unshift({ id: nextHistory++, productId: product.id, previousPrice, newPrice: product.price,
    changedByUserId: userId, changedByUserName: userId === "admin@example.test" ? "Fixture Admin" : null,
    changedAtUtc: new Date().toISOString(), entryType });
  priceHistory.set(product.id, entries);
}
for (const product of products.values()) recordPrice(product, null, null, "Baseline");
const token = email => `fixture.${Buffer.from(JSON.stringify({ sub: email, exp: Math.floor(Date.now() / 1000) + 3600, [roleClaim]: email === "admin@example.test" ? "Admin" : "User" })).toString("base64url")}.test-only`;
const refreshSessions = new Map();
const authData = email => ({ email, token: token(email),
  accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString() });

const server = await createServer({
  configFile: false,
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://localhost:5174") },
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [{ name: "isolated-product-fixture", configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, "http://localhost:5174");
      if (!url.pathname.startsWith("/api/")) return next();
      const send = (status, value) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(value === undefined ? undefined : JSON.stringify(value));
      };
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const json = () => JSON.parse(body.toString() || "{}");
        const path = url.pathname;
        const refreshId = req.headers.cookie?.split("; ").find(value => value.startsWith("fixture-refresh="))?.split("=")[1];
        const rotateCookie = email => {
          if (refreshId) refreshSessions.delete(refreshId);
          const id = randomUUID();
          refreshSessions.set(id, email);
          // Local fixture only; production cookie policy belongs to the real API.
          res.setHeader("Set-Cookie", `fixture-refresh=${id}; HttpOnly; SameSite=Lax; Path=/api/auth`);
        };
        if (path === "/api/auth/refresh" && req.method === "POST") {
          const email = refreshSessions.get(refreshId);
          if (!email) return send(401, { title: "No fixture session" });
          rotateCookie(email);
          return send(200, authData(email));
        }
        if (path === "/api/auth/logout" && req.method === "POST") {
          refreshSessions.delete(refreshId);
          res.setHeader("Set-Cookie", "fixture-refresh=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0");
          return send(204);
        }
        if (path === "/api/auth/login" && req.method === "POST") {
          const credentials = json();
          if (!["admin@example.test", "member@example.test"].includes(credentials.email) || credentials.password !== "Test123") return send(401, { title: "Use a fixture account and Test123" });
          rotateCookie(credentials.email);
          return send(200, authData(credentials.email));
        }
        let isAdmin = false; let userId = null;
        try { isAdmin = JSON.parse(Buffer.from(req.headers.authorization.split(".")[1], "base64url").toString())[roleClaim] === "Admin"; } catch { /* Anonymous request */ }
        try { userId = JSON.parse(Buffer.from(req.headers.authorization.split(".")[1], "base64url").toString()).sub; } catch { /* Anonymous */ }
        if (savedCarts.handle({ req, path, json, send, userId })) return;
        if (handleOrders({ req, path, url, json, send, userId, isAdmin })) return;
        const historyMatch = path.match(/^\/api\/products\/(\d+)\/price-history$/);
        if (historyMatch && req.method === "GET") {
          if (!isAdmin) return send(userId ? 403 : 401, { title: "Admin required" });
          const entries = priceHistory.get(Number(historyMatch[1]));
          if (!entries) return send(404, { title: "Product not found" });
          const page = Number(url.searchParams.get("page") || 1);
          const pageSize = Number(url.searchParams.get("pageSize") || 20);
          return send(200, { items: entries.slice((page - 1) * pageSize, page * pageSize), totalCount: entries.length, page, pageSize });
        }
        if ((req.method !== "GET" || path === "/api/products/manage") && !isAdmin) return send(req.headers.authorization ? 403 : 401, { title: "Admin required" });
        if (path === "/api/fixture/fail-next-upload" && req.method === "POST") { failNextUpload = true; return send(204); }
        if (path === "/api/products" || path === "/api/products/manage") {
          if (req.method === "GET") {
            const page = Number(url.searchParams.get("page") || 1);
            const pageSize = Number(url.searchParams.get("pageSize") || 12);
            const search = (url.searchParams.get("search") || "").toLowerCase();
            const items = [...products.values()].filter(p => (path.endsWith("manage") || p.isPublished) && `${p.title} ${p.brand}`.toLowerCase().includes(search)).reverse();
            return send(200, { items: items.slice((page - 1) * pageSize, page * pageSize), totalCount: items.length, page, pageSize });
          }
          if (req.method === "POST") {
            const input = json();
            const product = { ...input, id: nextProduct++, createdAt: new Date().toISOString(), images: [] };
            products.set(product.id, product);
            recordPrice(product, null, userId, "Created");
            return send(201, product);
          }
        }
        const content = path.match(/^\/api\/images\/(\d+)\/content$/);
        if (content) {
          const image = images.get(Number(content[1]));
          const product = image && [...products.values()].find(p => p.images.some(i => i.id === image.id));
          if (!product || (!product.isPublished && !isAdmin)) return send(404, { title: "Image not found" });
          res.setHeader("Content-Type", image.type); res.end(image.bytes); return;
        }
        const match = path.match(/^\/api\/products\/(\d+)(?:\/images(?:\/(order|\d+))?)?$/);
        if (!match) return send(404, { title: "Not found" });
        const product = products.get(Number(match[1]));
        if (!product || (req.method === "GET" && !product.isPublished && !isAdmin)) return send(404, { title: "Product not found" });
        if (!path.includes("/images")) {
          if (req.method === "GET") return send(200, product);
          if (req.method === "PUT") {
            const previousPrice = product.price;
            Object.assign(product, json());
            if (previousPrice !== product.price) recordPrice(product, previousPrice, userId, "PriceChanged");
            return send(200, product);
          }
          if (req.method === "DELETE") { products.delete(product.id); return send(204); }
        }
        if (req.method === "POST") {
          if (failNextUpload) { failNextUpload = false; return send(400, { detail: "Fixture upload failure. Retry this file." }); }
          if (product.images.length >= 10) return send(400, { title: "Maximum ten images" });
          const request = new Request("http://localhost:5174" + path, { method: "POST", headers: req.headers, body });
          const form = await request.formData();
          const file = form.get("file");
          if (!file?.size) return send(400, { title: "File is required" });
          const id = nextImage++;
          const image = { id, sortOrder: product.images.length, altText: form.get("altText") || "", width: 1, height: 1, contentType: file.type, size: file.size, url: `/api/images/${id}/content`, downloadUrl: `/api/images/${id}/download` };
          images.set(id, { id, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
          product.images.push(image); return send(201, image);
        }
        if (match[2] === "order") {
          product.images = json().imageIds.map((id, sortOrder) => ({ ...product.images.find(i => i.id === id), sortOrder }));
          return send(204);
        }
        const image = product.images.find(i => i.id === Number(match[2]));
        if (!image) return send(404, { title: "Image not found" });
        if (req.method === "PUT") { image.altText = json().altText; return send(204); }
        if (req.method === "DELETE") { product.images = product.images.filter(i => i.id !== image.id).map((i, sortOrder) => ({ ...i, sortOrder })); images.delete(image.id); return send(204); }
        return send(405, { title: "Method not allowed" });
      } catch (error) { send(500, { detail: error.message }); }
    });
  } }],
});
await server.listen();
console.log("Isolated test app: http://localhost:5174 — admin@example.test or member@example.test / Test123");
