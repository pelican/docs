import Link from 'next/link';
import { links } from '@/lib/links';

/** Phone navigation without JavaScript: a <details> that opens a sheet. */
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
        <Link href={links.install} className="pl-btn pl-btn--ink">
          Get started
        </Link>
      </nav>
    </details>
  );
}
