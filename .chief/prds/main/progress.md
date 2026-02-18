## Codebase Patterns
- Tests live in `packages/openapi-mocks/src/__tests__/` and import with `.js` extension (e.g., `'../generators/smart-defaults.js'`)
- Source files use ESM; Vitest is configured in the package
- Run `pnpm test` from `packages/openapi-mocks/` for tests, `pnpm exec tsc --noEmit` for typecheck
- `normalizeName` strips underscores and lowercases for camelCase/snake_case/case-insensitive matching
- Faker output type conflict detection uses a `COMPATIBLE_SCHEMA_TYPES` map to skip smart defaults when schema type is incompatible

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
