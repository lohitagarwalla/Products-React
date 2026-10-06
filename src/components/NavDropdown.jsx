import { useEffect, useId, useRef, useState } from "react";

export default function NavDropdown({ label, children }) {
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
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(value => !value)}
      >
        <span>{label}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={menuId} className="admin-menu-dropdown" hidden={!open}>
        <div className="admin-menu-panel">
          {children(() => setOpen(false))}
        </div>
      </div>
    </div>
  );
}
