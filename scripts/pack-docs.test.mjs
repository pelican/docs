// node --test scripts/pack-docs.test.mjs: what the Hub gets as the docs' redirects.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { docsRedirects } from './pack-docs.mjs';

test('keeps netlify.toml\'s redirects under /docs and drops rewrites and other paths', () => {
  const toml = `
[build]
  command = "bun run build"

[[redirects]]
  from = "/docs/_next/*"
  to = "/_next/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/docs/about"
  to = "/docs/contributors/"
  status = 301

[[redirects]]
  from = "/discord"
  to = "https://discord.gg/pelican-panel"
  status = 301

[[redirects]]
  from = "/docs/old/*"
  to = "/docs/new/:splat"
  status = 302

[[headers]]
  for = "/*"
`;

  assert.deepEqual(docsRedirects(toml), [
    { from: '/docs/about', to: '/docs/contributors/', status: 301 },
    { from: '/docs/old/*', to: '/docs/new/:splat', status: 302 },
  ]);
});

test('reads the real netlify.toml', () => {
  const redirects = docsRedirects(readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8'));

  assert.ok(redirects.length >= 6);
  assert.ok(redirects.some((r) => r.from === '/docs/guides/disk-quotas/zfs' && r.to === '/docs/guides/disk-quotas/about/' && r.status === 301));
  assert.ok(redirects.every((r) => r.from.startsWith('/docs') && r.status >= 300 && r.status < 400));
});
