import { authenticate } from "./authSession";
export { logout, restoreSession } from "./authSession";

export function login({ email, password }) {
  return authenticate("login", { email, password });
}
export function signUp({ firstname, lastname, email, phoneNumber, password, confirmPassword }) {
  return authenticate("register", { firstname, lastname, email, phoneNumber: phoneNumber.trim(), password, confirmPassword });
}
