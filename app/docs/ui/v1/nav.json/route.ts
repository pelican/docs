import { siteNav } from '@/lib/nav';

// /docs/ui/v1/nav.json: ui/nav.json (the site header, footer and call to action),
// for the Hub to copy. v1 is the shape of the file.
export const dynamic = 'force-static';

export function GET() {
  return new Response(`${JSON.stringify(siteNav, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
