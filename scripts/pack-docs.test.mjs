// bun test scripts/pack-docs.test.mjs  (all tests: bun test)
// Which redirects the Hub gets from netlify.toml.
import { describe, expect, test } from 'bun:test';
import { docsRedirects } from './pack-docs.mjs';

describe('docsRedirects', () => {
  test('keeps the redirects under /docs, drops rewrites and other paths', () => {
    const toml = `
[build]
  command = "bun run build"

[[redirects]]
  from = "/docs/_next/*"
  to = "/_next/:splat"
  status = 200

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
`;

    expect(docsRedirects(toml)).toEqual([
      { from: '/docs/about', to: '/docs/contributors/', status: 301 },
      { from: '/docs/old/*', to: '/docs/new/:splat', status: 302 },
    ]);
  });

  test('a redirect without a status is a 301, as on Netlify', () => {
    expect(docsRedirects('[[redirects]]\nfrom = "/docs/a"\nto = "/docs/b/"\n')).toEqual([{ from: '/docs/a', to: '/docs/b/', status: 301 }]);
  });

  test('reads the real netlify.toml', async () => {
    const redirects = docsRedirects(await Bun.file(new URL('../netlify.toml', import.meta.url)).text());

    expect(redirects.length).toBeGreaterThanOrEqual(6);
    expect(redirects).toContainEqual({ from: '/docs/guides/disk-quotas/zfs', to: '/docs/guides/disk-quotas/about/', status: 301 });
    for (const { from, status } of redirects) {
      expect(from.startsWith('/docs')).toBe(true);
      expect(status >= 300 && status < 400).toBe(true);
    }
  });
});
