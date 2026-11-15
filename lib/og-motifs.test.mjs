// bun test lib/og-motifs.test.mjs
// Every share-image motif in lib/og-motifs.ts quotes text that is on its page: checkedMotif drops
// one that doesn't (only a warning in the build log), so the card would lose its picture quietly.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkedMotif, DOCS_MOTIFS } from './og-motifs.ts';

const DOCS = join(import.meta.dir, '..', 'content', 'docs');

/** The page's MDX for a motif key (the page's slugs joined with "/", "" for the docs index). */
function pageSource(key) {
  for (const file of [key ? `${key}.mdx` : 'index.mdx', join(key, 'index.mdx')]) {
    const path = join(DOCS, file);
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  return null;
}

describe('share image motifs', () => {
  for (const key of Object.keys(DOCS_MOTIFS)) {
    test(`${key || '(index)'}: its page exists and still has the quoted text`, () => {
      const mdx = pageSource(key);
      expect(mdx).not.toBeNull();
      expect(checkedMotif(key, mdx)).toBeDefined();
    });
  }
});
