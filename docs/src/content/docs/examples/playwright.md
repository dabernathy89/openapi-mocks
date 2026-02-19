---
title: Playwright E2E Testing
description: End-to-end testing with openapi-mocks and Playwright using page.route() to intercept API calls.
---

This guide walks through the [`examples/playwright/`](https://github.com/your-org/openapi-mocks/tree/main/examples/playwright) project, which demonstrates how to use `openapi-mocks` for end-to-end testing with [Playwright](https://playwright.dev/).

The approach: generate realistic mock data from your OpenAPI spec with `createMockClient`, then wire it into Playwright tests via `page.route()` to intercept API calls. No service worker required — works in any environment including CI.

## The problem

End-to-end tests that hit real APIs are slow, brittle, and depend on external state. Tests that use hardcoded JSON fixtures drift out of sync with the real schema. `openapi-mocks` gives you the best of both worlds: **spec-accurate mock data that stays in sync with your API contract, generated deterministically for each test.**

## Project setup

The example is a standalone project (not a monorepo workspace member) you can clone and run independently.

```
examples/playwright/
├── specs/
│   └── acme-api.yaml          # OpenAPI 3.1 spec (users CRUD)
├── app/
│   ├── index.html             # Static SPA demo app
│   └── app.js                 # Simple router + fetch-based UI
├── e2e/
│   ├── users-list.spec.ts     # List rendering, addresses, pagination
│   └── user-detail.spec.ts    # Detail page, transforms, 422 errors
├── server.js                  # Static file server for the demo app
├── playwright.config.ts       # Playwright configuration
└── package.json
```

### Installation

```bash
cd examples/playwright

# Install dependencies (links openapi-mocks from the local workspace)
pnpm install

# Install Playwright's Chromium browser (first time only)
pnpm run install-browsers

# Run tests
pnpm test
```

## Generating mock data

Create a shared client once at the top of your test file. The client parses and resolves the spec once, then generates data or handlers on each call.

```ts
import { createMockClient } from "openapi-mocks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, "../specs/acme-api.yaml");

const mocks = createMockClient(specPath, {
  seed: 42,                               // fixed seed → deterministic output
  baseUrl: "http://localhost:4200/api/v1",
});
```

## Wiring into Playwright

Use `page.route()` to intercept requests and return generated data:

```ts
test("renders exactly 3 users", async ({ page }) => {
  const data = await mocks.data({
    operations: {
      listUsers: {
        arrayLengths: { users: [3, 3] },  // pin to exactly 3 users
      },
    },
  });

  const listUsersData = data.get("listUsers")?.get(200);

  await page.route("**/api/v1/users", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listUsersData),
    });
  });

  await page.goto("/users");
  await expect(page.locator("[data-testid='user-card']")).toHaveCount(3);
});
```

## Patterns

### Happy-path list rendering with fixed array lengths

Pin the number of items returned so assertions are straightforward:

```ts
const data = await mocks.data({
  operations: {
    listUsers: {
      arrayLengths: { users: [3, 3] },  // always exactly 3
    },
  },
});
```

### Nested array lengths with wildcard notation

Control arrays nested within each element using bracket `[*]` notation:

```ts
const data = await mocks.data({
  operations: {
    listUsers: {
      arrayLengths: {
        users: [2, 2],
        "users[*].addresses": [1, 1],  // 1 address per user
      },
    },
  },
});
```

### Per-test overrides via transform

Inject specific field values while keeping everything else Faker-generated:

```ts
const data = await mocks.data({
  operations: {
    getUser: {
      transform: (d) => ({
        ...d,
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    },
  },
});
```

### Path-param echoing (simulated)

When using `page.route()`, you can simulate `echoPathParams` by injecting the path param yourself:

```ts
const userId = "usr_abc123";
await page.route(`**/api/v1/users/${userId}`, (route) => {
  route.fulfill({
    body: JSON.stringify({ ...userData, id: userId }),
  });
});

await page.goto(`/users/${userId}`);
await expect(page.locator("[data-testid='user-id']")).toHaveText(userId);
```

> **Tip:** For full automatic `echoPathParams` support (where the library sets the field for you), use `mocks.handlers()` with MSW service workers. See [Using with MSW](#using-with-msw) below.

### Error responses (422)

Force a specific status code to test your error-handling UI:

```ts
const data = await mocks.data({
  operations: {
    createUser: {
      statusCode: 422,             // select the 422 response schema
      transform: (d) => ({
        ...d,
        fieldErrors: [
          { field: "email", message: "Email is already taken." },
          { field: "username", message: "Username must be between 3 and 20 characters." },
        ],
      }),
    },
  },
});

const errorData = data.get("createUser")?.get(422);

await page.route("**/api/v1/users", (route) => {
  if (route.request().method() === "POST") {
    route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify(errorData) });
  } else {
    route.continue();
  }
});
```

### Pagination with request-aware transforms

The `transform` option on `.handlers()` receives both the generated base data and the live MSW `Request` object, so you can read query parameters and patch the response before it's returned:

```ts
const handlers = await mocks.handlers({
  operations: {
    listUsers: {
      arrayLengths: { users: [10, 10] },
      transform: (data, request) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get("cursor");
        const page = cursor ? parseInt(cursor, 10) : 1;

        return {
          ...data,
          page,
          nextPage: page < 3 ? page + 1 : null,
          totalPages: 3,
        };
      },
    },
  },
});

await startMockServiceWorker(page, handlers);
```

The transform runs inside the MSW handler at intercept time. The library generates the base payload once, then your transform tweaks it per-request. No manual `page.route()` wiring needed.

### Seeding for snapshot tests

With a fixed `seed`, generated data is identical across runs. Use this to snapshot the output and catch regressions:

```ts
const mocks = createMockClient(specPath, { seed: 42 });

const data = await mocks.data({
  operations: { listUsers: { arrayLengths: { users: [2, 2] } } },
});

const users = (data.get("listUsers")?.get(200) as any).users;

// Same seed → same names every time. Snapshot catches generation regressions.
expect(users[0].name).toMatchSnapshot("first-user-name");
```

### ignoreExamples

Bypass `example:` values defined in the spec and get fresh Faker-generated data instead. Useful when spec examples like `"user@example.com"` would leak into screenshots or snapshots:

```ts
const data = await mocks.data({
  ignoreExamples: true,
  operations: { getUser: {} },
});

const userData = data.get("getUser")?.get(200);
// email is now a Faker-generated address, not "user@example.com"
```

## Using with MSW

For full MSW integration (including automatic `echoPathParams`), use `mocks.handlers()` with MSW's `setupWorker`:

```ts
// In your app's entry point (e.g., main.ts):
import { setupWorker } from "msw/browser";

const handlers = await mocks.handlers({ echoPathParams: true });
const worker = setupWorker(...handlers);
await worker.start();
```

```ts
// In Playwright, initialize the worker before navigating:
await page.addInitScript({ path: "setup-msw.js" });
await page.goto("/users/usr_abc123");

// The `userId` field in the response will automatically match "usr_abc123"
await expect(page.locator("[data-testid='user-id']")).toHaveText("usr_abc123");
```

See the full runnable code in [`examples/playwright/`](https://github.com/your-org/openapi-mocks/tree/main/examples/playwright).
