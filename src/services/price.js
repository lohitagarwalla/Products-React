export function validatePrice(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return "Enter a non-negative price with at most two decimal places";
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const number = Number(text);
  const serialized = String(number);
  const [serializedWhole, serializedFraction = ""] = serialized.split(".");
  // .NET decimal has a wider range than JS Number. Never silently round a submitted price.
  if (cents > 999999999999999999n || !Number.isFinite(number)
    || !/^\d+(?:\.\d{1,2})?$/.test(serialized)
    || BigInt(serializedWhole) * 100n + BigInt(serializedFraction.padEnd(2, "0")) !== cents) {
    return "This price is too large to represent accurately. Enter a smaller amount.";
  }
  return true;
}
