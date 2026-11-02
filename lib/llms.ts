import { renderPlaceholder, type PlaceholderData } from 'fumadocs-core/mdx-plugins/remark-llms.runtime';
import type { Node } from 'fumadocs-core/page-tree';
import { project } from '@/lib/home-data';
import { source } from '@/lib/source';

/**
 * Plain-Markdown versions of the docs for AI tools (llmstxt.org):
 *
 *   /llms.txt             an index of every docs page, linking the .md files
 *   /llms-full.txt        every docs page in one file, in sidebar order
 *   /docs/<page>.md       one page; built to out/md/<page>.md and served at
 *                         /docs/<page>.md by a rewrite in netlify.toml
 *
 * The Markdown comes from Fumadocs (`includeProcessedMarkdown` in
 * source.config.ts), with <Admonition>, <Tabs> and friends left as
 * placeholders that are rendered to plain Markdown here.
 */

export const SITE_URL = 'https://pelican.dev';

type DocsPage = ReturnType<typeof source.getPages>[number];

/** Public URL of a page's Markdown: /docs → /docs/index.md, /docs/panel/update → /docs/panel/update.md */
export function markdownPath(page: DocsPage): string {
  return page.slugs.length === 0 ? '/docs/index.md' : `${page.url}.md`;
}

/** Route params for app/md/[...slug]: the page's slugs, with .md on the last one. */
export function markdownParams(): { slug: string[] }[] {
  return source.getPages().map((page) => ({ slug: markdownPath(page).replace(/^\/docs\//, '').split('/') }));
}

export function pageFromMarkdownSlug(slug: string[]): DocsPage | undefined {
  const path = `/docs/${slug.join('/')}`;
  return source.getPages().find((page) => markdownPath(page) === path);
}

/** The HTML page's absolute URL, with the trailing slash the site uses. */
export function pageUrl(page: DocsPage): string {
  return `${SITE_URL}${page.url}/`;
}

/* ---- Sidebar order ------------------------------------------------------- */

export interface DocsSection {
  title: string;
  pages: DocsPage[];
}

/**
 * Every docs page in sidebar order, grouped by the top-level sidebar folder
 * (Panel, Wings, …). Loose top-level pages go under the separator above them,
 * or "Overview" before the first one.
 */
export function docsSections(): DocsSection[] {
  const byUrl = new Map(source.getPages().map((page) => [page.url, page]));
  const sections: DocsSection[] = [];
  let loose: DocsSection | undefined;

  const collect = (nodes: Node[], into: DocsPage[]) => {
    for (const node of nodes) {
      if (node.type === 'page') {
        const page = byUrl.get(node.url);
        if (page) into.push(page);
      } else if (node.type === 'folder') {
        if (node.index) collect([node.index], into);
        collect(node.children, into);
      }
    }
  };

  for (const node of source.getPageTree().children) {
    if (node.type === 'separator') {
      loose = { title: textOf(node.name) || 'More', pages: [] };
      sections.push(loose);
    } else if (node.type === 'folder') {
      const section = { title: textOf(node.name), pages: [] as DocsPage[] };
      collect([node], section.pages);
      sections.push(section);
      loose = undefined;
    } else {
      if (!loose) {
        loose = { title: 'Overview', pages: [] };
        sections.push(loose);
      }
      collect([node], loose.pages);
    }
  }

  return sections.filter((section) => section.pages.length > 0);
}

function textOf(name: unknown): string {
  return typeof name === 'string' ? name : '';
}

/* ---- One page as Markdown ------------------------------------------------ */

const ADMONITION_LABELS: Record<string, string> = {
  note: 'Note',
  info: 'Info',
  tip: 'Tip',
  success: 'Tip',
  caution: 'Caution',
  warning: 'Warning',
  danger: 'Danger',
  error: 'Danger',
};

/**
 * Markers for tabs, resolved in `resolveTabHeadings`: TABS_OPEN/TABS_CLOSE wrap
 * a <Tabs>, TAB starts a line with a <TabItem> label.
 */
const TABS_OPEN = '\u0002';
const TABS_CLOSE = '\u0003';
const TAB = '\u0001';

function attr(data: PlaceholderData, name: string): string | undefined {
  const value = data.attributes[name];
  return typeof value === 'string' && value ? value : undefined;
}

function blockquote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function admonition(data: PlaceholderData): string {
  const type = attr(data, 'type') ?? 'note';
  const label = ADMONITION_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
  const title = attr(data, 'title');
  const head = `**${label}${title ? `: ${title}` : ''}**`;
  const body = dedent(data.children).trim();
  return `\n${blockquote(body ? `${head}\n\n${body}` : head)}\n`;
}

const renderers: Record<string, (data: PlaceholderData) => string> = {
  Admonition: admonition,
  Callout: admonition,
  Tabs: (data) => `\n${TABS_OPEN}\n\n${dedent(data.children).trim()}\n\n${TABS_CLOSE}\n`,
  TabItem: (data) => {
    const label = attr(data, 'label') ?? attr(data, 'value') ?? 'Tab';
    return `\n${TAB}${label}\n\n${dedent(data.children).trim()}\n`;
  },
  Link: (data) => `[${data.children.trim()}](${attr(data, 'to') ?? attr(data, 'href') ?? ''})`,
  // The setup form only fills in values on the HTML page; the text around it explains them.
  SetupPanel: () => '',
  Mermaid: (data) => `\n\`\`\`mermaid\n${(attr(data, 'chart') ?? '').trim()}\n\`\`\`\n`,
};

/** Remove the indentation every non-blank line shares (Docusaurus pages indent tab contents). */
function dedent(text: string): string {
  const lines = text.split('\n');
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return min ? lines.map((line) => line.slice(min)).join('\n') : text;
}

/**
 * Turn tab labels into headings one level below the heading the <Tabs> sits
 * under (headings inside a tab don't push the next tab's label deeper).
 */
function resolveTabHeadings(markdown: string): string {
  let depth = 1;
  const stack: number[] = [];
  let fence: string | null = null;
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const content = line.replace(/^(?:>\s?)*/, '');
    const quote = line.slice(0, line.length - content.length);
    const fenceMatch = content.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1].startsWith(fence)) fence = null;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    if (content.trim() === TABS_OPEN) {
      stack.push(depth);
      continue;
    }
    if (content.trim() === TABS_CLOSE) {
      depth = stack.pop() ?? depth;
      continue;
    }
    if (content.startsWith(TAB)) {
      depth = Math.min((stack.at(-1) ?? depth) + 1, 6);
      out.push(`${quote}${'#'.repeat(depth)} ${content.slice(TAB.length)}`);
      continue;
    }
    const heading = content.match(/^(#{1,6})\s/);
    if (heading) depth = heading[1].length;
    out.push(line);
  }
  return out.join('\n');
}

/**
 * `:::note` … `:::` blocks (Docusaurus syntax, turned into a <Callout> on the
 * HTML page) come out of Fumadocs as written; render them like <Admonition>.
 */
function resolveDirectives(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  let block: { type: string; title?: string; lines: string[] } | null = null;
  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1].startsWith(fence)) fence = null;
    } else if (!fence) {
      const open: RegExpMatchArray | null = block ? null : line.match(/^\s*:::(\w+)(?:\[(.*)\])?\s*(.*)$/);
      if (open) {
        block = { type: open[1], title: open[2] || open[3] || undefined, lines: [] };
        continue;
      }
      if (block && /^\s*:::\s*$/.test(line)) {
        out.push(
          admonition({
            name: 'Admonition',
            attributes: { type: block.type, title: block.title },
            children: block.lines.join('\n'),
          }),
        );
        block = null;
        continue;
      }
    }
    (block ? block.lines : out).push(line);
  }
  if (block) out.push(...block.lines);
  return out.join('\n');
}

