import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // A fully static site in out/, served by Netlify like the Docusaurus build was.
  output: 'export',
  // pelican.dev has always used /docs/panel/getting-started/ with the slash.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default withMDX(config);
