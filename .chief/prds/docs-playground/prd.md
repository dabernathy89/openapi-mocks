# Docs Playground

## Overview

An interactive playground page on the `openapi-mocks` documentation site where users can experience the library without installing anything. The playground features a three-panel UI: a YAML spec editor, a live JavaScript code editor, and an accordion of MSW-intercepted `fetch()` calls with real response output. It lives at `/playground` and is teased via a CTA card on the homepage.

The playground runs entirely in the browser using a self-contained ESM bundle of `openapi-mocks`, real MSW service worker interception, and live code evaluation via `AsyncFunction`.

## User Stories

### US-001: Browser ESM bundle build config
**Priority:** 1
**Description:** As a library maintainer, I want a separate Vite build configuration that produces a self-contained browser-compatible ESM bundle of `openapi-mocks`, so that the docs playground can import the library as a static asset without any Node.js dependencies.

**Acceptance Criteria:**
- [ ] `packages/openapi-mocks/vite.browser.config.ts` exists and is a valid Vite library-mode config
- [ ] Running the build produces `packages/openapi-mocks/dist-browser/openapi-mocks.browser.js` as a single ESM file
- [ ] All dependencies (`@faker-js/faker`, `@apidevtools/swagger-parser`, `openapi-types`) are bundled inline
- [ ] `msw` is externalized (not bundled)
- [ ] `packages/openapi-mocks/package.json` has a `build:browser` script that runs the new config
- [ ] `packages/openapi-mocks/dist-browser/` is added to root `.gitignore`
- [ ] The bundle loads in a browser without Node.js-specific errors (verified in a browser console or Vitest browser mode)
- [ ] If `@apidevtools/swagger-parser` cannot be bundled due to unconditional Node.js imports, `@scalar/openapi-parser` is used in the browser bundle only (the main Node.js build is unchanged)

---

### US-002: MSW service worker setup in docs
**Priority:** 2
**Description:** As a developer setting up the playground, I want MSW's service worker file present in the docs public directory, so that `setupWorker().start()` can register it at the site root scope.

**Acceptance Criteria:**
- [ ] `docs/public/mockServiceWorker.js` exists (copied via `npx msw init docs/public/`)
- [ ] `msw` is added as a direct dependency in `docs/package.json` (v2.x)
- [ ] The file is committed to the repository (it is not gitignored)
- [ ] In a running docs dev server, DevTools > Application > Service Workers shows `mockServiceWorker.js` active at scope `/`

---

### US-003: Vue integration in Astro docs site
**Priority:** 3
**Description:** As a developer building the playground, I want Vue 3 support wired into the Astro docs site, so that I can use `client:only="vue"` islands for interactive components.

