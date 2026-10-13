import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

function AddressDetails({ address }) {
  return <div className="checkout-address-details">
    <p><strong>{address.recipientName}</strong>{", "}
      {[address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode, address.countryCode].filter(Boolean).join(", ")}
      {address.phoneNumber && <> · Phone: {address.phoneNumber}</>}
    </p>
  </div>;
}

function AddressSelector({ addresses, selectedId, loading, error, disabled, triggerRef, onRetry, onSelect, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const groupName = useId();
  const [draftId, setDraftId] = useState(selectedId);
  const validDraft = addresses.some(address => address.id === draftId);

  useEffect(() => {
    const element = dialog.current;
    const trigger = triggerRef.current;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [triggerRef]);

  return <dialog ref={dialog} className="checkout-address-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id={titleId}>Select delivery address</h2>
    {loading && <p role="status">Loading addresses…</p>}
    {error && <div role="alert"><p className="error-message">{error}</p><button type="button" className="btn btn-secondary" disabled={loading} onClick={onRetry}>Retry</button></div>}
    {!loading && !error && <fieldset className="checkout-address-options">
      <legend>Saved addresses</legend>
      {!addresses.length && <p>No saved addresses yet.</p>}
      {addresses.map(address => <label key={address.id} className="checkout-address-option">
        <input type="radio" name={groupName} value={address.id} checked={draftId === address.id}
          disabled={disabled} onChange={() => setDraftId(address.id)} />
        <div><p><strong>{address.label || "Address"}</strong>{address.isDefault && <span className="badge published">Default</span>}</p>
          <AddressDetails address={address} />
        </div>
      </label>)}
    </fieldset>}
    <div className="toolbar checkout-address-dialog-actions">
      <button type="button" className="btn btn-primary" disabled={disabled || loading || !!error || !validDraft}
        onClick={async () => { if (await onSelect(draftId)) onClose(); }}>Use this address</button>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <Link to="/profile">Manage addresses</Link>
    </div>
  </dialog>;
}

export default function CheckoutAddress({ isAuthenticated, userId, addressState, disabled }) {
  const [selecting, setSelecting] = useState(false);
  const trigger = useRef(null);
  const titleId = useId();
  const { addresses, selectedId, selectedAddress, loading, error, message, refresh, selectAddress } = addressState;

  function openSelector() {
    setSelecting(true);
    refresh();
  }

  return <section className="panel checkout-address" aria-labelledby={titleId}>
    <div className="checkout-address-heading">
      <h2 id={titleId}>Delivery address</h2>
      {isAuthenticated && userId && <button ref={trigger} type="button" className="btn btn-secondary" disabled={disabled || !addresses.length}
        onClick={openSelector}>{selectedAddress ? "Change address" : "Select address"}</button>}
    </div>
    {!isAuthenticated ? <p><Link to="/login" state={{ from: "/checkout" }}>Log in</Link> to view your saved addresses.</p>
      : !userId ? <p role="alert">Please log out and log in again to load your addresses.</p> : <>
        {loading && <p role="status">Loading addresses…</p>}
        {error && <div role="alert"><p className="error-message">{error}</p><button type="button" className="btn btn-secondary" disabled={disabled || loading} onClick={refresh}>Retry addresses</button></div>}
        {!loading && !error && <>
          {message && <p role="status">{message}</p>}
          {selectedAddress ? <>
            <p className="checkout-address-label"><strong>{selectedAddress.label || "Address"}</strong>{selectedAddress.isDefault && <span className="badge published">Default</span>}</p>
            <AddressDetails address={selectedAddress} />
          </> : addresses.length ? <p>Select a delivery address from your saved addresses.</p>
            : <p>No saved addresses yet. <Link to="/profile">Add an address</Link></p>}
        </>}
        <p className="muted checkout-address-notice">Your selection is saved with your cart. Delivery details are saved with your order when you place it.</p>
      </>}
    {selecting && <AddressSelector addresses={addresses} selectedId={selectedId} loading={loading} error={error}
      disabled={disabled} triggerRef={trigger} onRetry={refresh} onSelect={selectAddress} onClose={() => setSelecting(false)} />}
  </section>;
}
