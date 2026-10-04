import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function closeOutside(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div
      className="admin-menu"
      ref={containerRef}
      onPointerEnter={event => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={event => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === "Escape") {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        type="button"
        className="admin-menu-toggle"
        ref={buttonRef}
        aria-label="Admin navigation"
        aria-expanded={open}
        aria-controls={menuId}
        title="Admin navigation"
        onClick={() => setOpen(value => !value)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={menuId} className="admin-menu-dropdown" hidden={!open}>
        <div className="admin-menu-panel">
          <Link to="/admin/products" onClick={() => setOpen(false)}>Manage products</Link>
          <Link to="/admin/orders" onClick={() => setOpen(false)}>Manage orders</Link>
        </div>
      </div>
    </div>
  );
}
