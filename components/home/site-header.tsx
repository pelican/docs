import Link from 'next/link';
import { Star } from 'lucide-react';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { links } from '@/lib/links';
import { project } from '@/lib/home-data';
import { MobileMenu } from './mobile-menu';

/** Announcement bar plus the sky-blue nav from the V12 "B v3" board. */
export function SiteHeader() {
  return (
    <>
      <a href="#main" className="pl-skip">
        Skip to content
      </a>
      <div className="pl-announce">
        <span className="pl-announce__tag">{project.version.replace('1.0.0-', '')}</span>
        <span>A crashing plugin can no longer take the panel down, and more.</span>
        <a href={`https://github.com/pelican/panel/releases/tag/v${project.version}`} className="pl-announce__link">
          Read the release →
        </a>
      </div>
      <header className="pl-nav">
        <Link href="/" className="pl-nav__brand" aria-label="Pelican home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.png" alt="" width={44} height={44} />
          <span className="d">Pelican</span>
        </Link>
        <nav className="pl-nav__links" aria-label="Main">
          <Link href="/docs/">Docs</Link>
          <a href={`${links.hub}/plugins`}>Plugins</a>
          <a href={links.eggs}>Eggs</a>
          <a href={links.discord}>Community</a>
          <Link href="/support/">Sponsor</Link>
        </nav>
        <div className="pl-nav__actions">
          {/* Light/dark, shared with the docs bar (next-themes keeps it in localStorage). */}
          <ThemeSwitch className="pl-theme" />
          <a href={links.github} className="pl-btn pl-btn--white pl-btn--small" aria-label={`Pelican on GitHub, ${project.stars} stars`}>
            <Star size={16} aria-hidden strokeWidth={2.5} /> {(project.stars / 1000).toFixed(1)}k
          </a>
          <Link href={links.install} className="pl-btn pl-btn--ink pl-btn--small pl-nav__cta">
            Get started
          </Link>
          <MobileMenu />
        </div>
      </header>
    </>
  );
}
