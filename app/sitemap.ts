import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/og';
import { pagesSource, source } from '@/lib/source';

// Written once into out/sitemap.xml by the static export.
export const dynamic = 'force-static';

/** Every landing page and every docs page, with the docs' git last-modified dates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const landing: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/eggs/'), changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/support/'), changeFrequency: 'monthly', priority: 0.6 },
    ...pagesSource.getPages().map((page) => ({
      url: absoluteUrl(page.url),
      lastModified: page.data.lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: absoluteUrl(page.url),
    lastModified: page.data.lastModified,
    changeFrequency: 'weekly',
    priority: page.slugs.length === 0 ? 0.9 : 0.7,
  }));

  return [...landing, ...docs];
}
