import defaultMdxComponents from 'fumadocs-ui/mdx';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import type { MDXComponents } from 'mdx/types';
import { Admonition } from '@/components/mdx/admonition';
import { Link } from '@/components/mdx/link';
import { Mermaid } from '@/components/mdx/mermaid';
import { TabItem, Tabs } from '@/components/mdx/tabs';
import { SetupPanel } from '@/components/setup/setup-panel';
import { SetupAwareSpan } from '@/components/setup/setup-span';

/**
 * Components available in every .mdx page without an import.
 *
 * Adding one? Also add its name to COMPONENTS in scripts/check-content.mjs, which only lets
 * pages use the components listed there (a test fails if the two lists differ).
 *
 * <Admonition>, <Tabs>, <TabItem> and <Link> keep the names and props they
 * had on Docusaurus, so existing pages work unchanged.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    span: SetupAwareSpan,
    // Fumadocs' code block, with a name for its scrollable region (the file title, or "Code").
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props} viewportProps={{ 'aria-label': typeof props.title === 'string' ? `Code: ${props.title}` : 'Code' }}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    Admonition,
    Tabs,
    TabItem,
    Link,
    Mermaid,
    SetupPanel,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;
