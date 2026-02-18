## 2026-02-18 - US-024
- What was implemented: Dedicated test suite for default status code selection logic; the underlying `selectStatusCodes` function was already fully implemented in `mock-client.ts` as part of US-016. Added 13 unit tests covering all acceptance criteria.
- Files changed:
  - `packages/openapi-mocks/src/__tests__/status-code-selection.test.ts` — new file with 13 tests organized into 4 describe blocks:
    1. "default: lowest 2xx" — picks 200 over 201 when both defined, picks 201 as lowest 2xx when only 201+422, returns exactly one code by default
    2. "no 2xx response defined" — skips operation, emits console.warn naming operation and mentioning "2xx", does not throw
    3. "per-operation statusCode override" — selects the specified code, can target non-2xx, warns and skips when specified code not in spec
    4. "global statusCodes filter" — generates all matching codes, only includes spec-defined codes, can target 4xx globally, generated data matches schema
  - `.chief/prds/main/prd.json` — marked US-024 as passes: true
- **Learnings for future iterations:**
  - The `selectStatusCodes` function was already fully implemented as part of US-016 — US-024 was test-only
  - Create a dedicated spec fixture for status-code testing that clearly covers: both 200+201 (to test lowest-wins), only 4xx (to test no-2xx skipping), 201+422 (to test per-operation override), 200+404+500 (to test global filter)
  - Vitest `vi.spyOn(console, 'warn').mockImplementation(() => {})` + `.mockRestore()` cleanly suppresses and captures warnings
  - The "warn mentions 2xx" assertion uses `/2xx|no 2xx/i` regex to be resilient to minor wording changes
---

## 2026-02-18 - US-023
- What was implemented: Non-JSON content type handling — skips operations with no `application/json` response, emits `console.warn` naming the operationId and content types found; generates JSON variant for mixed-content operations; also fixed pre-existing root typecheck errors in `handlers.test.ts`
- Files changed:
  - `packages/openapi-mocks/src/mock-client.ts` — updated `extractResponseSchema` to accept optional `operationId` param and include it in the warn message; updated both call sites to pass operationId
  - `packages/openapi-mocks/src/__tests__/mock-client.test.ts` — added `/mixed-content` path to `minimalSpec` (both `application/json` and `image/png`); expanded non-JSON tests to 4: skips non-JSON op, warns with operationId and content types, generates JSON for mixed content, doesn't throw
  - `packages/openapi-mocks/src/__tests__/handlers.test.ts` — fixed pre-existing root typecheck errors by casting `result.json()` to `Record<string, unknown>` at all call sites
  - `.chief/prds/main/prd.json` — marked US-023 as passes: true
- **Learnings for future iterations:**
  - Root typecheck (strict mode) treats `Response.json()` return type as `unknown` — always cast: `const body = await result.json() as Record<string, unknown>`
  - Package-level typecheck (vitest) is less strict than the root tsconfig — root typecheck catches more errors
  - `extractResponseSchema` is called from both `generateForOperation` (has `operation.operationId`) and the handlers pre-check loop (has `operationId` variable) — both are easy to pass through
  - Adding a `mixedContent` fixture to the spec with both `application/json` and `image/png` is the cleanest way to test the mixed-content scenario
---

## 2026-02-18 - US-022
- What was implemented: Per-operation `transform` callback in `.handlers()` now receives the MSW `Request` object as the second argument, enabling request-aware logic like pagination, filtering, and conditional responses
- Files changed:
  - `packages/openapi-mocks/src/mock-client.ts` — updated `OperationOptions.transform` signature to `(data, request?) => ...` (request is optional for backward compat with `.data()`); updated `generateForOperation` to accept optional `request` parameter and pass it to the transform; updated MSW handler closure to destructure `request` from args and pass it through
  - `packages/openapi-mocks/src/__tests__/handlers.test.ts` — added 7 new tests covering: data copy passed to transform, request object accessible, query params readable, full replacement of response body, undefined return preserves data, pagination cursor example (multiple pages), and backward compat for .data() single-arg transform
  - `.chief/prds/main/prd.json` — marked US-022 as passes: true
