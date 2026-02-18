# openapi-mocks + Playwright Example

This example demonstrates how to use [`openapi-mocks`](https://github.com/your-org/openapi-mocks) for end-to-end testing with [Playwright](https://playwright.dev/).

The approach: use `createMockClient` to generate realistic mock data from your OpenAPI spec, then wire it into Playwright tests via `page.route()` to intercept API calls. No service worker needed — it works in any Playwright environment including CI.

## What's in this example

```
examples/playwright/
├── specs/
│   └── acme-api.yaml          # Minimal OpenAPI 3.1 spec (users CRUD)
├── app/
│   ├── index.html             # Static SPA demo app
│   └── app.js                 # Simple router + fetch-based UI
├── e2e/
│   ├── users-list.spec.ts     # List rendering, addresses, pagination
│   └── user-detail.spec.ts    # Detail page, transforms, 422 errors, ignoreExamples
├── server.js                  # Minimal static file server for the demo app
├── playwright.config.ts       # Playwright configuration
└── package.json
```

## Quick start

```bash
# Install dependencies (links openapi-mocks from the local workspace)
pnpm install

# Install Playwright's Chromium browser (first time only)
pnpm run install-browsers

# Run tests
pnpm test

# Run tests with visible browser (headed mode)
pnpm run test:headed
```

## How it works

### 1. Parse the spec once, use it everywhere

```ts
import { createMockClient } from "openapi-mocks";

const mocks = createMockClient("./specs/acme-api.yaml", {
  seed: 42,            // fixed seed → deterministic output
  baseUrl: "http://localhost:4200/api/v1",
});
```

### 2. Generate mock data for specific operations

```ts
const data = await mocks.data({
  operations: {
    listUsers: {
      arrayLengths: { users: [3, 3] },  // pin to exactly 3 users
    },
  },
});

const listUsersData = data.get("listUsers")?.get(200);
```

### 3. Intercept API calls with Playwright's `page.route()`

```ts
await page.route("**/api/v1/users", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(listUsersData),
  });
});

await page.goto("/users");
await expect(page.locator("[data-testid='user-card']")).toHaveCount(3);
```

## Patterns demonstrated

### Happy-path list rendering with fixed array lengths

Pin the number of items returned so assertions are straightforward:

```ts
arrayLengths: { users: [3, 3] }  // exactly 3 users
```

### Nested array lengths with wildcard notation

Control arrays nested within each element:

```ts
arrayLengths: {
  users: [2, 2],
  "users[*].addresses": [1, 1],  // 1 address per user
}
```

### Path-param echoing

Simulate `echoPathParams` by injecting the path param into the response via `page.route()`:

```ts
const userId = "usr_abc123";
await page.route(`**/api/v1/users/${userId}`, (route) => {
  route.fulfill({
    body: JSON.stringify({ ...userData, id: userId }),
  });
});
```

### Per-operation transforms

Inject specific field values while keeping the rest Faker-generated:

```ts
transform: (data) => ({
  ...data,
  name: "Ada Lovelace",
  email: "ada@example.com",
})
```

### Error responses (422)

Force a specific status code to test error handling:

```ts
const data = await mocks.data({
  operations: {
    createUser: {
      statusCode: 422,
      transform: (d) => ({
        ...d,
        fieldErrors: [
          { field: "email", message: "Email is already taken." },
        ],
      }),
    },
  },
});
```

### ignoreExamples

Bypass `example:` values in the spec and get fresh Faker-generated data:

```ts
const data = await mocks.data({
  ignoreExamples: true,
  operations: { getUser: {} },
});
```

### Pagination with request-aware route handlers

Playwright's `page.route()` gives you access to the intercepted request:

```ts
await page.route("**/api/v1/users**", (route, request) => {
  const url = new URL(request.url());
  const cursor = url.searchParams.get("cursor");
  const page = cursor ? parseInt(cursor, 10) : 1;

  route.fulfill({
    body: JSON.stringify({
      ...baseData,
      page,
      nextPage: page < 3 ? page + 1 : null,
      totalPages: 3,
    }),
  });
});
```

## Using with MSW (service workers)

For full MSW integration (e.g., to use `echoPathParams` with real request data in handlers), use `mocks.handlers()` with MSW's `setupWorker`:

```ts
// In your app's entry point:
import { setupWorker } from "msw/browser";
const worker = setupWorker(...await mocks.handlers());
await worker.start();

// In Playwright, initialize the worker before navigating:
await page.addInitScript({ path: "setup-msw.js" });
```

See the [openapi-mocks documentation](https://openapi-mocks.dev) for the full MSW integration guide.
