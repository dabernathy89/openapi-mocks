## 2026-02-18 - US-012
- What was implemented: Added a "Try the Playground" CTA card to the docs homepage (`index.mdx`) in a new "Try It Now" section above "Next Steps". The card links to `/playground/` with a one-sentence description of the playground.
- Files changed:
  - `docs/src/content/docs/index.mdx` — added "Try It Now" `CardGrid` section with a `Card` linking to `/playground/`
  - `.chief/prds/docs-playground/prd.json` — marked US-012 passes: true
- **Learnings for future iterations:**
  - Starlight `Card` components inside a `CardGrid` accept markdown link syntax in the body for linked cards
  - The homepage uses `@astrojs/starlight/components` `Card` and `CardGrid` — no new imports needed, just use the existing import line
  - `pnpm typecheck` (astro check) is the only quality check for `.mdx` content changes — 0 errors confirms success
---

## 2026-02-18 - US-011
- What was implemented: Error state display is fully handled by the existing `usePlayground` + `HandlerAccordion` infrastructure. Fixed the YAML error message format to include the constructor name (`YAMLException: ...`) matching the JS eval error format (`ReferenceError: ...`). All criteria were already met by previous stories — `evalStatus` and `evalError` flow from `usePlayground` → `Playground.vue` → `HandlerAccordion`; `activeHandlers` is cleared on any error; error is cleared on success; no error logic in `HandlerRow`.
- Files changed:
  - `docs/src/components/playground/usePlayground.ts` — fixed YAML parse error message to use `${err.constructor.name}: ${err.message}` format
  - `.chief/prds/docs-playground/prd.json` — marked US-011 passes: true
- **Learnings for future iterations:**
  - Error state infrastructure was already built during US-008/009 — US-011 was mostly verifying that the wiring was correct
  - YAML error format must use `${err.constructor.name}: ${err.message}` (not just `err.message`) to show `YAMLException: ...`
  - The `evalError` cleared on success happens naturally because `runEval()` sets `evalError.value = null` at the start
---

## 2026-02-18 - US-010
- What was implemented: Full fetch-and-display logic in `HandlerRow.vue`. On expand, fires a real `fetch()` to `http://playground.local` + substituted path. Shows loading state, then renders status code, content-type, duration, and prettified JSON body. Handles 204 No Content specially. Fetch errors show human-readable message. Each expand re-fires the fetch (no caching). `statusClass()` colors status badges by range (2xx/3xx/4xx/5xx).
- Files changed:
  - `docs/src/components/playground/HandlerRow.vue` — full fetch implementation with `watch(expanded, doFetch)`, result/error/loading refs, and full result display template
  - `.chief/prds/docs-playground/prd.json` — marked US-010 passes: true
- **Learnings for future iterations:**
  - `watch(() => props.expanded, (val) => { if (val) doFetch() })` triggers fresh fetch every time the row opens — no cached state needed
  - Path param substitution regex: `/:([^/]+)/g` — check `/id/i.test(param)` for `1`, else `example`
  - `response.status !== 204` guard before attempting `response.json()` prevents parse errors on No Content responses
  - `statusClass` helper belongs in `<script setup>` block (not a separate `<script>` block) so it's available to the template
---

## 2026-02-18 - US-009
- What was implemented: Full `HandlerAccordion.vue` with single-expand accordion behavior tracking `expandedKey` ref. `HandlerRow.vue` upgraded from stub to full component with colored HTTP method badges, chevron indicator, and expand/toggle event delegation.
- Files changed:
  - `docs/src/components/playground/HandlerAccordion.vue` — accordion behavior with `expandedKey` ref, loading spinner, error display, empty-state message; passes `expanded` + `@toggle` to each `HandlerRow`
  - `docs/src/components/playground/HandlerRow.vue` — method badge with per-method colors (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS), path display, chevron, `expanded` prop, `toggle` emit
  - `.chief/prds/docs-playground/prd.json` — marked US-009 passes: true
- **Learnings for future iterations:**
  - Accordion "only one open" pattern: parent tracks `expandedKey = ref<string | null>(null)` using `method:path` as key; child receives `:expanded="expandedKey === key"` and emits `@toggle`; parent toggles by comparing current value
  - `HandlerRow` is a pure presentational component at this stage — fetch logic (US-010) will be added to it in the next story
  - Method badge colors work well with CSS classes like `.method-GET`, `.method-POST` etc. keyed by `method.toUpperCase()`
  - The `toggle` emit defined as `defineEmits<{ toggle: [] }>()` (no payload) requires calling as `emit('toggle')` without arguments