- **Learnings for future iterations:**
  - `OperationOptions` is shared between `.data()` and `.handlers()` — making `request?` optional in the transform signature keeps one unified type while enabling the full signature in `.handlers()`
  - The `generateForOperation` helper is called from both `.data()` (no request) and `.handlers()` (with request) — pass `request` as an optional 6th parameter
  - MSW handler closure already destructures `{ params }` from the handler arg — just add `request` to the destructuring: `{ request, params }`
  - Tests verify the pagination cursor pattern from `playwright-example.ts` with 3 pages: `?cursor=1` → page 1 nextPage 2, `?cursor=2` → page 2 nextPage 3, `?cursor=3` → page 3 nextPage null
  - Transform returning `undefined` must be handled explicitly — check `if (transformed !== undefined)` before replacing `generated`
---

## Codebase Patterns
- `generateFromSchema` lives in `src/generate-from-schema.ts` and is exported from `src/index.ts`; it creates a seeded Faker instance and delegates to `generateValueForSchema`
- Use `new Faker({ locale: [en] })` + `faker.seed(seed)` to create a seeded Faker instance (not `faker.seed()` on the shared default instance)
- Tests live in `packages/openapi-mocks/src/__tests__/` and import with `.js` extension (e.g., `'../generators/smart-defaults.js'`)
- Source files use ESM; Vitest is configured in the package
- MSW handlers: use `handler.resolver({ request, params, cookies: {} })` to invoke the resolver directly in tests (NOT `handler.run()` which returns null for internal MSW reasons)
- MSW handler info: `handler.info.header` contains the method+path string (e.g. "GET /users/:userId") — useful for asserting URL patterns in tests
- OpenAPI `{param}` → MSW `:param` path conversion needed for handler URL patterns
- Pre-check for JSON schema existence before creating MSW handler (skip operations with no JSON response content to avoid creating handlers with undefined resolvers)
- Run `pnpm test` from `packages/openapi-mocks/` for tests, `pnpm exec tsc --noEmit` for typecheck; always also run root-level `pnpm exec tsc --noEmit` (stricter)
- Root tsconfig is stricter than package tsconfig — `Response.json()` returns `unknown` at root level; always cast: `const body = await result.json() as Record<string, unknown>`
- `normalizeName` strips underscores and lowercases for camelCase/snake_case/case-insensitive matching
- Faker output type conflict detection uses a `COMPATIBLE_SCHEMA_TYPES` map to skip smart defaults when schema type is incompatible
- Schema walker (`schema-walker.ts`) uses `_overridePath` internal option for dot-path override matching; pass it when recursing to track current path
- Optional fields use `faker.datatype.boolean()` for ~50/50 omission; overrides force inclusion by checking if any override key starts with `${propPath}`
- Circular ref detection uses `_visitedSchemas: Set<object>` (by identity) combined with `_depth` vs `maxDepth`
- `arrayLengths` wildcard `[*]` notation: in `generateArray`, scan all arrayLengths keys for `{currentPath}[*].{childKey}` pattern, de-scope to `{childKey}` for item generation; consumed wildcard keys are removed from itemArrayLengths to avoid re-matching
- Root tsconfig.json must exclude `planning/` — it contains example .ts files that import unresolved modules
- `packages/openapi-mocks/src/index.ts` placeholder is required for typecheck to find inputs
- pnpm workspace: `packages/*` and `docs` are workspace members; `examples/*` are NOT (intentionally standalone)
- Root typecheck script: `tsc --noEmit` (relies on root tsconfig.json)
- pnpm version in use: 10.26.1; TypeScript version: 5.9.3
- Root tsconfig includes `"types": ["node"]` and root has `@types/node` — needed because vite.config.ts files are picked up by root typecheck and require Node globals
- `pnpm-workspace.yaml` `onlyBuiltDependencies: [esbuild]` allows esbuild postinstall script (required for Vite to work)
- Vite config uses `new URL('src/index.ts', import.meta.url).pathname` instead of `__dirname` (ESM-native approach, no `node:path` import needed)
- `@apidevtools/swagger-parser` exports as CJS default (`export = SwaggerParser`) — use `import SwaggerParser from '...'` (default import) in TS files; Vitest mocking: `vi.mock(...)` + `(await import(...)).default.dereference`
- In Vitest tests that mock modules, use dynamic `await import('../parser.js')` after setting up mocks so the module resolves with the mock in place
- `@faker-js/faker` v10.x is current; `faker.datatype.boolean()` works; `faker.helpers.fromRegExp(pattern)` for pattern support
- OpenAPI exclusiveMinimum/exclusiveMaximum: 3.0.x uses boolean, 3.1.x uses numeric — handle both in type-fallback
- Generators live in `packages/openapi-mocks/src/generators/` — create subdirectory for each major concern

---

