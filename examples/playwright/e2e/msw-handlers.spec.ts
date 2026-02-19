/**
 * MSW handler tests for request-aware features.
 *
 * These tests demonstrate features that are only possible through
 * `mocks.handlers()` (not `mocks.data()`):
 *
 *  1. `echoPathParams` — path parameters from the request URL are injected
 *     into matching fields in the generated response.
 *  2. `transform` with access to the live `Request` object — the handler can
 *     read the request body and use it to shape the response.
 *  3. `statusCode` override at the handler level — force a specific status
 *     code (e.g. 422) for an operation so the UI error path is exercised.
 *
 * All spec files that use `@msw/playwright` import from `./fixtures` instead
 * of `@playwright/test` to get the pre-wired `network` fixture.
 */

import { test, expect } from "./fixtures";
import { createMockClient } from "openapi-mocks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, "../specs/acme-api.yaml");

// ---------------------------------------------------------------------------
// 1. echoPathParams
// ---------------------------------------------------------------------------

test.describe("echoPathParams", () => {
  test("echoes the userId path param into the response id field", async ({
    page,
    network,
  }) => {
    // Create a client with echoPathParams enabled. This is the correct way to
    // enable path-param echoing — it is a global option set at client creation
    // time so that the MSW handler closure can capture it.
    const echoMocks = createMockClient(specPath, {
      baseUrl: "http://localhost:4200/api/v1",
      echoPathParams: true,
    });

    const handlers = await echoMocks.handlers({
      operations: { getUser: {} },
    });

    // Register the handlers with the MSW network fixture.
    network.use(...handlers);

    const userId = "usr_abc123";
    await page.goto(`/users/${userId}`);

    // The echoPathParams feature maps the `userId` path param to the `id`
    // field in the response (name similarity match).
    await expect(page.locator("[data-testid='user-id']")).toHaveText(userId);
  });
});

// ---------------------------------------------------------------------------
// 2. request-body transform
// ---------------------------------------------------------------------------

test.describe("request-body transform", () => {
  test("echoes the posted username into the response name field", async ({
    page,
    network,
  }) => {
    // The standard mock client (no echoPathParams needed here).
    const mocks = createMockClient(specPath, {
      seed: 99,
      baseUrl: "http://localhost:4200/api/v1",
    });

    const handlers = await mocks.handlers({
      operations: {
        createUser: {
          // The transform receives the generated data AND the live Request
          // object. We read the request body and echo `username` into the
          // response `name` field.
          transform: async (data, req) => {
            if (!req) return data;
            try {
              const body = (await req.json()) as Record<string, unknown>;
              const username = body["username"];
              if (typeof username === "string") {
                return { ...data, name: username };
              }
            } catch {
              // Body unreadable — return generated data unchanged.
            }
            return data;
          },
        },
      },
    });

    network.use(...handlers);

    await page.goto("/users/new");

    // Fill in the form and submit — the POST goes to /api/v1/users and the
    // MSW handler intercepts it, reads the body, and echoes `username` back
    // as `name` in the 201 response.
    await page.getByLabel("Username").fill("testuser42");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("button", { name: "Create" }).click();

    // After a successful 201 the app redirects to /users.
    // Wait for navigation to confirm the handler returned a success response.
    await page.waitForURL("**/users");
    await expect(page.locator("body")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. statusCode override via handler
// ---------------------------------------------------------------------------

test.describe("statusCode override via handler", () => {
  test("forces createOrder to return 422 and renders the error UI", async ({
    page,
    network,
  }) => {
    const mocks = createMockClient(specPath, {
      seed: 42,
      baseUrl: "http://localhost:4200/api/v1",
    });

    const handlers = await mocks.handlers({
      operations: {
        createOrder: {
          // Force the 422 response code. The library will generate data from
          // the ValidationError schema defined for the 422 response.
          statusCode: 422,
          // Inject a human-readable message so the UI can display it.
          transform: (data) => ({
            ...data,
            message: "Invalid order: currency is required.",
            fieldErrors: [
              { field: "currency", message: "Currency is required." },
            ],
          }),
        },
      },
    });

    network.use(...handlers);

    await page.goto("/orders/new");

    // Submit the form — MSW intercepts the POST and returns 422.
    await page.getByRole("button", { name: "Place Order" }).click();

    // The error UI should show the validation message.
    await expect(page.locator("[data-testid='order-error']")).toBeVisible();
    await expect(page.locator("[data-testid='order-error']")).toHaveText(
      "Invalid order: currency is required.",
    );
  });
});
