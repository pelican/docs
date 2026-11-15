// node --test scripts/check-content.test.mjs  (pnpm test:content)
// Runs check-content.mjs on one-page folders: pages that could run code must fail, the
// MDX the docs really use must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./check-content.mjs', import.meta.url).pathname;

function check(page) {
  const dir = mkdtempSync(join(tmpdir(), 'check-content-'));
  writeFileSync(join(dir, 'page.mdx'), `---\ntitle: Test\n---\n\n${page}\n`);
  const result = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
  return { ok: result.status === 0, output: result.stdout + result.stderr };
}

const blocked = {
  'an expression that would hang the build': '{(() => { while (true) {} })()}',
  'an inline expression': 'Hello {process.exit(1)} world',
  'an import': "import x from 'node:fs'",
  'an export': 'export const a = 1',
  'a script tag': '<script>alert(1)</script>',
  'a component pages are not given': '<Evil />',
  'code in an attribute': '<Admonition title={fetch("https://example.com")}>x</Admonition>',
  'a function in an attribute': '<SetupPanel fields={() => []} />',
  'a spread attribute': '<Tabs {...props}>x</Tabs>',
  'an event handler': '<div onClick="alert(1)">x</div>',
  'a lowercase event handler': '<img src="/a.png" onerror="alert(1)" />',
  'dangerouslySetInnerHTML': '<div dangerouslySetInnerHTML={{ __html: "x" }} />',
  'a javascript: link in JSX': '<a href="javascript:alert(1)">x</a>',
  'a javascript: link with a tab in the scheme': '<Link to="java\tscript:alert(1)">x</Link>',
  'a javascript: link in braces': "<a href={'javascript:alert(1)'}>x</a>",
  'a data: link in a template literal': '<Link to={`data:text/html,x`}>x</Link>',
  'a javascript: URL nested in literal data': "<Card title=\"x\" data={{ links: [{ href: 'JavaScript:alert(1)' }] }} />",
  'a javascript: Markdown link': '[x](javascript:alert(1))',
  'a data: Markdown image': '![x](data:text/html;base64,PHNjcmlwdD4=)',
  'MDX that does not parse': '<Admonition>',
};

for (const [name, page] of Object.entries(blocked)) {
  test(`fails on ${name}`, () => {
    const { ok, output } = check(page);
    assert.equal(ok, false, output);
    assert.match(output, /problem/);
  });
}

const allowed = {
  'the components the docs use': [
    '<Admonition type="warning" title="Back up first">',
    '  Text',
    '</Admonition>',
    '',
    '<Tabs groupId="webserver" queryString>',
    '  <TabItem value="nginx" label="NGINX" default>NGINX</TabItem>',
    '</Tabs>',
    '',
    '<details>',
    '  <summary>More</summary>',
    '  Hidden',
    '</details>',
  ].join('\n'),
  'literal data in an attribute': "<SetupPanel fields={['domain', 'webserver', 'ssl', 'php', 'path']} />",
  'nested literal data': '<Card title="x" data={{ size: -1, tags: ["a", `b`], on: true, none: null }} />',
  'a comment': '{/* a note for editors */}',
  // @mdx-js/mdx 3 compiles an indented import/export as a paragraph of text, not code.
  'an indented export, which MDX reads as text': '  export const a = 1',
  'code that only looks like code': '```sh\nexport CF_Token=abc\n```\n\nRun `import x` or `<script>` in a shell.',
  'ordinary links': '[Docs](https://pelican.dev/docs) and [a page](./wings/update) and <Link to="/docs">x</Link>',
};

for (const [name, page] of Object.entries(allowed)) {
  test(`passes ${name}`, () => {
    const { ok, output } = check(page);
    assert.equal(ok, true, output);
  });
}
