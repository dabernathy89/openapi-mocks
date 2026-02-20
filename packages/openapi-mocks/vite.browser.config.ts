import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'openapi-mocks',
      formats: ['es'],
      fileName: () => 'openapi-mocks.browser.js',
    },
    outDir: 'dist-browser',
    rollupOptions: {
      // These packages are served via an import map (esm.sh CDN) in the docs playground.
      // Externalizing them keeps the browser bundle small and lets esm.sh supply
      // Node.js polyfills (including Buffer) that swagger-parser needs.
      external: (id) =>
        id === 'msw' ||
        id.startsWith('msw/') ||
        id === '@faker-js/faker' ||
        id === '@apidevtools/swagger-parser',
    },
    sourcemap: true,
  },
  resolve: {
    // Use browser-compatible builds when available
    browserField: true,
    conditions: ['browser', 'import', 'module', 'default'],
  },
});
