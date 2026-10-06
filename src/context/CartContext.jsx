import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as carts from "../services/cartService";
import { getSession } from "../services/authStorage";
import { fromMinor, toMinor } from "../services/money";
import { readCheckout } from "../services/checkoutStorage";
import { useAuth } from "./AuthContext";
import usePendingCheckout from "../hooks/usePendingCheckout";

const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const { sessionKey } = useAuth();
  return <SavedCart key={sessionKey} sessionKey={sessionKey}>{children}</SavedCart>;
}

function SavedCart({ children, sessionKey }) {
  const { user } = useAuth();
  const recovery = usePendingCheckout(user?.id);
  const [cart, setCart] = useState(null);
  const [refreshing, setRefreshing] = useState(!!user?.id);
  const [saving, setSaving] = useState(false);
  const [cartError, setCartError] = useState("");
  const inFlight = useRef(false);
  const readRequest = useRef(null);
  const active = useRef(true);
  const currentSession = () => active.current && getSession()?.token === sessionKey;

  const refreshCart = useCallback(async () => {
    if (!user?.id || inFlight.current) return false;
    readRequest.current?.abort();
    const controller = new AbortController();
    readRequest.current = controller;
    setRefreshing(true);
    setCartError("");
    try {
      const result = await carts.getCart({ signal: controller.signal });
      if (controller.signal.aborted || !active.current || getSession()?.token !== sessionKey) return false;
      setCart(result);
      return true;
    } catch (failure) {
      if (!controller.signal.aborted && active.current && getSession()?.token === sessionKey) setCartError(carts.cartError(failure));
      return false;
    } finally {
      if (readRequest.current === controller) {
        readRequest.current = null;
        if (active.current) setRefreshing(false);
      }
    }
  }, [user?.id, sessionKey]);

  useEffect(() => {
    active.current = true;
    refreshCart();
    const onFocus = () => { if (document.visibilityState === "visible") refreshCart(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active.current = false;
      readRequest.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshCart]);

  async function mutate(action) {
    if (!user?.id || !cart || inFlight.current || readRequest.current || cartError || !currentSession()) return false;
    try { if (readCheckout(user.id)) return false; } catch { return false; }
    inFlight.current = true;
    setSaving(true);
    try {
      const result = await action();
      if (!currentSession()) return false;
      setCart(result);
      setCartError("");
      return true;
    } catch (failure) {
      if (currentSession()) setCartError(`${carts.cartError(failure)} Reload the cart before making further changes.`);
      return false;
    } finally {
      inFlight.current = false;
      if (currentSession()) setSaving(false);
    }
  }

  const cartItems = cart?.items ?? [];
  function addToCart(product) {
    if (!product.isPublished) return Promise.resolve(false);
    const item = cartItems.find(item => item.id === product.id);
    if (item?.quantity >= 1000 || (!item && cartItems.length >= 100)) return Promise.resolve(false);
    return mutate(() => carts.setCartItem(product.id, (item?.quantity ?? 0) + 1));
  }
  const removeFromCart = id => mutate(() => carts.removeCartItem(id));
  function updateQuantity(id, quantity) {
    if (!Number.isInteger(quantity) || quantity > 1000) return Promise.resolve(false);
    return quantity <= 0 ? removeFromCart(id) : mutate(() => carts.setCartItem(id, quantity));
  }
  const totals = cartItems.filter(item => item.available).reduce((result, item) => {
    const currency = item.product.currency;
    result[currency] = fromMinor(toMinor(result[currency] || "0") + toMinor(item.product.price) * BigInt(item.quantity));
    return result;
  }, {});
  const locked = !!recovery.pending || !!recovery.error || saving || refreshing || !!cartError || (!!user && !cart);
  return <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity,
    clearCart: () => mutate(carts.clearCart), selectCartAddress: id => mutate(() => carts.setCartAddress(id)),
    selectedAddressId: cart?.selectedAddressId ?? null, selectedAddress: cart?.selectedAddress ?? null,
    totals, refreshCart, refreshing, saving, cartError, locked }}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
