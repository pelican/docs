# router/

pelican.dev is two apps on one domain: the **Pelican Hub** (Laravel) serves
almost every path, and this repo's static build (Netlify) serves the docs.
In production a Cloudflare Worker on `pelican.dev/*` picks the origin per
request. `dev-server.mjs` makes the same split on your machine, so you can see
pelican.dev as one site before the Worker exists.

```sh
pnpm build                     # writes out/
node router/dev-server.mjs     # http://127.0.0.1:8020/ (or: pnpm preview:site)
```

Env: `PORT` (default `8020`), `HUB` (default `http://127.0.0.1:8010`), `OUT`
(default `out`). Node 22, no dependencies. Every request is logged as
`status docs|hub|edge METHOD url`.

## The paths this build serves

Matched on the decoded, normalised path (`/docs/%2e%2e/x` is `/x`):

| Path | From |
| --- | --- |
| `/docs` and `/docs/*` | `out/docs/` (pages, `search.json`, `sitemap.xml`, `md/`, `og/`, `img/`, `ui/v1/`) |
| `/docs/_next/*` | `out/_next/*` (assetPrefix `/docs`; the export still writes to `out/_next/`) |
| `/docs/<page>.md` | `out/docs/md/<page>.md`, only when no file matched first |
| `/llms.txt`, `/llms-full.txt` | `out/` |
| `/update-panel.sh`, `/migrate-panel.sh`, `/migrate-wings.sh` | `out/` (the docs tell people to `curl` them) |

Everything else goes to the Hub. `scripts/check-paths.mjs` keeps the build in
step with this list: it fails when a file lands outside `out/docs/` that isn't
one of the five root files, Netlify's own, or on its INTERIM list.

Inside the docs paths it behaves like Netlify (`netlify.toml`): `GET`/`HEAD`
only, a directory without its trailing slash gets a 301, a missing file gets
`out/404.html` with status 404. It does not apply the other redirects in
`netlify.toml` (old docs paths, short links).

## What the router does on each side

- **Docs paths** are served from `out/`. `Cookie` and `Authorization` are
  removed first: the docs are static and must never see a Hub session.
- **Everything else** is proxied to the Hub with its method, headers and body.
  `Location` headers pointing at the Hub's own address are made relative, so
  redirects stay on the one site.
- **Next.js payload requests outside the docs** (`RSC: 1` header or `?_rsc=`)
  are answered with 404 by the router itself. The docs' client router prefetches
  them for links to `/`, `/plugins`, `/eggs`, `/sponsor`; the Hub has none, and
  on click Next.js falls back to a normal page load. This keeps a Laravel boot
  off every docs page view.

## Mapping to the Cloudflare Worker

The Worker is the same three branches, with Netlify instead of `out/`:

```js
const ROOT_FILES = new Set(['/llms.txt', '/llms-full.txt', '/update-panel.sh', '/migrate-panel.sh', '/migrate-wings.sh']);
const isDocs = (p) => p === '/docs' || p.startsWith('/docs/') || ROOT_FILES.has(p);

export default {
  async fetch(request, env) {
    const url = new URL(request.url); // WHATWG URL: already normalised
    if (isDocs(url.pathname)) {
      const headers = new Headers(request.headers);
      headers.delete('cookie');
      headers.delete('authorization');
      // Netlify does the /docs/_next and .md rewrites itself (netlify.toml).
      return fetch(new URL(url.pathname + url.search, env.DOCS_ORIGIN), { method: request.method, headers });
    }
    if (request.headers.get('rsc') === '1' || url.searchParams.has('_rsc')) {
      return new Response('Not a docs page\n', { status: 404 });
    }
    return fetch(new Request(new URL(url.pathname + url.search, env.HUB_ORIGIN), request));
  },
};
```

- `DOCS_ORIGIN` is the Netlify production site (e.g. `https://pelican-docs.netlify.app`);
  PR previews keep their own Netlify URLs and don't go through the Worker.
- Set `X-Forwarded-Host: pelican.dev` towards the Hub (and trust the Worker in
  Laravel's TrustProxies) so it builds `https://pelican.dev/...` URLs.
- Strip any `Set-Cookie` from Netlify responses on the way back.
- Keep this file, `dev-server.mjs` and `scripts/check-paths.mjs` in step when the
  list changes.
