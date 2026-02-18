// ---------------------------------------------------------------------------
// Example: Using openapi-mocks with Playwright for E2E testing
// ---------------------------------------------------------------------------
//
// This file demonstrates the intended end-user API for generating MSW handlers
// from an OpenAPI spec and wiring them into Playwright tests.
//
// Prerequisites:
//   npm install openapi-mocks msw playwright @playwright/test
//
// The OpenAPI spec is loaded from a local file, but any supported input works
// (URL, JSON string, plain object).
// ---------------------------------------------------------------------------

import { test, expect } from "@playwright/test";
import { createMockClient } from "openapi-mocks";

// ---------------------------------------------------------------------------
// Shared client – configured once, used across all tests
// ---------------------------------------------------------------------------
// The client parses and resolves the spec once, then exposes methods that
// generate handlers or raw data without re-reading the file or repeating
// options. Per-call options can still override or extend the defaults.

const mocks = createMockClient("./specs/acme-api.yaml", {
  seed: 42,
  baseUrl: "https://api.acme.dev/v1",
});

// ---------------------------------------------------------------------------
// 1. Happy Path – List Users
// ---------------------------------------------------------------------------

test.describe("User list page", () => {
  test("renders users returned by the API", async ({ page }) => {
    const handlers = await mocks.handlers({
      operations: {
        listUsers: {
          // Pin to exactly 3 items so the assertion is straightforward.
          arrayLengths: { users: [3, 3] },
        },
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/users");

    const cards = page.getByTestId("user-card");
    await expect(cards).toHaveCount(3);

    // With a fixed seed, the generated names are deterministic.
    // Snapshot the visible text to catch regressions in mock output.
    const names = await cards.allTextContents();
    expect(names).toMatchSnapshot("user-list-names");
  });

  test("renders nested addresses for each user", async ({ page }) => {
    const handlers = await mocks.handlers({
      operations: {
        listUsers: {
          arrayLengths: {
            users: [2, 2],
            // Bracket notation targets arrays within each element.
            // [1, 1] pins to exactly 1; [1, 3] would randomize between 1–3.
            "users[*].addresses": [1, 1],
          },
        },
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/users");

    for (const card of await page.getByTestId("user-card").all()) {
      await expect(card.getByTestId("address")).toHaveCount(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. User Detail – Path Param Echoing & Overrides
// ---------------------------------------------------------------------------

test.describe("User detail page", () => {
  test("displays the requested user ID via path-param echoing", async ({
    page,
  }) => {
    const handlers = await mocks.handlers({
      // Echo the `userId` path parameter into the response body so the
      // rendered page shows the ID that was actually requested.
      echoPathParams: true,
      operations: {
        getUser: {},
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/users/usr_abc123");

    await expect(page.getByTestId("user-id")).toHaveText("usr_abc123");
  });

  test("renders a specific user profile with overrides", async ({ page }) => {
    const handlers = await mocks.handlers({
      operations: {
        getUser: {
          // Hard-code specific fields. Everything else is still Faker-generated.
          transform: (data) => ({
            ...data,
            name: "Ada Lovelace",
            email: "ada@example.com",
            settings: { ...data.settings, theme: "dark" },
          }),
        },
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/users/usr_001");

    await expect(page.getByTestId("user-name")).toHaveText("Ada Lovelace");
    await expect(page.getByTestId("user-email")).toHaveText("ada@example.com");
  });
});

// ---------------------------------------------------------------------------
// 3. Pagination – Request-Aware Transform
// ---------------------------------------------------------------------------

test.describe("Paginated list", () => {
  test("sets nextPage cursor based on query params", async ({ page }) => {
    const handlers = await mocks.handlers({
      operations: {
        listUsers: {
          arrayLengths: { users: [10, 10] },
          // The transform runs inside the MSW handler at intercept time,
          // so it has access to the incoming request. The library generates
          // the base data, then your transform tweaks it before responding.
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
    await page.goto("https://app.acme.dev/users");

    await expect(page.getByTestId("current-page")).toHaveText("1");
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page.getByTestId("current-page")).toHaveText("2");
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page.getByTestId("current-page")).toHaveText("3");

    await expect(page.getByRole("link", { name: "Next" })).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// 4. Validation Failure – 422 Response
// ---------------------------------------------------------------------------

test.describe("Create user form", () => {
  test("shows field errors on validation failure", async ({ page }) => {
    const handlers = await mocks.handlers({
      operations: {
        createUser: {
          // Force the 422 response instead of the default 201.
          statusCode: 422,

          transform: (data, _request) => ({
            ...data,
            fieldErrors: [
              { field: "email", message: "Email is already taken." },
              {
                field: "username",
                message: "Username must be between 3 and 20 characters.",
              },
            ],
          }),
        },
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/users/new");

    await page.getByLabel("Email").fill("taken@example.com");
    await page.getByLabel("Username").fill("ab");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByTestId("field-error-email")).toHaveText(
      "Email is already taken.",
    );
    await expect(page.getByTestId("field-error-username")).toHaveText(
      "Username must be between 3 and 20 characters.",
    );

    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 5. Multiple Operations & Status Code Filtering
// ---------------------------------------------------------------------------

test.describe("Dashboard page", () => {
  test("renders data from multiple endpoints at once", async ({ page }) => {
    const handlers = await mocks.handlers({
      // Only generate 200 responses (the default returns the lowest 2xx,
      // but statusCodes makes it explicit).
      statusCodes: [200],
      operations: {
        listUsers: { arrayLengths: { users: [5, 5] } },
        listOrders: { arrayLengths: { orders: [10, 10] } },
        // Empty object = include with all defaults.
        getStats: {},
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/dashboard");

    await expect(page.getByTestId("user-count")).toHaveText("5");
    await expect(page.getByTestId("order-count")).toHaveText("10");
    await expect(page.getByTestId("stats-panel")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Ignore Examples – Skip Spec-Defined Example Values
// ---------------------------------------------------------------------------

test.describe("Ignore spec examples", () => {
  test("generates fresh data ignoring spec example values", async ({ page }) => {
    // Some specs ship with placeholder examples like "string" or
    // "user@example.com" that leak into screenshots. ignoreExamples
    // bypasses them so every value comes from Faker.
    const handlers = await mocks.handlers({
      ignoreExamples: true,
      operations: {
        getUser: {},
      },
    });

    await startMockServiceWorker(page, handlers);
    await page.goto("https://app.acme.dev/users/usr_001");

    // The email should be a Faker-generated address, not the spec's
    // hard-coded "user@example.com".
    const email = await page.getByTestId("user-email").textContent();
    expect(email).not.toBe("user@example.com");
    expect(email).toContain("@");
  });
});

// ---------------------------------------------------------------------------
// Helper: Wire MSW handlers into Playwright via a service worker
// ---------------------------------------------------------------------------
// This is a simplified sketch. A real implementation would:
//   - Serve the MSW service worker script from a known route.
//   - Use `page.addInitScript` to register handlers before any app code runs.
//   - Handle the worker lifecycle (start before navigation, stop in afterEach).

async function startMockServiceWorker(
  page: import("@playwright/test").Page,
  handlers: Awaited<ReturnType<typeof mocks.handlers>>,
) {
  await page.addInitScript({
    content: `
      // Placeholder – real implementation registers handlers with
      // setupWorker(...handlers).start() inside the app's service worker.
      window.__MSW_HANDLERS__ = ${JSON.stringify(handlers.length)} handlers registered;
    `,
  });
}
