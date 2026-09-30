import { apiRequest } from "./api";
import { readJwt } from "./jwt";

// Match these paths to your .NET controller routes.
const endpoints = { login: "/api/auth/login", signUp: "/api/auth/register" };

function readSession(data, email) {
  // Expected response: { token: "...", email?: "..." }.
  // Change data.token here if your backend uses data.accessToken.
  if (typeof data?.token !== "string" || !data.token.trim()) {
    throw new Error("The authentication response did not contain a token.");
  }
  if (!readJwt(data.token)) throw new Error("The authentication token is invalid or expired. Please log in again.");
  return { token: data.token, user: { email: data.email || email } };
}

export async function login({ email, password }) {
  const { data } = await apiRequest(endpoints.login, {
    method: "POST", auth: false, json: { email, password },
  });
  return readSession(data, email);
}

export async function signUp({ firstname, lastname, email, password, confirmPassword }) {
  const { data } = await apiRequest(endpoints.signUp, {
    method: "POST", auth: false,
    json: { firstname, lastname, email, password, confirmPassword },
  });
  return readSession(data, email);
}
