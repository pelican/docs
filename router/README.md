# router/

pelican.dev is two apps on one domain: the **Pelican Hub** (Laravel) serves
almost every path, and this repo's static build (Netlify) serves the docs.
In production a Cloudflare Worker on `pelican.dev/*` (`worker.mjs`) picks the
origin per request. `dev-server.mjs` makes the same split on your machine, with
`out/` in place of Netlify.

```sh
bun run build                  # writes out/
node router/dev-server.mjs     # http://127.0.0.1:8020/ (or: bun run preview:site)
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

## The Cloudflare Worker (`worker.mjs`)

The same three branches as the dev server, with Netlify instead of `out/`:

- **Docs paths** are fetched from `DOCS_ORIGIN` (the Netlify production site,
  `https://pelica.netlify.app`) without `Cookie` or `Authorization`, and any
  `Set-Cookie` is dropped on the way back. Netlify does the `/docs/_next` and
  `.md` rewrites itself (`netlify.toml`). Only `GET`/`HEAD`; anything else is 405.
- **Everything else** is fetched from `HUB_ORIGIN` (`https://hub.pelican.dev`)
  with its method, headers, body and cookies, plus `X-Forwarded-Host`,
  `-Proto`, `-Port` and `-For` (from `CF-Connecting-IP`). The Hub trusts those
  once `TRUSTED_PROXIES` is set, and then builds `https://pelican.dev/...` URLs.
- **Next.js payload requests outside the docs** are answered with 404 here.

Both fetches use `redirect: 'manual'`, so redirects reach the browser. A
`Location` on the origin's own address (Netlify's trailing-slash 301s point at
`pelica.netlify.app`) becomes a path, so they stay on pelican.dev.

```sh
bun run test:router   # node --test router/worker.test.mjs: the routing, with fetch recorded
cd router && bunx wrangler deploy --route "next.pelican.dev/*"   # try it on a spare hostname
```

`wrangler.toml` holds the two origins and, commented out, the `pelican.dev/*`
route for the switch. Keep `worker.mjs`, `dev-server.mjs` and
`scripts/check-paths.mjs` in step when the list of paths changes.

## Switching pelican.dev over

In this order, so nothing points at something that isn't there yet:

1. **Docs**: merge to `main` so Netlify production builds this site. Until the
   Worker is on, its interim landing pages keep `pelican.dev/` working.
2. **Hub** (Forge, production): deploy the redesign with `SITE_REDESIGN=true`,
   `APP_URL=https://pelican.dev`, `HUB_MACHINE_URL=https://hub.pelican.dev`
   (panels' update.json, downloads and the API stay there),
   `HUB_SITE_URL=https://pelican.dev`, `TRUSTED_PROXIES=*` and
   `SESSION_DOMAIN=.pelican.dev` (sign-in callbacks stay on hub.pelican.dev, so
   the session cookie must cover both). Then `php artisan config:cache`.
3. **Try the Worker** on a spare proxied hostname (`next.pelican.dev`): pages,
   a docs page and an old docs URL, `/update-panel.sh`, signing in.
4. **Switch**: proxy the `pelican.dev` DNS record (orange cloud) and add the
   `pelican.dev/*` route to the Worker.
5. **Then** set `HUB_REDIRECT_HUMANS=true`, so page visits on hub.pelican.dev
   move to pelican.dev. Not before `TRUSTED_PROXIES`: without it the Hub sees
   every Worker request as hub.pelican.dev and would redirect it in a loop.
6. **Clean up**: drop the INTERIM pages from the build (`scripts/check-paths.mjs`).

**Rollback**: remove the Worker route (or un-proxy the DNS record).
pelican.dev goes straight to Netlify again, which still serves the interim
pages and the docs; hub.pelican.dev never stopped working. Unset
`HUB_REDIRECT_HUMANS` if it was on.
