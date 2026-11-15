// bun test router/dev-server.test.mjs  (all tests: bun test)
// The local server against a temporary out/ and a fake Hub: what the docs build answers,
// and what goes to the Hub.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, resolveDocs } from './dev-server.mjs';

// out/ sits inside its own temporary folder, next to a file it must never serve.
const sandbox = mkdtempSync(join(tmpdir(), 'dev-server-'));
const out = join(sandbox, 'out');
const write = (path, body) => {
  mkdirSync(join(out, path, '..'), { recursive: true });
  writeFileSync(join(out, path), body);
};

write('docs/index.html', '<title>Docs</title>');
write('docs/panel/getting-started/index.html', '<title>Getting started</title>');
write('docs/md/panel/update.md', '# Update');
write('_next/static/app.css', 'body{}');
write('404.html', '<title>Not found</title>');
write('update-panel.sh', '#!/bin/bash');
writeFileSync(join(sandbox, 'secret.txt'), 'outside out/');

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe('resolveDocs', () => {
  test('a page, a folder with its slash, and a root file', async () => {
    expect((await resolveDocs('/docs/', out))?.file.full).toBe(join(out, 'docs/index.html'));
    expect((await resolveDocs('/docs/panel/getting-started/', out))?.file.full).toBe(join(out, 'docs/panel/getting-started/index.html'));
    expect((await resolveDocs('/update-panel.sh', out))?.file.full).toBe(join(out, 'update-panel.sh'));
  });

  test('a folder without its slash gets a redirect', async () => {
    expect(await resolveDocs('/docs/panel/getting-started', out)).toEqual({ redirect: '/docs/panel/getting-started/' });
  });

  test('/docs/_next/* comes from out/_next, and a missing .md from out/docs/md', async () => {
    expect((await resolveDocs('/docs/_next/static/app.css', out))?.file.full).toBe(join(out, '_next/static/app.css'));
    expect((await resolveDocs('/docs/panel/update.md', out))?.file.full).toBe(join(out, 'docs/md/panel/update.md'));
  });

  test('a missing page, and never a file outside out/', async () => {
    expect(await resolveDocs('/docs/nope/', out)).toBeUndefined();
    expect(await resolveDocs('/docs/%2e%2e/%2e%2e/secret.txt', out)).toBeUndefined();
    expect(await resolveDocs('/docs/..%2f..%2fsecret.txt', out)).toBeUndefined();
    expect(await resolveDocs('/docs/%E0%A4%A', out)).toBeUndefined();
  });
});

describe('createServer', () => {
  let server;
  let hub;
  let base;
  const hubRequests = [];

  beforeAll(async () => {
    hub = http.createServer((req, res) => {
      hubRequests.push({ url: req.url, host: req.headers['x-forwarded-host'] });
      if (req.url === '/login') {
        res.writeHead(302, { location: `http://127.0.0.1:${hub.address().port}/dashboard` });
        return res.end();
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('hub');
    });
    await new Promise((done) => hub.listen(0, '127.0.0.1', done));

    server = createServer({ out, hub: new URL(`http://127.0.0.1:${hub.address().port}`) });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => {
    server.close();
    hub.close();
  });

  test('docs come from out/, with the docs\' 404 page for a missing one', async () => {
    const page = await fetch(`${base}/docs/`);
    expect([page.status, await page.text()]).toEqual([200, '<title>Docs</title>']);

    const missing = await fetch(`${base}/docs/nope/`);
    expect([missing.status, await missing.text()]).toEqual([404, '<title>Not found</title>']);

    const slash = await fetch(`${base}/docs/panel/getting-started?x=1`, { redirect: 'manual' });
    expect([slash.status, slash.headers.get('location')]).toEqual([301, '/docs/panel/getting-started/?x=1']);
  });

  test('everything else goes to the Hub, whose own redirects stay on this site', async () => {
    const page = await fetch(`${base}/plugins?q=1`);
    expect([page.status, await page.text()]).toEqual([200, 'hub']);
    expect(hubRequests.at(-1)).toEqual({ url: '/plugins?q=1', host: new URL(base).host });

    const login = await fetch(`${base}/login`, { redirect: 'manual' });
    expect(login.headers.get('location')).toBe('/dashboard');
  });

  test('a Next.js prefetch of a Hub page is answered here, without asking the Hub', async () => {
    const before = hubRequests.length;
    const prefetch = await fetch(`${base}/eggs?_rsc=abc`);

    expect([prefetch.status, prefetch.headers.get('cache-control')]).toEqual([404, 'no-store']);
    expect(hubRequests.length).toBe(before);
  });
});
