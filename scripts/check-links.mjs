#!/usr/bin/env bun
/**
 * Checks that every link on a docs page goes to a page (and #anchor) that exists.
 *
 * When:  after every build (postbuild, after check-paths), and in CI
 * Run:   bun run check:links        (or: bun scripts/check-links.mjs [outDir], default out/)
 * Tests: bun test scripts/check-links.test.mjs
 *
 * It reads every out/docs/**\/*.html and each <a href> in it, resolves the href the way the
 * browser does (against the page's own URL, which ends in "/" because of trailingSlash), and
 * fails when a link to this build's paths (router/paths.mjs: /docs/* and the root files):
 *   - goes to a page or file that isn't in out/ and isn't an old path netlify.toml redirects;
 *   - has an #anchor that the target page has no id for (same-page "#x" links included).
 * Links to the Hub's pages (/plugins, /eggs, …) and to other sites aren't checked.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isDocsPath } from '../router/paths.mjs';
import { docsRedirects } from './pack-docs.mjs';

const ORIGIN = 'https://pelican.dev';

/** The URL a built HTML file is served at: docs/panel/update/index.html -> /docs/panel/update/ */
export function pagePathOf(file) {
  return `/${file.replace(/index\.html$/, '').replace(/\.html$/, '/')}`;
}

/** `&amp;` and friends in an attribute value, as the browser reads them. */
function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** The href of every <a> in a page (double-quoted, which is what Next.js writes). */
export function linksIn(html) {
  const hrefs = [];
  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = /\shref="([^"]*)"/.exec(tag)?.[1];
    if (href !== undefined) hrefs.push(unescapeHtml(href));
  }
  return hrefs;
}

/** Every id in a page: the targets #anchors can jump to. */
export function idsIn(html) {
  const ids = new Set();
  for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) ids.add(unescapeHtml(id));
  return ids;
}

/**
 * The broken links in a build. `pages` maps each docs page's path (/docs/x/) to its HTML,
 * `files` is every file in out/ (relative, "/" separators) and `redirects` the paths
 * netlify.toml redirects (without a trailing slash). Returns `{ page, href, reason }`s.
 */
export function brokenLinks(pages, files, redirects = new Set()) {
  const fileSet = new Set(files);
  const idCache = new Map();
  const idsOf = (path) => {
    if (!idCache.has(path)) idCache.set(path, idsIn(pages.get(path) ?? ''));
    return idCache.get(path);
  };

  const broken = [];
  for (const [page, html] of pages) {
    for (const href of linksIn(html)) {
      if (!href || /^(mailto|tel):/.test(href)) continue;
      let url;
      try {
        url = new URL(href, `${ORIGIN}${page}`);
      } catch {
        broken.push({ page, href, reason: 'not a valid URL' });
        continue;
      }
      if (url.origin !== ORIGIN || !isDocsPath(url.pathname)) continue; // another site, or the Hub's

      const path = url.pathname;
      const hash = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';

      let target; // the HTML page the link lands on, if it is one
      if (pages.has(path)) target = path;
      else if (pages.has(`${path}/`)) target = `${path}/`; // served with a 301 to the slash
      else if (fileSet.has(path.slice(1))) target = undefined; // a file: .md, .txt, .sh, an image
      else if (path.endsWith('.md') && fileSet.has(`docs/md/${path.slice('/docs/'.length)}`)) target = undefined;
      else if (redirects.has(path.replace(/\/$/, ''))) continue; // an old path netlify.toml redirects
      else {
        broken.push({ page, href, reason: 'no such page' });
        continue;
      }

      if (hash && target && !idsOf(target).has(hash)) broken.push({ page, href, reason: `no #${hash} on ${target}` });
    }
  }
  return broken;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Runs the check on a built `outDir`: how many docs pages it read, and the broken links. */
export function checkLinks(outDir, toml = 'netlify.toml') {
  const files = walk(outDir).map((file) => relative(outDir, file).split(sep).join('/'));
  const pages = new Map();
  for (const file of files.filter((f) => f.startsWith('docs/') && f.endsWith('.html'))) {
    pages.set(pagePathOf(file), readFileSync(join(outDir, file), 'utf8'));
  }
  const redirects = new Set(
    existsSync(toml) ? docsRedirects(readFileSync(toml, 'utf8')).map(({ from }) => from.replace(/\/$/, '')) : [],
  );
  return { pages: pages.size, broken: brokenLinks(pages, files, redirects) };
}

function main(outDir) {
  try {
    statSync(outDir);
  } catch {
    console.error(`check-links: ${outDir}/ not found. Run the build first.`);
    process.exit(1);
  }

  const { pages, broken } = checkLinks(outDir);
  if (broken.length) {
    console.error(`check-links: ${broken.length} broken link(s) on the docs pages:`);
    for (const { page, href, reason } of broken.slice(0, 100)) console.error(`  ${page}  ${href}  (${reason})`);
    if (broken.length > 100) console.error(`  … and ${broken.length - 100} more`);
    console.error('\nFix the link in content/docs/, or add a redirect for an old path to netlify.toml.');
    process.exit(1);
  }
  console.log(`check-links: ok (${pages} docs pages)`);
}

if (import.meta.main) main(process.argv[2] ?? 'out');
