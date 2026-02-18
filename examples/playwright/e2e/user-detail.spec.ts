/**
 * User detail page tests.
 *
 * Demonstrates:
 *   - Path-param echoing (simulated via transform since echoPathParams
 *     requires MSW service workers; we use data + Playwright route instead)
 *   - Per-operation transform to inject specific field values
 *   - Error response (422) with field-level validation errors
 *   - ignoreExamples option to bypass spec-defined example values
 */

import { test, expect } from "@playwright/test";
import { createMockClient } from "openapi-mocks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, "../specs/acme-api.yaml");

const mocks = createMockClient(specPath, {
  seed: 42,
  baseUrl: "http://localhost:4200/api/v1",
});

// ---------------------------------------------------------------------------
// 1. Path Param Echoing
// ---------------------------------------------------------------------------

test.describe("User detail page", () => {
  test("displays the requested user ID in the page", async ({ page }) => {
    const data = await mocks.data({
      operations: {
        getUser: {},
      },
    });

    const userData = data.get("getUser")?.get(200) as Record<string, unknown>;

    // Simulate echoPathParams: inject the path param into the response.
    const userId = "usr_abc123";
    await page.route(`**/api/v1/users/${userId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...userData,
          // Echo the path param back in the response — mirrors what
          // `echoPathParams: true` does in the MSW handler.
          id: userId,
        }),
      });
    });

    await page.goto(`/users/${userId}`);

    await expect(page.locator("[data-testid='user-id']")).toHaveText(userId);
  });

  test("renders a specific user profile with overrides via transform", async ({
    page,
  }) => {
    // Generate base data, then apply a transform to inject specific fields.
    const data = await mocks.data({
      operations: {
        getUser: {
          transform: (d) => ({
            ...(d as Record<string, unknown>),
            name: "Ada Lovelace",
            email: "ada@example.com",
          }),
        },
      },
    });

    const userData = data.get("getUser")?.get(200) as Record<string, unknown>;

    await page.route("**/api/v1/users/usr_001", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userData),
      });
    });

    await page.goto("/users/usr_001");

    await expect(page.locator("[data-testid='user-name']")).toHaveText(
      "Ada Lovelace",
    );
    await expect(page.locator("[data-testid='user-email']")).toHaveText(
      "ada@example.com",
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Validation Failure – 422 Response
// ---------------------------------------------------------------------------

test.describe("Create user form", () => {
  test("shows field errors on validation failure (422)", async ({ page }) => {
    const data = await mocks.data({
      operations: {
        createUser: {
          // Select the 422 error response instead of the default 201.
          statusCode: 422,
          transform: (d) => ({
            ...(d as Record<string, unknown>),
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

    const errorData = data.get("createUser")?.get(422);
    expect(errorData).toBeDefined();

    await page.route("**/api/v1/users", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify(errorData),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/users/new");

    await page.getByLabel("Email").fill("taken@example.com");
    await page.getByLabel("Username").fill("ab");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.locator("[data-testid='field-error-email']")).toHaveText(
      "Email is already taken.",
    );
    await expect(
      page.locator("[data-testid='field-error-username']"),
    ).toHaveText("Username must be between 3 and 20 characters.");

    // Form remains usable after a validation error.
    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 3. ignoreExamples – Bypass Spec-Defined Example Values
// ---------------------------------------------------------------------------

test.describe("ignoreExamples option", () => {
  test("generates fresh email values ignoring spec example values", async ({
    page,
  }) => {
    // The spec defines `example: "user@example.com"` on the email field.
    // With ignoreExamples: true, Faker generates a fresh value instead.
    const data = await mocks.data({
      ignoreExamples: true,
      operations: {
        getUser: {},
      },
    });

    const userData = data.get("getUser")?.get(200) as Record<string, unknown>;

    // Verify the generated email is NOT the spec example before rendering.
    expect(typeof userData.email).toBe("string");
    expect(userData.email as string).toContain("@");
    expect(userData.email).not.toBe("user@example.com");

    await page.route("**/api/v1/users/usr_001", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userData),
      });
    });

    await page.goto("/users/usr_001");

    const email = await page
      .locator("[data-testid='user-email']")
      .textContent();
    expect(email).toBeTruthy();
    expect(email).toContain("@");
    // Should NOT be the spec's hard-coded example value.
    expect(email).not.toBe("user@example.com");
  });
});
