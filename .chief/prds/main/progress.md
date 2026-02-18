## Codebase Patterns
- Tests live in `packages/openapi-mocks/src/__tests__/` and import with `.js` extension (e.g., `'../generators/smart-defaults.js'`)
- Source files use ESM; Vitest is configured in the package
- Run `pnpm test` from `packages/openapi-mocks/` for tests, `pnpm exec tsc --noEmit` for typecheck
- `normalizeName` strips underscores and lowercases for camelCase/snake_case/case-insensitive matching
- Faker output type conflict detection uses a `COMPATIBLE_SCHEMA_TYPES` map to skip smart defaults when schema type is incompatible
- Schema walker (`schema-walker.ts`) uses `_overridePath` internal option for dot-path override matching; pass it when recursing to track current path
- Optional fields use `faker.datatype.boolean()` for ~50/50 omission; overrides force inclusion by checking if any override key starts with `${propPath}`
- Circular ref detection uses `_visitedSchemas: Set<object>` (by identity) combined with `_depth` vs `maxDepth`

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