/** ```nginx setup {5,11} title="x" → ```nginx title="x" (setup and line highlights only matter on the HTML page). */
function cleanFenceMeta(markdown: string): string {
  return markdown.replace(/^(\s*(?:>\s?)*\s*)(`{3,}|~{3,})([^\s`]+)([^\n]*)$/gm, (_, indent, fence, lang, meta) => {
    const title = meta.match(/title="([^"]*)"/);
    return `${indent}${fence}${lang}${title ? ` title="${title[1]}"` : ''}`;
  });
}

/** Relative and root links → absolute pelican.dev URLs, resolved like the HTML page does. */
function absoluteLinks(markdown: string, page: DocsPage): string {
  // The page's folder on the site, e.g. /docs/panel/ for panel/getting-started.mdx.
  const dir = `/docs/${page.path.split('/').slice(0, -1).join('/')}`.replace(/\/?$/, '/');
  return markdown.replace(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g, (_, href: string) => {
    const [path, hash] = href.split('#');
    let url = path.startsWith('/') ? path : new URL(path, `https://x${dir}`).pathname;
    url = url.replace(/\.mdx?$/, '').replace(/\/index$/, '');
    if (!/\.[a-z0-9]+$/i.test(url) && !url.endsWith('/')) url += '/';
    return `](${SITE_URL}${url}${hash ? `#${hash}` : ''})`;
  });
}

