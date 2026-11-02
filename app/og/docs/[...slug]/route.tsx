import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb';
import { notFound } from 'next/navigation';
import { docsImage } from '@/lib/og-image';
import { source } from '@/lib/source';

// Share images for the docs, written into out/ at build time:
// /og/docs/image.png for /docs/ and /og/docs/<slug>/image.png for every other page.
// The last segment is the file name, so a catch-all can stay the last part of the route.
export const dynamic = 'force-static';
export const dynamicParams = false;

const FILE = 'image.png';

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, FILE] }));
}

/** The sidebar folders above a page ("Panel / Advanced"); top-level pages sit under "Project". */
function sectionOf(url: string, slugs: string[]) {
  if (slugs.length === 0) return 'Documentation';
  const folders = getBreadcrumbItems(url, source.getPageTree())
    .map((item) => item.name)
    .filter((name): name is string => typeof name === 'string');
  return folders.length > 0 ? folders.join(' / ') : 'Project';
}

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  if (slug.at(-1) !== FILE) notFound();
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return docsImage({
    section: sectionOf(page.url, page.slugs),
    title: page.data.title,
    description: page.data.description,
    url: `pelican.dev${page.url.replace(/\/$/, '')}`,
  });
}
