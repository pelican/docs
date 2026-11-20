// bun test lib/docs-href.test.mjs
// Relative links in a page resolve against the page's folder, not one folder deeper (trailingSlash).
import { expect, test } from 'bun:test';
import { resolveDocsHref } from './docs-href.ts';

test('relative links resolve against the page file\'s folder', () => {
  expect(resolveDocsHref('../versioning', 'panel/update.mdx')).toBe('/docs/versioning/');
  expect(resolveDocsHref('./install#docker-compose', 'panel/update.mdx')).toBe('/docs/panel/install/#docker-compose');
  expect(resolveDocsHref('./panel/install', 'getting-started.mdx')).toBe('/docs/panel/install/');
  expect(resolveDocsHref('../../guides/troubleshooting#schedules-not-running', 'panel/advanced/plugins.mdx')).toBe(
    '/docs/guides/troubleshooting/#schedules-not-running',
  );
  expect(resolveDocsHref('./contributors', 'index.mdx')).toBe('/docs/contributors/');
});

test('links to .mdx files and folder index files become page paths', () => {
  expect(resolveDocsHref('./guides/migrating-from-pterodactyl.mdx', 'comparison.mdx')).toBe('/docs/guides/migrating-from-pterodactyl/');
  expect(resolveDocsHref('./disk-quotas/index.mdx', 'guides/ssl.mdx')).toBe('/docs/guides/disk-quotas/');
});

test('/docs paths get the trailing slash; files keep their name', () => {
  expect(resolveDocsHref('/docs/guides/disk-quotas/about', 'x.mdx')).toBe('/docs/guides/disk-quotas/about/');
  expect(resolveDocsHref('/docs/panel/update.md', 'x.mdx')).toBe('/docs/panel/update.md');
  expect(resolveDocsHref('/docs', 'x.mdx')).toBe('/docs/');
});

test('other sites, anchors and the Hub\'s paths are left alone', () => {
  for (const href of ['https://github.com/pelican/panel', '#glossary', 'mailto:a@b.c', '/eggs', '/plugins', '//cdn.example.com/x', '/install.sh']) {
    expect(resolveDocsHref(href, 'panel/update.mdx')).toBe(href);
  }
});
