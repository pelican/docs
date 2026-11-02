import Link from 'next/link';
import { Star } from 'lucide-react';
import { FullSearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { links } from '@/lib/links';
import { project } from '@/lib/home-data';

/**
 * The B v3 top bar for the docs (desktop and tablet). On phones Fumadocs'
 * own bar, restyled in global.css, takes over so there is never a double bar.
 */
export function DocsTopBar() {
  return (
    <header className="dt-bar">
      <Link href="/" className="dt-bar__brand" aria-label="Pelican home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo.png" alt="" width={34} height={34} />
        <span>Pelican</span>
        <span className="dt-bar__section">Docs</span>
      </Link>
      <FullSearchTrigger className="dt-bar__search" />
      <nav className="dt-bar__links" aria-label="Site">
        <a href={`${links.hub}/plugins`}>Plugins</a>
        <Link href="/eggs/">Eggs</Link>
        <a href={links.discord}>Community</a>
        <Link href="/support/">Sponsor</Link>
      </nav>
      <div className="dt-bar__actions">
        <ThemeSwitch className="dt-bar__theme" />
        <a href={links.github} className="dt-btn" aria-label={`Pelican on GitHub, ${project.stars} stars`}>
          <Star size={15} strokeWidth={2.5} aria-hidden /> {(project.stars / 1000).toFixed(1)}k
        </a>
        <Link href={links.install} className="dt-btn dt-btn--ink">
          Get started
        </Link>
      </div>
    </header>
  );
}
