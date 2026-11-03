import { llmsFullTxt } from '@/lib/llms';

// /llms-full.txt: every docs page as Markdown in one file, in sidebar order.
export const dynamic = 'force-static';

export async function GET() {
  return new Response(await llmsFullTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
