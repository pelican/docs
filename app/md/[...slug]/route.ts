import { notFound } from 'next/navigation';
import { markdownParams, pageFromMarkdownSlug, pageMarkdown } from '@/lib/llms';

// One docs page as Markdown. Builds to out/md/<page>.md; netlify.toml serves
// it at /docs/<page>.md (the docs page route owns everything under /docs).
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return markdownParams();
}

export async function GET(_request: Request, { params }: RouteContext<'/md/[...slug]'>) {
  const { slug } = await params;
  const page = pageFromMarkdownSlug(slug);
  if (!page) notFound();
  return new Response(await pageMarkdown(page), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
