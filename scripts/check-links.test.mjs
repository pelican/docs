// bun test scripts/check-links.test.mjs  (all tests: bun test)
// Which links on the built docs pages count as broken, and that the script fails the build on one.
import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { brokenLinks, idsIn, linksIn, pagePathOf } from './check-links.mjs';

const page = (body) => `<html><body><h1 id="top">x</h1>${body}</body></html>`;

test('a built file is served at its folder\'s URL', () => {
  expect(pagePathOf('docs/index.html')).toBe('/docs/');
  expect(pagePathOf('docs/panel/update/index.html')).toBe('/docs/panel/update/');
});

test('reads hrefs and ids from the HTML', () => {
  const html = '<a class="x" href="../a/?q=1&amp;r=2#b">A</a><a>no href</a><h2 id="c&amp;d">C</h2>';
  expect(linksIn(html)).toEqual(['../a/?q=1&r=2#b']);
  expect([...idsIn(html)]).toEqual(['c&d']);
});

describe('brokenLinks', () => {
  const pages = new Map([
    ['/docs/', page('<a href="/docs/panel/update/">ok</a><a href="./panel/update/#docker">ok</a>')],
    ['/docs/panel/update/', page('<h2 id="docker">Docker</h2><a href="#top">ok</a>')],
  ]);
  const files = ['docs/index.html', 'docs/panel/update/index.html', 'docs/md/panel/update.md', 'llms.txt'];

  test('working links pass: pages, anchors, files, Markdown, the Hub and other sites', () => {
    const html = page(
      [
        '<a href="/docs/panel/update/#docker">a</a>',
        '<a href="/docs/panel/update">no slash: a 301</a>',
        '<a href="/docs/panel/update.md">markdown</a>',
        '<a href="/llms.txt">root file</a>',
        '<a href="/plugins">the Hub</a>',
        '<a href="https://github.com/pelican/panel">another site</a>',
        '<a href="mailto:x@example.com">mail</a>',
        '<a href="/docs/about">old path, redirected</a>',
      ].join(''),
    );
    const all = new Map([...pages, ['/docs/x/', html]]);
    expect(brokenLinks(all, [...files, 'docs/x/index.html'], new Set(['/docs/about']))).toEqual([]);
  });

  test('a relative link resolved one folder too deep is broken', () => {
    // content/docs/panel/update.mdx wrote [Versioning](../versioning); on /docs/panel/update/
    // the browser makes that /docs/panel/versioning/.
    const all = new Map([...pages, ['/docs/panel/update/', page('<h2 id="docker">D</h2><a href="../versioning">Versioning</a>')]]);
    expect(brokenLinks(all, files)).toEqual([{ page: '/docs/panel/update/', href: '../versioning', reason: 'no such page' }]);
  });

  test('a missing #anchor is broken, on another page or the same one', () => {
    const all = new Map([...pages, ['/docs/x/', page('<a href="/docs/panel/update/#nope">a</a><a href="#gone">b</a>')]]);
    expect(brokenLinks(all, files)).toEqual([
      { page: '/docs/x/', href: '/docs/panel/update/#nope', reason: 'no #nope on /docs/panel/update/' },
      { page: '/docs/x/', href: '#gone', reason: 'no #gone on /docs/x/' },
    ]);
  });
});

describe('the script', () => {
  function build(pagesByFile) {
    const dir = mkdtempSync(join(tmpdir(), 'check-links-'));
    for (const [file, html] of Object.entries(pagesByFile)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), html);
    }
    return dir;
  }
  const run = (dir) => Bun.spawnSync(['bun', join(import.meta.dir, 'check-links.mjs'), dir], { cwd: dir });

  test('passes a build whose links all work', () => {
    const dir = build({
      'docs/index.html': page('<a href="./versioning/">Versioning</a>'),
      'docs/versioning/index.html': page(''),
    });
    try {
      const result = run(dir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain('check-links: ok (2 docs pages)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fails a build with a broken link, naming the page and the link', () => {
    const dir = build({
      'docs/index.html': page(''),
      'docs/versioning/index.html': page(''),
      'docs/panel/update/index.html': page('<a href="../versioning">Versioning</a>'),
    });
    try {
      const result = run(dir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain('/docs/panel/update/  ../versioning  (no such page)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
