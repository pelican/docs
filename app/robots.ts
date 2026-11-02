import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/og';

// Written once into out/robots.txt by the static export.
export const dynamic = 'force-static';

/** Everything is open, AI crawlers included: the owner wants the docs discoverable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
