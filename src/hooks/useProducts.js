import { useEffect, useState } from "react";
import { listProducts, PRODUCT_CHANGED_EVENT, productError } from "../services/productService";
import { useAuth } from "../context/AuthContext";

export default function useProducts({ search, page, manage = false }) {
  const { sessionKey } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const key = JSON.stringify([search, page, manage, revision, sessionKey]);
  useEffect(() => {
    const reload = () => setRevision(value => value + 1);
    window.addEventListener(PRODUCT_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PRODUCT_CHANGED_EVENT, reload);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    listProducts({ search, page, manage, signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: productError(error) });
    });
    return () => controller.abort();
  }, [search, page, manage, key]);
  return { data: result?.key === key ? result.data : null,
    error: result?.key === key ? result.error : null, loading: result?.key !== key,
    reload: () => setRevision(value => value + 1) };
}
