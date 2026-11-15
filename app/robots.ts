import type { MetadataRoute } from 'next';
import { IS_PRODUCTION, SITE_URL } from '@/lib/og';

// Written once into out/robots.txt by the static export.
// INTERIM: after the switch the Hub serves /robots.txt (and should list /docs/sitemap.xml).
export const dynamic = 'force-static';

/** Everything is open, AI crawlers included: the owner wants the docs discoverable. */
export default function robots(): MetadataRoute.Robots {
  return {
    // Deploy previews are closed to crawlers; production is open to everyone.
    rules: IS_PRODUCTION ? { userAgent: '*', allow: '/' } : { userAgent: '*', disallow: '/' },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/docs/sitemap.xml`],
  };
}
