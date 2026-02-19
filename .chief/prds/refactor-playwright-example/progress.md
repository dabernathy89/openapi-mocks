## Codebase Patterns
- The `examples/playwright/` project is NOT a pnpm workspace member — it must be treated as a standalone package
- `openapi-mocks` is linked via `file:../../packages/openapi-mocks` in the example's package.json
- To validate a spec with swagger-parser, run from `packages/openapi-mocks/` where the dependency is installed
- The existing test pattern uses `mocks.data()` + Playwright's `page.route()` for interception (no MSW yet)
- Tests use `data-testid` attributes for element selection
- The app is a vanilla JS SPA served by `server.js` on port 4200

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
