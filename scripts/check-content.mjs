#!/usr/bin/env node
/**
 * Fails if a page in content/ could run code: an MDX `import` or `export`
 * statement, or a `<script` tag. The docs take pull requests from anyone, and
 * MDX compiles those into the site's JavaScript; the components a page may use
 * come from mdx-components.tsx, never from the page itself.
 *
 * Code blocks (``` and ~~~ fences) and `inline code` are skipped, so a shell
 * snippet like `export CF_Token=...` is fine.
 *
 *   node scripts/check-content.mjs [dir]     (default: content)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? 'content';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Indented too: MDX has no indented code blocks, so an indented `import` is still ESM. */
const ESM = /^\s*(import|export)\b/;
const SCRIPT = /<script\b/i;

const problems = [];
const files = walk(root).filter((file) => /\.mdx?$/.test(file));

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let fence = null; // the opening ``` or ~~~ run while inside a code block
  let frontmatter = lines[0]?.trim() === '---';

  lines.forEach((line, i) => {
    if (frontmatter) {
      if (i > 0 && line.trim() === '---') frontmatter = false;
      return;
    }
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null;
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }
    const text = line.replace(/(`+)[\s\S]*?\1/g, ''); // drop inline code spans
    const where = `${relative(process.cwd(), file)}:${i + 1}`;
    if (ESM.test(text)) problems.push(`${where}  ${text.trim().split(/\s/)[0]} statement: ${line.trim()}`);
    if (SCRIPT.test(text)) problems.push(`${where}  <script> tag: ${line.trim()}`);
  });
}

if (problems.length) {
  console.error(`check-content: ${problems.length} problem(s) in ${root}/ (MDX that would run code):`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nUse the components from mdx-components.tsx instead; code samples go in ``` blocks.');
  process.exit(1);
}

console.log(`check-content: ${files.length} pages in ${root}/, no import, export or <script. ok`);
