// Disposable browser fixture matching the current saved-cart contract.
export function cartFixture(products) {
  const carts = new Map();
  const addresses = new Map();
  let loseResponse = process.env.CART_FIXTURE_LOST_RESPONSE === "1";
  const getAddresses = userId => {
    if (!addresses.has(userId)) addresses.set(userId, [{ id: addresses.size + 1, label: "Home", recipientName: "Fixture Customer",
      addressLine1: "1 Test Street", addressLine2: null, city: "Bengaluru", state: "Karnataka", postalCode: "560001",
      countryCode: "IN", isDefault: true, rowVersion: "AAAAAAAAAAE=" }]);
    return addresses.get(userId);
  };
  const getCart = userId => {
    if (!carts.has(userId)) carts.set(userId, { id: carts.size + 1, selectedAddressId: null, items: new Map() });
    return carts.get(userId);
  };
  const dto = userId => {
    const cart = getCart(userId);
    return { id: cart.id, selectedAddressId: cart.selectedAddressId,
      selectedAddress: getAddresses(userId).find(address => address.id === cart.selectedAddressId) ?? null,
      items: [...cart.items].map(([productId, quantity]) => {
        const product = products.get(productId);
        const available = !!product?.isPublished;
        return { productId, quantity, available, productTitle: available ? product.title : null,
          unitPrice: available ? product.price : null, currency: available ? product.currency : null, imageUrl: null };
      }) };
  };
  return {
    findAddress(userId, addressId) { return getAddresses(userId).find(address => address.id === addressId); },
    purchased(userId, items) {
      const cart = getCart(userId);
      for (const item of items) cart.items.delete(item.productId);
      cart.selectedAddressId = getAddresses(userId).find(address => address.isDefault)?.id ?? null;
    },
    handle({ req, path, json, send, userId }) {
      if (!path.startsWith("/api/cart") && path !== "/api/profile/addresses") return false;
      if (!userId) { send(401, { title: "Log in" }); return true; }
      if (path === "/api/profile/addresses") { send(200, getAddresses(userId)); return true; }
      const cart = getCart(userId);
      const match = path.match(/^\/api\/cart\/items\/(\d+)$/);
      if (match && req.method === "PUT") {
        const id = Number(match[1]); const { quantity } = json();
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) { send(400, { detail: "Invalid quantity" }); return true; }
        if (!products.get(id)?.isPublished) { send(404, { detail: "Unavailable" }); return true; }
        cart.items.set(id, quantity);
        if (loseResponse) { loseResponse = false; send(503, { detail: "Fixture: cart saved but confirmation unavailable." }); return true; }
      } else if (match && req.method === "DELETE") cart.items.delete(Number(match[1]));
      else if (path === "/api/cart/items" && req.method === "DELETE") cart.items.clear();
      else if (path === "/api/cart/address" && req.method === "PUT") {
        const { addressId } = json();
        if (addressId !== null && !getAddresses(userId).some(address => address.id === addressId)) { send(404, { detail: "Address unavailable" }); return true; }
        cart.selectedAddressId = addressId;
      } else if (path !== "/api/cart" || req.method !== "GET") { send(404, {}); return true; }
      send(200, dto(userId));
      return true;
    },
  };
}
