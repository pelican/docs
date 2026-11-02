import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Built once at build time into a static file; the search box downloads it
// and searches in the browser, so the site needs no server.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source, { language: 'english' });