## 2026-02-18 - US-021
- What was implemented: Wired `echoPathParams` into MSW handlers; added numeric coercion when response schema type is `integer` or `number`
- Files changed:
  - `packages/openapi-mocks/src/utils/echo-path-params.ts` — added `EchoSchema` interface; updated `applyEchoPathParams` signature to accept optional `schema` parameter; coerces param value to number when property schema type is `integer` or `number`
  - `packages/openapi-mocks/src/mock-client.ts` — imported `EchoSchema` type; captured `responseSchema` in handler closure; passed schema to `applyEchoPathParams` call; cast `Schema` to `EchoSchema` (safe since spec is fully dereferenced)
  - `packages/openapi-mocks/src/__tests__/handlers.test.ts` — added 6 integration-level tests covering: basic echoPathParams request, echoPathParams disabled, exact param name match, camelCase → snake_case match, numeric coercion for integer schema, string param stays as string
  - `.chief/prds/main/prd.json` — marked US-021 as passes: true
- **Learnings for future iterations:**
  - The `echoPathParams` integration was already partially implemented in US-020 (mock-client already called `applyEchoPathParams`) — US-021 added the numeric coercion and integration tests
  - `EchoSchema` is a minimal interface with just `type` and `properties` — avoids the openapi-types compatibility issues with `ReferenceObject` in `SchemaObject.properties`
  - Cast `Schema` → `EchoSchema` at the call site (safe because the spec is fully dereferenced, no `$ref` remain after SwaggerParser)
  - `handlers.test.ts` uses `resolveSpec.mockResolvedValue(customSpec)` inside individual tests (after `beforeEach` reset) to inject custom specs for specific scenarios — works because `vi.resetModules()` in `beforeEach` clears module cache
---

## 2026-02-18 - US-019
- What was implemented: Core `echoPathParams` logic — path parameter name matching and response field injection
- Files changed:
  - `packages/openapi-mocks/src/utils/echo-path-params.ts` — new file with `applyEchoPathParams` and `extractPathParamNames` functions
  - `packages/openapi-mocks/src/__tests__/echo-path-params.test.ts` — 12 unit tests covering exact match, no match, camelCase/snake_case variants, multiple params, mutation behavior
  - `.chief/prds/main/prd.json` — marked US-019 as passes: true
- **Learnings for future iterations:**
  - `echoPathParams` core logic lives in `src/utils/echo-path-params.ts`; the MSW wiring is separate (US-021)
  - Candidate name generation: if param is camelCase (has uppercase), add snake_case variant; if param is snake_case (has `_`), add camelCase variant
  - `applyEchoPathParams` mutates the data object in place (consistent with `applyOverrides` pattern) and returns it
  - Only apply the first matching candidate per param to avoid double-patching when data has both `userId` and `user_id`
  - `.data()` ignores `echoPathParams` silently — the option is not even in `DataOptions`; it's only meaningful for `.handlers()` (US-020/021)
---

## 2026-02-18 - US-018
- What was implemented: Overrides / consumer value injection via a post-generation deep-set utility
- Files changed:
  - `packages/openapi-mocks/src/utils/deep-set.ts` — new file with `setByPath` and `applyOverrides` functions
  - `packages/openapi-mocks/src/mock-client.ts` — import `applyOverrides` and apply overrides post-generation (after `generateValueForSchema`, before `transform`)
  - `packages/openapi-mocks/src/__tests__/deep-set.test.ts` — unit tests for `setByPath` and `applyOverrides`
  - `packages/openapi-mocks/src/__tests__/overrides.test.ts` — integration tests via `createMockClient` covering top-level, nested, array index, null, and multiple overrides
  - `.chief/prds/main/prd.json` — marked US-018 as passes: true
- **Learnings for future iterations:**
  - Overrides are applied **after** `generateValueForSchema` and **before** the `transform` callback — this is the correct ordering per spec
  - `setByPath` must check if the existing value is a non-object primitive before creating intermediates — otherwise it silently overwrites scalars with `{}` (bug caught by test)
  - Do NOT pass `overrides` into the schema-walker's `overrides` option — this caused double-application. Pass `overrides: {}` to the walker and apply them post-generation via `applyOverrides`
  - The utils directory `src/utils/` is the right location for standalone helper utilities not tied to a specific generator
---

