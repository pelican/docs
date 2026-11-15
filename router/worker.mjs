/**
 * Splits pelican.dev between the docs on Netlify and the Hub, as a Cloudflare Worker.
 *
 * When:  not deployed: production serves the docs from the Hub on Forge. This is the
 *        option for later (router/README.md, "Switching to the Worker").
 * Run:   cd router && bunx wrangler deploy --route "next.pelican.dev/*"   (to try it)
 * Tests: bun test router/worker.test.mjs
 *
 * As a Worker on `pelican.dev/*`: the docs build on Netlify for /docs/* and the five root
 * files, the Pelican Hub for everything else. `dev-server.mjs` makes the same split on your machine with
 * out/ in place of Netlify; README.md has the paths and the reasons.
 *
 * Env (wrangler.toml [vars]):
 *   DOCS_ORIGIN  the Netlify production site, e.g. https://pelica.netlify.app
 *   HUB_ORIGIN   the Hub, https://hub.pelican.dev
 *
 * No dependencies, no state: one request in, one fetch out (or an answer from
 * here for the few things the Worker settles itself).
 */

/** The paths this build serves on pelican.dev; keep in step with README.md, dev-server.mjs and scripts/check-paths.mjs. */
export const ROOT_FILES = new Set(['/llms.txt', '/llms-full.txt', '/update-panel.sh', '/migrate-panel.sh', '/migrate-wings.sh']);

export const isDocsPath = (path) => path === '/docs' || path.startsWith('/docs/') || ROOT_FILES.has(path);

/** A Next.js navigation payload (the docs' client router prefetching a Hub link). */
const isNextPayload = (request, url) => request.headers.get('rsc') === '1' || url.searchParams.has('_rsc');

const hasBody = (method) => method !== 'GET' && method !== 'HEAD';

/**
 * The visitor's path and query on `origin`. Built from the origin with the path set on it, never
 * by resolving the path against the origin: `new URL('//attacker.example/', origin)` would be
 * attacker.example, and the visitor's cookies would go with it.
 */
export function onOrigin(url, origin) {
  const target = new URL(origin);
  target.pathname = url.pathname;
  target.search = url.search;
  return target;
}

/**
 * A response we can change: fetch() hands back immutable headers.
 */
function editable(response) {
  return new Response(response.body, response);
}

/**
 * Keep redirects on pelican.dev: an origin that answers with its own address
 * (Netlify's trailing-slash 301s, a Hub that doesn't trust the Worker yet) gets
 * the path only, which the browser resolves against pelican.dev.
 */
function keepLocationHere(response, origin) {
  const location = response.headers.get('location');
  if (location && location.startsWith(origin)) {
    response.headers.set('location', location.slice(origin.length) || '/');
  }
  return response;
}

async function toDocs(request, url, env, fetchImpl) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed\n', { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'text/plain' } });
  }

  // The docs are a static build and never see a Hub session.
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('authorization');

  const origin = env.DOCS_ORIGIN.replace(/\/+$/, '');
  // Netlify does the /docs/_next and .md rewrites itself (netlify.toml).
  const upstream = await fetchImpl(onOrigin(url, origin), { method: request.method, headers, redirect: 'manual' });

  const response = editable(upstream);
  response.headers.delete('set-cookie');

  return keepLocationHere(response, origin);
}

async function toHub(request, url, env, fetchImpl) {
  const origin = env.HUB_ORIGIN.replace(/\/+$/, '');
  const headers = new Headers(request.headers);

  // Who the visitor asked for and from where. The Hub trusts these from the Worker
  // (TRUSTED_PROXIES) and builds https://pelican.dev/... URLs from them.
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  headers.set('x-forwarded-port', url.port || (url.protocol === 'https:' ? '443' : '80'));
  const visitor = request.headers.get('cf-connecting-ip');
  if (visitor) headers.set('x-forwarded-for', visitor);

  const init = { method: request.method, headers, redirect: 'manual' };
  if (hasBody(request.method)) {
    init.body = request.body;
    init.duplex = 'half'; // a streamed body (Node needs it; Workers accept it)
  }

  const upstream = await fetchImpl(onOrigin(url, origin), init);

  return keepLocationHere(editable(upstream), origin);
}

/**
 * The routing itself, with fetch passed in so the tests can see what goes out.
 */
export async function route(request, env, fetchImpl = fetch) {
  // WHATWG URL: the path is already normalised (/docs/%2e%2e/x is /x).
  const url = new URL(request.url);

  if (isDocsPath(url.pathname)) {
    return toDocs(request, url, env, fetchImpl);
  }

  // The Hub has no Next.js payloads; answering here keeps a Laravel boot off every docs page
  // view (the docs prefetch their header links). On click Next.js loads the page normally.
  if (isNextPayload(request, url)) {
    return new Response('Not a docs page\n', { status: 404, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
  }

  return toHub(request, url, env, fetchImpl);
}

export default {
  fetch: (request, env) => route(request, env),
};
