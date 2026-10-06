import { useCallback, useEffect, useRef, useState } from "react";
import { addressError, listAddresses } from "../services/addressService";
import { useCart } from "../context/CartContext";

export default function useCheckoutAddress(userId) {
  const { selectedAddressId, selectedAddress, selectCartAddress, refreshCart, cartError } = useCart();
  const [state, setState] = useState({ addresses: [], loading: !!userId, error: "" });
  const request = useRef(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState(previous => ({ ...previous, loading: true, error: "" }));
    try {
      const [addresses] = await Promise.all([listAddresses({ signal: controller.signal }), refreshCart()]);
      if (!controller.signal.aborted) setState({ addresses, loading: false, error: "" });
    } catch (failure) {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: addressError(failure) }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [userId, refreshCart]);

  useEffect(() => {
    refresh();
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      request.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  async function selectAddress(id) {
    if (!state.addresses.some(address => address.id === id)) return false;
    return selectCartAddress(id);
  }

  return { ...state, error: state.error || cartError, selectedId: selectedAddressId,
    selectedAddress: state.addresses.some(address => address.id === selectedAddressId) ? selectedAddress : null,
    message: "", refresh, selectAddress };
}
