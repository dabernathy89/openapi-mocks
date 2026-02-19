/**
 * Post-build script: copy Markdown source files to dist/_md/
 *
 * This makes raw Markdown source available to the Cloudflare Pages Function
 * at /_md/<slug>.md so it can serve content negotiation for .md URLs.
 *
 * Source:      src/content/docs/**\/*.{md,mdx}
 * Destination: dist/_md/**\/*.md
 */
import { readdirSync, mkdirSync, copyFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const srcDir = join(docsRoot, 'src', 'content', 'docs');
const destDir = join(docsRoot, 'dist', '_md');

function copyMarkdownFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      copyMarkdownFiles(srcPath);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      // Compute relative path from src/content/docs → use as the dest path
      const relPath = relative(srcDir, srcPath);
      // Normalize .mdx → .md in dest
      const destRelPath = relPath.replace(/\.mdx$/, '.md');
      const destPath = join(destDir, destRelPath);
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying Markdown sources to dist/_md/ ...');
copyMarkdownFiles(srcDir);
console.log('Done.');
