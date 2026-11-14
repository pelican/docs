#!/usr/bin/env node
/**
 * Fails if a page in content/ could run code. The docs take pull requests from anyone, and
 * MDX compiles every page into JavaScript that runs during the build and in readers'
 * browsers, so anything a page puts into JavaScript is code: `import`/`export`, `{...}`
 * expressions (`{(() => { while (true) {} })()}` would hang the build), JSX attribute
 * values in braces, spread props, event handlers and `javascript:` URLs.
 *
 * So each page is parsed as MDX, the syntax the site compiles, and checked against an
 * allowlist rather than searched for bad words:
 *   - no `import` or `export`;
 *   - no `{expression}`, except a comment (`{/* ... *\/}`);
 *   - only the components mdx-components.tsx gives pages, and a short list of HTML tags;
 *   - attributes are plain: no spread, no `on*` handlers, no `dangerouslySetInnerHTML`,
 *     no `javascript:`, `vbscript:` or `data:` URLs, and a `{value}` may only be literal
 *     data (strings, numbers, booleans, null, and arrays or objects of those), as in
 *     <SetupPanel fields={['domain', 'php']} />;
 *   - Markdown links and images don't use those URL schemes either.
 * Code blocks and `inline code` are text to the parser, so a snippet like
 * `export CF_Token=...` is fine.
 *
 *   node scripts/check-content.mjs [dir]     (default: content)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';

const root = process.argv[2] ?? 'content';

/** The components mdx-components.tsx gives pages (its own and Fumadocs' defaults). */
const COMPONENTS = new Set(['Admonition', 'Tabs', 'TabItem', 'Link', 'Mermaid', 'SetupPanel', 'Card', 'Cards', 'Callout']);

/** HTML a page may write as tags. Markdown covers the rest. */
const HTML = new Set([
  'details', 'summary', 'br', 'kbd', 'sub', 'sup', 'abbr', 'mark', 'small', 'span', 'div', 'p',
  'a', 'img', 'code', 'pre', 'strong', 'em', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

const UNSAFE_URL = /^(javascript|vbscript|data):/;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Blank out YAML frontmatter, keeping its lines so positions still match the file. */
function withoutFrontmatter(source) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/);
  return match ? match[0].replace(/[^\n]/g, '') + source.slice(match[0].length) : source;
}

/** Browsers ignore whitespace and control characters inside a scheme (`java\tscript:`). */
function isUnsafeUrl(value) {
  return UNSAFE_URL.test(value.replace(/[\u0000- ]/g, '').toLowerCase());
}

/** True when an estree expression is plain data: no calls, functions, names or operators. */
function isLiteralData(node) {
  switch (node?.type) {
    case 'Literal':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'UnaryExpression':
      return (node.operator === '-' || node.operator === '+') && node.argument.type === 'Literal' && typeof node.argument.value === 'number';
    case 'ArrayExpression':
      return node.elements.every((element) => element === null || isLiteralData(element));
    case 'ObjectExpression':
      return node.properties.every(
        (property) => property.type === 'Property' && property.kind === 'init' && !property.computed && !property.method && !property.shorthand && isLiteralData(property.value),
      );
    default:
      return false;
  }
}

/** The single expression in an attribute value's `{...}`, or null if there isn't exactly one. */
function attributeExpression(value) {
  const body = value.data?.estree?.body;
  return body?.length === 1 && body[0].type === 'ExpressionStatement' ? body[0].expression : null;
}

function checkNode(node, report) {
  switch (node.type) {
    case 'mdxjsEsm':
      report(node, `${node.value.trim().split(/\s/)[0]} statement: ${node.value.trim().split('\n')[0]}`);
      return;
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      // A comment ({/* ... */}) compiles to nothing; anything else is code.
      if (node.data?.estree?.body.length !== 0) report(node, `{expression}: {${node.value.trim().slice(0, 60)}}`);
      return;
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement':
      checkElement(node, report);
      return;
    case 'link':
    case 'image':
    case 'definition':
      if (isUnsafeUrl(node.url)) report(node, `unsafe URL: ${node.url.slice(0, 60)}`);
      return;
  }
}

function checkElement(node, report) {
  const name = node.name;
  if (name !== null && !COMPONENTS.has(name) && !HTML.has(name)) {
    report(node, `<${name}> is not a component pages can use (see COMPONENTS and HTML in this script)`);
  }

  for (const attribute of node.attributes) {
    if (attribute.type !== 'mdxJsxAttribute') {
      report(node, `<${name}> has a spread attribute {${attribute.value.trim().slice(0, 40)}}`);
      continue;
    }

    const where = `<${name} ${attribute.name}>`;
    if (/^on/i.test(attribute.name) || attribute.name === 'dangerouslySetInnerHTML') {
      report(node, `${where}: event handlers and dangerouslySetInnerHTML are not allowed`);
      continue;
    }

    const value = attribute.value;
    if (typeof value === 'string') {
      if (isUnsafeUrl(value)) report(node, `${where}: unsafe URL ${value.slice(0, 60)}`);
    } else if (value !== null && value !== undefined && !isLiteralData(attributeExpression(value))) {
      report(node, `${where}: {${value.value.trim().slice(0, 60)}} is code; only literal data is allowed`);
    }
  }
}

function checkFile(file, problems) {
  const where = (node) => `${relative(process.cwd(), file)}:${node?.position?.start.line ?? '?'}`;

  let tree;
  try {
    tree = fromMarkdown(withoutFrontmatter(readFileSync(file, 'utf8')), {
      extensions: [mdxjs()],
      mdastExtensions: [mdxFromMarkdown()],
    });
  } catch (error) {
    const line = error.line ?? error.place?.line ?? error.place?.start?.line ?? '?';
    problems.push(`${relative(process.cwd(), file)}:${line}  not valid MDX: ${error.reason ?? error.message}`);
    return;
  }

  const report = (node, message) => problems.push(`${where(node)}  ${message}`);
  const visit = (node) => {
    checkNode(node, report);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
}

const problems = [];
const files = walk(root).filter((file) => /\.mdx?$/.test(file));
for (const file of files) checkFile(file, problems);

if (problems.length) {
  console.error(`check-content: ${problems.length} problem(s) in ${root}/ (MDX that would run code):`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nUse the components from mdx-components.tsx with plain attributes; code samples go in ``` blocks.');
  process.exit(1);
}

console.log(`check-content: ${files.length} pages in ${root}/, no code: no import/export, {expressions}, handlers or unsafe URLs. ok`);
