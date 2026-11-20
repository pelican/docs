// bun test scripts/sync-release.test.mjs  (all tests: bun test)
// Which release sync-release.mjs picks from GitHub's list. No network: the list is written here.
import { expect, test } from 'bun:test';
import { pickRelease } from './sync-release.mjs';

const release = (tag, publishedAt, draft = false) => ({
  tag_name: tag,
  published_at: publishedAt,
  html_url: `https://github.com/pelican/panel/releases/tag/${tag}`,
  draft,
});

test('takes the newest release, whatever order GitHub lists them in', () => {
  expect(
    pickRelease([
      release('v1.0.0-rc.3', '2026-11-14T17:04:30Z'),
      release('v1.0.0-rc.4', '2026-11-19T18:47:34Z'),
      release('v1.0.0-rc.2', '2026-10-22T16:29:49Z'),
    ]),
  ).toEqual({
    version: '1.0.0-rc.4',
    released: '19 November 2026',
    url: 'https://github.com/pelican/panel/releases/tag/v1.0.0-rc.4',
  });
});

test('skips drafts, which have no publish date yet', () => {
  expect(pickRelease([release('v1.0.1', null, true), release('v1.0.0-rc.4', '2026-11-19T18:47:34Z')]).version).toBe(
    '1.0.0-rc.4',
  );
});

test('reads the date in UTC', () => {
  expect(pickRelease([release('v1.0.0', '2026-11-19T23:30:00Z')]).released).toBe('19 November 2026');
});

test('gives null when there is no published release', () => {
  expect(pickRelease([])).toBeNull();
  expect(pickRelease([release('v1.0.1', null, true)])).toBeNull();
});
