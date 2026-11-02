import type { Metadata } from 'next';
import { links } from '@/lib/links';

/** The production origin. Canonicals, sitemap and JSON-LD use absolute URLs on it. */
export const SITE_URL = 'https://pelican.dev';
export const SITE_NAME = 'Pelican';

/** Netlify sets CONTEXT ("production", "deploy-preview", "branch-deploy") and DEPLOY_PRIME_URL at build time. */
export const IS_PRODUCTION = !process.env.CONTEXT || process.env.CONTEXT === 'production';

/**
 * Origin for share images. On previews it's the deploy's own URL, so link previews
 * work before these images exist on pelican.dev. Canonicals always stay on SITE_URL.
 */
export const ASSET_URL = (!IS_PRODUCTION && process.env.DEPLOY_PRIME_URL) || SITE_URL;

/** Social card size; the generated PNGs under /og are exactly this. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Social card (Open Graph) image paths. The routes under app/og build exactly these
 * 1200×630 PNGs at build time, so keep both sides in step.
 */
export const ogImage = {
  home: '/og/home.png',
  eggs: '/og/eggs.png',
  support: '/og/support.png',
  faq: '/og/faq.png',
  /** `/og/docs/image.png` for /docs/, `/og/docs/<slug segments>/image.png` for the rest. */
  docs(slugs: string[] = []): string {
    return slugs.length === 0 ? '/og/docs/image.png' : `/og/docs/${slugs.join('/')}/image.png`;
  },
} as const;

/** `/docs/panel/update` -> `https://pelican.dev/docs/panel/update/` (the site uses trailing slashes). */
export function absoluteUrl(path: string): string {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return new URL(withSlash, SITE_URL).toString();
}

interface PageMetadataInput {
  /** og:title and twitter:title; also `<title>` through the root template ("%s | Pelican") unless `absoluteTitle` is set. */
  title: string;
  /** Use this exact `<title>`, skipping the template. */
  absoluteTitle?: string;
  description: string;
  /** Site path of the page, like `/docs/panel/update/`. */
  path: string;
  /** One of the `ogImage` paths. */
  image: string;
  type?: 'website' | 'article';
  /** For articles: when the source last changed. */
  modifiedTime?: Date;
}

/**
 * Title, description, canonical, Open Graph and Twitter card for one page.
 * Next.js replaces (doesn't merge) `openGraph`/`twitter` from the layout, so every
 * page builds the full set here.
 */
export function pageMetadata({
  title,
  absoluteTitle,
  description,
  path,
  image,
  type = 'website',
  modifiedTime,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  // Social cards show the site name separately, so they get the plain title.
  const socialTitle = title;
  const images = [{ url: image, ...OG_SIZE, alt: socialTitle }];

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: 'en_US',
      url,
      title: socialTitle,
      description,
      images,
      ...(type === 'article' && modifiedTime ? { modifiedTime: modifiedTime.toISOString() } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [image],
    },
  };
}

/* ---------------------------------------------------------------------------
 * JSON-LD (schema.org). Only facts that the site itself states.
 * ------------------------------------------------------------------------- */

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationJsonLd() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/img/logo.png`,
    sameAs: ['https://github.com/pelican', links.discord],
  };
}

export function websiteJsonLd() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  };
}

/** Pelican Panel: free (FAQ, /support), AGPLv3 (FAQ licensing), runs on Linux (install docs). */
export function softwareApplicationJsonLd() {
  return {
    '@type': 'SoftwareApplication',
    name: 'Pelican Panel',
    description:
      'A free, self-hosted, open-source panel for running game servers. Each server lives in its own Docker container, and plugins extend the panel.',
    url: `${SITE_URL}/`,
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Game server management panel',
    operatingSystem: 'Linux',
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    sameAs: [links.github],
  };
}

/** Home > Documentation > page. Docs folders have no pages of their own, so they're left out. */
export function docsBreadcrumbJsonLd(page: { title: string; url: string }) {
  const crumbs = [
    { name: 'Home', url: `${SITE_URL}/` },
    { name: 'Documentation', url: absoluteUrl('/docs/') },
  ];
  if (page.url !== '/docs') crumbs.push({ name: page.title, url: absoluteUrl(page.url) });

  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export function techArticleJsonLd(page: {
  title: string;
  description: string;
  url: string;
  image: string;
  section?: string;
  lastModified?: Date;
}) {
  return {
    '@type': 'TechArticle',
    headline: page.title,
    description: page.description,
    url: absoluteUrl(page.url),
    mainEntityOfPage: absoluteUrl(page.url),
    image: new URL(page.image, SITE_URL).toString(),
    inLanguage: 'en',
    ...(page.section ? { articleSection: page.section } : {}),
    ...(page.lastModified ? { dateModified: page.lastModified.toISOString() } : {}),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/`, logo: `${SITE_URL}/img/logo.png` },
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * The question/answer pairs of an MDX page written as `<details><summary>Q</summary> A </details>`,
 * as text: emphasis marks go, links become absolute `<a>` tags (schema.org answers allow them,
 * and "find it here" means nothing without the link). A question that appears twice
 * (once per tab) keeps its first answer, since FAQPage questions must be unique.
 * `pagePath` resolves `?query` links, like `/faq/`.
 */
export function extractFaq(mdx: string, pagePath: string): FaqEntry[] {
  const plain = (text: string) =>
    text
      .replace(/<[^>]+>/g, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/(\*\*|__|\*|_)(\S[^*_]*?\S|\S)\1/g, '$2')
      .replace(/\s+/g, ' ')
      .trim();
  const resolve = (href: string) => {
    if (/^https?:\/\//.test(href)) return href;
    if (href.startsWith('?') || href.startsWith('#')) return absoluteUrl(pagePath) + href;
    // Root-relative in practice: the FAQ's "./docs/..." links point at /docs/...
    const [path, hash] = href.replace(/^(\.\.?\/|\/)+/, '/').split('#');
    return absoluteUrl(path) + (hash ? `#${hash}` : '');
  };
  const withLinks = (text: string) =>
    plain(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => `<a href="${resolve(href)}">${label}</a>`);

  const seen = new Set<string>();
  const entries: FaqEntry[] = [];
  for (const [, q, a] of mdx.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)) {
    const question = plain(q);
    const answer = withLinks(a);
    if (!question || !answer || seen.has(question)) continue;
    seen.add(question);
    entries.push({ question, answer });
  }
  return entries;
}

export function faqPageJsonLd(entries: FaqEntry[], path: string) {
  return {
    '@type': 'FAQPage',
    url: absoluteUrl(path),
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

/** Wraps schema.org nodes in one `@graph` and serialises it safely for a `<script>` tag. */
export function jsonLdScript(...nodes: object[]): string {
  const doc = nodes.length === 1
    ? { '@context': 'https://schema.org', ...nodes[0] }
    : { '@context': 'https://schema.org', '@graph': nodes };
  // `<` can't close the script element when escaped.
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}
