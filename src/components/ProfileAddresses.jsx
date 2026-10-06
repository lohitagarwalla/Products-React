import { useCallback, useEffect, useRef, useState } from "react";
import AddressForm from "./AddressForm";
import { addressError, createAddress, deleteAddress, getAddress, listAddresses, makeDefaultAddress, updateAddress } from "../services/addressService";

export default function ProfileAddresses() {
  const [visible, setVisible] = useState(false);
  const [addresses, setAddresses] = useState(null);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState(null);
  const [formError, setFormError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [discardAction, setDiscardAction] = useState(null);
  const request = useRef(null);
  const dirty = useRef(false);
  const revision = useRef(0);
  const onDirtyChange = useCallback(value => { dirty.current = value; }, []);

  useEffect(() => () => request.current?.abort(), []);

  async function runRequest(action, name = "load", forForm = false) {
    // Guard repeated clicks before React renders the busy state.
    if (request.current || discardAction) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setOperation(name);
    setError("");
    setMessage("");
    if (forForm) setFormError(null);
    try {
      await action(controller.signal);
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (forForm) {
          setFormError({ message: failure.status == null && name === "save" && !editor?.address
            ? "The save result could not be confirmed. Check your saved addresses before trying to add it again."
            : addressError(failure), data: failure.data,
            uncertainCreate: failure.status == null && name === "save" && !editor?.address });
          if (editor?.address && (failure.status === 409 || failure.status === 404)) setConflict(true);
        } else setError(addressError(failure));
      }
    } finally {
      if (!controller.signal.aborted) { setBusy(false); setOperation(""); }
      if (request.current === controller) request.current = null;
    }
  }

  function closeEditor() {
    dirty.current = false;
    setEditor(null);
    setFormError(null);
    setConflict(false);
    setDiscardAction(null);
  }

  function discardOrRun(action) {
    if (editor && dirty.current) setDiscardAction(() => action);
    else action();
  }

  function load() {
    return runRequest(async signal => {
      const data = await listAddresses({ signal });
      if (!signal.aborted) setAddresses(data);
    });
  }

  function toggleAddresses() {
    if (request.current) return;
    discardOrRun(() => {
      if (visible && editor) closeEditor();
      setVisible(!visible);
      if (!visible && addresses === null) load();
    });
  }

  function openEditor(address = null) {
    if (request.current) return;
    discardOrRun(() => {
      dirty.current = false;
      setFormError(null);
      setConflict(false);
      setError("");
      setMessage("");
      setVisible(true);
      setEditor({ address, revision: ++revision.current });
      if (addresses === null) load();
    });
  }

  function cancelEditor() {
    if (!request.current) discardOrRun(closeEditor);
  }

  async function refreshAfterWrite(signal, successMessage) {
    if (signal.aborted) return;
    setAddresses(null);
    setMessage(successMessage);
    try {
      const data = await listAddresses({ signal });
      if (!signal.aborted) setAddresses(data);
    } catch (failure) {
      if (!signal.aborted) setError(`The change was saved, but the address list could not be refreshed. ${addressError(failure)}`);
    }
  }

  function save(values) {
    if (!editor || conflict) return;
    return runRequest(async signal => {
      if (editor.address) await updateAddress(editor.address.id, values, editor.address.rowVersion, { signal });
      else await createAddress(values, { signal });
      if (signal.aborted) return;
      const editing = !!editor.address;
      closeEditor();
      await refreshAfterWrite(signal, editing ? "Address updated." : "Address added.");
    }, "save", true);
  }

  function remove() {
    if (!editor?.address || conflict) return;
    return runRequest(async signal => {
      await deleteAddress(editor.address.id, editor.address.rowVersion, { signal });
      if (signal.aborted) return;
      closeEditor();
      await refreshAfterWrite(signal, "Address deleted.");
    }, "delete", true);
  }

  function reloadEditor() {
    if (!editor?.address || request.current) return;
    discardOrRun(() => runRequest(async signal => {
      let latest;
      try {
        latest = await getAddress(editor.address.id, { signal });
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status !== 404) throw failure;
        closeEditor();
        await refreshAfterWrite(signal, "This address no longer exists.");
        return;
      }
      if (signal.aborted) return;
      dirty.current = false;
      setConflict(false);
      setEditor({ address: latest, revision: ++revision.current });
      setAddresses(previous => previous?.map(address => address.id === latest.id ? latest : address) ?? previous);
    }, "reload", true));
  }

  function setDefault(address) {
    return runRequest(async signal => {
      try {
        await makeDefaultAddress(address.id, address.rowVersion, { signal });
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status !== 409 && failure.status !== 404) throw failure;
        setAddresses(null);
        const data = await listAddresses({ signal });
        if (!signal.aborted) {
          setAddresses(data);
          setError(failure.status === 409
            ? "Addresses changed. The list has been refreshed; please try again."
            : "This address is no longer available. The list has been refreshed.");
        }
        return;
      }
      await refreshAfterWrite(signal, "Default address updated.");
    }, "default");
  }

  const form = editor && <AddressForm key={editor.revision} address={editor.address} busy={busy} blocked={!!discardAction} operation={operation}
    error={formError} conflict={conflict} onSave={save} onCancel={cancelEditor} onDelete={remove}
    onReload={reloadEditor} onRefresh={load} onDirtyChange={onDirtyChange} />;

  return (
    <section className="panel profile-addresses" aria-labelledby="profile-addresses-title">
      <div className="address-heading">
        <h2 id="profile-addresses-title">Addresses</h2>
        <div className="toolbar">
          <button type="button" className="btn btn-secondary" disabled={busy || !!discardAction} aria-expanded={visible} aria-controls="profile-address-list" onClick={toggleAddresses}>
            {visible ? "Hide addresses" : "Show addresses"}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !!discardAction} onClick={() => openEditor()}>Add new address</button>
        </div>
      </div>
      <div id="profile-address-list" hidden={!visible} aria-busy={busy}>
        {busy && <p role="status">{operation === "load" || operation === "reload" ? "Loading addresses…" : operation === "delete" ? "Deleting address…" : operation === "save" ? "Saving address…" : "Updating default address…"}</p>}
        {message && <p className="success-message" role="status">{message}</p>}
        {discardAction && <div className="address-discard-confirmation" role="group" aria-labelledby="address-discard-title">
          <p id="address-discard-title">Discard your unsaved address changes?</p>
          <div className="toolbar address-actions">
            <button type="button" className="btn btn-danger" onClick={() => { const action = discardAction; setDiscardAction(null); action(); }}>Discard changes</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDiscardAction(null)}>Keep editing</button>
          </div>
        </div>}
        {error && <div className="address-error"><p className="error-message" role="alert">{error}</p><button type="button" className="btn btn-secondary" disabled={busy} onClick={load}>Reload addresses</button></div>}
        {editor && !editor.address && form}
        {addresses?.length === 0 && !editor && <p className="empty-state">No saved addresses yet.</p>}
        {addresses?.map(address => (
          <section key={address.id} className="profile-address" aria-label={address.label || "Address"}>
            {editor?.address?.id === address.id ? form : <>
              <div className="address-label-row"><h3>{address.label || "Address"}</h3>{address.isDefault && <span className="badge published">Default</span>}</div>
              <p>{address.recipientName}</p>
              <p className="address-details">{[address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode, address.countryCode].filter(Boolean).join(", ")}</p>
              <div className="toolbar address-actions">
                <button type="button" className="btn btn-secondary" disabled={busy || !!discardAction} onClick={() => openEditor(address)}>Edit</button>
                {!address.isDefault && <button type="button" className="btn btn-secondary" disabled={busy || !!editor} onClick={() => setDefault(address)}>Make Default</button>}
              </div>
            </>}
          </section>
        ))}
        {editor?.address && !addresses?.some(address => address.id === editor.address.id) && form}
      </div>
    </section>
  );
}
