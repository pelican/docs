import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb';
import { notFound } from 'next/navigation';
import { docsImage, docsIndexImage, type DocsSection } from '@/lib/og-image';
import { checkedMotif } from '@/lib/og-motifs';
import { source } from '@/lib/source';

// Share images for the docs, written into out/ at build time:
// /og/docs/image.png for /docs/ and /og/docs/<slug>/image.png for every other page.
// The last segment is the file name, so a catch-all can stay the last part of the route.
export const dynamic = 'force-static';
export const dynamicParams = false;

const FILE = 'image.png';
const SECTIONS: DocsSection[] = ['Panel', 'Wings', 'Eggs', 'Guides'];

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, FILE] }));
}

/**
 * The sidebar folders above a page: the first is its section ("Panel"), the rest
 * its trail (["Advanced"]). Top-level pages sit under "Project", like the sidebar's separator.
 */
function placeOf(url: string): { section: DocsSection; trail: string[] } {
  const folders = getBreadcrumbItems(url, source.getPageTree())
    .map((item) => item.name)
    .filter((name): name is string => typeof name === 'string');
  const [first, ...trail] = folders;
  const section = SECTIONS.find((s) => s === first);
  return section ? { section, trail } : { section: 'Project', trail: [] };
}

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  if (slug.at(-1) !== FILE) notFound();
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const mdx = await readFile(join(process.cwd(), 'content/docs', page.path), 'utf8');
  const motif = checkedMotif(page.slugs.join('/'), mdx);

  if (page.slugs.length === 0) {
    const pages = source.getPages().filter((p) => p.slugs.length > 0);
    const count = (s: DocsSection) => pages.filter((p) => placeOf(p.url).section === s).length;
    return docsIndexImage({
      sections: [...SECTIONS, 'Project' as const].map((name) => ({ name, pages: count(name) })),
      flow: motif?.kind === 'flow' ? motif : undefined,
    });
  }

  return docsImage({
    ...placeOf(page.url),
    title: page.data.title,
    description: page.data.description,
    url: `pelican.dev${page.url.replace(/\/$/, '')}`,
    motif,
  });
}
