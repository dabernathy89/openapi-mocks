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
      // Externalize only msw — bundle everything else inline
      external: (id) => id === 'msw' || id.startsWith('msw/'),
    },
    sourcemap: true,
  },
  resolve: {
    // Use browser-compatible builds when available
    browserField: true,
    conditions: ['browser', 'import', 'module', 'default'],
  },
});
