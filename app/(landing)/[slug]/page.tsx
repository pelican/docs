import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pagesSource } from '@/lib/source';
import { extractFaq, faqPageJsonLd, jsonLdScript, ogImage, pageMetadata } from '@/lib/og';
import { getMDXComponents } from '@/mdx-components';
import { SiteHeader } from '@/components/home/site-header';
import { SiteFooterNav } from '@/components/home/sections';

export const dynamicParams = false;

// Short lines under each page's title, in the same voice as the homepage. The
// frontmatter description is the longer one used for search results.
const LEDES: Record<string, string> = {
  faq: 'Straight answers about Pelican, Wings, licensing and plugins.',
};

// Social card per page; every content/pages page needs one in the /og contract.
const OG_IMAGES: Record<string, string> = {
  faq: ogImage.faq,
};

/** FAQPage structured data from the page's own <details> questions, so it matches what readers see. */
function faqJsonLd(slug: string, path: string) {
  if (slug !== 'faq') return null;
  const entries = extractFaq(readFileSync(join(process.cwd(), 'content/pages', path), 'utf8'), `/${slug}/`);
  return entries.length > 0 ? jsonLdScript(faqPageJsonLd(entries, `/${slug}/`)) : null;
}

/**
 * Stand-alone MDX pages from content/pages (today only /faq) in the homepage's design.
 * /support is its own route (app/(landing)/support/page.tsx), not MDX.
 */
export default async function Page(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;
  const jsonLd = faqJsonLd(slug, page.path);

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <SiteHeader />
      <main id="main">
        <section className="pl-page__hero" aria-labelledby="page-title">
          <div className="pl-wrap">
            <h1 id="page-title" className="d pl-page__title">
              {page.data.title}
            </h1>
            {(LEDES[slug] ?? page.data.description) && (
              <p className="pl-page__lede">{LEDES[slug] ?? page.data.description}</p>
            )}
          </div>
        </section>
        <section className="pl-page__body">
          <div className="pl-wrap">
            <div className="pl-mdx prose">
              <MDX components={getMDXComponents()} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooterNav />
    </>
  );
}

export function generateStaticParams() {
  return pagesSource.getPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata(props: PageProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();
  return pageMetadata({
    title: page.data.title,
    description: page.data.description ?? LEDES[slug],
    path: `/${slug}/`,
    image: OG_IMAGES[slug] ?? ogImage.home,
  });
}
