# Product management

The frontend uses the existing ResourceBookingApp .NET product and image APIs. No backend changes are included.

## Run against .NET

1. Start the backend with its database configured and migrations applied.
2. Set `VITE_API_BASE_URL` in `.env.development` to the backend origin (currently `https://localhost:7030`).
3. Run `npm run dev` and open `http://localhost:5173`. The backend currently allows that exact CORS origin.
4. Log in with an account assigned the `Admin` role on the backend. If the role was assigned after login, log in again to obtain a new JWT.
5. Choose **Manage products**, then **Add product**. Save the draft, upload images, and publish it.

The frontend reads .NET's full role claim URI as well as `role`/`roles`, normalizes arrays, and rejects malformed/expired tokens. Decoding controls the UI only; the backend must continue to validate signatures and enforce Admin authorization.

## Routes and behavior

- `/`: published products, title/brand search, and server pagination.
- `/products/:id`: details, image gallery, currency-aware price, and Admin preview of drafts.
- `/admin/products`: searchable/paginated draft and published products; edit, publication, and deletion actions.
- `/admin/products/new`: product details, saved initially as a draft.
- `/admin/products/:id/edit`: details, image queue, cover ordering, alt text, image removal, publication, and deletion.

Create/update payloads contain `title`, `description`, `brand`, `price`, `currency`, and `isPublished`. Publication sends a complete PUT payload after retrieving the saved product. It does not submit unsaved form fields; save those first.

The upload picker accepts multiple files. Requests run sequentially, one `file` plus optional `altText` per multipart request. Each queued file has its own status and retry. Successfully uploaded files remain saved when another file fails. The first saved image is the cover. Current frontend limits match backend configuration: 10 images, 5 MiB/file, JPEG/PNG/WebP. The backend validates dimensions, content, corruption, and animation. Update the frontend limits if backend configuration changes.

Published images load from the backend URL. Draft images are fetched with the bearer token and displayed with temporary object URLs; these are released on unmount/session changes. Tokens are never placed in image URLs.

Product form input survives failed saves. Reloading the saved product intentionally discards unsaved details and the local upload queue. After an uncertain upload failure (for example, a disconnected network after the server saved the image), reload saved images before retrying to avoid duplicates.

Cart items use API product data rather than the demo array. Checkout refreshes prices and availability through anonymous product reads, blocks unavailable products, and groups totals by currency. Checkout remains a demo: there is no order/payment API integration.

## Checks

```sh
npm test
npm run lint
npm run build
```

Automated checks cover JWT role shapes/expiry, session handling, price serialization precision, product endpoint/payload mapping, multipart requests, binary image reads, and HTTP errors.

For an isolated browser check without the .NET database:

```sh
node tests/fixture-server.mjs
```

Open `http://localhost:5174`. Use `admin@example.test` or `member@example.test`, password `Test123`. This separate server uses in-memory fixtures and a test-only token generator; it is not part of the production build. Restarting resets the fixture data. It must never be used as a production backend.

Manual integration checklist:

- Anonymous Admin URL redirects to login; a non-Admin sees access denied.
- Admin creates/updates a draft; drafts are absent from the public list.
- Select multiple images, preview/upload them, retry a failed upload, reorder, edit alt text, and remove an image.
- Admin can view draft images. Anonymous users cannot fetch draft content.
- Publish/unpublish updates public visibility; delete removes the product from management and shop lists.
- Expired sessions return to login. API validation, forbidden, missing-resource, and conflict errors appear without clearing entered details.
- Search and pagination use the server; cart prices/currencies come from the API.

## Current backend constraints

- Product/image writes return 409 for overlapping database updates, but DTOs do not expose a version for detecting edits from an old browser form. A future API version/ETag contract would be needed to prevent all stale-edit overwrites.
- .NET decimal supports larger precise values than JavaScript Number. The form rejects a price that would change when serialized by the browser. Extremely large stored prices require a string-based money contract for full precision.
- Deletion is the backend's existing soft-delete workflow; the frontend does not implement restoration.
- No token refresh endpoint is assumed. Expired sessions require login again.

Implementation verification: build, lint, and focused automated tests passed. Isolated browser checks covered role routing, draft creation, editing, authenticated gallery display, alt text, ordering, publication/unpublication, and cart availability. Browser file selection was blocked by the Chrome extension's file-access setting, and automation stalled on native confirmation dialogs. Full live .NET integration was not run because the configured API was not listening.
