# Frontend refresh-token authentication

The frontend follows `D:\CSharp\ResourceBookingApp\docs\refresh-token-authentication.md`.
Access JWTs last 15 minutes. Refresh sessions have an absolute seven-day expiry;
refreshing never extends it. The refresh secret is only in the API's Secure,
HttpOnly cookie. JavaScript does not read or persist it.

## Local setup

1. Run the backend HTTPS launch profile at `https://localhost:7030`, with the
   refresh-session migration applied and its development certificate trusted.
2. Configure backend `AuthSession:AllowedOrigins` to include exactly
   `http://localhost:5173` (no trailing slash), with credentialed CORS enabled.
3. Run `npm run dev` and open `http://localhost:5173`. Vite uses a strict port so
   it cannot silently switch to an origin the backend has not allowed.

All API requests now use `VITE_API_BASE_URL`, including development. The previous
HTTP Vite API proxy was removed. `.env.development` already points to the HTTPS
API. Restart Vite after changing environment configuration. Do not mix localhost,
127.0.0.1, LAN IPs, or different frontend ports during session testing.

For production, replace the placeholder in `.env.production`, configure the exact
frontend origin on the API, and use HTTPS. Prefer frontend and API on the same site
to avoid third-party-cookie restrictions. Use one canonical frontend origin:
Web Locks and BroadcastChannel cannot coordinate separate frontend origins even
when they share an API cookie. A current browser with Web Locks is required;
unsupported environments show an error rather than sending uncoordinated refreshes.

## Code flow

- `http.js`: URL construction, fetch and response parsing, without auth recovery.
- `authService.js`: login/register/restore/logout and obtaining a usable access
  session. Similar to an application service in .NET: it coordinates the workflow.
- `authStore.js`: in-memory session, profile mapping, state transitions and
  subscriptions. `isCurrentSession(key)` lets async UI actions reject stale results.
- `authCoordinator.js`: Web Locks, same-origin tab messages, and non-secret
  coordination metadata in localStorage. It receives store callbacks rather than
  importing React or the authentication service.
- `api.js`: bearer header, renewal before expiry, and at most one retry after an
  authenticated 401. It never refreshes for 403 or anonymous/login failures.
- `AuthContext.jsx`: React adapter exposing state and actions through `useAuth()`.
- `AuthNotice.jsx`: displays the shared recovery message and login link.

The UI states are `initializing`, `authenticated`, `anonymous`, and
`reauthenticationRequired`. Errors have a `code` and a user-facing `message`.
Public pages render during restoration; protected routes, checkout and account
actions wait. A normal background refresh keeps the authenticated state and
session key, so forms are not remounted. An uncertain refresh requires sign-in
and removes account-dependent UI, while internal session identity remains
available to the coordinator. New login and logout invalidate old UI work.

On startup, a tab asks other tabs for a current access token under a shared Web
Lock, otherwise it refreshes with the cookie. Concurrent startup/401 calls share
one in-tab promise and serialize across tabs. React StrictMode uses the same
promise. Cookie requests use credentials include; refresh/logout add
`X-Refresh-Token: 1` with no bearer header or body.

The access token is never stored in localStorage/sessionStorage. The legacy
`shopHub.auth` JWT entry is removed on initialization; old users without a refresh
cookie must log in again. `shopHub.auth-state` contains only a session generation,
revision, blocked/pending markers and a user-facing recovery message. Live tabs
exchange access tokens through BroadcastChannel without persisting them.

Cart, checkout and protected route identities survive access-token rotation but
change on a new login/logout. Stale responses cannot clear or replace a new login.
Retries preserve method, body, cancellation and response type; checkout retains
its original RequestId and delivery snapshot. Ordinary network errors are not
automatically retried, including uncertain order writes.

## Failure behavior

- Refresh 401 clears frontend authentication and sends protected routes to login.
- Refresh 400/403 is a request/origin configuration failure, not a retry trigger.
- Lost refresh responses, timeouts, 5xx or invalid success bodies block further
  automatic rotation until explicit sign-in. A persisted pending marker also
  catches a tab closing mid-refresh. The UI enters `reauthenticationRequired` and
  shows a concise sign-in message without raw transport details.
- Malformed coordination metadata requires explicit login without automatically
  replaying a cookie whose rotation state is unknown.
- Logout clears local state immediately across tabs, then revokes the cookie
  session under the same lock. Failed server logout is reported; automatic startup
  restoration remains blocked until explicit sign-in. Issued JWTs can remain valid
  on the server until their normal expiry.

## Verification

Run `npm test`, `npm run lint` and `npm run build`. `tests/refresh-auth.test.mjs` bundles the real
auth modules into isolated JS realms, modeling separate tab memories with shared
metadata, locks and messages. These tests do not prove real browser cookie policy,
CORS, HTTPS trust, or SQL Server behavior.

With the backend running, verify in a browser:

1. Login and signup accept the HttpOnly refresh cookie; storage contains no JWT.
2. Reload a protected page and open a second tab: authentication restores without
   a premature redirect to login.
3. Let an access JWT expire, then load cart/orders. Refresh succeeds and the
   original request is retried once; checkout and form state survive.
4. Trigger protected requests in two tabs at expiry; rotation is coordinated and
   the backend does not revoke the session for replay.
5. Logout during activity, reload, and confirm both tabs remain signed out.
6. Expire/revoke the refresh session; confirm login is required. Simulate a lost
   refresh response; confirm there is no automatic refresh loop.
7. Check multipart uploads, private images and checkout recovery still work.

For isolated manual UI testing, run `node tests/fixture-server.mjs` and open
`http://localhost:5174`. Use `member@example.test` or `admin@example.test` with
password `Test123`. This in-memory fixture supports login, cookie rotation and
logout; its localhost cookie settings do not model production cross-site policy.

For the October 17 frontend refactor, automated checks passed, but browser tools
could not connect to the local fixture. Live API cookie, CORS and SQL-backed
behavior remain unverified.
