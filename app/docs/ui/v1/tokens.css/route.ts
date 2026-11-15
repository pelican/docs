import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// /docs/ui/v1/tokens.css: ui/tokens.css as it is, for the Hub to copy.
// v1 is the shape of the file; bump the folder when a change would break a copy.
export const dynamic = 'force-static';

export async function GET() {
  const css = await readFile(join(process.cwd(), 'ui/tokens.css'), 'utf8');
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
