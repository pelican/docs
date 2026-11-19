import { llmsTxt } from '@/lib/llms';

// /docs/llms.txt: the same index as /llms.txt, for tools that look for it next to the docs.
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
