import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DiscordIcon } from '@/components/icons';
import { links } from '@/lib/links';

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
          <img src="/img/logo.png" alt="" width={28} height={28} />
          Pelican <span>Docs</span>
        </span>
      ),
      url: '/',
    },
    githubUrl: links.github,
    links: [
      { text: 'Home', url: '/', on: 'menu' },
      { text: 'Eggs', url: links.eggs, on: 'menu' },
      { text: 'Plugins', url: `${links.hub}/plugins`, on: 'menu' },
      { text: 'Sponsor', url: '/support/', on: 'menu' },
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
