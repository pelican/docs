import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { pagesSource } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { SiteHeader } from '@/components/home/site-header';
import { SiteFooterNav } from '@/components/home/sections';

export const dynamicParams = false;

// Short lines under each page's title, in the same voice as the homepage.
const LEDES: Record<string, string> = {
  faq: 'Straight answers about Pelican, Wings, licensing and plugins.',
};

/**
 * Stand-alone MDX pages from content/pages (today only /faq) in the homepage's design.
 * /support is its own route (app/(landing)/support/page.tsx), not MDX.
 */
export default async function Page(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params;
  const page = pagesSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="pl-page__hero" aria-labelledby="page-title">
          <div className="pl-wrap">
            <h1 id="page-title" className="d pl-page__title">
              {page.data.title}
            </h1>
            {(page.data.description ?? LEDES[slug]) && (
              <p className="pl-page__lede">{page.data.description ?? LEDES[slug]}</p>
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
  return { title: page.data.title, description: page.data.description ?? LEDES[slug] };
}
