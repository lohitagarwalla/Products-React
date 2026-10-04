const moneyKeys = new Set(["price", "unitPrice", "lineTotal", "totalAmount"]);

// Match complete JSON strings so numbers inside descriptions are never rewritten.
// Preserve money tokens before JSON.parse can round a .NET decimal into a Number.
export function parseMoneyJson(text) {
  JSON.parse(text); // Validate the original grammar before quoting numeric tokens.
  return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"(?:\s*:\s*-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)?/g, token => {
    const match = token.match(/^("(?:\\.|[^"\\])*")(\s*:\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/);
    return match && moneyKeys.has(JSON.parse(match[1]))
      ? `${match[1]}${match[2]}"${match[3]}"` : token;
  }));
}

export function toMinor(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Invalid monetary amount.");
  return BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
}

export function fromMinor(value) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

export function multiplyMoney(value, quantity) {
  return fromMinor(toMinor(value) * BigInt(quantity));
}

export function formatMoney(value, currency = "INR") {
  const minor = toMinor(value);
  const whole = minor / 100n;
  const fraction = String(minor % 100n).padStart(2, "0");
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(whole)
      .map(part => part.type === "fraction" ? fraction : part.value).join("");
  } catch {
    return `${currency} ${fromMinor(minor)}`;
  }
}
