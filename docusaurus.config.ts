import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import tailwindPlugin from "./src/plugins/tailwind-config.cjs";
import remarkgfm from "remark-gfm";

const config: Config = {
  title: "Pelican",
  tagline: "From prehistoric to peak performance: Pelican takes flight!",
  favicon: "img/favicon.ico",
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    }
  },
  url: "https://pelican.dev",
  baseUrl: "/",
  organizationName: "pelican",
  projectName: "docs",
  onBrokenLinks: "throw",
  themes: ["@docusaurus/theme-mermaid"],
  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/pelican/docs/blob/main/",
          remarkPlugins: [remarkgfm],
        },
        theme: {
          customCss: [
            require.resolve("./src/css/tailwind.css"),
            require.resolve("./src/css/custom.scss"),
          ],
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Pelican",
      logo: {
        src: "img/logo.png",
      },
      items: [
        { to: "/docs", label: "Docs", position: "left" },
        { to: "/support", label: "Support", position: "left" },
        { to: "/faq", label: "FAQ", position: "left" },
        { to: "/hub", label: "Hub", position: "left", target: "_blank", },
        { to: "/eggs", label: "Eggs", position: "left", target: "_blank", },
        { to: "/github", position: "right", className: "github-link", target: "_blank", },
        { to: "/discord", position: "right", className: "discord-link", target: "_blank", },
      ],
    },
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    footer: {
      logo: {
        src: "img/logo.png",
        height: "64px",
        width: "64px",
      },
      style: "dark",
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Panel',
              to: '/docs/panel/install',
            },
            {
              label: 'Wings',
              to: '/docs/wings/install',
            },
            {
              label: 'SSL Setup',
              to: '/docs/guides/ssl'
            },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "Discord", to: "/discord", target: "_blank", },
            { label: "GitHub", to: "/github", target: "_blank", },
          ],
        },
      ],
      copyright: `Copyright © 2024 - ${new Date().getFullYear()} Pelican`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: [
        "bash",
        "nginx",
        "apacheconf",
        "ini",
        "sql",
        "yaml",
        "docker",
        "php",
      ],
    },
  } satisfies Preset.ThemeConfig,
  plugins: [
    [
      require.resolve('@docusaurus/plugin-client-redirects'),
      {
        redirects: [
          { from: '/discord', to: 'https://discord.gg/pelican-panel' },
          { from: '/eggs', to: 'https://pelican-eggs.github.io/pelican' },
          { from: '/github', to: 'https://github.com/pelican/panel' },
          { from: '/hub', to: 'https://hub.pelican.dev' },
          { from: '/donate', to: 'https://pelican.dev/support' },
          { from: '/docs/about', to: '/docs/contributors' },
          { from: '/docs/glossary', to: '/docs/#glossary' },
          { from: '/docs/troubleshooting', to: '/docs/guides/troubleshooting' },
          { from: '/docs/guides/docker', to: '/docs/getting-started' },
          { from: '/docs/panel/advanced/docker', to: '/docs/panel/install' },
          { from: '/docs/panel/getting-started', to: '/docs/panel/standalone/getting-started' },
          { from: '/docs/panel/webserver-config', to: '/docs/panel/standalone/webserver-config' },
          { from: '/docs/panel/panel-setup', to: '/docs/panel/standalone/panel-setup' },
          { from: '/docs/panel/optional-config', to: '/docs/panel/standalone/optional-config' },
        ],
      },
    ],
    require.resolve('docusaurus-lunr-search'),
    "docusaurus-plugin-sass",
    tailwindPlugin,
  ],
  future: {
    faster: true,
    v4: true
  },
  // scripts: ['/js/snowflake.min.js'],
};

export default config;