**Acceptance Criteria:**
- [ ] `@astrojs/vue` is added to `docs/package.json` devDependencies (v5.x)
- [ ] `vue` is added to `docs/package.json` dependencies (v3.x)
- [ ] `docs/astro.config.mjs` includes `vue()` in the integrations array
- [ ] A minimal smoke-test Vue component (`<script setup>` + `<template>`) can be mounted with `client:only="vue"` without build errors
- [ ] `vue-codemirror`, `@codemirror/lang-yaml`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`, and `js-yaml` are added to `docs/package.json` (see dependency versions in plan)

---

### US-004: Playground page scaffold
**Priority:** 4
**Description:** As a user navigating to `/playground`, I want a dedicated page that renders the playground UI within the standard site chrome, so that I get the site header and theme toggle without the page appearing in the docs sidebar or content search.

**Acceptance Criteria:**
- [ ] `docs/src/pages/playground.astro` exists as a standalone Astro page (not under `src/content/docs/`)
- [ ] The page wraps content in Starlight's `<StarlightPage>` component with an appropriate title
- [ ] The page is accessible at `/playground` in the dev server and static build
- [ ] The page does not appear in the Starlight sidebar or content collection search
- [ ] The page renders a placeholder `<Playground client:only="vue" />` import without errors
- [ ] `docs/src/components/playground/` directory structure exists with stub files: `Playground.vue`, `SpecEditor.vue`, `CodeEditor.vue`, `HandlerAccordion.vue`, `HandlerRow.vue`, `usePlayground.ts`, `sample-spec.ts`, `default-code.ts`, `types.ts`
- [ ] `types.ts` exports `HandlerInfo`, `FetchResult`, and `EvalResult` TypeScript interfaces

---

### US-005: Sample Petshop spec constant
**Priority:** 5
**Description:** As a playground user, I want the spec editor pre-loaded with a realistic sample OpenAPI spec, so that I can see the playground working immediately without writing my own spec.

**Acceptance Criteria:**
- [ ] `docs/src/components/playground/sample-spec.ts` exports a `SAMPLE_SPEC` string constant containing valid OpenAPI 3.x YAML
- [ ] The spec defines exactly 6 operations: `listPets` (`GET /pets`), `createPet` (`POST /pets`), `getPet` (`GET /pets/{petId}`), `deletePet` (`DELETE /pets/{petId}`), `listOwners` (`GET /owners`), `getOwner` (`GET /owners/{ownerId}`)
- [ ] The spec uses `$ref` component schemas (Pet, Owner, Error)
- [ ] At least one schema uses `x-faker-method` extensions
- [ ] Pet schema includes a nested Owner object; Owner schema includes a nested address object
- [ ] At least one operation has multiple response codes (e.g. `createPet` returns 201 and 422; `getPet` returns 200 and 404)
- [ ] At least one schema property uses an enum
- [ ] `docs/src/components/playground/default-code.ts` exports a `DEFAULT_CODE` string constant with the default Panel 2 code (calls `createMockClient(spec, { baseUrl: 'http://playground.local', seed: 42 })` and returns handlers)
- [ ] `js-yaml.load(SAMPLE_SPEC)` parses without errors

---

### US-006: Spec editor panel (Panel 1)
**Priority:** 6
**Description:** As a playground user, I want to edit the OpenAPI spec in a syntax-highlighted YAML editor, so that I can modify the spec and see the playground update.

**Acceptance Criteria:**
- [ ] `SpecEditor.vue` renders a CodeMirror 6 editor with YAML language support and One Dark theme
- [ ] The editor is pre-loaded with `SAMPLE_SPEC` on mount
- [ ] The editor emits an `update:modelValue` event (or equivalent) when content changes, compatible with `v-model` from the parent
- [ ] The editor fills its container and is scrollable for long specs
- [ ] A visible label or header identifies the panel as the spec editor (e.g. "OpenAPI Spec")
- [ ] A small note is visible: `// Parsed by js-yaml — $refs are resolved at eval time` (or similar)
- [ ] The component does not import or depend on `usePlayground` directly; it is a pure controlled input

---

### US-007: Code editor panel (Panel 2)
**Priority:** 7
**Description:** As a playground user, I want to edit JavaScript code in a syntax-highlighted editor that has `createMockClient` and `spec` pre-injected, so that I can experiment with the library API and see results immediately.

**Acceptance Criteria:**
- [ ] `CodeEditor.vue` renders a CodeMirror 6 editor with JavaScript language support and One Dark theme
- [ ] The editor is pre-loaded with `DEFAULT_CODE` on mount
- [ ] The editor emits `update:modelValue` on change, compatible with `v-model`
- [ ] A visible comment or UI note reads: `// createMockClient and spec are pre-injected`
- [ ] A visible label identifies the panel (e.g. "Client Code")
- [ ] The component is a pure controlled input with no eval logic

---

### US-008: `usePlayground` composable — eval and MSW wiring
**Priority:** 8
**Description:** As a developer, I want a `usePlayground` composable that owns all stateful logic — parsing the spec, debouncing changes, evaluating user code, and updating MSW handlers — so that the Vue components stay thin and the core logic is testable in isolation.

**Acceptance Criteria:**
- [ ] `usePlayground.ts` exports a `usePlayground()` composable
- [ ] Composable holds `specText` and `codeText` as `ref<string>` with initial values from `SAMPLE_SPEC` and `DEFAULT_CODE`
- [ ] On mount, calls `setupWorker()` from `msw/browser` and `await worker.start()` to register the service worker
- [ ] Watching `specText` triggers debounced re-eval after 800ms
- [ ] Watching `codeText` triggers debounced re-eval after 500ms
- [ ] Re-eval parses `specText` with `js-yaml.load()` to produce `specObject`
- [ ] Re-eval executes `new AsyncFunction('createMockClient', 'spec', codeText)(realCreateMockClient, specObject)` where `realCreateMockClient` is imported from the browser bundle at `/playground/openapi-mocks.browser.js`
- [ ] After successful eval, calls `worker.resetHandlers(...handlers)` with the returned `HttpHandler[]`
- [ ] Exposes `routes: ComputedRef<HandlerInfo[]>` derived from the active handlers (using `handler.info.method` and `handler.info.path`)
- [ ] Exposes `evalStatus: Ref<'idle' | 'pending' | 'ok' | 'error'>`
- [ ] Exposes `evalError: Ref<string | null>` (set on YAML parse error or JS eval error, cleared on success)
- [ ] The browser bundle is imported dynamically (`await import('/playground/openapi-mocks.browser.js')`) so it does not block initial page load
- [ ] The docs build step copies `packages/openapi-mocks/dist-browser/openapi-mocks.browser.js` to `docs/public/playground/openapi-mocks.browser.js`