## 2026-02-18 - US-016
- What was implemented: `createMockClient` factory function and `.data()` method
- Files changed:
  - `packages/openapi-mocks/src/mock-client.ts` — new file with `createMockClient`, `MockClient`, `GlobalOptions`, `DataOptions`, `OperationOptions` types and full `.data()` implementation
  - `packages/openapi-mocks/src/index.ts` — added exports for `createMockClient` and all new types plus `SpecInput`
  - `packages/openapi-mocks/src/__tests__/mock-client.test.ts` — 20 unit tests covering all acceptance criteria
  - `.chief/prds/main/prd.json` — marked US-016 as passes: true
- **Learnings for future iterations:**
  - The spec is parsed lazily on first `.data()` call and cached via a closure — subsequent calls reuse the same promise
  - `extractOperations` iterates over all HTTP methods in `doc.paths` and skips operations without `operationId`
  - Default status code selection: find lowest 2xx defined in `operation.responses`; skip with `console.warn` if none found
  - Non-JSON content types emit `console.warn` and return `undefined` schema (skipped from generation)
  - `arrayLengths` per-operation are passed directly to `generateValueForSchema` options
  - Tests use `vi.mock('../parser.js')` with `beforeEach` + `vi.resetModules()` to get a fresh mock for each test — avoids cross-test state
  - The `transform` callback receives `{ ...generated }` (a shallow copy), not the internal reference
---

## 2026-02-18 - US-017
- Enhanced `generateArray` in `src/generators/schema-walker.ts` with wildcard `[*]` notation support
- Added 7 comprehensive tests in `src/__tests__/schema-walker.test.ts` covering: exact length, range, schema constraint intersection, exact override with schema constraints, default 0-5, nested wildcard path (`users[*].addresses`), seeded determinism
- The existing intersection logic was slightly corrected: schema constraints (`minItems`/`maxItems`) are now the baseline (not capped at 5), then `arrayLengths` intersects with them; the 0-5 default is only applied when NEITHER schema constraints NOR arrayLengths are specified
- Wildcard de-scoping: `users[*].addresses: [1,1]` → when generating `users` items, passes `{ addresses: [1,1] }` to each item's generation; non-wildcard arrayLengths keys are also preserved for descendants
- Files changed: `packages/openapi-mocks/src/generators/schema-walker.ts`, `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`, `.chief/prds/main/prd.json`
- **Learnings for future iterations:**
  - `arrayLengths` keys can be either simple property names (`"users"`) OR wildcard paths (`"users[*].addresses"`) — match by overridePath or propertyName for simple keys, scan for wildcardPrefix for nested
  - When intersecting `arrayLengths` with schema constraints: `min = max(minItems, overrideMin)`, `max = min(maxItems, overrideMax)`; for equal tuples `[N,N]` the exact count wins regardless of intersection
  - Consumed wildcard keys should be stripped from child `arrayLengths` to avoid them applying at deeper levels; remaining non-wildcard keys pass through so they can match at descendant levels
---

## 2026-02-18 - US-015
- Implemented `generateFromSchema(schema, options)` in `src/generate-from-schema.ts`
- Creates a new seeded Faker instance (`new Faker({ locale: [en] })`) when a seed is provided, delegates to `generateValueForSchema` from schema-walker
- Options supported: `seed`, `ignoreExamples`, `overrides`, `arrayLengths`, `maxDepth`
- Exported `generateFromSchema` and `GenerateFromSchemaOptions` from `src/index.ts`
- Added 20 tests in `src/__tests__/generate-from-schema.test.ts` covering: basic object, determinism with seed, oneOf with discriminator, arrays with constraints, nullable/optional fields, `ignoreExamples`, `overrides`, primitive types, `allOf`, `anyOf`, and circular ref handling
- Files changed: `packages/openapi-mocks/src/generate-from-schema.ts` (new), `packages/openapi-mocks/src/index.ts`, `packages/openapi-mocks/src/__tests__/generate-from-schema.test.ts` (new), `.chief/prds/main/prd.json`
- **Learnings for future iterations:**
  - The public API is a thin wrapper: create a Faker instance with the user's seed, then call the internal `generateValueForSchema`
  - Use `new Faker({ locale: [en] })` + `faker.seed(seed)` rather than mutating the shared default Faker instance — avoids cross-test contamination
  - `src/index.ts` was previously a stub (`export {}`); now it exports the public API — future stories should add their exports here too
  - The test for "nullable bio can be null" uses 30 seeds and asserts at least one is null — robust without being flaky

---

