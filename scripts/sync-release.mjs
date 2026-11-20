#!/usr/bin/env bun
/**
 * Reads the latest Pelican Panel release from GitHub, for the homepage and llms.txt.
 *
 * When:   before every build (prebuild); by hand to see what the build will use
 * Writes: data/release.json ({} when GitHub can't be reached: the typed values in lib/home-data.ts are used)
 * Run:    bun run sync:release
 * Tests:  bun test scripts/sync-release.test.mjs
 *
 * Never fails the build: no network, a rate limit or a 5-second timeout just means the fallback.
 * GITHUB_TOKEN, when set (CI sets it), raises GitHub's rate limit.
 */
import { join } from 'node:path';

const OUT = join(import.meta.dir, '..', 'data', 'release.json');

/** The newest published release (drafts skipped, prereleases kept), or null. */
export function pickRelease(releases) {
  const latest = releases
    .filter((release) => !release.draft && release.published_at)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  if (!latest) return null;

  return {
    version: latest.tag_name.replace(/^v/, ''), // "v1.0.0-rc.4" → "1.0.0-rc.4"
    released: new Date(latest.published_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    url: latest.html_url,
  };
}

if (import.meta.main) {
  let release = null;
  try {
    const response = await fetch('https://api.github.com/repos/pelican/panel/releases?per_page=10', {
      headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    release = pickRelease(await response.json());
  } catch (error) {
    console.warn(`release: using the typed version in lib/home-data.ts (${error.message})`);
  }
  await Bun.write(OUT, `${JSON.stringify(release ?? {}, null, 2)}\n`);
  if (release) console.log(`release: pelican/panel ${release.version}, ${release.released}`);
}
