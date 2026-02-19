import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'openapi-mocks',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      // Externalize all deps — consumers bring their own
      external: (id) => !id.startsWith('.') && !id.startsWith('/'),
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist',
    }),
  ],
});
