import Link from 'next/link';
import { Star } from 'lucide-react';
import { FullSearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { links } from '@/lib/links';
import { project } from '@/lib/home-data';
import { navOutsideDocs, siteNav } from '@/lib/nav';

/**
 * The B v3 top bar for the docs (desktop and tablet). On phones Fumadocs'
 * own bar, restyled in global.css, takes over so there is never a double bar.
 */
export function DocsTopBar() {
  return (
    <header className="dt-bar">
      {/* Plain links: / and the paths in the site nav are the Hub's pages, not this app's. */}
      <a href="/" className="dt-bar__brand" aria-label="Pelican home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/docs/img/logo.png" alt="" width={34} height={34} />
        <span>Pelican</span>
        <span className="dt-bar__section">Docs</span>
      </a>
      <FullSearchTrigger className="dt-bar__search" />
      <nav className="dt-bar__links" aria-label="Site">
        {navOutsideDocs.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="dt-bar__actions">
        <ThemeSwitch className="dt-bar__theme" />
        <a href={links.github} className="dt-btn" aria-label={`Pelican on GitHub, ${project.stars} stars`}>
          <Star size={15} strokeWidth={2.5} aria-hidden /> {(project.stars / 1000).toFixed(1)}k
        </a>
        <Link href={siteNav.cta.href} className="dt-btn dt-btn--ink">
          {siteNav.cta.label}
        </Link>
      </div>
    </header>
  );
}
