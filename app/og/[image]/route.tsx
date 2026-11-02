import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { eggCount, eggIndex, gameCount } from '@/lib/eggs';
import { eggsImage, faqImage, homeImage, supportImage } from '@/lib/og-image';
import { plans } from '@/lib/support';

// Share images for the site pages, written into out/og/ at build time.
export const dynamic = 'force-static';
export const dynamicParams = false;

/** The first few questions on /faq, read from its MDX so the image follows the page. */
async function faqQuestions() {
  const mdx = await readFile(join(process.cwd(), 'content/pages/faq.mdx'), 'utf8');
  return [...new Set([...mdx.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1].trim()))];
}

const IMAGES = {
  'home.png': () => homeImage(),
  'eggs.png': () =>
    eggsImage({ eggs: eggCount, games: gameCount, categories: eggIndex.categories.map((c) => c.name) }),
  'support.png': () => supportImage({ plans: plans.map(({ name, price }) => ({ name, price })) }),
  'faq.png': async () => faqImage({ questions: await faqQuestions() }),
} as const;

export function generateStaticParams() {
  return Object.keys(IMAGES).map((image) => ({ image }));
}

export async function GET(_req: Request, { params }: RouteContext<'/og/[image]'>) {
  const { image } = await params;
  if (!Object.hasOwn(IMAGES, image)) notFound();
  return IMAGES[image as keyof typeof IMAGES]();
}
