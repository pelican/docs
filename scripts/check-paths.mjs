#!/usr/bin/env bun
/**
 * Checks that the build only puts files where pelican.dev serves them.
 *
 * When:  after every build (postbuild), and in CI
 * Run:   bun run check:paths        (or: bun scripts/check-paths.mjs [outDir], default out/)
 * Tests: bun test scripts/check-paths.test.mjs
 *
 * On pelican.dev the Hub serves this build's /docs/* and its root files (router/paths.mjs);
 * every other path is the Hub's own. So every file in out/ must be under out/docs/, be one of
 * the root files, or be on a list below with a reason. A file anywhere else would never be
 * reached on pelican.dev.
 *
 * It fails on three things:
 *   - a file in out/ outside those places;
 *   - a root file missing from out/;
 *   - a docs page that loads something (script, stylesheet, font, icon, image, share image)
 *     from outside /docs/, because those paths are the Hub's.
 *
 * "The switch" below means the day pelican.dev's DNS points at the Hub (router/README.md,
 * "Production: the Hub on Forge"). Until then Netlify serves this whole build.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isDocsPath, ROOT_FILES } from '../router/paths.mjs';

/**
 * Lists of allowed files outside out/docs/. An entry ending in "/" matches everything in that
 * folder, one ending in "*" everything that starts with it; any other entry is one file.
 */

/** Netlify's own files: it reads them, it doesn't serve them as pages. */
const NETLIFY = [
  '_redirects',
  '_headers',
  // Netlify serves out/404.html for every missing path, /docs/* included; the Hub serves it too.
  '404.html',
];

/**
 * Served under /docs/ by a rewrite. _next/: the JS, CSS and fonts. Pages load them from
 * /docs/_next/ (assetPrefix in next.config.mjs); netlify.toml, the Hub and
 * router/dev-server.mjs map that to out/_next/.
 */
const MAPPED = ['_next/'];

/**
 * INTERIM: the landing pages (/, /eggs/, /support/, /faq/) and what only they use. The Hub
 * has its own; remove each entry, together with its pages, after the switch.
 */
const INTERIM = [
  'index.html', // the homepage
  'index.txt', // the homepage's navigation payload
  '__next.*', // the homepage's navigation payloads (__next.*.txt)
  'eggs/', // /eggs/
  'support/', // /support/
  'faq/', // /faq/
  'data/', // egg details the /eggs/ page loads
  'img/', // images on the landing pages (eggs, games, plugins, sponsors)
  'og/', // share images of the landing pages
  'sitemap.xml', // the landing pages' sitemap (the Hub serves /sitemap.xml)
  'robots.txt', // the Hub serves /robots.txt
  '404/', // Next's copy of the 404 page (404.html is the one served)
  '_not-found/', // the 404 page's navigation payloads
];

/** Whether a file (relative to out/, with "/" separators) matches a list entry. */
export function matches(file, entry) {
  if (entry.endsWith('/')) return file.startsWith(entry);
  if (entry.endsWith('*')) return file.startsWith(entry.slice(0, -1));
  return file === entry;
}

/**
 * Sorts the build's files into the places pelican.dev serves them from. Returns the counts,
 * how many files each INTERIM entry covers, the stray files and the missing root files.
 */
export function sortFiles(files) {
  const counts = { docs: 0, root: 0, netlify: 0, mapped: 0, interim: 0 };
  const interim = new Map();
  const stray = [];

  for (const file of files) {
    const interimEntry = INTERIM.find((entry) => matches(file, entry));

    if (file.startsWith('docs/')) counts.docs++;
    else if (ROOT_FILES.includes(file)) counts.root++;
    else if (NETLIFY.some((entry) => matches(file, entry))) counts.netlify++;
    else if (MAPPED.some((entry) => matches(file, entry))) counts.mapped++;
    else if (interimEntry) {
      counts.interim++;
      interim.set(interimEntry, (interim.get(interimEntry) ?? 0) + 1);
    } else stray.push(file);
  }

  const missing = ROOT_FILES.filter((file) => !files.includes(file));

  return { counts, interim, stray, missing };
}

/**
 * The paths a page loads from outside /docs/: <script src>, <link href> (stylesheets,
 * preloads, icons; not canonical or alternate, which are links), <img src> and share-image
 * <meta>. Links (<a href>) may point anywhere, and so may other sites. The patterns assume
 * double-quoted attributes, which is what Next.js writes.
 */
export function pathsLoadedOutsideDocs(html) {
  const outside = [];

  for (const [tag, name] of html.matchAll(/<(script|link|img|meta)\b[^>]*>/g)) {
    let url;
    if (name === 'link') url = /rel="(canonical|alternate)"/.test(tag) ? undefined : /\shref="([^"]+)"/.exec(tag)?.[1];
    else if (name === 'meta') url = /(og:image|twitter:image)"/.test(tag) ? /\scontent="([^"]+)"/.exec(tag)?.[1] : undefined;
    else url = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    if (!url) continue;

    const path = url.replace(/^https:\/\/pelican\.dev(?=\/)/, '');
    if (!path.startsWith('/') || path.startsWith('//')) continue; // another site
    if (isDocsPath(path)) continue;
    outside.push(path);
  }

  return outside;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Prints at most `max` lines of a list, then how many more there are. */
function printList(lines, max = 50) {
  for (const line of lines.slice(0, max)) console.error(`  ${line}`);
  if (lines.length > max) console.error(`  … and ${lines.length - max} more`);
}

function main(outDir) {
  try {
    statSync(outDir);
  } catch {
    console.error(`check-paths: ${outDir}/ not found. Run the build first.`);
    process.exit(1);
  }

  const files = walk(outDir).map((file) => relative(outDir, file).split(sep).join('/'));
  const { counts, interim, stray, missing } = sortFiles(files);

  // Each bad path once, with the first page that loads it.
  const loadedOutside = new Map();
  for (const file of files.filter((f) => f.startsWith('docs/') && f.endsWith('.html'))) {
    for (const path of pathsLoadedOutsideDocs(readFileSync(join(outDir, file), 'utf8'))) {
      if (!loadedOutside.has(path)) loadedOutside.set(path, file);
    }
  }

  console.log(`check-paths: ${files.length} files in ${outDir}/`);
  console.log(`  under docs/          ${counts.docs}`);
  console.log(`  root files           ${counts.root} (${ROOT_FILES.join(', ')})`);
  console.log(`  _next/ (/docs/_next) ${counts.mapped}`);
  console.log(`  Netlify              ${counts.netlify}`);
  console.log(`  INTERIM              ${counts.interim} (remove after the switch)`);
  for (const [entry, n] of interim) console.log(`    ${entry.padEnd(14)} ${n}`);

  let failed = false;
  if (missing.length) {
    failed = true;
    console.error(`\nMissing root files: ${missing.join(', ')}`);
  }
  if (stray.length) {
    failed = true;
    console.error(`\n${stray.length} file(s) outside docs/ that pelican.dev would never serve from this build:`);
    printList(stray);
    console.error('\nMove them under /docs/, or add them to a list in scripts/check-paths.mjs with a reason.');
  }
  if (loadedOutside.size) {
    failed = true;
    console.error(`\nDocs pages load ${loadedOutside.size} path(s) outside /docs/ (the Hub's after the switch):`);
    printList([...loadedOutside].map(([path, file]) => `${path}  (first seen in ${file})`));
  }

  if (failed) process.exit(1);
  console.log('\ncheck-paths: ok');
}

if (import.meta.main) main(process.argv[2] ?? 'out');