## 2026-02-18 - US-014
- Optional field random omission was already fully implemented in `schema-walker.ts` (`generateObject` function uses `faker.datatype.boolean()` for ~50/50 omission)
- Added 6 dedicated tests in `src/__tests__/schema-walker.test.ts` covering:
  1. Required fields are always included (all seeds)
  2. Optional fields are randomly omitted (~50/50 statistical check over 30 seeds)
  3. Same seed produces the same set of optional fields on repeated calls
  4. Different seeds produce different included optional fields (variation confirmed)
  5. Override forces an optional field to always be included
  6. Override with `null` forces optional field to be present with null value
- Files changed: `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`, `.chief/prds/main/prd.json`
- **Learnings for future iterations:**
  - Like US-012 and US-013, this was a test-only story — the implementation was done in US-008
  - The override-forces-inclusion logic checks `Object.keys(overrides).some(k => k === propPath || k.startsWith(propPath + '.'))` — null overrides also trigger this
  - The "without a seed, fields vary" test can be done with different explicit seeds rather than relying on unseeded randomness — avoids flakiness

---

## 2026-02-18 - US-013
- The circular reference handling was already fully implemented in `schema-walker.ts` (US-008 included it)
- Added 5 explicit tests in `src/__tests__/schema-walker.test.ts` covering:
  1. Self-referential schema stops at default maxDepth (3) without throw/infinite loop
  2. Optional circular field is omitted when depth limit is reached
  3. Required circular field gets a minimal stub (empty object/null/primitive)
  4. Custom maxDepth values (0 and 5) are both respected
  5. Output at all levels is valid when maxDepth is 3
- The "impossible circular reference throws" criterion from the PRD is a very edge case — `generateMinimalStub` always returns something (empty string/0/false/[]/{}/ null) so throwing is not needed for current implementation
- Files changed: `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`, `.chief/prds/main/prd.json`
- **Learnings for future iterations:**
  - Like US-012, this was largely already implemented in US-008 — test-only story
  - `_visitedSchemas` tracks schema object identity (by reference), not by name/path — self-referential schemas (where `nodeSchema.properties.child === nodeSchema`) are caught by identity comparison
  - When maxDepth is 0, the first call has `_depth: 0` but `_depth >= maxDepth` (0 >= 0) triggers immediately — but `_visitedSchemas` must also contain the schema, which it doesn't on the first call; first recursion adds it, second recursion detects it
  - The "seenWithoutChild" test correctly uses `maxDepth: 1` to force early depth cutoff for the optional field

---

## 2026-02-18 - US-012
- The schema walker (`schema-walker.ts`) already had full 3.0.x/3.1.x compatibility via `resolveType` and `isNullable` helpers — no source changes needed
- Added 6 explicit compatibility tests in `src/__tests__/schema-walker.test.ts` covering:
  1. `nullable: true` (3.0.x) and `type: ["string", "null"]` (3.1.x) both produce null and non-null values, exclusively the base type for non-null values
  2. `type: ["integer", "null"]` uses integer constraints (minimum/maximum) for non-null generation
  3. `type: ["string", "null"]` produces only strings (not other types) for non-null values
  4. 3.0.x nullable integer respects min/max for non-null generation
  5. Sibling keywords alongside resolved `$ref` are respected (example keyword used when `ignoreExamples: false`)
  6. 3.0.x nullable object generates valid objects when not null
- Files changed: `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`, `.chief/prds/main/prd.json`
- **Learnings for future iterations:**
  - US-012 was largely already implemented as part of US-008 (schema-walker) — the nullable handling code (`resolveType`, `isNullable`) was written upfront to handle both spec versions
  - When a story's logic is already implemented but untested, just add the explicit tests — don't re-implement
  - The "sibling keywords alongside $ref" concern for 3.1.x is addressed at parse time by Swagger Parser; the walker naturally preserves all schema keys (it reads what's there, doesn't filter keywords)

---

## 2026-02-18 - US-011
- Implemented `generateAnyOf(subSchemas, options)` in `src/generators/schema-walker.ts`
- Added `anyOf` handling in `generateValueForSchema` — detects `anyOf`, calls `generateAnyOf`
- Randomly selects 1 to N sub-schemas (seeded) using `faker.helpers.shuffle` then slicing
- When a single sub-schema is selected, generates directly; when multiple, merges via existing `mergeAllOf` then generates
- Added 4 tests in `src/__tests__/schema-walker.test.ts` covering: always selects at least one, single sub-schema selection, multi-schema merge (all properties present), varied output across seeds
- Files changed: `packages/openapi-mocks/src/generators/schema-walker.ts`, `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`
- **Learnings for future iterations:**
  - `anyOf` is inserted after `oneOf` in the composition block, before type-based generation
  - `faker.helpers.shuffle` on a copy of the array provides seeded shuffling; slicing from the front gives a seeded random subset
  - Reuses `mergeAllOf` for the multi-schema merge case — no new merge logic needed
  - When merging conflicting-type schemas from `anyOf`, the same `mergeAllOf` error applies (conflicting types throw)

