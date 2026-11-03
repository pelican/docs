import defaultMdxComponents from 'fumadocs-ui/mdx';
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
 * <Admonition>, <Tabs>, <TabItem> and <Link> keep the names and props they
 * had on Docusaurus, so existing pages work unchanged.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    span: SetupAwareSpan,
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
