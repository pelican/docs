#!/usr/bin/env bun
/**
 * Shows pelican.dev as one site on your machine.
 *
 * When:  by hand, to see the docs and a local Hub together
 * Run:   bun run build && bun run dev:site, then open http://127.0.0.1:8020/
 * Tests: bun test router/dev-server.test.mjs
 *
 * The docs build (out/) answers /docs/* and the five root files, the Hub everything else: the
 * split pelican.dev makes in production (router/README.md). No dependencies.
 * Env: PORT (8020), HUB (http://127.0.0.1:8010), OUT (out, relative to the repo).
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { isDocsPath, isNextPayload, keepOnSite, ROOT_FILES } from './paths.mjs';

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

/**
 * A file under `out` for a URL path, `{ dir: true }` for a folder, or undefined. The path is
 * decoded here (and only here), and it can never leave `out`.
 */
async function fileFor(out, path) {
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return undefined;
  }

  const full = normalize(join(out, decoded));
  if (full !== out && !full.startsWith(out + sep)) return undefined;

  try {
    const info = await stat(full);
    if (info.isFile()) return { full, size: info.size };
    if (info.isDirectory()) return { dir: true };
  } catch {}
  return undefined;
}

/**
 * What the docs build answers for a path under `out`, the way Netlify does (netlify.toml):
 * 1. /docs/_next/*  -> out/_next/*        (assetPrefix)
 * 2. the file itself, or <dir>/index.html (a folder without its slash gets a 301)
 * 3. /docs/*        -> out/docs/md/*      (the .md copies, only when nothing else matched)
 *
 * Returns `{ file }`, `{ redirect }` or undefined (missing: the caller sends out/404.html).
 */
export async function resolveDocs(pathname, out) {
  if (pathname.startsWith('/docs/_next/')) {
    const file = await fileFor(out, pathname.slice('/docs'.length));
    return file?.full ? { file } : undefined;
  }

  const file = await fileFor(out, pathname);
  if (file?.full) return { file };
  if (file?.dir) {
    if (!pathname.endsWith('/')) return { redirect: `${pathname}/` };
    const index = await fileFor(out, `${pathname}index.html`);
    if (index?.full) return { file: index };
  }

  if (pathname.startsWith('/docs/')) {
    const md = await fileFor(out, `/docs/md/${pathname.slice('/docs/'.length)}`);
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
  // of crashing the server with an unhandled stream error.
  pipeline(createReadStream(full), res, () => {});
}

async function serveDocs(req, res, url, out) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed\n');
  }

  const hit = await resolveDocs(url.pathname, out);
  if (hit?.redirect) {
    res.writeHead(301, { Location: hit.redirect + url.search });
    return res.end();
  }
  if (hit?.file) return sendFile(res, req.method, 200, hit.file);

  // Netlify answers every missing path with out/404.html.
  const notFound = await fileFor(out, '/404.html');
  if (notFound?.full) return sendFile(res, req.method, 404, notFound);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n');
}

function proxyToHub(req, res, url, hub) {
  // The docs' client router prefetches its links to the Hub as Next.js payloads; the Hub has
  // none, so answer here instead of booting Laravel. On click Next.js loads the page normally.
  if (isNextPayload(req.headers.rsc, url)) {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'X-Served-By': 'router' });
    return res.end('Not a docs page\n');
  }

  const headers = {
    ...req.headers,
    'x-forwarded-for': req.socket.remoteAddress ?? '',
    'x-forwarded-host': req.headers.host ?? '',
    'x-forwarded-proto': 'http',
  };
  const upstream = http.request(
    { protocol: hub.protocol, hostname: hub.hostname, port: hub.port, method: req.method, path: req.url, headers },
    (hubRes) => {
      const out = { ...hubRes.headers, 'x-served-by': 'hub' };
      if (typeof out.location === 'string') out.location = keepOnSite(out.location, hub.origin);
      res.writeHead(hubRes.statusCode ?? 502, out);
      // pipeline, not pipe: if the Hub cuts its response short, the browser's response is
      // closed too instead of hanging (and a browser that leaves stops the Hub's).
      pipeline(hubRes, res, () => {});
    },
  );
  upstream.on('error', (error) => {
    if (res.headersSent) return res.destroy(error);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`The Hub at ${hub.origin} did not answer: ${error.message}\n`);
  });
  pipeline(req, upstream, () => {});
}

/** The local server: the same docs-or-Hub decision as worker.mjs (paths.mjs). */
export function createServer({ out, hub }) {
  return http.createServer(async (req, res) => {
    // Appended to a dummy origin, never resolved against one, so //host/x stays a path. The
    // pathname has its ./.. resolved and is not decoded, as in the Worker.
    const url = new URL(`http://x${req.url ?? '/'}`);
    const docs = isDocsPath(url.pathname);

    res.on('finish', () => {
      const by = res.getHeader('x-served-by') === 'router' ? 'edge' : docs ? 'docs' : 'hub ';
      console.log(`${res.statusCode} ${by} ${req.method} ${req.url}`);
    });

    try {
      if (docs) await serveDocs(req, res, url, out);
      else proxyToHub(req, res, url, hub);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
}

if (import.meta.main) {
  const out = resolve(import.meta.dir, '..', process.env.OUT ?? 'out');
  const hub = new URL(process.env.HUB ?? 'http://127.0.0.1:8010');
  const port = Number(process.env.PORT ?? 8020);

  createServer({ out, hub }).listen(port, '127.0.0.1', () => {
    console.log(`pelican.dev (local): http://127.0.0.1:${port}/`);
    console.log(`  /docs/*, ${ROOT_FILES.map((name) => `/${name}`).join(', ')} -> ${out}`);
    console.log(`  everything else -> ${hub.origin}`);
  });
}
