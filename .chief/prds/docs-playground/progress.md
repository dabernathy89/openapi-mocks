## Codebase Patterns
- pnpm workspaces monorepo: library at `packages/openapi-mocks/`, docs at `docs/`
- Library uses Vite 7 in library mode, outputs ESM + CJS to `dist/`
- Tests use Vitest; typecheck uses `tsc --noEmit`; quality check = `pnpm test && pnpm typecheck`
- `@apidevtools/json-schema-ref-parser` has `"browser": { "fs": false }` in package.json — Vite handles Node.js stubs automatically for browser builds
- Browser bundle: externalize only `msw` and `msw/*`; all other deps bundle inline via Vite conditions `['browser', 'import', 'module', 'default']`
- `dist-browser/` goes in root `.gitignore` alongside `dist/`

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
