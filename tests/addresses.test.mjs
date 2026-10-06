import assert from "node:assert/strict";
import { test } from "node:test";
import { ADDRESS_FIELDS, addressDefaults, addressFieldError, addressPayload } from "../src/services/addressForm.js";

test("address validation follows the backend's required fields, lengths and country-dependent postal rule", () => {
  const values = { label: "", recipientName: "Test", addressLine1: "Road", addressLine2: "",
    city: "Bengaluru", state: "Karnataka", postalCode: "560001", countryCode: "IN" };
  for (const field of ADDRESS_FIELDS) {
    assert.equal(addressFieldError(field.name, values[field.name], values), "");
    assert.ok(addressFieldError(field.name, "x".repeat(field.maxLength + 1), values));
    assert.equal(!!addressFieldError(field.name, "   ", values), !!field.required);
  }
  for (const postalCode of ["012345", "56000", "5600012", "ABC123"]) {
    assert.ok(addressFieldError("postalCode", postalCode, { countryCode: " in " }));
  }
  assert.equal(addressFieldError("postalCode", "SW1A 1AA", { countryCode: "GB" }), "");
  assert.ok(addressFieldError("countryCode", "123", values));
  assert.ok(addressFieldError("countryCode", "I", values));
  assert.equal(addressFieldError("countryCode", " in ", values), "");
});

test("address defaults and payloads keep drafts separate from server IDs and versions", () => {
  assert.equal(addressDefaults().countryCode, "IN");
  assert.equal(addressDefaults().recipientName, "");
  assert.equal(addressDefaults({ recipientName: "Test", countryCode: "GB" }).countryCode, "GB");
  const payload = addressPayload({ label: "   ", recipientName: " Test ", addressLine1: " Road ",
    addressLine2: " ", city: " City ", state: " State ", postalCode: " 560001 ", countryCode: " in ",
    id: 7, rowVersion: "version", isDefault: true, makeDefault: true });
  assert.deepEqual(payload, { label: null, recipientName: "Test", addressLine1: "Road", addressLine2: null,
    city: "City", state: "State", postalCode: "560001", countryCode: "IN" });
});