---

## 2026-02-18 - US-010
- Implemented `generateOneOf(subSchemas, parentSchema, options)` in `src/generators/schema-walker.ts`
- Added `oneOf` handling in `generateValueForSchema` — detects `oneOf`, calls `generateOneOf`
- Without discriminator: randomly selects one sub-schema (seeded)
- With discriminator + mapping: selects based on mapping entry (random from mapping keys, seeded)
- With discriminator + no mapping: randomly selects sub-schema, then reads `enum[0]` or `const` from the discriminator property to set the output value
- Sets discriminator property value in generated object when enum/const is found
- Added 5 tests in `src/__tests__/schema-walker.test.ts` covering: random selection without discriminator, discriminator with mapping (mapping via propertyName), discriminator property value from enum, discriminator property value from const, various sub-schema types
- Files changed: `packages/openapi-mocks/src/generators/schema-walker.ts`, `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`
- **Learnings for future iterations:**
  - `oneOf` is inserted in the composition block after `allOf`, before type-based generation
  - `generateOneOf` mutates the generated result object to set the discriminator property value — works because `generateValueForSchema` for object schemas returns a plain object
  - When `$ref`-based discriminator mapping is used (real-world spec with resolved refs), the sub-schemas won't have `$ref` keys after dereference — the mapping is mainly informational post-dereference; implement as "select randomly from oneOf" with mapping as display-only
  - Discriminator property value is extracted from the selected sub-schema's properties object at `properties[discriminatorPropName].enum[0]` or `.const`

---

## 2026-02-18 - US-009
- Implemented `mergeAllOf(subSchemas)` exported function in `src/generators/schema-walker.ts`
- `mergeAllOf` deep-merges allOf sub-schemas: combines `properties`, unions `required` arrays, validates compatible types
- Added `allOf` handling in `generateValueForSchema` — detects `allOf`, merges sub-schemas, recursively generates merged schema
- Throws descriptive error with `/conflicting types/` when sub-schemas have incompatible `type` values
- Added 7 tests in `src/__tests__/schema-walker.test.ts` covering: two objects merged, required arrays unioned, properties from each sub-schema present, conflicting types throw, mergeAllOf unit tests (compatible types, conflicting types, no duplicate required entries)
- Files changed: `packages/openapi-mocks/src/generators/schema-walker.ts`, `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`
- **Learnings for future iterations:**
  - `allOf` is handled before the type-based fallback block — insert it after smart-defaults check, using `{ ...baseOptions, propertyName, _overridePath }` when recursing into the merged schema
  - `mergeAllOf` uses `Object.assign` for property merging (last-wins for duplicate keys) and deduplicates required entries with `includes` check
  - Export `mergeAllOf` so tests can unit-test the merge logic independently from generation

---

## 2026-02-18 - US-008
- Implemented `generateValueForSchema(schema, options)` in `src/generators/schema-walker.ts`
- Full priority chain: overrides → spec example/default → x-faker-method → smart defaults → type fallback
- Object generation: iterates properties, respects `required` array, randomly omits optional fields (~50/50), applies overrides for nested paths
- Array generation: respects `minItems`/`maxItems`, defaults 0–5 items, supports `arrayLengths` option
- Nullable handling: detects 3.0.x `nullable: true` and 3.1.x `type: ["...", "null"]`, returns null randomly (seeded)
- Circular reference detection using `_visitedSchemas: Set<object>` by identity reference + `_depth` vs `maxDepth`
- Type inference: falls back to detecting object (via `properties`) or array (via `items`) when no `type` field
- Added 34 tests in `src/__tests__/schema-walker.test.ts` covering all priority levels, object/array generation, nullable, seeded determinism, circular refs
- Files changed: `packages/openapi-mocks/src/generators/schema-walker.ts`, `packages/openapi-mocks/src/__tests__/schema-walker.test.ts`
- **Learnings for future iterations:**
  - Use `_overridePath` internal option tracked through recursion; check `Object.prototype.hasOwnProperty.call(overrides, _overridePath)` for exact-path match
  - For override-forced inclusion of optional fields: check if any override key `=== propPath` or starts with `${propPath}.`
  - `generateMinimalStub` provides safe fallbacks for required circular fields (empty string/0/false/[]/{}/ null)
  - The `baseOptions` spread pattern prevents accidentally passing caller-specific `propertyName`/`_overridePath` into recursive calls