---

### US-009: Handler accordion panel (Panel 3)
**Priority:** 9
**Description:** As a playground user, I want to see a list of active MSW route handlers displayed as collapsible accordion rows, so that I can browse which endpoints are available and explore each one.

**Acceptance Criteria:**
- [ ] `HandlerAccordion.vue` accepts a `routes` prop of type `HandlerInfo[]`
- [ ] Renders one `HandlerRow.vue` per route
- [ ] When `routes` is empty and `evalStatus` is `'ok'`, shows a message: "No handlers returned."
- [ ] When `evalStatus` is `'pending'`, shows a loading indicator
- [ ] A visible label identifies the panel (e.g. "Live Handlers")
- [ ] Each row displays `METHOD /path` with the HTTP method visually distinguished (e.g. colored badge)
- [ ] Only one row can be expanded at a time (accordion behavior)
- [ ] Expanding a row triggers a fetch (delegated to `HandlerRow`)

---

### US-010: Handler row — fetch and response display
**Priority:** 10
**Description:** As a playground user, I want to expand a handler row to fire a real `fetch()` call that MSW intercepts, so that I can see the actual mock response data the library generates.

**Acceptance Criteria:**
- [ ] `HandlerRow.vue` accepts a `route` prop of type `HandlerInfo` (method + path)
- [ ] On expand, fires `fetch('http://playground.local' + exampleUrl(route.path), { method: route.method })`
- [ ] Path parameters (`:param` style) are substituted: params containing `id` (case-insensitive) become `1`, all others become `example`
- [ ] While fetch is in flight, shows a loading state inside the accordion body
- [ ] On success, accordion body displays: HTTP status code, `Content-Type` header value, prettified JSON response body (if JSON), and duration in ms
- [ ] `DELETE` responses with 204 No Content display "204 No Content" without attempting to parse a body
- [ ] On fetch error (network failure, non-MSW response), displays a human-readable error message
- [ ] Each expand re-fires the fetch (not cached)
- [ ] Network tab in DevTools shows the fetch to `http://playground.local/...` fulfilled by "ServiceWorker"

---

### US-011: Error state display
**Priority:** 11
**Description:** As a playground user, I want clear error feedback when my spec YAML or JavaScript code is invalid, so that I can quickly identify and fix mistakes without the page crashing.

**Acceptance Criteria:**
- [ ] Invalid YAML in Panel 1 (e.g. broken indentation) shows an error message in the Panel 3 area within ~800ms; the accordion route list is cleared
- [ ] Invalid JavaScript in Panel 2 (e.g. syntax error, runtime exception) shows an error message in the Panel 3 area within ~500ms
- [ ] Error messages display the raw error string (e.g. `YAMLException: ...` or `ReferenceError: ...`)
- [ ] The page does not crash or throw an unhandled exception in either case
- [ ] Fixing the error (making the content valid again) clears the error and restores the accordion within the respective debounce window
- [ ] `Playground.vue` passes `evalError` and `evalStatus` from `usePlayground` to `HandlerAccordion` for display; no error logic lives in `HandlerRow`

---

### US-012: Homepage "Try the Playground" CTA
**Priority:** 12
**Description:** As a visitor to the docs homepage, I want a visible call-to-action that links to the playground, so that I can discover and try the interactive demo without searching for it.

**Acceptance Criteria:**
- [ ] `docs/src/content/docs/index.mdx` includes a card or link block that reads "Try the Playground" (or equivalent)
- [ ] The card links to `/playground/`
- [ ] The card includes a brief description (one sentence) of what the playground does
- [ ] The CTA renders correctly in both light and dark themes
- [ ] `pnpm build` in `docs/` succeeds with `dist/playground/index.html` present in the output
- [ ] The homepage CTA link navigates to the playground page without a 404
