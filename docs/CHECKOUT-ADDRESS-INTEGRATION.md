# Checkout address integration

The checkout address tile currently previews a saved address. It does not affect
order creation. Its notice makes this limitation visible, and address loading or
selection does not block an order. Profile defaults are never changed by checkout.

`CheckoutContent` owns `useCheckoutAddress`; the confirmed selection is available
as `addressState.selectedId`. The dialog keeps an independent draft until the
user confirms. Addresses and the selection remain in memory. The session-keyed
checkout discards them on account changes. Requests are aborted on unmount and
superseded refreshes; returning to the browser or opening the selector refreshes
saved addresses. Deleted selections require a new explicit choice.

## Enabling delivery addresses in the order API

1. Agree the request field with the backend (for example `addressId`). Validate
   ownership, availability, and required address rules on the server.
2. Add the field to `OrderCreateDto` and snapshot the resolved delivery details
   on the order in the creation transaction. Profile edits/deletion must not
   change historical orders. Include address semantics in the idempotency hash;
   replay an existing request before resolving its now possibly deleted address.
3. Capture `addressState.selectedId` when constructing a **new** checkout attempt
   in `Checkout.jsx`, before `saveCheckout`. Store the ID, not full address details.
   Read the address from that saved attempt on retries, never from current UI state.
4. Extend `buildOrderRequest` in `src/services/checkoutAddress.js` to serialize
   the agreed field from the attempt. It currently deliberately serializes only
   the supported request ID and items.
5. Require a valid selection for new orders and handle backend address errors.
   Decide explicitly how pending attempts created before this contract are
   recovered; never silently change an uncertain request or its request ID.
6. Render the saved delivery snapshot in order details, replace the preview
   notice, and verify ownership errors, deleted addresses, snapshot persistence,
   changed-payload conflicts, and retries after an uncertain response.

Do not log delivery details or send them in URLs or analytics events.
