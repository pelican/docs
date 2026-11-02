import './(landing)/home.css';
import Link from 'next/link';
import { SiteHeader } from '@/components/home/site-header';
import { SiteFooterNav } from '@/components/home/sections';
import type { Metadata } from 'next';
import { links } from '@/lib/links';
import { ogImage } from '@/lib/og';

// No canonical: a 404 isn't a page to index (Next.js adds `robots: noindex` itself).
export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page doesn’t exist on pelican.dev. It may have moved when the docs were rebuilt.',
  openGraph: { type: 'website', siteName: 'Pelican', title: 'Page not found', images: [ogImage.home] },
  twitter: { card: 'summary_large_image', title: 'Page not found', images: [ogImage.home] },
};

/** 404, in the homepage's design. */
export default function NotFound() {
  return (
    <div className="pl">
      <SiteHeader />
      <main id="main" className="pl-404">
        <div className="pl-wrap">
          <p className="d pl-404__code" aria-hidden>
            404
          </p>
          <h1 className="d pl-404__title">This page flew off.</h1>
          <p className="pl-404__lede">
            It may have moved when the docs were rebuilt. Try the docs home, or search from there.
          </p>
          <div className="pl-404__actions">
            <Link href="/docs/" className="pl-btn pl-btn--ink pl-btn--big">
              Open the docs
            </Link>
            <Link href="/" className="pl-btn pl-btn--white pl-btn--big">
              Go home
            </Link>
            <Link href={links.install} className="pl-textlink">
              Install guide
            </Link>
          </div>
        </div>
      </main>
      <SiteFooterNav />
    </div>
  );
}
