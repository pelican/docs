#!/usr/bin/env bun
/**
 * Reads the latest Pelican Panel release from GitHub, for the homepage and llms.txt.
 *
 * When:  before every build (prebuild); by hand to see what the build will use
 * Writes: data/release.json
 * Run:   bun run sync:release       (or: bun scripts/sync-release.mjs)
 * Tests: bun test scripts/sync-release.test.mjs  (with a stubbed fetch, no network)
 *
 * Asks the GitHub API for pelican/panel's last 10 releases and takes the newest published one
 * (prereleases count, drafts don't): its version (the tag without the leading `v`), the day it
 * was published ("19 November 2026") and its page. lib/home-data.ts reads data/release.json and
 * uses its typed values for anything the file doesn't have.
 *
 * It never fails or holds up the build: each request times out after 5 seconds and is tried at
 * most twice. On any failure (no network, rate limit, an error status, an answer that isn't a
 * list of releases) it prints one line and writes the file as it is in git, with no release in
 * it, so the build uses home-data.ts's typed values.
 *
 * Env: GITHUB_TOKEN (optional; CI sets it, it raises the rate limit), GITHUB_API (default
 * https://api.github.com; point it somewhere unreachable to try the fallback).
 */
import { join } from 'node:path';

export const REPO = 'pelican/panel';
export const OUT = join(import.meta.dir, '..', 'data', 'release.json');
export const TIMEOUT_MS = 5000;

/** What data/release.json holds when there is no live release (as committed in git). */
export const FALLBACK = {
  note: 'Written by scripts/sync-release.mjs before each build. Empty here: lib/home-data.ts uses its typed values.',
};

/** "2026-11-19T18:47:34Z" → "19 November 2026" (the day in UTC, like home-data.ts's dates). */
export function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

/**
 * The newest published release in a GitHub releases list: drafts skipped, prereleases kept,
 * newest by published_at. Throws if the list holds none, or isn't a list of releases.
 */
export function pickRelease(releases) {
  if (!Array.isArray(releases)) throw new Error('the answer is not a list of releases');
  const published = releases
    .filter((r) => r && !r.draft && typeof r.published_at === 'string' && !Number.isNaN(Date.parse(r.published_at)))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  const latest = published[0];
  if (!latest) throw new Error('no published release');
  const version = String(latest.tag_name ?? '').replace(/^v/, '');
  // It ends up in llms.txt and on the homepage: only a plain version is taken.
  if (!/^\d+\.\d+\.\d+[0-9A-Za-z.+-]*$/.test(version)) throw new Error(`unexpected tag ${JSON.stringify(latest.tag_name)}`);
  const url = String(latest.html_url ?? '');
  if (!url.startsWith(`https://github.com/${REPO}/releases/`)) throw new Error(`unexpected release URL ${JSON.stringify(url)}`);
  return { version, released: formatDate(latest.published_at), url, publishedAt: latest.published_at };
}

/** A failure worth one more try: the network, a timeout or a 5xx (not a rate limit or bad data). */
class RetryableError extends Error {}

/**
 * The latest release from the GitHub API, or null (with one line on `warn`) on any failure.
 * `fetchFn`, `api` and `token` are parameters so the tests can stub them.
 */
export async function latestRelease({
  fetchFn = fetch,
  api = 'https://api.github.com',
  token,
  timeoutMs = TIMEOUT_MS,
  retryDelayMs = 500,
  warn = console.warn,
} = {}) {
  const url = `${api.replace(/\/$/, '')}/repos/${REPO}/releases?per_page=10`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pelican-docs-build',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const once = async () => {
    let res;
    try {
      res = await fetchFn(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new RetryableError(error?.message ?? String(error));
    }
    if (res.status >= 500) throw new RetryableError(`${res.status} from GitHub`);
    if (!res.ok) throw new Error(`${res.status} from GitHub${res.status === 403 || res.status === 429 ? ' (rate limited?)' : ''}`);
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error('GitHub answered with something that is not JSON');
    }
    return pickRelease(body);
  };

  try {
    try {
      return await once();
    } catch (error) {
      if (!(error instanceof RetryableError)) throw error;
      await Bun.sleep(retryDelayMs);
      return await once();
    }
  } catch (error) {
    warn(`release: could not read the latest ${REPO} release (${error?.message ?? error}); using the typed version in lib/home-data.ts`);
    return null;
  }
}

async function main() {
  const release = await latestRelease({
    api: process.env.GITHUB_API || undefined,
    token: process.env.GITHUB_TOKEN || undefined,
  });
  await Bun.write(OUT, `${JSON.stringify(release ?? FALLBACK, null, 2)}\n`);
  if (release) console.log(`release: ${REPO} ${release.version}, ${release.released} → data/release.json`);
}

if (import.meta.main) {
  main().catch((error) => {
    // Only writing the file can get here: that is a real problem, so it fails the build.
    console.error(error);
    process.exit(1);
  });
}
