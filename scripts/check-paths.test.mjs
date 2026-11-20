// bun test scripts/check-paths.test.mjs  (all tests: bun test)
// How check-paths sorts the build's files, and which page loads count as outside /docs/.
import { describe, expect, test } from 'bun:test';
import { ROOT_FILES } from '../router/paths.mjs';
import { matches, pathsLoadedOutsideDocs, sortFiles } from './check-paths.mjs';

test('list entries: a folder, a prefix ending in *, or one file', () => {
  expect(matches('eggs/paper/index.html', 'eggs/')).toBe(true);
  expect(matches('eggsy.html', 'eggs/')).toBe(false);
  expect(matches('__next._tree.txt', '__next.*')).toBe(true);
  expect(matches('robots.txt', 'robots.txt')).toBe(true);
  expect(matches('robots.txt.bak', 'robots.txt')).toBe(false);
});

describe('sortFiles', () => {
  test('puts each file where pelican.dev serves it from', () => {
    const { counts, interim, stray, missing } = sortFiles([
      'docs/index.html',
      'docs/panel/index.html',
      ...ROOT_FILES,
      '404.html',
      '_next/static/a.css',
      'eggs/index.html',
      '__next._tree.txt',
    ]);

    expect(counts).toEqual({ docs: 2, root: ROOT_FILES.length, netlify: 1, mapped: 1, interim: 2 });
    expect([...interim]).toEqual([['eggs/', 1], ['__next.*', 1]]);
    expect(stray).toEqual([]);
    expect(missing).toEqual([]);
  });

  test('a file nowhere on the lists is stray, and a missing root file is reported', () => {
    const { stray, missing } = sortFiles(['docs/index.html', 'plugins/index.html', 'llms.txt']);

    expect(stray).toEqual(['plugins/index.html']);
    expect(missing).toEqual(ROOT_FILES.filter((name) => name !== 'llms.txt'));
  });
});

describe('pathsLoadedOutsideDocs', () => {
  test('scripts, stylesheets, images and share images outside /docs/ count', () => {
    const html = [
      '<script src="/_next/static/app.js"></script>',
      '<link rel="stylesheet" href="/styles.css">',
      '<img src="/img/logo.png">',
      '<meta property="og:image" content="https://pelican.dev/og/home.png">',
    ].join('');

    expect(pathsLoadedOutsideDocs(html)).toEqual(['/_next/static/app.js', '/styles.css', '/img/logo.png', '/og/home.png']);
  });

  test('/docs/, the root files, other sites and plain links don\'t', () => {
    const html = [
      '<script src="/docs/_next/static/app.js"></script>',
      '<link rel="icon" href="/docs/img/favicon.ico">',
      '<link rel="canonical" href="https://pelican.dev/">',
      '<img src="https://cdn.example.com/a.png">',
      '<img src="//cdn.example.com/b.png">',
      '<a href="/plugins">Plugins</a>',
      '<script src="/llms.txt"></script>',
    ].join('');

    expect(pathsLoadedOutsideDocs(html)).toEqual([]);
  });
});
