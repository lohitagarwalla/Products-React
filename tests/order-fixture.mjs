// Disposable in-memory browser fixture; never used by the application build.
export function orderFixture(products, purchased = () => {}) {
  const orders = new Map();
  const requests = new Map();
  let nextId = 1;
  let loseResponse = process.env.ORDER_FIXTURE_LOST_RESPONSE === "1";
  let conflict = process.env.ORDER_FIXTURE_CONFLICT === "1";
  const version = order => Buffer.from(String(order.statusHistory.length).padStart(8, "0")).toString("base64");
  return ({ req, path, url, json, send, userId, isAdmin }) => {
    if (!path.startsWith("/api/orders")) return false;
    if (!userId) { send(401, { title: "Log in" }); return true; }
    const respond = (status, body) => { send(status, body); return true; };
    if (path === "/api/orders" && req.method === "POST") {
      const input = json();
      const key = `${userId}:${input.requestId}`;
      if (!input.deliveryAddress) return respond(400, { detail: "Delivery address required." });
      const signature = JSON.stringify({ items: [...input.items].sort((a, b) => a.productId - b.productId), deliveryAddress: input.deliveryAddress });
      if (requests.has(key)) {
        const prior = requests.get(key);
        return prior.signature === signature ? respond(200, orders.get(prior.id)) : respond(409, { detail: "Request ID already used with different items." });
      }
      if (input.items.some(item => !products.get(item.productId)?.isPublished)) return respond(400, { detail: "Product unavailable." });
      const now = new Date().toISOString();
      const order = { id: nextId++, orderNumber: `ORD-FIXTURE-${String(nextId - 1).padStart(5, "0")}`, userId,
        status: "Placed", currency: "INR", deliveryAddress: structuredClone(input.deliveryAddress), createdAt: now, shippedAt: null, deliveredAt: null, cancelledAt: null,
        cancelledByUserId: null, cancellationReason: null,
        items: input.items.map((item, index) => ({ id: index + 1, productId: item.productId, quantity: item.quantity,
          productTitle: products.get(item.productId).title, unitPrice: products.get(item.productId).price,
          lineTotal: products.get(item.productId).price * item.quantity, imageUrl: null })),
        statusHistory: [{ id: 1, previousStatus: null, newStatus: "Placed", changedByUserId: userId, changedAtUtc: now, reason: null }] };
      order.totalAmount = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
      order.rowVersion = version(order);
      orders.set(order.id, order); requests.set(key, { id: order.id, signature });
      purchased(userId, input.items);
      if (loseResponse) { loseResponse = false; return respond(503, { detail: "Fixture: order committed but confirmation unavailable. Retry the same request." }); }
      return respond(201, order);
    }
    if (path === "/api/orders" || path === "/api/orders/manage") {
      if (path.endsWith("manage") && !isAdmin) return respond(403, { title: "Admin required" });
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const status = url.searchParams.get("status");
      const from = url.searchParams.get("fromUtc"); const to = url.searchParams.get("toUtc");
      const items = [...orders.values()].reverse().filter(order => (path.endsWith("manage") || order.userId === userId)
        && (!status || order.status === status) && (!from || order.createdAt >= from) && (!to || order.createdAt < to)
        && `${order.orderNumber} ${order.items.map(item => item.productTitle).join(" ")}`.toLowerCase().includes(search));
      const page = Number(url.searchParams.get("page") || 1); const pageSize = Number(url.searchParams.get("pageSize") || 20);
      return respond(200, { items: items.slice((page - 1) * pageSize, page * pageSize).map(order => ({ ...order, totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0) })), totalCount: items.length, page, pageSize });
    }
    const match = path.match(/^\/api\/orders\/(\d+)(?:\/(ship|deliver|cancel))?$/);
    const order = match && orders.get(Number(match[1]));
    if (!order || (!isAdmin && order.userId !== userId)) return respond(404, { title: "Order not found" });
    if (!match[2]) return respond(200, order);
    const action = match[2]; const input = json();
    if (action !== "cancel" && !isAdmin) return respond(403, { title: "Admin required" });
    if (conflict) { conflict = false; return respond(409, { detail: "Fixture concurrency conflict." }); }
    const target = { ship: "Shipped", deliver: "Delivered", cancel: "Cancelled" }[action];
    if (order.status === target) return respond(200, order);
    if (input.rowVersion !== order.rowVersion || !({ Placed: ["ship", "cancel"], Shipped: ["deliver", "cancel"] }[order.status] || []).includes(action)) return respond(409, { detail: "Order changed." });
    const now = new Date().toISOString();
    order.statusHistory.push({ id: order.statusHistory.length + 1, previousStatus: order.status, newStatus: target, changedByUserId: userId, changedAtUtc: now, reason: action === "cancel" ? input.reason : null });
    order.status = target; order.rowVersion = version(order);
    order[{ ship: "shippedAt", deliver: "deliveredAt", cancel: "cancelledAt" }[action]] = now;
    if (action === "cancel") { order.cancelledByUserId = userId; order.cancellationReason = input.reason; }
    return respond(200, order);
  };
}
