/**
 * Library feature coverage tests.
 *
 * Demonstrates every major library option not covered by other spec files:
 *   1. statusCodes filtering  — only generate specific HTTP status codes
 *   2. multiple operations    — single mocks.data() call covers multiple endpoints
 *   3. generateFromSchema     — standalone utility, no spec file, pure Node.js
 *   4. seed reproducibility   — same seed → same output; different seed → different output
 *
 * Tests 1, 2, and 4 use `mocks.data()` + Playwright's `page.route()`.
 * Test 3 does NOT navigate to any page — it is a pure Node.js assertion.
 */

import { test, expect } from "@playwright/test";
import { createMockClient, generateFromSchema } from "openapi-mocks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, "../specs/acme-api.yaml");

// ---------------------------------------------------------------------------
// 1. statusCodes filtering
// ---------------------------------------------------------------------------

test.describe("statusCodes filtering", () => {
  test("only 200 responses are generated; dashboard renders user and order counts", async ({ page }) => {
    const mocks = createMockClient(specPath, {
      seed: 10,
      baseUrl: "http://localhost:4200/api/v1",
    });

    const data = await mocks.data({
      statusCodes: [200],
      operations: {
        listUsers: {},
        listOrders: {},
      },
    });

    // Both operations must be present
    expect(data.has("listUsers")).toBe(true);
    expect(data.has("listOrders")).toBe(true);

    // Only 200 status codes should exist — no 4xx entries
    for (const [, statusMap] of data) {
      for (const [statusCode] of statusMap) {
        expect(statusCode).toBe(200);
      }
    }

    const usersData = data.get("listUsers")?.get(200) as Record<string, unknown>;
    const ordersData = data.get("listOrders")?.get(200) as Record<string, unknown>;
    expect(usersData).toBeDefined();
    expect(ordersData).toBeDefined();

    // Intercept both endpoints so the dashboard can render counts
    await page.route("**/api/v1/users**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...usersData,
          page: 1,
          totalPages: 1,
          nextPage: null,
        }),
      });
    });

    await page.route("**/api/v1/orders**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...ordersData,
          page: 1,
          totalPages: 1,
          nextPage: null,
        }),
      });
    });

    await page.goto("/dashboard");

    // Both counts must be populated (non-empty text)
    const userCountEl = page.locator("[data-testid='user-count']");
    const orderCountEl = page.locator("[data-testid='order-count']");

    await expect(userCountEl).not.toBeEmpty();
    await expect(orderCountEl).not.toBeEmpty();

    // The counts must be numeric
    const userCount = parseInt(await userCountEl.textContent() ?? "", 10);
    const orderCount = parseInt(await orderCountEl.textContent() ?? "", 10);
    expect(isNaN(userCount)).toBe(false);
    expect(isNaN(orderCount)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Multiple operations at once
// ---------------------------------------------------------------------------

test.describe("multiple operations at once", () => {
  test("single mocks.data() call intercepts listUsers, listOrders, and getOrder", async ({ page }) => {
    const mocks = createMockClient(specPath, {
      seed: 20,
      baseUrl: "http://localhost:4200/api/v1",
    });

    const data = await mocks.data({
      operations: {
        listUsers: { arrayLengths: { users: [2, 2] } },
        listOrders: { arrayLengths: { orders: [2, 2] } },
        getOrder: {},
      },
    });

    // All three operations must have data
    expect(data.has("listUsers")).toBe(true);
    expect(data.has("listOrders")).toBe(true);
    expect(data.has("getOrder")).toBe(true);

    const usersData = data.get("listUsers")?.get(200) as Record<string, unknown>;
    const ordersData = data.get("listOrders")?.get(200) as Record<string, unknown>;
    const orderData = data.get("getOrder")?.get(200) as Record<string, unknown>;

    expect(usersData).toBeDefined();
    expect(ordersData).toBeDefined();
    expect(orderData).toBeDefined();

    // Each intercepted endpoint returns data
    let usersCalled = false;
    let ordersCalled = false;
    let orderDetailCalled = false;

    await page.route("**/api/v1/users", (route) => {
      usersCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...usersData, page: 1, totalPages: 1, nextPage: null }),
      });
    });

    await page.route("**/api/v1/orders", (route) => {
      ordersCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...ordersData, page: 1, totalPages: 1, nextPage: null }),
      });
    });

    const orderId = orderData["id"] as string;
    await page.route(`**/api/v1/orders/${orderId}`, (route) => {
      orderDetailCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(orderData),
      });
    });

    // Trigger users endpoint
    await page.goto("/users");
    await expect(page.locator("[data-testid='user-card']")).toHaveCount(2);
    expect(usersCalled).toBe(true);

    // Trigger orders endpoint
    await page.goto("/orders");
    await expect(page.locator("[data-testid='order-card']")).toHaveCount(2);
    expect(ordersCalled).toBe(true);

    // Trigger order detail endpoint
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator("[data-testid='order-id']")).toHaveText(orderId);
    expect(orderDetailCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. generateFromSchema — standalone utility (pure Node.js, no page navigation)
// ---------------------------------------------------------------------------

test.describe("generateFromSchema — standalone utility", () => {
  test("generates Order-shaped data from an inline schema without a spec file", async () => {
    // Define the Order schema inline — matches the allOf structure in acme-api.yaml
    const orderSchema = {
      type: "object",
      required: ["id", "createdAt", "updatedAt", "status", "total", "currency"],
      properties: {
        id: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        status: {
          type: "string",
          enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
        },
        total: { type: "number", minimum: 0 },
        currency: { type: "string", minLength: 3, maxLength: 3 },
      },
    };

    const generated = generateFromSchema(orderSchema, { seed: 77 }) as Record<string, unknown>;

    // Required fields must be present
    expect(generated).toHaveProperty("id");
    expect(generated).toHaveProperty("status");
    expect(generated).toHaveProperty("total");
    expect(generated).toHaveProperty("currency");

    // Type assertions
    expect(typeof generated["id"]).toBe("string");
    expect(["pending", "processing", "shipped", "delivered", "cancelled"]).toContain(generated["status"]);
    expect(typeof generated["total"]).toBe("number");
    expect(typeof generated["currency"]).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 4. Seed reproducibility
// ---------------------------------------------------------------------------

test.describe("seed reproducibility", () => {
  test("same seed produces identical output; different seeds produce different output", async () => {
    const mocks1 = createMockClient(specPath, { seed: 1234 });
    const mocks2 = createMockClient(specPath, { seed: 1234 });
    const mocks3 = createMockClient(specPath, { seed: 9999 });

    const [data1, data2, data3] = await Promise.all([
      mocks1.data({ operations: { listUsers: { arrayLengths: { users: [3, 3] } } } }),
      mocks2.data({ operations: { listUsers: { arrayLengths: { users: [3, 3] } } } }),
      mocks3.data({ operations: { listUsers: { arrayLengths: { users: [3, 3] } } } }),
    ]);

    const users1 = (data1.get("listUsers")?.get(200) as { users: Array<{ id: string; name: string; email: string }> }).users;
    const users2 = (data2.get("listUsers")?.get(200) as { users: Array<{ id: string; name: string; email: string }> }).users;
    const users3 = (data3.get("listUsers")?.get(200) as { users: Array<{ id: string; name: string; email: string }> }).users;

    expect(users1).toBeDefined();
    expect(users2).toBeDefined();
    expect(users3).toBeDefined();

    // Same seed → identical output
    expect(users1[0]?.id).toBe(users2[0]?.id);
    expect(users1[0]?.name).toBe(users2[0]?.name);
    expect(users1[0]?.email).toBe(users2[0]?.email);

    // Different seed → at least one field differs
    const anyDiffers =
      users1[0]?.id !== users3[0]?.id ||
      users1[0]?.name !== users3[0]?.name ||
      users1[0]?.email !== users3[0]?.email;
    expect(anyDiffers).toBe(true);
  });
});
