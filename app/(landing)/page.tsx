import type { Metadata } from 'next';
import { SiteHeader } from '@/components/home/site-header';
import {
  jsonLdScript,
  ogImage,
  organizationJsonLd,
  pageMetadata,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '@/lib/og';
import {
  ActivitySection,
  CommunitySection,
  FeaturesSection,
  GamesSection,
  HeroSection,
  InstallSection,
  JumpNav,
  PluginsSection,
  SiteFooterNav,
  WhySection,
} from '@/components/home/sections';

const TITLE = 'Pelican: your servers, your community, your control';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  absoluteTitle: TITLE,
  description:
    'Pelican is a free, self-hosted, open-source panel for running game servers. Each server lives in its own Docker container, and plugins extend the panel.',
  path: '/',
  image: ogImage.home,
});

const jsonLd = jsonLdScript(organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd());

// Section order follows the V12 "B v3" board.
export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SiteHeader />
      <main id="main">
        <HeroSection />
        <GamesSection />
        <JumpNav />
        <WhySection />
        <FeaturesSection />
        <PluginsSection />
        <ActivitySection />
        <InstallSection />
        <CommunitySection />
      </main>
      <SiteFooterNav />
    </>
  );
}
