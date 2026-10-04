import { ORDER_STATUSES } from "./orderService";

function localDate(value, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date range.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("Enter a valid date range.");
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function orderFilters(params) {
  const search = params.get("search") || "";
  const status = params.get("status") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || 20);
  if (search.length > 200) throw new Error("Search must be 200 characters or fewer.");
  if (status && !ORDER_STATUSES.includes(status)) throw new Error("Choose a valid order status.");
  if (!Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error("Invalid page or page size.");
  if (from && to && from > to) throw new Error("The end date must be on or after the start date.");
  return { search, status, page, pageSize,
    ...(from ? { fromUtc: localDate(from) } : {}), ...(to ? { toUtc: localDate(to, true) } : {}) };
}

export function formatOrderDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}
