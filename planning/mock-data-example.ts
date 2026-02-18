// ---------------------------------------------------------------------------
// Example: Using openapi-mocks for standalone mock data generation
// ---------------------------------------------------------------------------
//
// This file demonstrates the core data generation API — no MSW, no request
// interception. Use this when you need realistic fake data for:
//
//   - Unit tests that assert on data shapes
//   - Storybook stories
//   - Seeding a database or local dev server
//   - Generating fixtures to commit alongside tests
//
// Prerequisites:
//   npm install openapi-mocks
//
// ---------------------------------------------------------------------------

import { createMockClient, generateFromSchema } from "openapi-mocks";

// ---------------------------------------------------------------------------
// 1. Basic Usage – Generate Data for All Operations
// ---------------------------------------------------------------------------

const mocks = createMockClient("./specs/acme-api.yaml", {
  seed: 42,
});

// Returns a Map<operationId, Map<statusCode, generatedData>>.
const allData = await mocks.data();

const listUsersOk = allData.get("listUsers")!.get(200);
console.log(listUsersOk);
// → { users: [{ id: "...", name: "...", email: "..." }, ...] }

const getUserOk = allData.get("getUser")!.get(200);
console.log(getUserOk);
// → { id: "...", name: "...", email: "...", settings: { ... } }

// ---------------------------------------------------------------------------
// 2. Scoped to Specific Operations
// ---------------------------------------------------------------------------

const userData = await mocks.data({
  operations: {
    listUsers: {
      arrayLengths: { users: [5, 5] },
    },
    getUser: {},
  },
});

console.log(userData.get("listUsers")!.get(200)!.users.length);
// → 5

// ---------------------------------------------------------------------------
// 3. Multiple Status Codes
// ---------------------------------------------------------------------------

const withErrors = await mocks.data({
  statusCodes: [200, 422],
  operations: {
    createUser: {},
  },
});

const success = withErrors.get("createUser")!.get(201);
const validationError = withErrors.get("createUser")!.get(422);
console.log(success);
// → { id: "...", name: "...", email: "..." }
console.log(validationError);
// → { message: "...", fieldErrors: [...] }

// ---------------------------------------------------------------------------
// 4. Transforms on Raw Data
// ---------------------------------------------------------------------------

const storyData = await mocks.data({
  operations: {
    getUser: {
      transform: (data) => ({
        ...data,
        name: "Jane Doe",
        avatar: "https://placeholders.dev/128x128",
      }),
    },
  },
});

console.log(storyData.get("getUser")!.get(200)!.name);
// → "Jane Doe"

// ---------------------------------------------------------------------------
// 5. Ignore Spec Examples
// ---------------------------------------------------------------------------

const freshData = await mocks.data({
  ignoreExamples: true,
  operations: {
    getUser: {},
  },
});

// Every value comes from Faker, even if the spec defines
// example: "user@example.com" on the email field.
console.log(freshData.get("getUser")!.get(200)!.email);
// → "Kendrick.Stehr@gmail.com" (or similar, determined by seed)

// ---------------------------------------------------------------------------
// 6. generateFromSchema – Ad-Hoc Single Schema
// ---------------------------------------------------------------------------
// For one-off mocking outside the context of a full OpenAPI document.
// Useful in unit tests where you have a schema object but no spec file.

const address = generateFromSchema({
  type: "object",
  properties: {
    street: { type: "string", "x-faker-method": "location.streetAddress" },
    city: { type: "string", "x-faker-method": "location.city" },
    zip: { type: "string", "x-faker-method": "location.zipCode" },
  },
  required: ["street", "city", "zip"],
}, { seed: 42 });

console.log(address);
// → { street: "123 Maple Dr", city: "East Rhiannonberg", zip: "48721" }

// ---------------------------------------------------------------------------
// 7. generateFromSchema – Composition (oneOf with discriminator)
// ---------------------------------------------------------------------------

const notification = generateFromSchema({
  oneOf: [
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["email"] },
        subject: { type: "string" },
        to: { type: "string", "x-faker-method": "internet.email" },
      },
      required: ["type", "subject", "to"],
    },
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["sms"] },
        body: { type: "string" },
        phone: { type: "string", "x-faker-method": "phone.number" },
      },
      required: ["type", "body", "phone"],
    },
  ],
  discriminator: {
    propertyName: "type",
    mapping: { email: "#/oneOf/0", sms: "#/oneOf/1" },
  },
}, { seed: 7 });

console.log(notification);
// → { type: "sms", body: "...", phone: "..." }
//   (or the email variant, depending on seed)

// ---------------------------------------------------------------------------
// 8. generateFromSchema – Arrays with Constraints
// ---------------------------------------------------------------------------

const tags = generateFromSchema({
  type: "array",
  items: { type: "string", "x-faker-method": "lorem.word" },
  minItems: 2,
  maxItems: 4,
}, { seed: 42 });

console.log(tags);
// → ["voluptas", "quia", "est"]

// ---------------------------------------------------------------------------
// 9. generateFromSchema – Nullable & Optional Fields
// ---------------------------------------------------------------------------

const profile = generateFromSchema({
  type: "object",
  properties: {
    name: { type: "string" },
    bio: { type: ["string", "null"] },       // 3.1.x nullable
    nickname: { type: "string" },             // not required → may be omitted
  },
  required: ["name"],
}, { seed: 42 });

console.log(profile);
// → { name: "...", bio: null, nickname: "..." }
//   (bio may be null or a string; nickname may be present or absent)
