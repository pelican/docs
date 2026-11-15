#!/usr/bin/env node
/**
 * After `next build`: every file in out/ must be under out/docs/, unless it is
 * listed below. pelican.dev will send only /docs/* and the five root files to
 * this build (a Cloudflare route; see router/README.md); the Hub serves every
 * other path. A file outside out/docs/ that isn't listed would be unreachable
 * on pelican.dev, or would mean a docs page depends on a path the Hub owns.
 *
 * It also reads every docs page (every .html file under out/docs/) and fails if one loads
 * something (script, stylesheet, font, icon, image, share image) from outside
 * /docs/: after the switch those paths are the Hub's.
 *
 *   node scripts/check-paths.mjs [outDir]     (default: out)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Served at the site root by this build, also after the switch. */
const ROOT_FILES = ['llms.txt', 'llms-full.txt', 'update-panel.sh', 'migrate-panel.sh', 'migrate-wings.sh'];

/** Netlify's own files: it reads them, it doesn't serve them as pages. */
const NETLIFY = [
  '_redirects',
  '_headers',
  // Netlify serves out/404.html for every missing path, /docs/* included.
  '404.html',
];

/**
 * Prefix-matched paths that are reachable under /docs/ by a rewrite.
 * _next/: the JS, CSS and fonts. Pages load them from /docs/_next/ (assetPrefix
 * in next.config.mjs); netlify.toml and router/dev-server.mjs map that to out/_next/.
 */
const MAPPED = ['_next/'];

/**
 * INTERIM: the landing pages (/, /eggs/, /support/, /faq/) and what only they
 * use. Each entry: remove after the switch, together with the pages.
 */
const INTERIM = [
  'index.html', // remove after the switch: the homepage
  'index.txt', // remove after the switch: the homepage's navigation payload
  '__next.', // remove after the switch: the homepage's navigation payloads (__next.*.txt)
  'eggs/', // remove after the switch: /eggs/
  'support/', // remove after the switch: /support/
  'faq/', // remove after the switch: /faq/
  'data/', // remove after the switch: egg details the /eggs/ page loads
  'img/', // remove after the switch: images on the landing pages (eggs, games, plugins, sponsors)
  'og/', // remove after the switch: share images of the landing pages
  'sitemap.xml', // remove after the switch: the landing pages' sitemap (the Hub serves /sitemap.xml)
  'robots.txt', // remove after the switch: the Hub serves /robots.txt
  '404/', // remove after the switch: Next's copy of the 404 page (Netlify uses 404.html)
  '_not-found/', // remove after the switch: the 404 page's navigation payloads
];

const outDir = process.argv[2] ?? 'out';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

try {
  statSync(outDir);
} catch {
  console.error(`check-paths: ${outDir}/ not found. Run the build first.`);
  process.exit(1);
}

const files = walk(outDir).map((file) => relative(outDir, file).split(sep).join('/'));
const counts = { docs: 0, root: 0, netlify: 0, mapped: 0, interim: 0 };
const interimHits = new Map();
const stray = [];

const matches = (file, entry) => (entry.endsWith('/') || entry.endsWith('.') ? file.startsWith(entry) : file === entry);

for (const file of files) {
  if (file.startsWith('docs/')) counts.docs++;
  else if (ROOT_FILES.includes(file)) counts.root++;
  else if (NETLIFY.includes(file)) counts.netlify++;
  else if (MAPPED.some((entry) => file.startsWith(entry))) counts.mapped++;
  else {
    const entry = INTERIM.find((e) => matches(file, e));
    if (entry) {
      counts.interim++;
      interimHits.set(entry, (interimHits.get(entry) ?? 0) + 1);
    } else stray.push(file);
  }
}

const missing = ROOT_FILES.filter((file) => !files.includes(file));

// What docs pages load: <script src>, <link href> (stylesheets, preloads, icons;
// not canonical/alternate, which are links), <img src> and share-image <meta>.
// Links (<a href>) may point anywhere.
const TAGS = /<(script|link|img|meta)\b[^>]*>/g;
const badRefs = new Set();
for (const file of files.filter((f) => f.startsWith('docs/') && f.endsWith('.html'))) {
  const html = readFileSync(join(outDir, file), 'utf8');
  for (const [tag, name] of html.matchAll(TAGS)) {
    let url;
    if (name === 'link') url = /rel="(canonical|alternate)"/.test(tag) ? undefined : /\shref="([^"]+)"/.exec(tag)?.[1];
    else if (name === 'meta') url = /(og:image|twitter:image)"/.test(tag) ? /\scontent="([^"]+)"/.exec(tag)?.[1] : undefined;
    else url = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    if (!url) continue;
    const path = url.replace(/^https:\/\/pelican\.dev(?=\/)/, '');
    if (!path.startsWith('/') || path.startsWith('//')) continue; // other sites
    if (path.startsWith('/docs/') || ROOT_FILES.includes(path.slice(1))) continue;
    badRefs.add(`${path}  (first seen in ${file})`);
  }
}

console.log(`check-paths: ${files.length} files in ${outDir}/`);
console.log(`  under docs/          ${counts.docs}`);
console.log(`  root files           ${counts.root} (${ROOT_FILES.join(', ')})`);
console.log(`  _next/ (/docs/_next) ${counts.mapped}`);
console.log(`  Netlify              ${counts.netlify}`);
console.log(`  INTERIM              ${counts.interim} (remove after the switch)`);
for (const [entry, n] of interimHits) console.log(`    ${entry.padEnd(14)} ${n}`);

let failed = false;
if (missing.length) {
  failed = true;
  console.error(`\nMissing root files: ${missing.join(', ')}`);
}
if (stray.length) {
  failed = true;
  console.error(`\n${stray.length} file(s) outside docs/ that pelican.dev would not route to this build:`);
  for (const file of stray.slice(0, 50)) console.error(`  ${file}`);
  if (stray.length > 50) console.error(`  … and ${stray.length - 50} more`);
  console.error('\nMove them under /docs/, or add them to a list in scripts/check-paths.mjs with a reason.');
}

if (badRefs.size) {
  failed = true;
  console.error(`\nDocs pages load ${badRefs.size} path(s) outside /docs/ (the Hub's after the switch):`);
  for (const ref of [...badRefs].slice(0, 50)) console.error(`  ${ref}`);
}

if (failed) process.exit(1);
console.log('\ncheck-paths: ok');
