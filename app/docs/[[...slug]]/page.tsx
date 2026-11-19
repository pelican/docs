import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  PageLastUpdate,
} from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { githubEditUrl, source } from '@/lib/source';
import { docsBreadcrumbJsonLd, jsonLdScript, ogImage, pageMetadata, techArticleJsonLd } from '@/lib/og';
import { getMDXComponents } from '@/mdx-components';
import { PageActions } from '@/components/docs/page-actions';
import { markdownPath } from '@/lib/llms';
import { resolveDocsHref } from '@/lib/docs-href';

export const dynamicParams = false;

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const jsonLd = jsonLdScript(
    docsBreadcrumbJsonLd({ title: page.data.title, url: page.url }),
    techArticleJsonLd({
      title: page.data.title,
      description: docsDescription(page.data.title, page.data.description),
      url: page.url,
      image: ogImage.docs(page.slugs),
      section: docsSection(page.url),
      lastModified: page.data.lastModified,
    }),
  );

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      // Hooks for the Hub look in app/global.css ("Docs: page").
      breadcrumb={{ className: 'dt-crumbs' }}
      footer={{ className: 'dt-pager' }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <PageActions
        // The built file (out/docs/md/…): served as-is everywhere, unlike the /docs/<page>.md rewrite.
        markdownUrl={markdownPath(page).replace(/^\/docs\//, '/docs/md/')}
        githubUrl={githubEditUrl('docs', page.path)}
      />
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // Pages link with relative paths like ../versioning or ./docker.mdx; resolve them
            // against the page's folder, not its URL (which ends in /). See lib/docs-href.ts.
            a: ({ href, ...rest }) => (
              <defaultMdxComponents.a href={href ? resolveDocsHref(href, page.path) : href} {...rest} />
            ),
          })}
        />
      </DocsBody>
      <div className="dt-pagefoot flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <EditOnGitHub className="dt-edit" href={githubEditUrl('docs', page.path)} />
        {page.data.lastModified && <PageLastUpdate date={page.data.lastModified} />}
      </div>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const isIndex = page.slugs.length === 0;
  return pageMetadata({
    // "Docker | Pelican Docs" reads better in results than a bare "Docker | Pelican".
    absoluteTitle: isIndex ? 'Pelican documentation' : `${page.data.title} | Pelican Docs`,
    title: isIndex ? 'Pelican documentation' : page.data.title,
    description: docsDescription(page.data.title, page.data.description),
    path: page.url,
    image: ogImage.docs(page.slugs),
    type: isIndex ? 'website' : 'article',
    modifiedTime: page.data.lastModified,
  });
}

/** The page's frontmatter description; every page has one, this only guards a new page without it. */
function docsDescription(title: string, description?: string) {
  return description ?? `${title}: part of the Pelican documentation.`;
}

/** The top docs folder a page sits in ("Panel", "Wings", "Guides", "Eggs"), for the article's section. */
function docsSection(url: string) {
  const [top] = getBreadcrumbItems(url, source.pageTree);
  return typeof top?.name === 'string' ? top.name : undefined;
}
