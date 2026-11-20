import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Built once at build time into out/docs/search.json; the search box (app/layout.tsx)
// downloads it and searches in the browser, so the site needs no server.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source, { language: 'english' });
