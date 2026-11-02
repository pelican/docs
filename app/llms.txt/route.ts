import { llmsTxt } from '@/lib/llms';

// /llms.txt (llmstxt.org): an index of the docs for AI tools.
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
