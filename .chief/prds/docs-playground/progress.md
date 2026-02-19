## Codebase Patterns
- pnpm workspaces monorepo: library at `packages/openapi-mocks/`, docs at `docs/`
- Library uses Vite 7 in library mode, outputs ESM + CJS to `dist/`
- Tests use Vitest; typecheck uses `tsc --noEmit`; quality check = `pnpm test && pnpm typecheck`
- `@apidevtools/json-schema-ref-parser` has `"browser": { "fs": false }` in package.json — Vite handles Node.js stubs automatically for browser builds
- Browser bundle: externalize only `msw` and `msw/*`; all other deps bundle inline via Vite conditions `['browser', 'import', 'module', 'default']`
- `dist-browser/` goes in root `.gitignore` alongside `dist/`

---

## 2026-02-18 - US-005
- What was implemented: Filled in `sample-spec.ts` with a complete OpenAPI 3.1.0 Petshop YAML spec and `default-code.ts` with the default playground code string.
- Files changed:
  - `docs/src/components/playground/sample-spec.ts` — exports `SAMPLE_SPEC` with full Petshop spec: 6 operations (listPets, createPet, getPet, deletePet, listOwners, getOwner), 3 $ref schemas (Pet, Owner, Error), x-faker-method extensions, nested objects, enums, multiple response codes
  - `docs/src/components/playground/default-code.ts` — exports `DEFAULT_CODE` calling `createMockClient(spec, { baseUrl: 'http://playground.local', seed: 42 })`
  - `.chief/prds/docs-playground/prd.json` — marked US-005 passes: true
- **Learnings for future iterations:**
  - `js-yaml` is installed in `docs/node_modules` — can verify YAML parsing with `node --input-type=module` and the full path to the module
  - Quality check for docs-only changes is just `pnpm typecheck` in the `docs/` directory (astro check), not the full library test suite
  - The `x-faker-method` format is `namespace.methodName` (e.g. `animal.petName`, `internet.email`) matching Faker.js v9 API

---

## 2026-02-18 - US-004
- What was implemented: Created `docs/src/pages/playground.astro` as a standalone Astro page using `StarlightPage`. Created `docs/src/components/playground/` directory with all required stub files: `Playground.vue`, `SpecEditor.vue`, `CodeEditor.vue`, `HandlerAccordion.vue`, `HandlerRow.vue`, `usePlayground.ts`, `sample-spec.ts`, `default-code.ts`, `types.ts`.
- Files changed:
  - `docs/src/pages/playground.astro` (new) — standalone page at `/playground`
  - `docs/src/components/playground/types.ts` (new) — exports `HandlerInfo`, `FetchResult`, `EvalResult`
  - `docs/src/components/playground/Playground.vue` (new) — root component stub
  - `docs/src/components/playground/SpecEditor.vue` (new) — controlled textarea stub
  - `docs/src/components/playground/CodeEditor.vue` (new) — controlled textarea stub
  - `docs/src/components/playground/HandlerAccordion.vue` (new) — accordion stub
  - `docs/src/components/playground/HandlerRow.vue` (new) — row stub
  - `docs/src/components/playground/usePlayground.ts` (new) — composable stub
  - `docs/src/components/playground/sample-spec.ts` (new) — SAMPLE_SPEC stub
  - `docs/src/components/playground/default-code.ts` (new) — DEFAULT_CODE stub
  - `.chief/prds/docs-playground/prd.json` — marked US-004 passes: true
- **Learnings for future iterations:**
  - In a `playground.astro` page, Astro infers a local type `Playground` from the filename — importing a Vue component also named `Playground` causes ts(2440) conflict. Fix: use an alias (`PlaygroundApp`) for the import.
  - `StarlightPage` from `@astrojs/starlight/components/StarlightPage.astro` provides the site chrome (header, theme toggle) without adding the page to the sidebar or content search.
  - `docs/src/pages/` directory did not exist — must create it before adding the Astro page file.
---

## 2026-02-18 - US-003
- What was implemented: Added Vue 3 + @astrojs/vue integration to the Astro docs site. Installed all required packages and added `vue()` to the integrations array in astro.config.mjs. Created a minimal VueSmokeTest.vue component. Installed CodeMirror dependencies (vue-codemirror, @codemirror/lang-yaml, @codemirror/lang-javascript, @codemirror/theme-one-dark, js-yaml).
- Files changed:
  - `docs/package.json` — added `@astrojs/vue` (devDep), `vue`, `vue-codemirror`, `@codemirror/lang-yaml`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`, `js-yaml`
  - `docs/astro.config.mjs` — imported `vue` from `@astrojs/vue`, added `vue()` to integrations array (before starlight)
  - `docs/src/components/VueSmokeTest.vue` (new) — minimal smoke-test Vue SFC
  - `pnpm-lock.yaml` — updated lockfile
  - `.chief/prds/docs-playground/prd.json` — marked US-003 passes: true
- **Learnings for future iterations:**
  - `vue()` integration must be placed BEFORE `starlight()` in the integrations array
  - `pnpm typecheck` (which runs `astro check`) is the quality check for the docs package — runs in ~2s
  - The `public/mockServiceWorker.js` triggers a ts(2570) hint about `Client` type but it's not an error and is pre-existing
---

## 2026-02-18 - US-002
- What was implemented: Added `msw` as a direct dependency in `docs/package.json` (v2.x) and ran `npx msw init docs/public/` to copy `mockServiceWorker.js` into the docs public directory. Created the `docs/public/` directory.
- Files changed:
  - `docs/package.json` — added `"msw": "^2.7.5"` to dependencies
  - `docs/public/mockServiceWorker.js` (new) — MSW service worker file
  - `pnpm-lock.yaml` — updated lockfile
  - `.chief/prds/docs-playground/prd.json` — marked US-002 passes: true
- **Learnings for future iterations:**
  - `npx msw init <dir> --no-save` copies the service worker without modifying package.json (avoids duplicate writes)
  - MSW was already present in workspace `node_modules` (hoisted from `packages/openapi-mocks`) so install was fast
  - `docs/public/` directory did not exist — must create it first before running `msw init`
  - Verify `git check-ignore -v <file>` to confirm the service worker is not gitignored before committing
---

## 2026-02-18 - US-001
- What was implemented: Created `packages/openapi-mocks/vite.browser.config.ts` — a Vite library-mode config that produces a self-contained ESM bundle at `dist-browser/openapi-mocks.browser.js`. All runtime deps bundled inline; `msw` externalized via dynamic import only.
- Files changed:
  - `packages/openapi-mocks/vite.browser.config.ts` (new)
  - `packages/openapi-mocks/package.json` — added `build:browser` script
  - `.gitignore` — added `dist-browser/`
  - `.chief/prds/docs-playground/prd.json` — marked US-001 passes: true
- **Learnings for future iterations:**
  - Vite warns "Module X externalized for browser compatibility" for `util` and `path`, but these are handled via polyfill stubs at build time — the output bundle has zero external ESM imports except the dynamic `msw` import
  - `@apidevtools/swagger-parser` DOES bundle successfully for browser with Vite's browser conditions; no need to switch to `@scalar/openapi-parser`
  - Bundle size: ~901KB uncompressed / ~259KB gzip — large but acceptable for a playground
  - `resolve.browserField: true` and `conditions: ['browser', 'import', 'module', 'default']` are the key Vite options to get browser-compatible resolution
---
