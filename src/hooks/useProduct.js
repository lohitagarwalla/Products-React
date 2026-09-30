import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getProduct, productError } from "../services/productService";

export default function useProduct(id) {
  const { sessionKey } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const key = `${id}:${sessionKey}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    getProduct(id, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: productError(error) });
    });
    return () => controller.abort();
  }, [id, key]);
  return { key, product: result?.key === key ? result.data : null,
    error: result?.key === key ? result.error : null, loading: result?.key !== key,
    reload: () => setRevision(value => value + 1) };
}
