export const ADDRESS_FIELDS = [
  { name: "label", label: "Label (optional)", maxLength: 50 },
  { name: "recipientName", label: "Recipient name", maxLength: 100, required: true, autoComplete: "name" },
  { name: "addressLine1", label: "Address line 1", maxLength: 200, required: true, autoComplete: "address-line1", wide: true },
  { name: "addressLine2", label: "Address line 2 (optional)", maxLength: 200, autoComplete: "address-line2", wide: true },
  { name: "city", label: "City", maxLength: 100, required: true, autoComplete: "address-level2" },
  { name: "state", label: "State", maxLength: 100, required: true, autoComplete: "address-level1" },
  { name: "postalCode", label: "Postal / PIN code", maxLength: 20, required: true, autoComplete: "postal-code" },
  { name: "countryCode", label: "Country code", maxLength: 2, required: true, autoComplete: "country" },
];

export function addressDefaults(address) {
  return Object.fromEntries(ADDRESS_FIELDS.map(({ name }) => [name, address?.[name] ?? (name === "countryCode" ? "IN" : "")]));
}

export function addressFieldError(name, value, values) {
  const field = ADDRESS_FIELDS.find(field => field.name === name);
  const text = (value || "").trim();
  if (field.required && !text) return `${field.label} is required.`;
  if (text.length > field.maxLength) return `Use ${field.maxLength} characters or fewer.`;
  if (name === "countryCode" && !/^[A-Za-z]{2}$/.test(text)) return "Use a two-letter country code, such as IN.";
  if (name === "postalCode" && values.countryCode?.trim().toUpperCase() === "IN" && !/^[1-9][0-9]{5}$/.test(text)) {
    return "Enter a six-digit Indian PIN code that does not start with zero.";
  }
  return "";
}

export function addressPayload(values) {
  const payload = Object.fromEntries(ADDRESS_FIELDS.map(({ name }) => [name, (values[name] || "").trim()]));
  payload.label = payload.label || null;
  payload.addressLine2 = payload.addressLine2 || null;
  payload.countryCode = payload.countryCode.toUpperCase();
  return payload;
}
