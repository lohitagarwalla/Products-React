import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { ADDRESS_FIELDS, addressDefaults, addressFieldError, addressPayload } from "../services/addressForm";

export default function AddressForm({ address, busy, blocked = false, operation, error, conflict, onSave, onCancel, onDelete, onReload, onRefresh, onDirtyChange }) {
  const editing = !!address;
  const locked = busy || blocked;
  const prefix = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
    defaultValues: { ...addressDefaults(address), makeDefault: false },
  });

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  function submit(values) {
    if (locked || conflict || confirmDelete) return;
    const payload = addressPayload(values);
    onSave(editing ? payload : { ...payload, makeDefault: !!values.makeDefault });
  }

  const serverErrors = error?.data?.errors;
  function fieldServerError(name) {
    if (!serverErrors) return "";
    const key = Object.keys(serverErrors).find(key => key.replace(/^\$\./, "").toLowerCase() === name.toLowerCase());
    const messages = serverErrors[key];
    return Array.isArray(messages) ? messages.join(" ") : messages || "";
  }

  return (
    <form className="address-form" onSubmit={handleSubmit(submit)} noValidate aria-labelledby={`${prefix}-title`} aria-busy={busy}>
      <h3 id={`${prefix}-title`}>{editing ? "Edit address" : "Add new address"}</h3>
      {error && <p className="error-message" role="alert">{error.message}</p>}
      {error?.uncertainCreate && <button type="button" className="btn btn-secondary" disabled={locked} onClick={onRefresh}>Refresh saved addresses</button>}
      {conflict && <div className="address-conflict">
        <p>Your draft is still here. Load the latest address before saving or deleting again.</p>
        <button type="button" className="btn btn-secondary" disabled={locked} onClick={onReload}>Load latest address</button>
      </div>}
      <fieldset className="form-fieldset" disabled={locked}>
        <div className="form-grid">
          {ADDRESS_FIELDS.map(field => {
            const id = `${prefix}-${field.name}`;
            const message = errors[field.name]?.message || fieldServerError(field.name);
            return <div key={field.name} className={`form-group${field.wide ? " address-field-wide" : ""}`}>
              <label className="form-label" htmlFor={id}>{field.label}</label>
              <input id={id} className="form-input" autoComplete={field.autoComplete} maxLength={field.maxLength}
                autoFocus={field.name === "recipientName"} aria-required={field.required || undefined}
                aria-invalid={!!message} aria-describedby={message ? `${id}-error` : field.name === "countryCode" ? `${id}-hint` : undefined}
                {...register(field.name, {
                  validate: (value, values) => addressFieldError(field.name, value, values) || true,
                  ...(field.name === "countryCode" ? { deps: ["postalCode"] } : {}),
                })} />
              {field.name === "countryCode" && <p id={`${id}-hint`} className="muted">Two-letter code, such as IN.</p>}
              {message && <span id={`${id}-error`} className="form-error" role="alert">{message}</span>}
            </div>;
          })}
        </div>
        {!editing && <label className="address-default-choice"><input type="checkbox" {...register("makeDefault")} /> Make this my default address</label>}
        {editing && address.isDefault && <p className="muted">This is your default address.</p>}
      </fieldset>
      <div className="toolbar address-actions">
        <button type="submit" className="btn btn-primary" disabled={locked || conflict || confirmDelete}>
          {busy && operation === "save" ? "Saving…" : editing ? "Save changes" : "Save address"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={locked} onClick={onCancel}>Cancel</button>
        {editing && !confirmDelete && <button type="button" className="btn btn-danger" disabled={locked || conflict} onClick={() => setConfirmDelete(true)}>Delete address</button>}
      </div>
      {editing && confirmDelete && <div className="address-delete-confirmation" role="group" aria-labelledby={`${prefix}-delete-title`}>
        <p id={`${prefix}-delete-title`}>Delete this saved address?</p>
        {isDirty && <p className="muted">Your unsaved edits will also be discarded.</p>}
        {address.isDefault && <p className="muted">The oldest remaining address will become default. If this is your last address, you will have no saved addresses.</p>}
        <div className="toolbar address-actions">
          <button type="button" className="btn btn-danger" disabled={locked || conflict} onClick={onDelete}>{busy && operation === "delete" ? "Deleting…" : "Confirm delete"}</button>
          <button type="button" className="btn btn-secondary" disabled={locked} onClick={() => setConfirmDelete(false)}>Keep address</button>
        </div>
      </div>}
    </form>
  );
}
