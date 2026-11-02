import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from 'fumadocs-mdx/config';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins/rehype-code';
import { remarkAdmonition } from 'fumadocs-core/mdx-plugins/remark-admonition';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins/remark-mdx-mermaid';
import { transformerMetaHighlight } from '@shikijs/transformers';
import lastModified from 'fumadocs-mdx/plugins/last-modified';
import type { Root } from 'mdast';
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
