#!/usr/bin/env node
/**
 * pelican.dev as one site, locally: the docs build (out/) for /docs/* and the
 * five root files, the Hub for everything else. The same split the Cloudflare
 * route makes in production (router/README.md). Node only, no dependencies.
 *
 *   bun run build && node router/dev-server.mjs
 *   open http://127.0.0.1:8020/
 *
 * Env: PORT (8020), HUB (http://127.0.0.1:8010), OUT (out, relative to the repo).
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize, posix, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(repo, process.env.OUT ?? 'out');
const PORT = Number(process.env.PORT ?? 8020);
const HUB = new URL(process.env.HUB ?? 'http://127.0.0.1:8010');

/** The paths this build serves on pelican.dev; keep in step with router/README.md and scripts/check-paths.mjs. */
const ROOT_FILES = ['/llms.txt', '/llms-full.txt', '/update-panel.sh', '/migrate-panel.sh', '/migrate-wings.sh'];
const isDocsPath = (path) => path === '/docs' || path.startsWith('/docs/') || ROOT_FILES.includes(path);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** A file under out/ for a URL path, or undefined. Never leaves out/. */
async function fileFor(path) {
  const full = normalize(join(OUT, path));
  if (full !== OUT && !full.startsWith(OUT + sep)) return undefined;
  try {
    const info = await stat(full);
    if (info.isFile()) return { full, size: info.size };
    if (info.isDirectory()) return { dir: true };
  } catch {}
  return undefined;
}

/**
 * The Netlify mapping (netlify.toml), in the same order:
 * 1. /docs/_next/*  -> out/_next/*        (assetPrefix; forced)
 * 2. the file itself, or <dir>/index.html (a directory without the slash gets a 301, like Netlify)
 * 3. /docs/*        -> out/docs/md/*      (the .md copies; only when nothing else matched)
 */
async function resolveDocs(path) {
  if (path.startsWith('/docs/_next/')) {
    const file = await fileFor(path.slice('/docs'.length));
    return file?.full ? { file } : undefined;
  }
  const file = await fileFor(path);
  if (file?.full) return { file };
  if (file?.dir) {
    if (!path.endsWith('/')) return { redirect: `${path}/` };
    const index = await fileFor(`${path}index.html`);
    if (index?.full) return { file: index };
  }
  if (path.startsWith('/docs/')) {
    const md = await fileFor(`/docs/md/${path.slice('/docs/'.length)}`);
    if (md?.full) return { file: md };
  }
  return undefined;
}

function sendFile(res, method, status, { full, size }) {
  res.writeHead(status, {
    'Content-Type': TYPES[extname(full)] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': 'no-cache',
    'X-Served-By': 'docs (out/)',
  });
  if (method === 'HEAD') return res.end();
  // pipeline, not pipe: a file that fails to open after stat() ends this response instead
  // of crashing the router with an unhandled stream error.
  pipeline(createReadStream(full), res, () => {});
}

async function serveDocs(req, res, path) {
  // The docs are a static build and never see the Hub's session: like the
  // Worker will before it forwards to Netlify, drop Cookie and Authorization.
  delete req.headers.cookie;
  delete req.headers.authorization;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed\n');
  }
  const hit = await resolveDocs(path);
  if (hit?.redirect) {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.writeHead(301, { Location: hit.redirect + query });
    return res.end();
  }
  if (hit?.file) return sendFile(res, req.method, 200, hit.file);
  // Netlify answers every missing path with out/404.html.
  const notFound = await fileFor('/404.html');
  if (notFound?.full) return sendFile(res, req.method, 404, notFound);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n');
}

/**
 * Next.js navigation payloads (`RSC: 1` header or `?_rsc=`) for paths outside
 * the docs: the docs' client router prefetches them for links to the Hub (/,
 * /plugins, ...). The Hub has none, so answer here instead of booting Laravel;
 * on click Next.js then loads the page normally.
 */
const isNextPayload = (req) => req.headers.rsc === '1' || /[?&]_rsc=/.test(req.url ?? '');

function proxyToHub(req, res) {
  if (isNextPayload(req)) {
    res.setHeader('X-Served-By', 'router');
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not a docs page\n');
  }
  const headers = {
    ...req.headers,
    'x-forwarded-for': req.socket.remoteAddress ?? '',
    'x-forwarded-host': req.headers.host ?? '',
    'x-forwarded-proto': 'http',
  };
  const upstream = http.request(
    { protocol: HUB.protocol, hostname: HUB.hostname, port: HUB.port, method: req.method, path: req.url, headers },
    (hubRes) => {
      const out = { ...hubRes.headers, 'x-served-by': 'hub' };
      // Keep redirects on this origin when the Hub answers with its own address.
      if (typeof out.location === 'string' && out.location.startsWith(HUB.origin)) {
        out.location = out.location.slice(HUB.origin.length) || '/';
      }
      res.writeHead(hubRes.statusCode ?? 502, out);
      // pipeline, not pipe: if the Hub cuts its response short, the browser's response is
      // closed too instead of hanging (and a browser that leaves stops the Hub's).
      pipeline(hubRes, res, () => {});
    },
  );
  upstream.on('error', (error) => {
    if (res.headersSent) return res.destroy(error);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`The Hub at ${HUB.origin} did not answer: ${error.message}\n`);
  });
  pipeline(req, upstream, () => {});
}

const server = http.createServer(async (req, res) => {
  let path;
  try {
    // Decoded and with ./.. resolved, so /docs/%2e%2e/x can't reach out/ outside docs/.
    // Appended to an origin, not resolved against one: a path like //host/x stays a path (as in
    // worker.mjs), instead of becoming another host.
    path = posix.normalize(decodeURIComponent(new URL(`http://x${req.url ?? '/'}`).pathname));
  } catch {
    res.writeHead(400);
    return res.end();
  }
  const docs = isDocsPath(path);
  res.on('finish', () => console.log(`${res.statusCode} ${res.getHeader('x-served-by') === 'router' ? 'edge' : docs ? 'docs' : 'hub '} ${req.method} ${req.url}`));
  try {
    if (docs) await serveDocs(req, res, path);
    else proxyToHub(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`pelican.dev (local): http://127.0.0.1:${PORT}/`);
  console.log(`  /docs/*, ${ROOT_FILES.join(', ')} -> ${OUT}`);
  console.log(`  everything else -> ${HUB.origin}`);
});
