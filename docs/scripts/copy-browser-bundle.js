#!/usr/bin/env node
/**
 * Copies the openapi-mocks browser bundle into docs/public/playground/
 * so it is served as a static asset at /playground/openapi-mocks.browser.js
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../../packages/openapi-mocks/dist-browser/openapi-mocks.browser.js');
const destDir = resolve(__dirname, '../public/playground');
const dest = resolve(destDir, 'openapi-mocks.browser.js');

if (!existsSync(src)) {
  console.error(`[copy-browser-bundle] Source not found: ${src}`);
  console.error('Run "pnpm build:browser" in packages/openapi-mocks first.');
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-browser-bundle] Copied ${src} → ${dest}`);
