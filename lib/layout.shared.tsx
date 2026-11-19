import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared';
import { DiscordIcon } from '@/components/icons';
import { links } from '@/lib/links';
import { navOutsideDocs } from '@/lib/nav';

/**
 * Options for the docs layout. On desktop the B v3 top bar (DocsTopBar) carries
 * the site navigation; these show in the phone bar and the phone sidebar.
 */
export function docsOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="dt-navtitle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/docs/img/logo-96.webp" alt="" width={28} height={28} />
          Pelican <span>Docs</span>
        </span>
      ),
      url: '/',
    },
    githubUrl: links.github,
    links: [
      // The Hub's pages (ui/nav.json), as plain links: Fumadocs' link would add the docs'
      // trailing slash (/sponsor/ instead of /sponsor) and try client-side navigation, and its
      // `external` would open a new tab.
      hubMenuLink('Home', '/'),
      ...navOutsideDocs.filter((item) => item.href.startsWith('/')).map((item) => hubMenuLink(item.label, item.href)),
      {
        type: 'icon',
        label: 'Discord',
        text: 'Discord',
        icon: <DiscordIcon />,
        url: links.discord,
      },
    ],
  };
}

/** Fumadocs' own sidebar link look (itemVariants in fumadocs-ui's docs sidebar), for a plain <a>. */
const MENU_LINK =
  'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none';

/** A link to one of the Hub's pages in the phone menu, with its href exactly as written. */
function hubMenuLink(text: string, url: string): LinkItemType {
  return {
    type: 'custom',
    on: 'menu',
    children: (
      <a href={url} className={MENU_LINK} style={{ paddingInlineStart: 'calc(2 * var(--spacing))' }}>
        {text}
      </a>
    ),
  };
}
