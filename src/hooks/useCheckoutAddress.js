import { useCallback, useEffect, useRef, useState } from "react";
import { addressError, listAddresses } from "../services/addressService";
import { reconcileAddressSelection } from "../services/checkoutAddress";

// CheckoutContent is keyed by sessionKey: account changes discard all address state.
export default function useCheckoutAddress(userId) {
  const [state, setState] = useState({ addresses: [], selectedId: null, initialized: false, loading: !!userId, error: "", message: "" });
  const request = useRef(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState(previous => ({ ...previous, loading: true, error: "" }));
    try {
      const addresses = await listAddresses({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setState(previous => {
        const selectedId = reconcileAddressSelection(addresses, previous.selectedId, previous.initialized);
        return { addresses, selectedId, initialized: true, loading: false, error: "",
          message: previous.selectedId !== null && selectedId === null ? "Your selected address is no longer available. Please select another address." : "" };
      });
    } catch (failure) {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: addressError(failure) }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [userId]);

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

  function selectAddress(id) {
    setState(previous => previous.addresses.some(address => address.id === id)
      ? { ...previous, selectedId: id, message: "" } : previous);
  }

  return { ...state, selectedAddress: state.addresses.find(address => address.id === state.selectedId) ?? null, refresh, selectAddress };
}
