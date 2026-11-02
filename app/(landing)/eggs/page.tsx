import type { Metadata } from 'next';
import { SiteHeader } from '@/components/home/site-header';
import { SiteFooterNav } from '@/components/home/sections';
import { EggIndexList, type IndexEgg, type IndexGame } from '@/components/home/egg-index';
import { eggCount, eggIndex, gameCount } from '@/lib/eggs';

export const metadata: Metadata = {
  title: 'Eggs: every game and app Pelican can run',
  description: `${eggCount} eggs for Pelican, from Minecraft and Rust to Discord bots and databases. Copy an egg's URL and import it into your panel.`,
};

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const updated = dateFormat.format(new Date(eggIndex.generatedAt));
const hubUpdated = eggIndex.hubFetchedAt ? dateFormat.format(new Date(eggIndex.hubFetchedAt)) : null;

// Only what the list shows, searches or filters on goes to the browser: no
// square icons (they're for the homepage), no egg icons, no empty fields.
const indexGames: IndexGame[] = eggIndex.games.map(({ slug, name, category, steamAppId, art, eggs }) => ({
  slug,
  name,
  category,
  steamAppId,
  art,
  eggs: eggs.map((e) => {
    const egg: IndexEgg = { name: e.name, description: e.description, url: e.url, image: e.image };
    if (e.imageNote) egg.imageNote = e.imageNote;
    if (e.features.length) egg.features = e.features;
    if (e.vars.length) egg.vars = e.vars.join(' ');
    if (e.hubUrl) egg.hubUrl = e.hubUrl;
    if (e.installs) egg.installs = e.installs;
    if (e.updatedAt) egg.updatedAt = e.updatedAt.slice(0, 10);
    return egg;
  }),
}));

export default function EggsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pl-ei">
        <section className="pl-ei__hero" aria-labelledby="eggs-title">
          <div className="pl-wrap">
            <h1 id="eggs-title" className="d pl-ei__title">
              Every egg, in one place.
            </h1>
            <p className="pl-ei__lede">
              An egg tells Pelican how to install and start a game or app. Here are all {eggCount} community eggs for{' '}
              {gameCount} games and plenty more besides. Copy an egg&apos;s URL and import it from your panel&apos;s Eggs
              page.
            </p>
          </div>
        </section>
        <section className="pl-ei__list" aria-label="Eggs">
          <div className="pl-wrap">
            <EggIndexList games={indexGames} categories={eggIndex.categories} />
            <p className="pl-fine pl-ei__source">
              From the <a href="https://pelican-eggs.github.io/pelican">pelican-eggs index</a>, which is rebuilt every day
              from the <a href="https://github.com/pelican-eggs">pelican-eggs repositories</a>. This copy is from {updated}.
              {hubUpdated && (
                <>
                  {' '}
                  Install counts, update dates and Details pages come from{' '}
                  <a href="https://hub.pelican.dev/eggs">Pelican Hub</a>, as of {hubUpdated}.
                </>
              )}{' '}
              Game artwork comes from each game&apos;s Steam store page and belongs to its publisher; the Minecraft block is
              our own drawing.
            </p>
          </div>
        </section>
      </main>
      <SiteFooterNav />
    </>
  );
}
