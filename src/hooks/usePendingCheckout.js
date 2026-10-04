import { useSyncExternalStore } from "react";
import { CHECKOUT_CHANGED_EVENT, readCheckout } from "../services/checkoutStorage";

function subscribe(callback) {
  window.addEventListener(CHECKOUT_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHECKOUT_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export default function usePendingCheckout(userId) {
  const snapshot = useSyncExternalStore(subscribe, () => {
    try { return JSON.stringify({ pending: readCheckout(userId) }); }
    catch { return JSON.stringify({ error: "Checkout recovery storage is unavailable. Enable browser storage before placing an order." }); }
  });
  return JSON.parse(snapshot);
}
