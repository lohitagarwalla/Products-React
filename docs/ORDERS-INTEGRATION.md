# Orders frontend

## Routes and API

- `/checkout`: guest cart viewing, login/signup return, authenticated order submission.
- `/orders` and `/orders/:id`: current user's orders, filters, saved items, totals, history and cancellation.
- `/admin/orders` and `/admin/orders/:id`: all orders, customer IDs, shipping, delivery and cancellation.

The frontend uses the existing `/api` development proxy and production
`VITE_API_BASE_URL`. All order requests include the bearer token. The API enforces
ownership and Admin access. Admins' personal lists still use `GET /api/orders`;
the management list uses `GET /api/orders/manage`.

## Checkout recovery

Before submission, save the UUID and exact product/quantity payload in
`sessionStorage`, scoped by the JWT's user ID. A lost response can be retried after
navigation, reload or reauthentication as that same user. Retries bypass catalog
refresh because the server may already have created the order before a product
was subsequently removed. Both 200 replays and 201 creations are accepted.

Cart edits are locked during an unresolved attempt. A rejected 400 response allows
editing the checkout. For an uncertain outcome, the user must review My orders
and explicitly acknowledge starting a different checkout. Each new checkout gets
a new UUID. Recovery is per tab and is not intended to survive closing that tab.
The ordinary cart remains in memory, as before.

Only confirmed submissions remove ordered quantities. A cart instance/revision
check prevents a late response or a recovered old attempt from clearing a cart
that was changed in the meantime. Responses from an older login do not update the
new session's UI.

## Status changes and data

- Placed: owners can cancel; admins can ship or cancel.
- Shipped: owners can cancel; admins can deliver or cancel.
- Delivered and Cancelled: no further action buttons.
- Writes send the untouched Base64 `rowVersion`; only cancellation sends a reason.
- Conflicts and uncertain status-write outcomes reload the order for review.
- Date filters use local calendar days, converted to an inclusive UTC start and
  exclusive next-day UTC end. Filters/pagination are stored in the URL.
- JSON monetary tokens are preserved as strings before conversion to JS numbers.
  BigInt minor units provide exact cart arithmetic and formatting. Order details
  use saved server totals and product titles. Missing/broken images use placeholders.
- Product write validation also runs at the service boundary to avoid silently
  rounding an existing large price when changing publication status.

Payments, refunds, inventory, addresses and carrier integrations are not provided
by the current backend contract.

## Verification

```powershell
npm test
npm run lint
npm run build
```

Tests cover API payloads, bearer authentication, exact amounts, checkout recovery
and account isolation, quantity/currency validation, status actions, date bounds,
and HTTP errors without automatic mutation retries.

For disposable browser verification:

```powershell
$env:ORDER_FIXTURE_LOST_RESPONSE = '1'
$env:ORDER_FIXTURE_CONFLICT = '1'
node tests/fixture-server.mjs
```

Open `http://localhost:5174`. Fixture logins are `member@example.test` or
`admin@example.test`, password `Test123`. The first checkout commits to the fixture
and drops its response; the first status write returns 409. Fixture data is held
only in memory. This test server is not used by the application build.

Verified in the browser: guest login return; lost-response recovery after reload;
cancellation conflict and reason/history; admin filtering, shipping, delivery and
terminal states; and mobile detail layout. The live .NET API was also checked for
login, user-ID claims, authenticated order-list responses, and the non-admin UI
guard. Mutating browser flows were verified against the disposable fixture rather
than creating orders in the application database.
