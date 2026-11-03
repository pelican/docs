import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from 'fumadocs-mdx/config';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins/rehype-code';
import { remarkAdmonition } from 'fumadocs-core/mdx-plugins/remark-admonition';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins/remark-mdx-mermaid';
import { transformerMetaHighlight } from '@shikijs/transformers';
import lastModified from 'fumadocs-mdx/plugins/last-modified';
import type { Paragraph, PhrasingContent, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { transformerSetup } from './lib/shiki-setup';

// The documentation under /docs.
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      // Markdown of each page for /llms.txt, /llms-full.txt and /docs/….md
      // (lib/llms.ts). The JSX components come out as placeholders that
      // lib/llms.ts turns into plain Markdown.
      includeProcessedMarkdown: {
        headingIds: false,
        mdxAsPlaceholder: ['Admonition', 'Callout', 'Tabs', 'TabItem', 'Link', 'SetupPanel', 'Mermaid'],
      },
    },
  },
  meta: { schema: metaSchema },
});

// Stand-alone pages outside the docs, like /faq. (/support is app/(landing)/support/page.tsx.)
export const pages = defineDocs({
  dir: 'content/pages',
  docs: { schema: frontmatterSchema },
  meta: { schema: metaSchema },
});

const codeDefaults = rehypeCodeDefaultOptions;

// Language names the pages used on Docusaurus (Prism) that Shiki calls
// something else, or doesn't ship. Writers can keep using either name.
const LANGUAGE_ALIASES: Record<string, string> = {
  NGINX: 'nginx',
  apacheconf: 'apache',
  unit: 'ini',
  caddy: 'plaintext',
  caddyfile: 'plaintext',
};

// Docusaurus took `:::note` blocks written tight, with no blank lines:
//
//   :::note
//   Text.
//   :::
//
// Markdown reads that as one paragraph, but remarkAdmonition only matches when
// `:::note` and `:::` are paragraphs of their own, so the page showed the colons
// as text. This splits them out first, so pages copied from main work as written.
const ADMONITION_OPEN = /^:::\w+(\[[^\]\n]*\])?[ \t]*\n/;
const ADMONITION_CLOSE = /\n[ \t]*:::[ \t]*$/;

function remarkSplitAdmonitions() {
  const paragraph = (value: string): Paragraph => ({ type: 'paragraph', children: [{ type: 'text', value }] });
  return (tree: Root) => {
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const children: PhrasingContent[] = [...node.children];
      let opener: string | undefined;
      let closer = false;

      const head = children[0];
      const open = head?.type === 'text' ? ADMONITION_OPEN.exec(head.value) : null;
      if (head?.type === 'text' && open) {
        opener = open[0].trim();
        children[0] = { type: 'text', value: head.value.slice(open[0].length) };
      }
      const tail = children[children.length - 1];
      if (tail?.type === 'text' && ADMONITION_CLOSE.test(tail.value)) {
        closer = true;
        children[children.length - 1] = { type: 'text', value: tail.value.replace(ADMONITION_CLOSE, '') };
      }
      if (!opener && !closer) return;

      const body = children.filter((c) => !(c.type === 'text' && c.value === ''));
      const parts: Paragraph[] = [];
      if (opener) parts.push(paragraph(opener));
      if (body.length > 0) parts.push({ type: 'paragraph', children: body });
      if (closer) parts.push(paragraph(':::'));
      parent.children.splice(index, 1, ...parts);
      return index + parts.length;
    });
  };
}

function remarkLanguageAliases() {
  return (tree: Root) => {
    visit(tree, 'code', (node) => {
      if (node.lang && node.lang in LANGUAGE_ALIASES) node.lang = LANGUAGE_ALIASES[node.lang];
    });
  };
}

export default defineConfig({
  plugins: [lastModified()],
  mdxOptions: {
    remarkPlugins: (plugins) => [
      // `:::note` ... `:::` blocks become a <Callout>, coloured the same way as
      // <Admonition type="…"> (components/mdx/admonition.tsx).
      remarkSplitAdmonitions,
      [
        remarkAdmonition,
        {
          typeMap: {
            note: 'info',
            info: 'info',
            tip: 'success',
            caution: 'warning',
            warning: 'warning',
            danger: 'error',
          },
        },
      ],
      remarkMdxMermaid,
      remarkLanguageAliases,
      ...plugins,
    ],
    rehypeCodeOptions: {
      ...codeDefaults,
      themes: { light: 'github-light', dark: 'github-dark' },
      fallbackLanguage: 'plaintext',
      transformers: [
        ...(codeDefaults.transformers ?? []),
        // ```nginx {5,11} highlights lines 5 and 11, like it did on Docusaurus.
        transformerMetaHighlight(),
        // ```nginx setup fills the reader's own values in (see components/setup).
        transformerSetup(),
      ],
    },
  },
});
