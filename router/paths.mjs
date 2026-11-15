/**
 * Which paths on pelican.dev come from this build, in one place.
 *
 * When:  imported by scripts/check-paths.mjs, scripts/pack-docs.mjs, router/dev-server.mjs and
 *        router/worker.mjs (and by the Hub's list in pelican/hub, DocsBuildService::ROOT_FILES)
 * Run:   nothing to run; change the list here and the four files above follow
 * Tests: bun test router/paths.test.mjs
 *
 * This build serves /docs/* and a few files at the site's root (the ones the docs tell people
 * to download, like update-panel.sh). Every other path on pelican.dev is the Hub's.
 */

/** Files served at pelican.dev's root from this build (out/<name>). The Hub has the same list. */
export const ROOT_FILES = ['llms.txt', 'llms-full.txt', 'update-panel.sh', 'migrate-panel.sh', 'migrate-wings.sh'];

/**
 * Whether a URL path is this build's to answer. Pass `new URL(...).pathname`: already free of
 * dot segments, and not decoded, so `/docs%2Fx` is one segment like the browser sees it.
 */
export function isDocsPath(pathname) {
  return pathname === '/docs' || pathname.startsWith('/docs/') || ROOT_FILES.includes(pathname.slice(1));
}

/**
 * Whether a request is a Next.js navigation payload (the docs' client router prefetching a
 * link): an `RSC: 1` header or a `_rsc` query parameter.
 */
export function isNextPayload(rscHeader, url) {
  return rscHeader === '1' || url.searchParams.has('_rsc');
}

/**
 * A redirect's Location, kept on pelican.dev: if it points at `origin` itself (Netlify's
 * trailing-slash 301s, a Hub building its own address), only its path and query are kept, so
 * the browser stays on the site. Anything else is returned unchanged. Compared by origin, not
 * by prefix: https://hub.pelican.dev.example.com is a different site.
 */
export function keepOnSite(location, origin) {
  let target;
  try {
    target = new URL(location, origin);
  } catch {
    return location;
  }

  if (target.origin !== new URL(origin).origin) return location;

  // A path that starts with "//" (or "/\\") would be read by the browser as another site
  // (https://hub.pelican.dev//evil.example/ -> //evil.example/), so keep a single slash.
  const path = target.pathname.replace(/^[/\\]+/, '/');

  return `${path}${target.search}${target.hash}`;
}
