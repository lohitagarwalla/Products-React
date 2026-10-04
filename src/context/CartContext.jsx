import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getProduct, productError } from "../services/productService";
import { fromMinor, toMinor } from "../services/money";
import { newRequestId, readCheckout } from "../services/checkoutStorage";
import { useAuth } from "./AuthContext";
import usePendingCheckout from "../hooks/usePendingCheckout";

const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const { user } = useAuth();
  const recovery = usePendingCheckout(user?.id);
  const locked = !!recovery.pending || !!recovery.error;
  const [cartInstance] = useState(newRequestId);
  const [cartRevision, setCartRevision] = useState(0);
  const revisionRef = useRef(0);
  const [cartItems, setCartItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cartError, setCartError] = useState("");
  const requestNumber = useRef(0);
  const cartIds = JSON.stringify(cartItems.map(item => item.id));

  function addToCart(product) {
    if (!product.isPublished || isLocked()) return;
    touchCart();
    setCartItems(items => items.some(item => item.id === product.id)
      ? items.map(item => item.id === product.id ? { ...item, quantity: Math.min(1000, item.quantity + 1), product, available: true } : item)
      : items.length >= 100 ? items : [...items, { id: product.id, quantity: 1, product, available: true }]);
  }

  function isLocked() {
    try { return !!readCheckout(user?.id); } catch { return true; }
  }

  function touchCart() {
    revisionRef.current += 1;
    setCartRevision(revisionRef.current);
  }

  const refreshCart = useCallback(async () => {
    const current = ++requestNumber.current;
    setRefreshing(true); setCartError("");
    try {
      const products = await Promise.all(JSON.parse(cartIds).map(async id => {
        try { return { id, product: await getProduct(id, { auth: false }) }; }
        catch (error) { if (error.status === 404) return { id, product: null }; throw error; }
      }));
      if (current !== requestNumber.current) return false;
      setCartItems(items => items.map(item => {
        const fresh = products.find(product => product.id === item.id);
        return fresh ? { ...item, product: fresh.product || item.product, available: !!fresh.product?.isPublished } : item;
      }));
      return products.every(item => item.product?.isPublished);
    } catch (error) {
      if (current === requestNumber.current) setCartError(productError(error));
      return false;
    } finally {
      if (current === requestNumber.current) setRefreshing(false);
    }
  }, [cartIds]);

  function removeFromCart(id) {
    if (isLocked()) return;
    touchCart();
    setCartItems(items => items.filter(item => item.id !== id));
  }
  function updateQuantity(id, quantity) {
    if (isLocked() || !Number.isInteger(quantity) || quantity > 1000) return;
    if (quantity <= 0) return removeFromCart(id);
    touchCart();
    setCartItems(items => items.map(item => item.id === id ? { ...item, quantity } : item));
  }
  function completeCheckout(pending) {
    // Check the current revision, including when an older request finishes after navigation.
    if (pending.cartInstance !== cartInstance || pending.cartRevision !== revisionRef.current) return;
    touchCart();
    setCartItems(items => items.map(item => ({ ...item,
      quantity: item.quantity - (pending.items.find(ordered => ordered.productId === item.id)?.quantity || 0),
    })).filter(item => item.quantity > 0));
  }
  const totals = cartItems.filter(item => item.available).reduce((result, item) => {
    result[item.product.currency] = fromMinor(toMinor(result[item.product.currency] || "0") + toMinor(item.product.price) * BigInt(item.quantity));
    return result;
  }, {});

  return <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity,
    totals, refreshCart, refreshing, cartError, locked, cartInstance, cartRevision, completeCheckout }}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
