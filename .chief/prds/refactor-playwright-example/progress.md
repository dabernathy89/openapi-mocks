## Codebase Patterns
- The `examples/playwright/` project is NOT a pnpm workspace member — it must be treated as a standalone package
- `openapi-mocks` is linked via `file:../../packages/openapi-mocks` in the example's package.json
- To validate a spec with swagger-parser, run from `packages/openapi-mocks/` where the dependency is installed
- The existing test pattern uses `mocks.data()` + Playwright's `page.route()` for interception (no MSW yet)
- Tests use `data-testid` attributes for element selection
- The app is a vanilla JS SPA served by `server.js` on port 4200
- To install deps in `examples/playwright/` (NOT a workspace member), use `pnpm install --ignore-workspace` from that directory
- MSW-based tests import `{ test, expect }` from `./fixtures` — the `network` fixture runs automatically (`auto: true`) for every test; call `network.use()` for per-test handler overrides
- `@msw/playwright` uses `page.route()` internally — no service worker initialization needed; no `mockServiceWorker.js` generation required

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
