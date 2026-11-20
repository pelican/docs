// bun test scripts/pack-docs.test.mjs  (all tests: bun test)
// What the Hub gets: the packed folder, and the redirects taken from netlify.toml.
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT_FILES } from '../router/paths.mjs';
import { docsRedirects, pack } from './pack-docs.mjs';

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

test('only /docs and paths under it, not /docsfoo', () => {
  const toml = `
[[redirects]]
  from = "/docsfoo"
  to = "/docs/"

[[redirects]]
  from = "/docs"
  to = "/docs/"
`;

  expect(docsRedirects(toml)).toEqual([{ from: '/docs', to: '/docs/', status: 301 }]);
});

describe('pack', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'pack-docs-'));
  const src = join(sandbox, 'out');
  const toml = join(sandbox, 'netlify.toml');
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  const write = (path, body) => {
    mkdirSync(join(src, path, '..'), { recursive: true });
    writeFileSync(join(src, path), body);
  };
  write('docs/index.html', 'docs');
  write('docs/panel/index.html', 'panel');
  write('_next/static/app.css', 'css');
  write('404.html', 'not found');
  for (const name of ROOT_FILES) write(name, name);
  writeFileSync(toml, '[[redirects]]\nfrom = "/docs/about"\nto = "/docs/contributors/"\n');

  test('lays the folder out the way the Hub installs it', async () => {
    const folder = join(sandbox, 'dist-docs');
    expect(await pack(folder, { src, toml })).toEqual({ redirects: 1, rootFiles: ROOT_FILES.length });

    expect(readdirSync(folder).sort()).toEqual(['404.html', 'BUILD.json', '_next', '_root', 'index.html', 'panel', 'redirects.json']);
    expect(readdirSync(join(folder, '_root')).sort()).toEqual([...ROOT_FILES].sort());
    expect(JSON.parse(readFileSync(join(folder, 'redirects.json'), 'utf8'))).toEqual([{ from: '/docs/about', to: '/docs/contributors/', status: 301 }]);
    expect(Object.keys(JSON.parse(readFileSync(join(folder, 'BUILD.json'), 'utf8')))).toEqual(['sha', 'branch', 'built_at']);
  });

  test('BUILD.json names the commit and branch built, BUILD_SHA/BUILD_BRANCH first', async () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { GITHUB_SHA: 'aaa', GITHUB_REF_NAME: 'main', BUILD_SHA: 'bbb', BUILD_BRANCH: 'feat/fumadocs-next' });
      const folder = join(sandbox, 'dist-build-env');
      await pack(folder, { src, toml });
      expect(JSON.parse(readFileSync(join(folder, 'BUILD.json'), 'utf8'))).toMatchObject({ sha: 'bbb', branch: 'feat/fumadocs-next' });
      delete process.env.BUILD_SHA;
      delete process.env.BUILD_BRANCH;
      await pack(folder, { src, toml });
      expect(JSON.parse(readFileSync(join(folder, 'BUILD.json'), 'utf8'))).toMatchObject({ sha: 'aaa', branch: 'main' });
    } finally {
      for (const key of ['GITHUB_SHA', 'GITHUB_REF_NAME', 'BUILD_SHA', 'BUILD_BRANCH']) {
        if (key in saved) process.env[key] = saved[key];
        else delete process.env[key];
      }
    }
  });

  test('refuses an output folder that isn\'t a dist folder, before deleting anything', async () => {
    await expect(pack(src, { src, toml })).rejects.toThrow('must start with "dist"');
    await expect(pack(sandbox, { src, toml })).rejects.toThrow('must start with "dist"');
    expect(existsSync(join(src, 'docs/index.html'))).toBe(true);
  });

  test('says what\'s missing when the build hasn\'t run', async () => {
    await expect(pack(join(sandbox, 'dist-x'), { src: join(sandbox, 'nothing'), toml })).rejects.toThrow('run "bun run build" first');
  });
});

