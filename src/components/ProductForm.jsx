import { useForm } from "react-hook-form";
import { validatePrice } from "../services/price";

export default function ProductForm({ product, onSave, busy, onDirtyChange }) {
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({ defaultValues: {
    title: product?.title ?? "", description: product?.description ?? "", brand: product?.brand ?? "",
    price: product?.price ?? "", currency: product?.currency ?? "INR",
  } });
  const requiredText = (name, max) => ({ required: `${name} is required`, maxLength: { value: max, message: `Maximum ${max} characters` }, validate: value => !!value.trim() || `${name} is required` });
  const fields = [
    ["title", "Title", requiredText("Title", 200), { maxLength: 200 }],
    ["brand", "Brand", requiredText("Brand", 100), { maxLength: 100 }],
    ["price", "Price", { required: "Price is required", validate: validatePrice }, { type: "number", min: 0, step: "0.01" }],
    ["currency", "Currency", { required: "Currency is required", pattern: { value: /^[A-Za-z]{3}$/, message: "Enter a three-letter currency code, such as INR" } }, { maxLength: 3 }],
  ];
  return <form onChange={() => onDirtyChange(true)} onSubmit={handleSubmit(async values => {
    const saved = await onSave(values);
    if (saved) reset({ title: saved.title, brand: saved.brand, price: saved.price, currency: saved.currency, description: saved.description });
  })}>
    <fieldset disabled={busy} className="form-fieldset">
      <div className="form-grid">{fields.map(([name, label, rules, props]) => <div className="form-group" key={name}>
        <label className="form-label" htmlFor={`product-${name}`}>{label}</label>
        <input className="form-input" id={`product-${name}`} {...props} {...register(name, rules)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />
        {errors[name] && <span id={`${name}-error`} className="form-error">{errors[name].message}</span>}
      </div>)}</div>
      <div className="form-group"><label className="form-label" htmlFor="product-description">Description</label>
        <textarea className="form-input" id="product-description" rows={5} maxLength={4000} {...register("description", { maxLength: { value: 4000, message: "Maximum 4000 characters" } })} />
        {errors.description && <span className="form-error">{errors.description.message}</span>}
      </div>
      <button className="btn btn-primary" type="submit">{busy ? "Please wait…" : product ? "Save details" : "Create draft"}</button>
      {isDirty && <span className="muted form-hint">Unsaved details. Save before publishing or leaving this page.</span>}
    </fieldset>
  </form>;
}
