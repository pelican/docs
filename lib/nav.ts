import nav from '@/ui/nav.json';

/**
 * The pelican.dev navigation shared with the Hub (ui/nav.json, published at
 * /docs/ui/v1/nav.json). Paths like /plugins and /sponsor are the Hub's; while
 * Netlify still serves the whole domain, netlify.toml redirects them.
 */
export interface NavLink {
  label: string;
  href: string;
}

export const siteNav: {
  items: NavLink[];
  footer: { title: string; items: NavLink[] }[];
  cta: NavLink;
} = nav;

/** The site nav without "Docs": the docs bar is already in the docs. */
export const navOutsideDocs = siteNav.items.filter((item) => !item.href.startsWith('/docs'));