---

## 2026-02-18 - US-008
- What was implemented: Full `usePlayground` composable with MSW service worker setup, debounced spec/code watchers, dynamic browser bundle import, AsyncFunction eval, and `worker.resetHandlers()` integration. Updated `Playground.vue` to use the composable. Updated `HandlerAccordion.vue` to accept `evalStatus` and `evalError` props for loading/error display. Added `docs/scripts/copy-browser-bundle.js` script and wired it into the docs build step.
- Files changed:
  - `docs/src/components/playground/usePlayground.ts` — full implementation
  - `docs/src/components/playground/Playground.vue` — wired to `usePlayground` composable
  - `docs/src/components/playground/HandlerAccordion.vue` — accepts `evalStatus` + `evalError` props
  - `docs/scripts/copy-browser-bundle.js` — copies browser bundle to `docs/public/playground/`
  - `docs/package.json` — updated `build` script to copy bundle; added `@types/js-yaml` devDep
  - `pnpm-lock.yaml` — updated lockfile
  - `.chief/prds/docs-playground/prd.json` — marked US-008 passes: true
- **Learnings for future iterations:**
  - `js-yaml` lacks its own types — must install `@types/js-yaml` as devDependency; use static `import * as jsYaml from 'js-yaml'` (not dynamic) for typecheck compatibility
  - Dynamic import of `/playground/openapi-mocks.browser.js` uses a string cast (`as string`) to satisfy TS — this is safe since Vite serves it as a static asset at runtime
  - `AsyncFunction` pattern: `Object.getPrototypeOf(async function(){}).constructor` — cast as `new(...args: string[]) => (...args: unknown[]) => Promise<unknown>` for TS
  - MSW `setupWorker()` must be called with no handlers initially; use `worker.resetHandlers(...handlers)` after eval
  - Pass `{ onUnhandledRequest: 'bypass' }` to `worker.start()` to prevent MSW from printing warnings for unrelated fetches
  - The `public/playground/` directory is created by the copy script at build time; in dev, manually run the copy script or build the browser bundle first

---

## 2026-02-18 - US-007
- What was implemented: Replaced the stub `CodeEditor.vue` with a full CodeMirror 6 editor using `vue-codemirror`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`, and `EditorView.lineWrapping`. Panel header shows label "Client Code" and a note "// createMockClient and spec are pre-injected". Component is a pure controlled input with no eval logic.
- Files changed:
  - `docs/src/components/playground/CodeEditor.vue` — full implementation with CodeMirror 6 JavaScript editor
  - `.chief/prds/docs-playground/prd.json` — marked US-007 passes: true
- **Learnings for future iterations:**
  - `CodeEditor.vue` follows identical structure to `SpecEditor.vue` — swap `yaml()` for `javascript()` from `@codemirror/lang-javascript`
  - `@codemirror/lang-javascript` is already installed in `docs/node_modules` (added in US-003)
  - Panel note text must match exactly: `// createMockClient and spec are pre-injected`

---

## 2026-02-18 - US-006
- What was implemented: Replaced the stub `SpecEditor.vue` with a full CodeMirror 6 editor using `vue-codemirror`, `@codemirror/lang-yaml`, `@codemirror/theme-one-dark`, and `EditorView.lineWrapping`. Panel header shows label "OpenAPI Spec" and a note about js-yaml parsing. Component is a pure controlled input (no `usePlayground` dependency).
- Files changed:
  - `docs/src/components/playground/SpecEditor.vue` — full implementation with CodeMirror 6 editor
  - `.chief/prds/docs-playground/prd.json` — marked US-006 passes: true
- **Learnings for future iterations:**
  - `vue-codemirror` `<Codemirror>` component accepts `:model-value` and emits `update:model-value` — compatible with `v-model` from parent
  - Extensions array: `[yaml(), oneDark, EditorView.lineWrapping]` — import `EditorView` from `@codemirror/view` (not from `codemirror`)
  - Use `:deep(.cm-editor)` and `:deep(.cm-scroller)` scoped CSS selectors to style CodeMirror internals inside a scoped `<style scoped>` block
  - `pnpm typecheck` (astro check) is the only quality check needed for docs-only Vue component changes; 0 errors confirms success

---

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
