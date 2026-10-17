# Connecting frontend authentication to .NET

See [Frontend refresh-token authentication](refresh-token-authentication.md) for
module responsibilities, state transitions, setup and verification steps.

The frontend uses the API URL in VITE_API_BASE_URL. Restart the dev server after
changing environment files; production configuration requires a new build.

## Request and response contract

- POST /api/auth/login: email and password.
- POST /api/auth/register: firstname, lastname, email, phoneNumber, password and confirmPassword.
- POST /api/auth/refresh and POST /api/auth/logout: cookies included, X-Refresh-Token: 1, no bearer token or body.

Successful login, registration and refresh responses must include token,
accessTokenExpiresAt and refreshTokenExpiresAt. Expiry values must be valid future
timestamps. Optional email, firstName, lastName and phoneNumber populate the user
profile; JWT claims supply the user ID and roles. JWT decoding controls frontend
presentation only. The .NET API verifies tokens and authorizes requests.

The access token stays in memory. The browser manages the refresh cookie; frontend
JavaScript neither reads it nor stores it in localStorage. The only persisted auth
data is coordination metadata used to serialize cookie rotation across tabs.

## Usage

React components use useAuth() from src/context/AuthContext.jsx for user, status,
error, sessionKey, login, signUp and logout. Async account operations use
isCurrentSession(sessionKey) from src/services/authService.js before applying
results. They do not read the authentication store directly.

Business services call apiRequest() from src/services/api.js. It attaches a usable
access token and retries an authenticated 401 once, preserving the original body.
Set auth: false for public requests. A 403 does not trigger renewal.

The API contract is unchanged by the frontend refactor. No backend deployment or
production cookie verification is implied by frontend tests.
