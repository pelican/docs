import type { Metadata } from 'next';
import { SiteHeader } from '@/components/home/site-header';
import {
  ActivitySection,
  CommunitySection,
  FeaturesSection,
  FinalSection,
  GamesSection,
  HeroSection,
  InstallSection,
  JumpNav,
  PluginsSection,
  SiteFooterNav,
  WhySection,
} from '@/components/home/sections';

export const metadata: Metadata = {
  title: { absolute: 'Pelican: your servers, your community, your control' },
  description:
    'Pelican is a free, self-hosted, open-source panel for running game servers. Each server lives in its own Docker container, and plugins extend the panel.',
};

// Section order follows the V12 "B v3" board.
export default function HomePage() {
  return (
    <>
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
        <FinalSection />
      </main>
      <SiteFooterNav />
    </>
  );
}
