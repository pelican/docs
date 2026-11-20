// bun test router/paths.test.mjs  (all tests: bun test)
// Which paths are this build's, and how redirects stay on pelican.dev.
import { describe, expect, test } from 'bun:test';
import { isDocsPath, isNextPayload, keepOnSite, ROOT_FILES } from './paths.mjs';

describe('isDocsPath', () => {
  test('the docs and the root files are this build\'s', () => {
    for (const path of ['/docs', '/docs/', '/docs/panel/getting-started/', '/docs/_next/static/a.css', ...ROOT_FILES.map((name) => `/${name}`)]) {
      expect({ path, docs: isDocsPath(path) }).toEqual({ path, docs: true });
    }
  });

  test('everything else is the Hub\'s', () => {
    for (const path of ['/', '/docsfoo', '/plugins', '/eggs/paper', '/faq', '/sitemap.xml', '/update-wings.sh', '/x/llms.txt', '/docs%2Fpanel/']) {
      expect({ path, docs: isDocsPath(path) }).toEqual({ path, docs: false });
    }
  });
});

test('isNextPayload: an RSC header or a _rsc query parameter', () => {
  expect(isNextPayload('1', new URL('https://pelican.dev/plugins'))).toBe(true);
  expect(isNextPayload(null, new URL('https://pelican.dev/plugins?_rsc=abc'))).toBe(true);
  expect(isNextPayload(null, new URL('https://pelican.dev/plugins?_rsc'))).toBe(true);
  expect(isNextPayload(null, new URL('https://pelican.dev/plugins?x=1'))).toBe(false);
});

describe('keepOnSite', () => {
  const origin = 'https://hub.pelican.dev';

  test('a redirect to the origin itself becomes a path on pelican.dev', () => {
    expect(keepOnSite('https://hub.pelican.dev/dashboard?tab=1', origin)).toBe('/dashboard?tab=1');
    expect(keepOnSite('https://hub.pelican.dev', origin)).toBe('/');
    expect(keepOnSite('/already/a/path', origin)).toBe('/already/a/path');
  });

  test('a path starting with // or /\\ stays on the site (the browser would read it as another host)', () => {
    expect(keepOnSite('https://hub.pelican.dev//evil.example/x', origin)).toBe('/evil.example/x');
    expect(keepOnSite('https://hub.pelican.dev/\\evil.example', origin)).toBe('/evil.example');
    expect(keepOnSite('//hub.pelican.dev///evil.example', origin)).toBe('/evil.example');
  });

  test('other sites, look-alikes included, are left alone', () => {
    expect(keepOnSite('https://discord.com/oauth2/authorize', origin)).toBe('https://discord.com/oauth2/authorize');
    expect(keepOnSite('https://hub.pelican.dev.example.com/x', origin)).toBe('https://hub.pelican.dev.example.com/x');
    expect(keepOnSite('http://hub.pelican.dev/x', origin)).toBe('http://hub.pelican.dev/x');
  });
});
