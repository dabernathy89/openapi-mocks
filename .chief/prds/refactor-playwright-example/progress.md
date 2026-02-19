## Codebase Patterns
- The `examples/playwright/` project is NOT a pnpm workspace member — it must be treated as a standalone package
- `openapi-mocks` is linked via `file:../../packages/openapi-mocks` in the example's package.json
- To validate a spec with swagger-parser, run from `packages/openapi-mocks/` where the dependency is installed
- The existing test pattern uses `mocks.data()` + Playwright's `page.route()` for interception (no MSW yet)
- After building the library (`pnpm build` in `packages/openapi-mocks/`), run `pnpm install --ignore-workspace` in `examples/playwright/` to refresh the pnpm store copy — the store maintains a separate copy with a different inode, so just rebuilding is not enough
- `echoPathParams` is a GlobalOptions field set at client creation time, not a per-call HandlersOptions option; for tests that need it, create a separate mock client with `echoPathParams: true`
- The `applyEchoPathParams` utility now also matches bare `id` suffix (e.g. path param `userId` → response field `id`) — common REST API pattern
- Tests use `data-testid` attributes for element selection
- The app is a vanilla JS SPA served by `server.js` on port 4200
- To install deps in `examples/playwright/` (NOT a workspace member), use `pnpm install --ignore-workspace` from that directory
- MSW-based tests import `{ test, expect }` from `./fixtures` — the `network` fixture runs automatically (`auto: true`) for every test; call `network.use()` for per-test handler overrides
- `@msw/playwright` uses `page.route()` internally — no service worker initialization needed; no `mockServiceWorker.js` generation required

---

## 2026-02-18 - US-006
- What was implemented: Added `e2e/library-features.spec.ts` demonstrating all uncovered library features
  - `statusCodes filtering`: `mocks.data({ statusCodes: [200], operations: { listUsers: {}, listOrders: {} } })` — asserts only 200 status codes in result map, navigates to `/dashboard`, asserts both user-count and order-count are populated
  - `multiple operations at once`: Single `mocks.data()` call with `listUsers`, `listOrders`, and `getOrder`; intercepts all three routes via `page.route()`; asserts each endpoint returns data
  - `generateFromSchema — standalone utility`: Imports `generateFromSchema` directly from `openapi-mocks`; generates from an inline `Order` schema (no spec file); asserts shape and types; pure Node.js — no `page` navigation
  - `seed reproducibility`: Creates three clients (seed 1234, seed 1234, seed 9999); asserts first two produce identical user data; asserts seed 9999 differs from seed 1234 on at least one field
  - All 18 Playwright tests pass
- Files changed: `examples/playwright/e2e/library-features.spec.ts`, `.chief/prds/refactor-playwright-example/prd.json`
- **Learnings for future iterations:**
  - `generateFromSchema` takes a raw JSON schema object (no spec file needed) — useful for unit-style assertions within Playwright tests
  - The dashboard route (`/dashboard`) already exists in `app.js` and `index.html` with `data-testid="user-count"` and `data-testid="order-count"` — no UI changes needed for statusCodes filtering test
  - When checking seed reproducibility, use `Promise.all` with three separate `createMockClient` instances (each with its own seed) for clean parallel generation
  - `page.route()` URL patterns with query strings: use `**/api/v1/orders**` (with trailing glob) to catch URLs with query params; use exact path `**/api/v1/orders` (no glob) to avoid double-matching

---

## 2026-02-18 - US-005
- What was implemented: Added E2E tests for composite schema keywords
  - Created `e2e/composite-schemas.spec.ts` with three test.describe blocks:
    - `allOf — Order extends BaseEntity`: Generates order via `getOrder`, asserts both BaseEntity fields (`id`, `createdAt`, `updatedAt`) and Order-specific fields (`status`, `total`) are present; also validates via UI
    - `oneOf — OrderItem discriminator`: Uses `arrayLengths: { items: [3, 3] }` + transform fallback to guarantee items; asserts `type` discriminator is always present; asserts PhysicalProduct items have `weight`/`dimensions` and NOT `downloadUrl`/`licenseKey`, and vice versa; also validates `data-item-type` attributes in UI
    - `anyOf — PaymentMethod`: Uses transform to guarantee `paymentMethod` is present; asserts at least one variant's fields are present (CreditCard or BankTransfer); validates `data-payment-type` in UI
  - All 3 tests use `mocks.data()` + `page.route()` (no MSW fixture)
  - All 14 Playwright tests pass
- Files changed: `examples/playwright/e2e/composite-schemas.spec.ts`, `.chief/prds/refactor-playwright-example/prd.json`
- **Learnings for future iterations:**
  - `x-faker-method: date.past` returns a Date object (not a string) — test with `toBeTruthy()` or `toBeInstanceOf(Date)` rather than `typeof x === "string"` when asserting date fields
  - `arrayLengths` for nested arrays uses dot-path or glob syntax (e.g. `items: [3, 3]`) — but optional fields may not be generated even with `arrayLengths`; use a transform fallback to guarantee presence
  - anyOf tests should check `isCreditCard || isBankTransfer` (not exclusive) because anyOf allows conforming to multiple variants simultaneously

---

## 2026-02-18 - US-004
- What was implemented: Added MSW handler tests for request-aware features
  - Created `e2e/msw-handlers.spec.ts` with three test.describe blocks:
    - `echoPathParams`: navigates to `/users/usr_abc123`, asserts the `user-id` element shows `usr_abc123` via MSW handler with `echoPathParams: true`
    - `request-body transform`: posts to create user, transform reads request body and echoes `username` → `name`; asserts 201 redirect to `/users`
    - `statusCode override via handler`: forces `createOrder` to return 422, asserts error UI shows validation message
  - Added `/orders/new` create-order form page to the demo app (HTML + app.js) to give the 422 test a real UI to exercise
  - Extended `applyEchoPathParams` in the library to also try the bare `id` suffix (e.g. path param `userId` → response field `id`) — required because the spec uses `{userId}` as the path param but `id` as the response field name
  - Rebuilt the library and reinstalled in example project to refresh pnpm store
