import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // A fully static site in out/, served by Netlify like the Docusaurus build was.
  output: 'export',
  // pelican.dev has always used /docs/panel/getting-started/ with the slash.
  trailingSlash: true,
  // pelican.dev serves only /docs/* (plus /llms*.txt and the install scripts) from
  // this build; every other path belongs to the Hub. So the JS, CSS and fonts load
  // from /docs/_next/... With `output: 'export'` the files are still written to
  // out/_next/, and netlify.toml rewrites /docs/_next/* to them.
  // (basePath would move the interim landing pages under /docs too.)
  assetPrefix: '/docs',
  images: { unoptimized: true },
};

export default withMDX(config);
