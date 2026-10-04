import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getOrder, listOrders, ORDER_CHANGED_EVENT, orderError } from "../services/orderService";

export default function useOrders(filters, validationError = "") {
  const { sessionKey } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const query = JSON.stringify(filters);
  const key = JSON.stringify([query, revision, sessionKey]);
  useEffect(() => {
    const reload = () => setRevision(value => value + 1);
    window.addEventListener(ORDER_CHANGED_EVENT, reload);
    return () => window.removeEventListener(ORDER_CHANGED_EVENT, reload);
  }, []);
  useEffect(() => {
    if (validationError) return;
    const controller = new AbortController();
    listOrders({ ...JSON.parse(query), signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: orderError(error) }); });
    return () => controller.abort();
  }, [query, key, validationError]);
  return { data: result?.key === key && !validationError ? result.data : null,
    error: validationError || (result?.key === key ? result.error : null),
    loading: !validationError && result?.key !== key,
    reload: () => setRevision(value => value + 1) };
}

export function useOrder(id) {
  const { sessionKey } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const key = JSON.stringify([id, sessionKey, revision]);
  useEffect(() => {
    const controller = new AbortController();
    getOrder(id, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: orderError(error) }); });
    return () => controller.abort();
  }, [id, key]);
  return { order: result?.key === key ? result.data : null,
    error: result?.key === key ? result.error : null, loading: result?.key !== key,
    reload: () => setRevision(value => value + 1),
    replaceOrder: data => setResult({ key, data }) };
}
