/**
 * Splits pelican.dev between the docs on Netlify and the Hub, as a Cloudflare Worker.
 *
 * When:  not deployed: production serves the docs from the Hub on Forge. This is the
 *        option for later (router/README.md, "Switching to the Worker").
 * Run:   cd router && bunx wrangler deploy --route "next.pelican.dev/*"   (to try it)
 * Tests: bun test router/worker.test.mjs
 *
 * As a Worker on `pelican.dev/*`: the docs build on Netlify for /docs/* and the root
 * files (paths.mjs), the Pelican Hub for everything else. `dev-server.mjs` makes the same split on your machine with
 * out/ in place of Netlify; README.md has the paths and the reasons.
 *
 * Env (wrangler.toml [vars]):
 *   DOCS_ORIGIN  the Netlify production site, e.g. https://pelica.netlify.app
 *   HUB_ORIGIN   the Hub, https://hub.pelican.dev
 *
 * No dependencies, no state: one request in, one fetch out (or an answer from
 * here for the few things the Worker settles itself).
 */

import { isDocsPath, isNextPayload, keepOnSite } from './paths.mjs';

const isReadOnly = (method) => method === 'GET' || method === 'HEAD';

/** An origin from the Worker's settings, without a trailing slash; a clear error if it's missing. */
function originFrom(env, name) {
  const value = env?.[name];
  if (!value) throw new Error(`The Worker setting ${name} is missing (router/wrangler.toml [vars]).`);
  return value.replace(/\/+$/, '');
}

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

/** Keep a redirect from `origin` on pelican.dev (paths.mjs, keepOnSite). */
function keepLocationHere(response, origin) {
  const location = response.headers.get('location');
  if (location) response.headers.set('location', keepOnSite(location, origin));
  return response;
}

async function toDocs(request, url, env, fetchImpl) {
  if (!isReadOnly(request.method)) {
    return new Response('Method Not Allowed\n', { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'text/plain' } });
  }

  // The docs are a static build and never see a Hub session.
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('authorization');

  const origin = originFrom(env, 'DOCS_ORIGIN');
  // Netlify does the /docs/_next and .md rewrites itself (netlify.toml).
  const upstream = await fetchImpl(onOrigin(url, origin), { method: request.method, headers, redirect: 'manual' });

  const response = editable(upstream);
  response.headers.delete('set-cookie');

  return keepLocationHere(response, origin);
}

async function toHub(request, url, env, fetchImpl) {
  const origin = originFrom(env, 'HUB_ORIGIN');
  const headers = new Headers(request.headers);

  // Who the visitor asked for and from where. The Hub trusts these from the Worker
  // (TRUSTED_PROXIES) and builds https://pelican.dev/... URLs from them.
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  headers.set('x-forwarded-port', url.port || (url.protocol === 'https:' ? '443' : '80'));
  // Only Cloudflare's word for the visitor's address: a visitor can send their own
  // X-Forwarded-For, and the Hub trusts that header from the Worker.
  headers.delete('x-forwarded-for');
  const visitor = request.headers.get('cf-connecting-ip');
  if (visitor) headers.set('x-forwarded-for', visitor);

  const init = { method: request.method, headers, redirect: 'manual' };
  if (!isReadOnly(request.method)) {
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
  if (isNextPayload(request.headers.get('rsc'), url)) {
    return new Response('Not a docs page\n', { status: 404, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
  }

  return toHub(request, url, env, fetchImpl);
}

export default {
  fetch: (request, env) => route(request, env),
};
