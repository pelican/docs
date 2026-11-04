import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/og';
import { pagesSource } from '@/lib/source';

// Written once into out/sitemap.xml by the static export.
// INTERIM: the landing pages only (remove after the switch, with them). The docs
// have their own /docs/sitemap.xml (app/docs/sitemap.ts); robots.txt lists both,
// and the Hub will serve /sitemap.xml as an index that points at the docs one.
export const dynamic = 'force-static';

/** The landing pages (/, /eggs, /support, /faq). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
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
}
