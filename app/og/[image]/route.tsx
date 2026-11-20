import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { eggCount, FEATURED, gameBySlug, gameCount } from '@/lib/eggs';
import { extractFaq } from '@/lib/og';
import { eggsImage, faqImage, homeImage, supportImage } from '@/lib/og-image';
import { compareRows, plans } from '@/lib/support';

// Share images for the site pages, written into out/og/ at build time.
export const dynamic = 'force-static';
export const dynamicParams = false;

/** The title and first questions on /faq, read from its MDX so the image follows the page. */
async function faq() {
  const mdx = await readFile(join(process.cwd(), 'content/pages/faq.mdx'), 'utf8');
  const title = /^title:\s*"?(.+?)"?\s*$/m.exec(mdx)?.[1] ?? 'Frequently Asked Questions';
  const items = extractFaq(mdx, '/faq/').map(({ question, answer }) => ({
    question,
    // Answers may carry links; the image only needs their words.
    answer: answer.replace(/<[^>]+>/g, ''),
  }));
  return { title, items };
}

/** "1 Discord account", from the comparison table on /support. */
function accounts(i: number) {
  const n = compareRows.find((r) => r.label === 'Discord accounts covered')?.values[i];
  return n ? `${n} Discord ${n === '1' ? 'account' : 'accounts'}` : '';
}

const IMAGES = {
  'home.png': () => homeImage(),
  'eggs.png': () =>
    eggsImage({
      eggs: eggCount,
      games: gameCount,
      tiles: FEATURED.flatMap((slug) => {
        const game = gameBySlug(slug);
        return game ? [{ name: game.name, icon: game.icon, eggs: game.eggs.length }] : [];
      }),
    }),
  'support.png': () => supportImage({ plans: plans.map(({ name, price }, i) => ({ name, price, detail: accounts(i) })) }),
  'faq.png': async () => faqImage(await faq()),
} as const;

export function generateStaticParams() {
  return Object.keys(IMAGES).map((image) => ({ image }));
}

export async function GET(_req: Request, { params }: RouteContext<'/og/[image]'>) {
  const { image } = await params;
  if (!Object.hasOwn(IMAGES, image)) notFound();
  return IMAGES[image as keyof typeof IMAGES]();
}
