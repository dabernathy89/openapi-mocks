/**
 * Cloudflare Pages Function: Markdown content negotiation
 *
 * Handles requests ending in `.md` and returns the raw Markdown source for
 * the corresponding documentation page. This allows programmatic consumers
 * (LLMs, CLI tools, etc.) to fetch Markdown content directly.
 *
 * Examples:
 *   GET /guides/configuration.md  → returns raw Markdown source
 *   GET /examples/playwright.md   → returns raw Markdown source
 *   GET /reference/readme.md      → returns raw Markdown source
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Only handle requests ending in .md
  if (!pathname.endsWith('.md')) {
    return context.next();
  }

  // Strip trailing .md to get the slug
  const slug = pathname.slice(1, -3); // remove leading "/" and trailing ".md"

  // Try to find the source file in the static assets.
  // The built site copies markdown source files alongside HTML output.
  // We look in the docs source content directory via the ASSETS binding.
  // Since Cloudflare Pages serves static files from dist/, we need to
  // fetch the raw markdown from the source content path.
  //
  // Strategy: The Astro static build puts HTML at /slug/index.html.
  // We serve the raw .md source by fetching from the /_md/ directory,
  // which we populate during build by copying source files.
  //
  // For simplicity, we construct the path to the source markdown and
  // attempt to serve it from the static assets.

  // Normalize the slug: handle index pages and trailing slashes
  let normalizedSlug = slug;
  if (normalizedSlug.endsWith('/')) {
    normalizedSlug = normalizedSlug.slice(0, -1);
  }

  // Attempt to fetch the markdown source from the /_md/ static directory
  // (populated during the Astro build via a custom postbuild script).
  const mdSourceUrl = new URL(`/_md/${normalizedSlug}.md`, context.request.url);

  try {
    const assetResponse = await context.env.ASSETS.fetch(mdSourceUrl);
    if (assetResponse.ok) {
      const content = await assetResponse.text();
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch {
    // Asset not found, fall through to 404
  }

  return new Response(`Markdown source not found for: /${normalizedSlug}`, {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
