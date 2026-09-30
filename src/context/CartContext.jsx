import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getProduct, productError } from "../services/productService";

const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cartError, setCartError] = useState("");
  const requestNumber = useRef(0);
  const cartIds = JSON.stringify(cartItems.map(item => item.id));

  function addToCart(product) {
    if (!product.isPublished) return;
    setCartItems(items => items.some(item => item.id === product.id)
      ? items.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1, product, available: true } : item)
      : [...items, { id: product.id, quantity: 1, product, available: true }]);
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

  function removeFromCart(id) { setCartItems(items => items.filter(item => item.id !== id)); }
  function updateQuantity(id, quantity) {
    if (quantity <= 0) return removeFromCart(id);
    setCartItems(items => items.map(item => item.id === id ? { ...item, quantity } : item));
  }
  function clearCart() { setCartItems([]); }
  const totals = cartItems.filter(item => item.available).reduce((result, item) => {
    result[item.product.currency] = (result[item.product.currency] || 0) + item.product.price * item.quantity;
    return result;
  }, {});

  return <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity,
    clearCart, totals, refreshCart, refreshing, cartError }}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
