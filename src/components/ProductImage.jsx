import { useEffect, useState } from "react";
import { apiRequest, apiUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ProductImage({ image, title = "Product", privateImage = false, className = "" }) {
  const { sessionKey } = useAuth();
  const [loaded, setLoaded] = useState(null);
  const [failed, setFailed] = useState("");
  const path = image?.url;
  const identity = `${path}:${privateImage}:${sessionKey}`;

  useEffect(() => {
    if (!path || !privateImage || !sessionKey) return;
    const controller = new AbortController();
    let objectUrl;
    apiRequest(path, { responseType: "blob", signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(data);
      setLoaded({ identity, url: objectUrl });
    }).catch(error => {
      if (error.name !== "AbortError") setFailed(identity);
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, privateImage, sessionKey, identity]);

  const src = path && (privateImage ? (loaded?.identity === identity ? loaded.url : null) : apiUrl(path));
  if (!src || failed === identity) return <div className={`image-placeholder ${className}`} role="img" aria-label={title}>
    {failed === identity ? "Image unavailable" : path ? "Loading image…" : "No image"}
  </div>;
  return <img className={className} src={src} alt={image.altText || title} loading="lazy" onError={() => setFailed(identity)} />;
}
