# Connecting authentication to .NET

## Configuration and response contract

The existing `.env.development` contains `VITE_API_BASE_URL=https://localhost:7001`.
Replace the port with your API's HTTPS port. Set the real deployment address in
`.env.production` (currently an example). Restart Vite after editing environment
files; production values require a new build. Never put signing keys in Vite env files.

Update the routes in `src/services/authService.js` to match your controllers:

- `POST /api/auth/login`
- `POST /api/auth/register`

Login sends `{ "email": "person@example.com", "password": "..." }`.
Signup sends `{ "firstname": "Jane", "lastname": "Doe", "email": "person@example.com", "password": "...", "confirmPassword": "..." }`.
The signup form requires both names and matching passwords. Login and signup
have separate pages at `/login` and `/signup`, each with its own form state.
The old `/auth` URL redirects to `/signup`.
Both expect a successful JSON response such as:

```json
{ "token": "your-jwt", "email": "person@example.com" }
```

`email` is optional; the form email is used for display if omitted. If the token
property is called `accessToken`, change `data.token` in `authService.js`. Adjust
the request payload there if the API contract changes. Returning 204 or a
success body without a token does not sign the user in.

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/services/api.js` | Base URL, bearer header, JSON requests, response parsing, HTTP errors and 401 handling |
| `src/services/authService.js` | Login/signup routes and request/response contract |
| `src/services/authStorage.js` | Read, save and clear token plus display email; notify React |
| `src/context/AuthContext.jsx` | Async login/signup, UI state, restore saved session, logout and cross-tab synchronization |
| `src/pages/Login.jsx` | Email/password login form, validation, API errors, and submission state |
| `src/pages/Signup.jsx` | Signup fields, matching-password validation, API errors, and submission state |

Existing environment files are reused. Passwords are no longer stored or checked
in the browser. Old demo `users` and `currentUserEmail` entries are ignored, not
automatically deleted. You can remove those two keys in browser DevTools after
you no longer need the demo data.

## Calling other endpoints

Always use `apiRequest` for backend requests to get the automatic bearer header:

```js
import { apiRequest, ApiError } from "./services/api";

const { data: products } = await apiRequest("/api/products");

const { status, data: order } = await apiRequest("/api/orders", {
  method: "POST",
  json: { productId: 1, quantity: 2 },
});

try {
  const result = await apiRequest("/api/orders/123", { method: "DELETE" });
  if (result.status === 202) {
    // Accepted for processing: show pending and check completion via your API.
  } else {
    // For an API that confirms deletion with 200/204, update the UI.
  }
} catch (error) {
  if (error instanceof ApiError && error.status === 409) {
    // Show the conflict message: error.message.
  } else {
    // Show error.message (including network failures).
  }
}

// Public request: do not attach a token.
await apiRequest("/api/products", { auth: false });
```

All 2xx responses return `{ status, data }`; empty bodies return `data: null`.
Non-2xx responses throw `ApiError` with `status`, `data`, and `message`.
.NET ProblemDetails and validation errors are supported. Network errors have no
HTTP status. Responses are expected to be JSON, text, or empty, not binary files.

On an authenticated 401, the session is cleared and the navbar shows Login.
The request still throws so its caller can display the error. A 403 does not
clear the session. No automatic retries or token refresh are implemented.

## Backend requirements

- Validate JWT signature, issuer, audience and expiration using JWT bearer authentication.
- Protect relevant endpoints with `[Authorize]`; login/signup must allow anonymous access.
- If React and the API use different origins, configure CORS for the actual React
  origin (including port), required HTTP methods, and `Authorization` and
  `Content-Type` headers. Handle preflight requests through ASP.NET Core CORS middleware.
- Derive user identity from the validated JWT claims. The stored display email
  is UI data, not proof of authorization.
- Use HTTPS and trust your development HTTPS certificate.

Reference: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication

## Session behavior and verification

The token is stored under `shopHub.auth` in localStorage, so it survives reloads
and browser restarts. localStorage is readable by JavaScript and therefore exposed
to XSS. A production alternative is an HttpOnly cookie/BFF design, which requires
backend changes. Logout removes the browser session; it does not revoke a JWT
already issued by the server. Expired tokens are cleared when an authenticated
request receives 401, not by a client timer.

With the backend running, verify:

1. Signup/login return a token and update the navbar.
2. Inspect a later API request in DevTools: `Authorization: Bearer <token>` is present.
3. Reload: the display session restores and subsequent requests still carry the token.
4. An empty 204 response succeeds; a 409 exposes its status/message.
5. An authenticated 401 removes the session; a 403 leaves it intact.
6. Logout clears the session, including in another open tab.

The existing product catalog and checkout still use their current local behavior;
their backend routes have not been supplied. Use the helper when connecting them.
