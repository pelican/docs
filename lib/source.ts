import { docs, pages } from 'fumadocs-mdx:collections/server';
import { loader } from 'fumadocs-core/source';

/** Everything under /docs, with the sidebar from each folder's meta.json. */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

/** Stand-alone MDX pages at the site root (content/pages): /faq. */
export const pagesSource = loader({
  baseUrl: '/',
  source: pages.toFumadocsSource(),
});

export function githubEditUrl(collection: 'docs' | 'pages', path: string) {
  return `https://github.com/pelican/docs/blob/main/content/${collection}/${path}`;
}
