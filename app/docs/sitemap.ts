import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/og';
import { source } from '@/lib/source';

// Written once into out/docs/sitemap.xml by the static export. The Hub's
// /sitemap.xml index links here.
export const dynamic = 'force-static';

/** Every docs page, with its git last-modified date. */
export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: absoluteUrl(page.url),
    lastModified: page.data.lastModified,
    changeFrequency: 'weekly',
    priority: page.slugs.length === 0 ? 0.9 : 0.7,
  }));
}
