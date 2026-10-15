import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  Sidebar: [
    'welcome',
    'getting-started',
    {
      type: 'category',
      label: 'Panel',
      collapsed: false,
      items: [
        'panel/install',
        {
          type: 'category',
          label: 'Standalone',
          items: [
            'panel/standalone/getting-started',
            'panel/standalone/webserver-config',
            'panel/standalone/panel-setup',
            'panel/standalone/optional-config',
          ]
        },
        'panel/update',
        {
          type: 'category',
          label: 'Advanced',
          items: [
            'panel/advanced/redis',
            'panel/advanced/mysql',
            'panel/advanced/artisan',
            'panel/advanced/podman',
            'panel/advanced/cloudflare-tunnel',
            'panel/advanced/api-docs',
            'panel/advanced/plugins',
          ]
        }
      ],
    },
    {
      type: 'category',
      label: 'Wings',
      items: [
        'wings/install',
        'wings/optional-config',
        'wings/update'
      ],
    },
    {
      type: 'category',
      label: 'Eggs',
      items: [
        'eggs/creating-a-custom-egg',
        'eggs/creating-a-custom-yolk',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/mounts',
        'guides/ssl',
        'guides/php-upgrade',
        'guides/database-hosts',
        'guides/change-panel-domain',
        'guides/uninstalling',
        'guides/migrating-from-pterodactyl',
        'guides/translating',
        'guides/troubleshooting',
      
        {
          type: 'category',
          label: 'Disk Quotas',
          items: [
            'guides/disk-quotas/about',
            'guides/disk-quotas/ext4-xfs',
          ]
        }
      ],
    },
    'versioning',
    'comparison',
    'contributors',
  ],
};

export default sidebars;
