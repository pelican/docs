import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { ExternalLinkGuard } from '@/components/external-link-guard';
import { ASSET_URL, IS_PRODUCTION, OG_SIZE, SITE_NAME, ogImage } from '@/lib/og';

// The brand faces from the V12 design, used across the whole site:
// Bricolage Grotesque for display, Instrument Sans for reading and interface,
// JetBrains Mono for code.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--pl-font-display', display: 'swap' });
const text = Instrument_Sans({ subsets: ['latin'], variable: '--pl-font-text', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  // Resolves the relative share-image URLs; a preview's own address on deploy previews.
  metadataBase: new URL(ASSET_URL),
  // Previews must not compete with pelican.dev in search results.
  ...(IS_PRODUCTION ? {} : { robots: { index: false, follow: false } }),
  title: {
    default: 'Pelican: free, open-source game server panel',
    template: '%s | Pelican',
  },
  description:
    'Pelican is a free, open-source panel for running game servers and applications in isolated Docker containers.',
  applicationName: SITE_NAME,
  icons: { icon: '/img/favicon.ico', apple: '/img/logo.png' },
  // Fallbacks only: each page sets its own canonical, Open Graph and Twitter card
  // through pageMetadata() in lib/og.ts.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [{ url: ogImage.home, ...OG_SIZE, alt: 'Pelican' }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage.home] },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          // Follows the reader's system setting; the switch in the docs bar overrides it.
          theme={{ defaultTheme: 'system' }}
          // The search index is a static file built with the site (app/api/search).
          search={{ options: { type: 'static' } }}
        >
          {children}
          <ExternalLinkGuard />
        </RootProvider>
      </body>
    </html>
  );
}