export async function pageMarkdown(page: DocsPage): Promise<string> {
  const processed = await page.data.getText('processed');
  let body = await renderPlaceholder(processed, renderers);
  body = resolveDirectives(body);
  body = resolveTabHeadings(body);
  body = cleanFenceMeta(body);
  body = absoluteLinks(body, page);
  body = body.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

  const head = [`# ${page.data.title}`];
  if (page.data.description) head.push(`> ${page.data.description}`);
  head.push(`Source: ${pageUrl(page)}`);
  return `${head.join('\n\n')}\n\n${body}\n`;
}

/* ---- llms.txt / llms-full.txt -------------------------------------------- */

export function llmsTxt(): string {
  const lines = [
    '# Pelican',
    '',
    `> Pelican is a free, open-source game server control panel (${project.license}). The Panel is a PHP/Laravel web app where admins and users create, configure and manage game servers; Wings is the daemon on each node that runs every server in its own Docker container. Servers are defined by "eggs" (install scripts and startup settings for each game or app). Current version: ${project.version}.`,
    '',
    'The docs cover installing and updating the Panel and Wings, webserver and SSL setup, eggs, and guides such as migrating from Pterodactyl. Each link below is the page as plain Markdown; drop the `.md` for the HTML page.',
    '',
  ];

  for (const section of docsSections()) {
    lines.push(`## ${section.title}`, '');
    for (const page of section.pages) {
      const description = page.data.description ? `: ${page.data.description}` : '';
      lines.push(`- [${page.data.title}](${SITE_URL}${markdownPath(page)})${description}`);
    }
    lines.push('');
  }

  lines.push(
    '## Site',
    '',
    `- [Eggs](${SITE_URL}/eggs/): searchable index of community eggs (games and apps Pelican can run)`,
    `- [Support Pelican](${SITE_URL}/support/): how to fund the project (monthly plans, one-off donations) or help without paying`,
    `- [FAQ](${SITE_URL}/faq/): differences from Pterodactyl, migration, egg compatibility, AGPLv3 licensing and plugins`,
    `- [Full docs in one file](${SITE_URL}/llms-full.txt): every page above, in order`,
    '',
    '## Optional',
    '',
    '- [Source code](https://github.com/pelican/panel): the Panel on GitHub',
    '- [Hub API](https://hub.pelican.dev/api): API for the plugin and egg hub',
    '',
  );

  return lines.join('\n');
}

export async function llmsFullTxt(): Promise<string> {
  const parts = [
    `# Pelican documentation\n\nEvery page of ${SITE_URL}/docs/ as Markdown, in sidebar order. Pelican version ${project.version}. Index: ${SITE_URL}/llms.txt\n`,
  ];
  for (const section of docsSections()) {
    for (const page of section.pages) parts.push(await pageMarkdown(page));
  }
  return parts.join('\n---\n\n');
}
