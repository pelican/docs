import Link from 'next/link';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { links } from '@/lib/links';

/** Phone navigation: a <details> that opens a sheet (only the theme switch needs JavaScript). */
export function MobileMenu() {
  return (
    <details className="pl-menu">
      <summary className="pl-btn pl-btn--white">Menu</summary>
      <nav className="pl-menu__sheet" aria-label="Main">
        <Link href="/docs/">Docs</Link>
        <a href={`${links.hub}/plugins`}>Plugins</a>
        <a href={links.eggs}>Eggs</a>
        <a href={links.discord}>Community</a>
        <Link href="/support/">Sponsor</Link>
        <div className="pl-menu__theme">
          {/* The button is named "Toggle Theme" by Fumadocs; this label is for sight. */}
          <span aria-hidden>Theme</span>
          <ThemeSwitch className="pl-theme" />
        </div>
        <Link href={links.install} className="pl-btn pl-btn--ink">
          Get started
        </Link>
      </nav>
    </details>
  );
}
