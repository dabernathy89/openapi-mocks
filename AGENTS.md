# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`openapi-mocks` is a TypeScript library that parses OpenAPI 3.0.x / 3.1.x documents and generates realistic mock data and pre-built MSW (Mock Service Worker) v2 request handlers. Single npm package (`openapi-mocks`) with a single entry point.

**Status:** Pre-implementation. Planning documents live in `planning/`. No library code has been written yet.

## Monorepo Structure

pnpm workspaces monorepo:

```
packages/openapi-mocks/   → Library source (single entry point)
docs/                     → Astro/Starlight documentation site
examples/playwright/      → Playwright E2E example (NOT a workspace member)
examples/mock-server/     → Standalone mock server example (NOT a workspace member)
```

Example projects under `examples/` are intentionally **not** workspace members — they must work as standalone cloneable packages.

## Build & Test Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm build                # Build all packages
pnpm test                 # Run Vitest across workspace
pnpm -r test              # Run tests in all workspace members
```

Library package (`packages/openapi-mocks/`):
```bash
pnpm build                # Vite 8 library mode build → dist/
pnpm test                 # Run Vitest
```

Docs site (`docs/`):
```bash
pnpm dev                  # Start Astro dev server
pnpm build                # Static build → docs/dist/
```

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite 8 (library mode), ESM output (CJS if cleanly supported)
- **Testing:** Vitest
- **OpenAPI Parsing:** `@apidevtools/swagger-parser` + `openapi-types`
- **Mock Data:** `@faker-js/faker` (direct dependency)
- **Request Interception:** `msw` v2+ (**peer dependency**, lazily loaded)
- **Docs:** Astro + Starlight, API reference via `starlight-typedoc`
- **Release:** `semantic-release`
- **Hosting:** Cloudflare Pages (docs)

## Architecture

### Public API (two levels of granularity)

1. **`createMockClient(spec, options)`** — factory that parses the spec once, returns a client with:
   - `.data()` → `Promise<Map<operationId, Map<statusCode, generatedData>>>`
   - `.handlers()` → `Promise<HttpHandler[]>` (MSW v2 handlers, lazily imports MSW)
2. **`generateFromSchema(schema, options)`** — lower-level utility for ad-hoc single-schema mocking

### Data Generation Priority Chain

Highest to lowest: consumer overrides → spec `example`/`default` → `x-faker-method` extension → smart defaults (property name mapping) → type-based fallback.

### Key Design Decisions

- **MSW is lazy:** `.handlers()` dynamically imports MSW at call time. Consumers using only `.data()` or `generateFromSchema` never need MSW installed. If MSW is missing when `.handlers()` is called, throw a descriptive error.
- **Fail hard on spec problems:** Broken `$ref` pointers, invalid `x-faker-method` paths, etc. throw errors (instances of a custom error class). Silent fallbacks mask bugs.
- **Non-JSON content types:** Emit `console.warn` and skip (don't throw). Mixed-content specs are valid.
- **Optional fields:** Randomly included/omitted (~50/50, seeded) to surface missing-field bugs.
- **Circular refs:** Stop at `maxDepth` (default 3). Optional/nullable circular fields get `null` or are omitted; required non-nullable get a minimal stub.
- **OpenAPI 3.0.x vs 3.1.x:** Handle `nullable: true` (3.0.x) equivalently to `type: ["string", "null"]` (3.1.x). Support `type` as array (3.1.x).

## Canonical Reference Files

These files in `planning/` define the intended public API shape and should be treated as the source of truth:

- `planning/PROJECT_OVERVIEW.md` — technical design, configuration options, v1 scope
- `planning/prd.md` — full PRD with user stories and acceptance criteria
- `planning/DOCS_PLAN.md` — documentation site architecture
- `planning/mock-data-example.ts` — canonical data generation API usage
- `planning/playwright-example.ts` — canonical MSW/Playwright API usage