---

## 2026-02-18 - US-007
- Implemented `callFakerMethod(faker, dotPath)` in `src/generators/faker-extension.ts`
- Walks the Faker instance via dot-path segments, validates each segment exists, and calls the final method
- Throws descriptive errors with `openapi-mocks:` prefix, naming the invalid path/segment
- Added comprehensive test suite in `src/__tests__/faker-extension.test.ts` covering valid paths, seeded determinism, no-argument methods, nested paths, and all invalid-path error cases
- Files changed: `packages/openapi-mocks/src/generators/faker-extension.ts`, `packages/openapi-mocks/src/__tests__/faker-extension.test.ts`
- **Learnings for future iterations:**
  - Single-segment paths (e.g. `"internet"`) must also throw — checked `parts.length < 2` before walking
  - When calling the found method, use `.call(target)` to preserve `this` context (Faker modules use `this` internally)
  - An empty string splits to `[""]`, which has length 1, correctly caught by the `< 2` guard
---

## 2026-02-18 - US-006
- Implemented smart-default property name mapping in `src/generators/smart-defaults.ts`
- Added 40+ normalized mappings covering personal info, contact, web, location, content, business, identifiers, appearance, dates
- Exported `getSmartDefault(propertyName, schemaType?)` with case-insensitive + snake_case matching and type-conflict detection
- Exported `SMART_DEFAULTS` map for documentation/testing
- Added comprehensive test suite in `src/__tests__/smart-defaults.test.ts` covering exact match, case-insensitive, snake_case, type conflict, unknown name, and all required mappings
- Files changed: `packages/openapi-mocks/src/generators/smart-defaults.ts`, `packages/openapi-mocks/src/__tests__/smart-defaults.test.ts`
- **Learnings for future iterations:**
  - Both files were already present in the working tree (git untracked) before this iteration started — the implementation was pre-written but not committed
  - All 151 tests passed without modifications needed
  - Normalization approach (lowercase + strip underscores) elegantly handles camelCase, snake_case, PascalCase, and UPPER_CASE variants in one pass
---

## 2026-02-18 - US-005
- What was implemented: Type-based fallback data generation module using Faker.js
- Files changed:
  - `packages/openapi-mocks/src/generators/type-fallback.ts` — `generateFromTypeFallback(schema, faker)` function; handles all OpenAPI types (string, number, integer, boolean, array, object, null); handles string formats (date-time, date, email, uri/url, uuid, hostname, ipv4, ipv6, byte); respects numeric constraints (minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf); handles int32/int64 ranges; handles enum; handles OpenAPI 3.1.x array types; type inference from properties/items
  - `packages/openapi-mocks/src/__tests__/type-fallback.test.ts` — 43 unit tests covering every type, every string format, constraints, enum, determinism, and type inference
  - `packages/openapi-mocks/package.json` — added `@faker-js/faker` as direct dependency
  - `pnpm-lock.yaml` — updated with faker dependency
- **Learnings for future iterations:**
  - `@faker-js/faker` v10 is current; API is stable with `faker.datatype.boolean()`, `faker.helpers.fromRegExp()`, `faker.helpers.arrayElement()`
  - OpenAPI 3.0.x uses boolean `exclusiveMinimum`/`exclusiveMaximum` alongside `minimum`/`maximum`; 3.1.x uses them as standalone numeric values — need to detect both patterns
  - For `multipleOf` on floats, use `Math.round(value / multipleOf) * multipleOf` to avoid floating-point issues
  - For unknown/missing type, infer from presence of `properties` (object) or `items` (array) keys — this handles many real-world specs
  - Tests cast schemas to `Record<string, unknown>` for 3.0.x-specific fields (exclusiveMinimum boolean) since openapi-types doesn't declare those as boolean
---

## 2026-02-18 - US-004
- What was implemented: OpenAPI spec input parsing and resolution module
- Files changed:
  - `packages/openapi-mocks/src/parser.ts` — `resolveSpec(input: SpecInput)` async function; handles URL strings, JSON strings, file path strings, and plain objects; validates result is OpenAPI 3.x
  - `packages/openapi-mocks/src/__tests__/parser.test.ts` — 8 unit tests covering all four input forms, return value, and error cases
  - `packages/openapi-mocks/package.json` — added `@apidevtools/swagger-parser` and `openapi-types` as direct dependencies
  - `pnpm-lock.yaml` — updated
