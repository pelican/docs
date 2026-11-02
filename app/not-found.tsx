import './(landing)/home.css';
import Link from 'next/link';
import { SiteHeader } from '@/components/home/site-header';
import { SiteFooterNav } from '@/components/home/sections';
import { links } from '@/lib/links';

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
