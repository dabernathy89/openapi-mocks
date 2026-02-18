# OpenAPI Mock Data & MSW Handler Generator

> **Package name:** `openapi-mocks`

## Overview

A TypeScript library that parses OpenAPI 3.0.x / 3.1.x documents and generates realistic mock data and pre-built [Mock Service Worker (MSW)](https://mswjs.io/docs) request handlers. Consumers can generate raw mock data for use in tests and stories, or fully-wired MSW handlers that intercept network requests and return spec-compliant responses — all from a single OpenAPI source of truth.

The library is runtime-only for v1, but its internals should be architected with a clean separation between schema-walking / data-generation and MSW handler assembly so that a future CLI or build-time code generation layer can reuse the core without major refactoring.

---

## Tech Stack

| Concern | Tool |
|---|---|
| Language | TypeScript (strict mode) |
| Build / Bundling | [Vite 8](https://vite.dev/blog/announcing-vite8-beta) (library mode) |
| OpenAPI Parsing | [`@apidevtools/swagger-parser`](https://www.npmjs.com/package/@apidevtools/swagger-parser) |
| OpenAPI Types | [`openapi-types`](https://www.npmjs.com/package/openapi-types) (extended for custom extensions) |
| Mock Data | [`@faker-js/faker`](https://www.npmjs.com/package/@faker-js/faker) |
| Request Interception | [`msw`](https://www.npmjs.com/package/msw) v2+ (peer dependency) |
| Testing | [Vitest](https://vitest.dev/) |
| Release | [`semantic-release`](https://github.com/semantic-release/semantic-release) |
| Distribution | npm |

---

## Package Structure

Single npm package with a single entry point: `openapi-mocks`. The `createMockClient` factory exposes both `.data()` and `.handlers()` on the same client object. Consumers who only need raw mock data never touch `.handlers()` and don't need MSW installed. Calling `.handlers()` without MSW installed throws a descriptive error at call time directing the consumer to install `msw`.

### Dependency Strategy

- **`@faker-js/faker`** — direct dependency (implementation detail, always needed).
- **`@apidevtools/swagger-parser`** — direct dependency.
- **`openapi-types`** — direct dependency.
- **`msw`** — peer dependency, `>=2.0.0` (only needed when calling `.handlers()`). MSW is lazily loaded at call time, so consumers who only use `.data()` and `generateFromSchema` never need it installed. MSW v1 is not supported; consumers on v1 should migrate using [MSW's migration guide](https://mswjs.io/docs/migrations/1.x-to-2.x).

---

## Core Capabilities

### 1. Mock Data Generation

Generate realistic fake data from any OpenAPI schema. The library resolves `$ref` pointers, handles composition keywords (`oneOf`, `anyOf`, `allOf`), and produces values that conform to the schema's types, formats, and constraints.

### 2. MSW Handler Generation

Produce ready-to-use MSW v2 `http.*` handlers for every operation (or a filtered subset) in the document via the `.handlers()` method on `createMockClient`. Each handler returns a JSON response whose body, status code, and content type match the OpenAPI spec. Only `application/json` responses are supported in v1; the library emits a console warning when it encounters non-JSON content types and silently skips those operations (no handler is generated).

---

## Data Generation Strategy

Data is resolved in the following priority order (highest → lowest):

1. **Consumer overrides** — explicit values passed at call time via the `overrides` option.
2. **OpenAPI `example` / `default`** — values defined directly in the schema. Respected unless the consumer enables `ignoreExamples` mode.
3. **`x-faker-method` extension** — a custom OpenAPI extension (e.g. `x-faker-method: internet.email`) that maps a schema property to a specific Faker method.
4. **Smart defaults** (type constraint takes precedence) — a curated mapping of ~30–50 common property names to Faker methods (e.g. `firstName` / `first_name` → `faker.person.firstName()`). If a property name matches a smart default but the schema's `type` conflicts (e.g. a property named `email` with `type: integer`), the type constraint wins and the smart default is skipped. Not extensible by the consumer; `x-faker-method` serves as the escape hatch for edge cases.
5. **Type-based fallback** — generic Faker calls based on the OpenAPI `type` and `format` (e.g. `type: integer, format: int32` → `faker.number.int()`).

### Optional and Nullable Fields

Optional properties are randomly included or omitted to simulate realistic API responses and surface frontend bugs where missing fields aren't handled. Nullable fields may randomly receive `null`. Both behaviors are influenced by the seed when one is set, ensuring deterministic output in tests. Consumers can use the `overrides` option to force specific values (or explicit `null` / omission) when they need control.

---

## OpenAPI Extension: `x-faker-method`

The `openapi-types` interfaces will be extended to include an optional `x-faker-method` string field on schema objects. This field accepts a dot-path into the Faker namespace (e.g. `image.avatar`) and overrides the smart-default and type-based fallback strategies for that property.

---

## Composition Support

| Keyword | Behavior |
|---|---|
| `allOf` | Deep-merge all sub-schemas into a single object, then generate data for the merged schema. |
| `oneOf` | If a `discriminator` is present, select the sub-schema indicated by the discriminator mapping and ensure the discriminator property is set correctly in the output. Otherwise, randomly select one sub-schema (seeded via Faker). |
| `anyOf` | Randomly select one or more sub-schemas, merge them, and generate data. |

### OpenAPI 3.0.x vs 3.1.x

Both versions are supported. Key differences the library must handle:

- **`nullable`**: In 3.0.x, `nullable: true` is a separate keyword. In 3.1.x, nullability is expressed as `type: ["string", "null"]`.
- **`type` as array**: 3.1.x allows `type` to be an array (aligned with JSON Schema 2020-12).
- **`$ref` siblings**: 3.1.x allows keywords alongside `$ref`; 3.0.x does not.

Swagger Parser handles most of the resolution, but the data generation layer must account for these differences.

---

## Configuration Options

### Global Options

- **`baseUrl`** — base URL prepended to every MSW handler path (e.g. `https://api.example.com/v1`).
- **`seed`** — seed value passed to Faker for deterministic output. Also makes random optional-field omission deterministic.
- **`ignoreExamples`** — when enabled, `example` and `default` values in the OpenAPI document are ignored and all values come from Faker.
- **`statusCodes`** — limit generation to specific response status codes (e.g. `[200, 422]`).
- **`operations`** — an object keyed by operation ID. When provided, only the listed operation IDs are generated. Each key maps to a per-operation options object (see below), or an empty object (`{}`) to include the operation with all defaults. When omitted, all operations are included.
- **`overrides`** — deep-merge overrides applied to generated data. Supports dot-notation for nested paths (e.g. `users.0.email`).
- **`echoPathParams`** — when enabled, path parameters from the request are echoed into matching response fields (e.g. a request to `/users/123` populates `userId: 123` in the response if the schema has a `userId` property). Defaults to `false`. Only meaningful for `.handlers()`; ignored by `.data()` since there is no request.
- **`maxDepth`** — maximum recursion depth for circular/self-referential schemas. Defaults to 3. Beyond this limit: optional or nullable circular fields receive `null` (nullable) or are omitted (optional); required non-nullable circular fields receive a minimal stub object with required primitive fields populated one level past the depth limit; if a valid stub cannot be constructed (e.g. a required non-nullable field whose type is the circular type with no primitive fields), the library throws with an error naming the circular path.

### Per-Operation Options

Each key in the `operations` object accepts:

- **`statusCode`** — override the default status code (lowest 2xx) for this operation. Used to generate error responses for specific endpoints.
- **`arrayLengths`** — control the number of items generated for array schemas within this operation. Keys are dot-notation paths (e.g. `users`, `users[*].addresses`) and values are `[min, max]` tuples. Equal values (e.g. `[3, 3]`) pin to an exact count. When no `arrayLengths` are set and no schema constraints exist, arrays default to a random length between 0–5 items (seeded). Schema-level `minItems` / `maxItems` constraints are always respected.
- **`transform`** — a callback that receives the generated mock data and returns modified data. In `.data()`, the signature is `(data) => newData`. In `.handlers()`, the callback also receives the intercepted MSW request: `(data, request) => newData`. If the callback returns `undefined`, the original data is used as-is. This is the primary mechanism for both static overrides (hard-coding specific fields) and request-aware behavior (e.g. reading query parameters to set pagination fields).

---

## Default Status Code Behavior

When no `statusCodes` filter is set, handlers return the lowest 2xx response defined for each operation. Consumers who need error responses for specific endpoints can use the per-operation `statusCode` option.

---

## Request Awareness

The library generates handlers that are intentionally simple — they don't attempt to simulate stateful server behavior like pagination, filtering, or resource creation. Instead, two opt-in mechanisms allow consumers to add request-aware behavior:

1. **Path parameter echoing** (`echoPathParams` option) — automatically populates response fields whose names match path parameters from the request.
2. **Response transform callbacks** (per-operation `transform`) — a callback that receives the request and a copy of the generated data, letting consumers implement custom logic like patching `nextPage` based on query parameters.

This keeps the library's core responsibility narrow (generate data from schemas) while being extensible for more advanced use cases.

---

## Public API

### Spec Input

All top-level functions accept an OpenAPI document in any of the following forms:

- A **URL** (string starting with `http://` or `https://`) — fetched and parsed at runtime.
- A **file path** (string) — read from disk and parsed.
- A **JSON string** — parsed directly.
- A **plain JavaScript object** — used as-is (assumed to be a valid OpenAPI document).

Resolution is handled by `@apidevtools/swagger-parser`, which supports all four forms natively.

### Functions

The library exposes two levels of granularity:

1. **`createMockClient`** (from `openapi-mocks`) — a factory that parses and resolves the spec once, then exposes two methods:
   - **`.data()`** — returns `Promise<Map<operationId, Map<statusCode, generatedData>>>` with mock response data. Accepts per-call options (`operations`, `statusCodes`, `ignoreExamples`) that override or extend the client-level defaults.
   - **`.handlers()`** — returns `Promise<HttpHandler[]>` (MSW v2 handler objects) ready to pass to `setupServer` or `setupWorker`. Accepts the same per-call options as `.data()`, plus MSW-specific options like `baseUrl` and `echoPathParams`. Per-operation `transform` callbacks receive the MSW `Request` object alongside the generated data. Throws a descriptive error if `msw` is not installed.

   Global options (`seed`, `ignoreExamples`, `baseUrl`, `echoPathParams`) are set at client creation; per-call options can override or extend the defaults.

2. **`generateFromSchema`** (from `openapi-mocks`) — a lower-level utility that generates data for a single schema object, useful for ad-hoc mocking outside the context of a full document. Accepts a schema object and options (`seed`, `ignoreExamples`), returns the generated value directly.

---

## Error Handling

The library throws hard when it encounters something it cannot handle: broken `$ref` pointers, unsupported schema constructs, or invalid `x-faker-method` paths. This is intentional — silent fallbacks mask spec issues and lead to confusing debugging sessions. Consumers should expect errors during development if their spec has problems, which surfaces issues early.

The one exception is non-JSON content types, which emit a console warning and are skipped rather than throwing, since a mixed-content-type spec is perfectly valid and shouldn't block generation of the JSON operations.

---

## v1 Scope

### In Scope

- OpenAPI 3.0.x and 3.1.x support
- `application/json` response generation
- Response headers from the spec
- Authentication / security scheme mocking (scope TBD — at minimum, handlers will not reject unauthenticated requests)
- File upload / multipart support
- `oneOf`, `anyOf`, `allOf` with discriminator support
- Circular reference handling with configurable depth
- Per-operation configuration (status codes, array lengths, response transforms)

### Out of Scope (v1)

- Non-JSON content types (warning emitted, response skipped)
- Build-time code generation / CLI
- Request body validation
- Fuzzy property-name matching (curated list only)
- Stateful mock server behavior (pagination, CRUD, etc.)

### Nice-to-Have

_(None currently — all scoped features are committed for v1.)_

---

## Testing Strategy

| Layer | Scope | Volume |
|---|---|---|
| **Unit tests** | Schema generation: type mapping, smart defaults, `x-faker-method`, composition (`oneOf`/`anyOf`/`allOf`), discriminators, circular refs, optional field handling, overrides, array lengths | Heavy — this is where the complexity lives |
| **Integration tests** | Full pipeline against real-world OpenAPI specs (e.g. Petstore, Stripe, GitHub) to catch edge cases | Moderate |
| **E2E tests** | Actual MSW handlers intercepting requests in a test environment | Light — just a few to verify the wiring works |

Snapshot tests with seeded Faker output can be used across all layers to catch regressions in generated data.

---

## Open Questions

- **Auth mocking depth:** What does security scheme mocking look like concretely? Options range from "handlers ignore auth entirely" to "handlers check for token presence and return 401/403 if missing" to "generate mock tokens." Needs further scoping.