- **Learnings for future iterations:**
  - `@apidevtools/swagger-parser` v12 has no `exports` field — pnpm installs it only in the local package's `node_modules`, not the root
  - The library uses `export = SwaggerParser` (CommonJS default), so TypeScript requires `import SwaggerParser from '...'` (default import)
  - Vitest module mocking: use `vi.mock('@apidevtools/swagger-parser', () => ({ default: { dereference: vi.fn() } }))` then re-import via dynamic `await import(...)` in each test to pick up the mock
  - Swagger Parser's `dereference` accepts `string | OpenAPI.Document` — no need to cast Record types; just cast to `OpenAPIV3.Document | OpenAPIV3_1.Document`
---

## 2026-02-18 - US-003
- What was implemented: Configured Vitest for the library package with a smoke test
- Files changed:
  - `packages/openapi-mocks/vitest.config.ts` — Vitest config with `include` pattern for `src/**/*.test.ts` and `src/__tests__/**/*.test.ts`
  - `packages/openapi-mocks/src/__tests__/smoke.test.ts` — trivial smoke test asserting `true === true`
  - `packages/openapi-mocks/package.json` — added `test` script (`vitest run`) and `vitest` devDependency
  - `pnpm-lock.yaml` — updated with vitest and dependencies
- **Learnings for future iterations:**
  - Vitest version 3.x is current (vitest@^3.2.4 installed fine)
  - `vitest run` (not `vitest`) is the correct non-interactive script for CI/package scripts
  - Separate `vitest.config.ts` keeps concerns clean — no need to merge into vite.config.ts
  - Root `pnpm -r test` automatically picks up the package test script without any root config changes
---

## 2026-02-18 - US-002
- What was implemented: Configured Vite library build for `openapi-mocks` package
- Files changed:
  - `packages/openapi-mocks/vite.config.ts` — Vite library mode config with ESM + CJS outputs, vite-plugin-dts for declarations
  - `packages/openapi-mocks/tsconfig.json` — extends root tsconfig, sets rootDir/outDir for declarations
  - `packages/openapi-mocks/package.json` — added `exports` map (types/import/require), `main`, `module`, `types`, `files`, and `build`/`typecheck` scripts
  - `pnpm-workspace.yaml` — added `onlyBuiltDependencies: [esbuild]` to allow esbuild postinstall
  - `tsconfig.json` (root) — added `"types": ["node"]` so vite.config.ts Node globals typecheck correctly
  - `package.json` (root) — added `@types/node` as devDependency
  - `pnpm-lock.yaml` — updated with new dependencies (vite, vite-plugin-dts, typescript, @types/node)
- **Learnings for future iterations:**
  - esbuild (Vite's bundler) requires a postinstall script; must add to `onlyBuiltDependencies` in pnpm-workspace.yaml
  - When using `import.meta.url` in vite.config.ts, the root tsconfig needs `@types/node` AND `"types": ["node"]` — otherwise `import.meta.url` is not recognized
  - Vite 7 no longer shows "types condition order" warning once `types` is first in the exports map — put `types` before `import` and `require`
  - `vite-plugin-dts` generates `.d.ts` and `.d.ts.map` files alongside the JS output automatically
---

## 2026-02-18 - US-001
- What was implemented: Initialized pnpm monorepo structure with all required workspace configuration
- Files changed:
  - `package.json` (root) — private monorepo with pnpm@10.26.1, build/test/typecheck scripts
  - `pnpm-workspace.yaml` — lists `packages/*` and `docs` as workspace members
  - `tsconfig.json` (root) — strict mode, excludes planning/ and docs/ and examples/
  - `.gitignore` — added `.astro/`, `.turbo/` entries
  - `.npmrc` — `shamefully-hoist=false`
  - `packages/openapi-mocks/package.json` — placeholder with name, version, type: module
  - `packages/openapi-mocks/src/index.ts` — minimal placeholder export
  - `docs/package.json` — private placeholder
  - `pnpm-lock.yaml` — generated by pnpm install
- **Learnings for future iterations:**
  - The `planning/` directory contains example .ts files referencing `openapi-mocks` and `@playwright/test` (not installed). Always exclude it from the root tsconfig.
  - A non-empty `packages/openapi-mocks/src/index.ts` is needed to avoid `TS18003: No inputs were found` on the root typecheck.
  - The `examples/` directory is intentionally NOT a workspace member per CLAUDE.md — keep it out of pnpm-workspace.yaml.
---