- Files changed: `examples/playwright/e2e/msw-handlers.spec.ts`, `examples/playwright/app/app.js`, `examples/playwright/app/index.html`, `packages/openapi-mocks/src/utils/echo-path-params.ts`, `.chief/prds/refactor-playwright-example/prd.json`
- **Learnings for future iterations:**
  - `echoPathParams` is a GlobalOptions field — create a separate mock client when a test needs it, don't expect `mocks.handlers({ echoPathParams: true })` to work as a per-call option
  - After rebuilding the library, must run `pnpm install --ignore-workspace` in `examples/playwright/` to sync the pnpm store's copy (separate inodes, not hardlinked to source dist)
  - The `applyEchoPathParams` id-suffix logic (paramName endsWith 'id') enables the common REST pattern where `{userId}` → `id` field in response; keep this in mind for future path param tests
  - All 11 Playwright tests pass (8 original + 3 new MSW handler tests)
---

## 2026-02-18 - US-003
- What was implemented: Set up @msw/playwright fixture for MSW-based Playwright tests
  - Added `msw` (^2.12.10) and `@msw/playwright` (^0.6.4) to `devDependencies` in `examples/playwright/package.json`
  - Installed packages with `pnpm install --ignore-workspace` (required because the example is NOT a workspace member)
  - Created `e2e/fixtures.ts` exporting an extended `test` and `expect` using `@msw/playwright`'s `defineNetworkFixture`
  - The `network` fixture runs automatically (`auto: true`) for every test without being listed explicitly
  - The `handlers` fixture defaults to `[]` and is marked as `{ option: true }` so individual tests can override
  - All 8 existing tests still pass after the changes
- Files changed: `examples/playwright/package.json`, `examples/playwright/pnpm-lock.yaml`, `examples/playwright/e2e/fixtures.ts`, `.chief/prds/refactor-playwright-example/prd.json`
- **Learnings for future iterations:**
  - `@msw/playwright` uses `page.route()` internally — no `mockServiceWorker.js` needed; the PRD's mention of `npx msw init` is not necessary for this integration
  - The `handlers` fixture option value is an empty array `[]`, not a pre-built handler set — MSW-based specs that need handlers call `network.use(http.get(...))` inline
  - New MSW-based spec files should import from `./fixtures` (not `@playwright/test`) to get the pre-wired `network` fixture
---

## 2026-02-18 - US-002
- What was implemented: Added order routes to the demo SPA app
  - Added `renderOrders()` function in `app/app.js` — fetches `GET /api/v1/orders` and renders order cards with `data-testid="order-card"`
  - Added `renderOrderDetail(orderId)` function — fetches `GET /api/v1/orders/:orderId`, renders order detail with `data-testid="order-id"`, `data-testid="order-status"`, `data-testid="order-total"`, order items with `data-testid="order-item"` + `data-item-type`, and payment method with `data-testid="payment-method"` + `data-payment-type`
  - Extended the router to handle `/orders` and `/orders/:id` paths
  - Added `#order-list` and `#order-detail` HTML sections to `app/index.html`
  - Added "Orders" link to the nav in `index.html`
- Files changed: `examples/playwright/app/app.js`, `examples/playwright/app/index.html`, `.chief/prds/refactor-playwright-example/prd.json`
- **Learnings for future iterations:**
  - The SPA router in `app.js` uses string matching on `window.location.pathname` — order routes must come before any general catch-all
  - `show(id)` hides all `#app > div` children by setting `display:none`, then shows the specified one — new views need a top-level `<div id="...">` child of `#app`
  - Payment type detection in the app uses `pm.last4 != null` to distinguish credit card from bank transfer (fields from anyOf variants)
  - All 8 existing Playwright tests passed after adding the new routes
---

## 2026-02-18 - US-001
- What was implemented: Extended `examples/playwright/specs/acme-api.yaml` with composite schema keywords and order-related endpoints
  - Added `BaseEntity` schema (id, createdAt, updatedAt) as base for `allOf`
  - Added `Order` schema using `allOf` extending `BaseEntity` with status enum, total, currency
  - Added `OrderDetail` schema using `allOf` extending `Order` with embedded items and paymentMethod
  - Added `PhysicalProduct` and `DigitalProduct` schemas as `oneOf` variants for `OrderItem` with discriminator on `type` field
  - Added `CreditCard` and `BankTransfer` schemas as `anyOf` variants for `PaymentMethod`
  - Added `CreateOrderInput` schema for POST request body
  - Added `GET /orders` (`listOrders`) — paginated list endpoint
  - Added `GET /orders/{orderId}` (`getOrder`) — single order with items and payment method
  - Added `POST /orders` (`createOrder`) — 201 and 422 responses
- Files changed: `examples/playwright/specs/acme-api.yaml`, `.chief/prds/refactor-playwright-example/prd.json`
- **Learnings for future iterations:**
  - Spec validation: use `packages/openapi-mocks/` directory to run swagger-parser (it has the dependency), with relative path `../../examples/playwright/specs/acme-api.yaml`
  - OpenAPI 3.1.0 `oneOf` discriminator requires `mapping` under `discriminator.mapping` for each variant
  - `x-faker-method` annotation on numeric fields (like `total`) works — `commerce.price` returns a string so may need attention in later tests
  - The PRD JSON is new (created in this iteration) — it's committed under `.chief/prds/refactor-playwright-example/prd.json`
---
