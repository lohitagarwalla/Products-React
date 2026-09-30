import { useEffect, useRef, useState } from "react";
import ProductImage from "./ProductImage";
import { uploadImage, deleteImage, updateImage, reorderImages, productError } from "../services/productService";

// Match the current .NET ImageStorage configuration; the API remains authoritative.
const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

export default function ProductImageManager({ product, setProduct, busy, runAction }) {
  const [queue, setQueue] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  const uploadController = useRef(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const patchQueue = (id, patch) => setQueue(items => items.map(item => item.id === id ? { ...item, ...patch } : item));

  function selectFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setSelectionError("");
    const waiting = queue.filter(item => item.status !== "uploaded").length;
    if (product.images.length + waiting + files.length > MAX_IMAGES) {
      setSelectionError(`A product can have at most ${MAX_IMAGES} images, including queued files.`); return;
    }
    const invalid = files.find(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > MAX_BYTES);
    if (invalid) {
      setSelectionError(`${invalid.name}: choose a non-empty JPEG, PNG, or WebP file up to 5 MiB.`); return;
    }
    setQueue(items => [...items, ...files.map(file => ({ id: crypto.randomUUID(), file, altText: "", status: "pending" }))]);
  }

  async function upload(items) {
    await runAction(async () => {
      const controller = new AbortController();
      uploadController.current = controller;
      for (const item of items) {
        if (controller.signal.aborted) break;
        patchQueue(item.id, { status: "uploading", error: "" });
        try {
          const image = await uploadImage(product.id, item.file, item.altText, controller.signal);
          if (controller.signal.aborted) break;
          setProduct(current => ({ ...current, images: [...current.images, image] }));
          patchQueue(item.id, { status: "uploaded" });
        } catch (error) {
          if (controller.signal.aborted) break;
          patchQueue(item.id, { status: "failed", error: productError(error) });
          if ([401, 403, 404, 409].includes(error.status)) break;
        }
      }
    });
  }

  async function move(imageId, offset) {
    const images = [...product.images];
    const index = images.findIndex(image => image.id === imageId);
    [images[index], images[index + offset]] = [images[index + offset], images[index]];
    await runAction(async () => {
      await reorderImages(product.id, images.map(image => image.id));
      setProduct(current => ({ ...current, images: images.map((image, sortOrder) => ({ ...image, sortOrder })) }));
    }, "Image order saved.");
  }

  async function remove(image) {
    if (!window.confirm("Remove this image from the product?")) return;
    await runAction(async () => {
      await deleteImage(product.id, image.id);
      setProduct(current => ({ ...current, images: current.images.filter(item => item.id !== image.id).map((item, sortOrder) => ({ ...item, sortOrder })) }));
    }, "Image removed.");
  }

  const pending = queue.filter(item => item.status === "pending");
  return <section className="panel" aria-labelledby="product-images-title">
    <h2 id="product-images-title">Images ({product.images.length}/{MAX_IMAGES})</h2>
    <p className="muted">The first image is the cover. JPEG, PNG, or WebP; up to 5 MiB each, 6000 pixels per side and 16 million pixels total. Animated images are not supported.</p>
    <fieldset disabled={busy} className="form-fieldset">
      <label className="form-label" htmlFor="product-files">Add images</label>
      <input id="product-files" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={selectFiles} disabled={busy || product.images.length >= MAX_IMAGES} />
      {selectionError && <p className="error-message" role="alert">{selectionError}</p>}
      {!!queue.length && <div className="upload-queue">
        {queue.map(item => <div key={item.id} className="upload-row">
          <LocalPreview file={item.file} />
          <div className="upload-info"><strong>{item.file.name}</strong><p role="status">{item.status}</p>
            {item.status !== "uploaded" && <label>Alt text<input className="form-input" maxLength={250} value={item.altText} onChange={event => patchQueue(item.id, { altText: event.target.value })} /></label>}
            {item.error && <p className="form-error" role="alert">{item.error} If the connection was interrupted, reload saved images before retrying to avoid a duplicate.</p>}
          </div>
          {item.status === "failed" && <button type="button" className="btn btn-secondary" onClick={() => upload([item])}>Retry</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setQueue(items => items.filter(entry => entry.id !== item.id))}>{item.status === "uploaded" ? "Dismiss" : "Remove from queue"}</button>
        </div>)}
        <button type="button" className="btn btn-primary" disabled={!pending.length || busy} onClick={() => upload(pending)}>Upload {pending.length} pending image{pending.length === 1 ? "" : "s"}</button>
      </div>}
      <div className="image-grid">{product.images.map((image, index) => <article key={image.id} className="image-card">
        <ProductImage image={image} title={product.title} privateImage={!product.isPublished} className="managed-image" />
        <p>{index === 0 ? "Cover image" : `Image ${index + 1}`}</p>
        <form onSubmit={event => {
          event.preventDefault();
          const altText = new FormData(event.currentTarget).get("altText").trim();
          runAction(async () => {
            await updateImage(product.id, image.id, altText);
            setProduct(current => ({ ...current, images: current.images.map(item => item.id === image.id ? { ...item, altText } : item) }));
          }, "Alt text saved.");
        }}>
          <label className="form-label" htmlFor={`alt-${image.id}`}>Alt text</label>
          <input className="form-input" id={`alt-${image.id}`} name="altText" maxLength={250} defaultValue={image.altText} />
          <button className="btn btn-secondary btn-small" type="submit">Save alt text</button>
        </form>
        <div className="toolbar">
          <button type="button" className="btn btn-secondary btn-small" disabled={busy || index === 0} onClick={() => move(image.id, -1)}>Move earlier</button>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy || index === product.images.length - 1} onClick={() => move(image.id, 1)}>Move later</button>
          <button type="button" className="btn btn-danger btn-small" onClick={() => remove(image)}>Remove image</button>
        </div>
      </article>)}</div>
    </fieldset>
  </section>;
}

function LocalPreview({ file }) {
  const ref = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={ref} alt={`Preview of ${file.name}`} className="list-image" />;
}
