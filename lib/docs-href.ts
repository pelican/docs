/**
 * Where a link written in a docs page goes, as a site path.
 *
 * Pages keep the Docusaurus habit of relative links (`../versioning`, `./panel/install`,
 * `./docker.mdx`). They mean "next to this file", but the site has trailing slashes
 * (next.config.mjs), so a browser would resolve them one folder too deep:
 * `../versioning` on /docs/panel/update/ is /docs/panel/versioning/, which doesn't exist.
 * So they are resolved here, at build time, against the page's folder: the HTML page
 * (app/docs/[[...slug]]/page.tsx) and its Markdown copy (lib/llms.ts) both use this.
 * scripts/check-links.mjs then checks every link in the build.
 */

/**
 * `href` as written in the page whose file is `pagePath` (relative to content/docs, like
 * `panel/update.mdx`) → the path it points at: `/docs/versioning/`, `/docs/panel/install/#docker-compose`.
 * Other sites, `#anchors`, `mailto:` and root paths outside /docs (the Hub's /plugins, /eggs)
 * come back unchanged; /docs paths get the trailing slash the site uses.
 */
export function resolveDocsHref(href: string, pagePath: string): string {
  if (!href || href.startsWith('#') || href.startsWith('?') || href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href)) {
    return href;
  }
  const relative = !href.startsWith('/');
  if (!relative && !/^\/docs(\/|$|[?#])/.test(href)) return href;

  // The page's folder on the site: /docs/panel/ for panel/update.mdx, /docs/ for index.mdx.
  const dir = `/docs/${pagePath.split('/').slice(0, -1).join('/')}`.replace(/\/?$/, '/');
  const url = new URL(href, `https://x${dir}`);
  let path = url.pathname;
  if (relative) path = path.replace(/\.mdx?$/, '').replace(/\/index$/, '/');
  if (!path.endsWith('/') && !/\.[a-z\d]+$/i.test(path)) path += '/';
  return `${path}${url.search}${url.hash}`;
}
