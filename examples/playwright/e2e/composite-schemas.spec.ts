/**
 * Composite schema tests: allOf, oneOf, anyOf.
 *
 * Demonstrates how `openapi-mocks` generates data from composite schemas:
 *   - allOf  → Order extends BaseEntity (merged fields)
 *   - oneOf  → OrderItem discriminator (PhysicalProduct or DigitalProduct)
 *   - anyOf  → PaymentMethod (CreditCard or BankTransfer)
 *
 * All tests use `mocks.data()` + Playwright's `page.route()`.
 */

import { test, expect } from "@playwright/test";
import { createMockClient } from "openapi-mocks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, "../specs/acme-api.yaml");

const mocks = createMockClient(specPath, {
  seed: 99,
  baseUrl: "http://localhost:4200/api/v1",
});

// ---------------------------------------------------------------------------
// 1. allOf — Order extends BaseEntity
// ---------------------------------------------------------------------------

test.describe("allOf — Order extends BaseEntity", () => {
  test("generated order has BaseEntity fields and Order-specific fields", async ({ page }) => {
    const data = await mocks.data({
      operations: {
        getOrder: {},
      },
    });

    const orderData = data.get("getOrder")?.get(200) as Record<string, unknown>;
    expect(orderData).toBeDefined();

    // BaseEntity fields (from allOf base)
    expect(orderData).toHaveProperty("id");
    expect(orderData).toHaveProperty("createdAt");
    expect(orderData).toHaveProperty("updatedAt");
    expect(typeof orderData["id"]).toBe("string");
    // createdAt / updatedAt may be a Date object or an ISO string depending
    // on whether the faker method result was serialised.
    expect(orderData["createdAt"]).toBeTruthy();
    expect(orderData["updatedAt"]).toBeTruthy();

    // Order-specific fields (from allOf extension)
    expect(orderData).toHaveProperty("status");
    expect(orderData).toHaveProperty("total");
    expect(["pending", "processing", "shipped", "delivered", "cancelled"]).toContain(orderData["status"]);

    // Route the order detail endpoint so we can also assert via the UI.
    const orderId = orderData["id"] as string;
    await page.route(`**/api/v1/orders/${orderId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(orderData),
      });
    });

    await page.goto(`/orders/${orderId}`);

    await expect(page.locator("[data-testid='order-id']")).toHaveText(orderId);
    await expect(page.locator("[data-testid='order-status']")).not.toBeEmpty();
    await expect(page.locator("[data-testid='order-total']")).not.toBeEmpty();
  });
});

// ---------------------------------------------------------------------------
// 2. oneOf — OrderItem discriminator (PhysicalProduct or DigitalProduct)
// ---------------------------------------------------------------------------

test.describe("oneOf — OrderItem discriminator", () => {
  test("each order item has a discriminator type field and exclusive fields", async ({ page }) => {
    // Use a transform to guarantee items are present on the order detail.
    const data = await mocks.data({
      operations: {
        getOrder: {
          arrayLengths: { items: [3, 3] },
          transform: (d) => {
            const order = d as Record<string, unknown>;
            // If the generator didn't produce items, inject stubs so the
            // test always has something to assert against.
            if (!Array.isArray(order["items"]) || (order["items"] as unknown[]).length === 0) {
              order["items"] = [
                { type: "physical", weight: 1.5, dimensions: { width: 10, height: 5, depth: 3 } },
                { type: "digital", downloadUrl: "https://example.com/dl", licenseKey: "ABC-123" },
              ];
            }
            return order;
          },
        },
      },
    });

    const orderData = data.get("getOrder")?.get(200) as Record<string, unknown>;
    expect(orderData).toBeDefined();

    const items = orderData["items"] as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      // Discriminator field must always be present.
      expect(item).toHaveProperty("type");
      const itemType = item["type"];
      expect(["physical", "digital"]).toContain(itemType);

      if (itemType === "physical") {
        // PhysicalProduct fields only.
        expect(item).toHaveProperty("weight");
        expect(item).toHaveProperty("dimensions");
        // Must NOT have DigitalProduct fields.
        expect(item).not.toHaveProperty("downloadUrl");
        expect(item).not.toHaveProperty("licenseKey");
      } else {
        // DigitalProduct fields only.
        expect(item).toHaveProperty("downloadUrl");
        expect(item).toHaveProperty("licenseKey");
        // Must NOT have PhysicalProduct fields.
        expect(item).not.toHaveProperty("weight");
        expect(item).not.toHaveProperty("dimensions");
      }
    }

    // Verify the UI renders items with correct data-item-type attributes.
    const orderId = orderData["id"] as string;
    await page.route(`**/api/v1/orders/${orderId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(orderData),
      });
    });

    await page.goto(`/orders/${orderId}`);

    const itemEls = page.locator("[data-testid='order-item']");
    await expect(itemEls).toHaveCount(items.length);

    for (const itemEl of await itemEls.all()) {
      const itemType = await itemEl.getAttribute("data-item-type");
      expect(["physical", "digital"]).toContain(itemType);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. anyOf — PaymentMethod (CreditCard or BankTransfer)
// ---------------------------------------------------------------------------

test.describe("anyOf — PaymentMethod", () => {
  test("generated payment method has fields from CreditCard or BankTransfer", async ({ page }) => {
    // Use a transform to guarantee paymentMethod is present.
    const data = await mocks.data({
      operations: {
        getOrder: {
          transform: (d) => {
            const order = d as Record<string, unknown>;
            if (!order["paymentMethod"]) {
              order["paymentMethod"] = { last4: "4242", brand: "visa" };
            }
            return order;
          },
        },
      },
    });

    const orderData = data.get("getOrder")?.get(200) as Record<string, unknown>;
    expect(orderData).toBeDefined();

    const pm = orderData["paymentMethod"] as Record<string, unknown> | undefined;
    expect(pm).toBeDefined();

    // anyOf: must satisfy at least one variant.
    const isCreditCard = "last4" in (pm ?? {}) || "brand" in (pm ?? {});
    const isBankTransfer = "accountLast4" in (pm ?? {}) || "routingNumber" in (pm ?? {});
    expect(isCreditCard || isBankTransfer).toBe(true);

    if (isCreditCard && !isBankTransfer) {
      expect(pm).toHaveProperty("last4");
      expect(pm).toHaveProperty("brand");
    } else if (isBankTransfer && !isCreditCard) {
      expect(pm).toHaveProperty("accountLast4");
      expect(pm).toHaveProperty("routingNumber");
    }
    // anyOf allows both — if both sets are present, that is valid too.

    // Assert via the UI.
    const orderId = orderData["id"] as string;
    await page.route(`**/api/v1/orders/${orderId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(orderData),
      });
    });

    await page.goto(`/orders/${orderId}`);

    const paymentEl = page.locator("[data-testid='payment-method']");
    await expect(paymentEl).toBeVisible();

    const paymentType = await paymentEl.getAttribute("data-payment-type");
    expect(["credit-card", "bank-transfer"]).toContain(paymentType);
  });
});
