// bun test scripts/sync-release.test.mjs  (all tests: bun test)
// Which release sync-release picks (drafts skipped, prereleases kept, newest first, `v` stripped)
// and that every failure falls back to home-data.ts's typed values. fetch is stubbed: no network.
import { describe, expect, test } from 'bun:test';
import { formatDate, latestRelease, pickRelease } from './sync-release.mjs';

const rel = (tag, publishedAt, extra = {}) => ({
  tag_name: tag,
  published_at: publishedAt,
  html_url: `https://github.com/pelican/panel/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  ...extra,
});

describe('pickRelease', () => {
  test('takes the newest by published date, whatever order the list is in', () => {
    const picked = pickRelease([
      rel('v1.0.0-rc.3', '2026-11-14T17:04:30Z'),
      rel('v1.0.0-rc.4', '2026-11-19T18:47:34Z'),
      rel('v1.0.0-rc.2', '2026-10-22T16:29:49Z'),
    ]);
    expect(picked).toEqual({
      version: '1.0.0-rc.4',
      released: '19 November 2026',
      url: 'https://github.com/pelican/panel/releases/tag/v1.0.0-rc.4',
      publishedAt: '2026-11-19T18:47:34Z',
    });
  });

  test('skips drafts, even newer ones', () => {
    const picked = pickRelease([
      rel('v1.0.0', null, { draft: true }),
      rel('v1.0.1', '2026-12-01T00:00:00Z', { draft: true }),
      rel('v1.0.0-rc.4', '2026-11-19T18:47:34Z'),
    ]);
    expect(picked.version).toBe('1.0.0-rc.4');
  });

  test('keeps prereleases', () => {
    const picked = pickRelease([
      rel('v1.0.0-rc.5', '2026-11-25T10:00:00Z', { prerelease: true }),
      rel('v1.0.0-rc.4', '2026-11-19T18:47:34Z'),
    ]);
    expect(picked.version).toBe('1.0.0-rc.5');
  });

  test('strips only a leading v', () => {
    expect(pickRelease([rel('v1.2.3', '2026-11-19T00:00:00Z')]).version).toBe('1.2.3');
    expect(pickRelease([rel('1.2.3', '2026-11-19T00:00:00Z')]).version).toBe('1.2.3');
  });

  test('throws on anything it should not trust', () => {
    expect(() => pickRelease({ message: 'API rate limit exceeded' })).toThrow('not a list');
    expect(() => pickRelease([])).toThrow('no published release');
    expect(() => pickRelease([rel('v1.0.0', null, { draft: true })])).toThrow('no published release');
    expect(() => pickRelease([rel('nightly <b>', '2026-11-19T00:00:00Z')])).toThrow('unexpected tag');
    expect(() =>
      pickRelease([rel('v1.0.0', '2026-11-19T00:00:00Z', { html_url: 'https://example.com/x' })]),
    ).toThrow('unexpected release URL');
  });
});

test('formatDate gives the day in UTC, like home-data.ts', () => {
  expect(formatDate('2026-10-22T16:29:49Z')).toBe('22 October 2026');
  expect(formatDate('2026-11-30T23:59:59Z')).toBe('30 November 2026');
});

describe('latestRelease', () => {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const collect = () => {
    const lines = [];
    return { lines, warn: (line) => lines.push(line) };
  };

  test('asks GitHub for the last 10 releases, with the token when there is one', async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return json([rel('v1.0.0-rc.4', '2026-11-19T18:47:34Z')]);
    };
    const release = await latestRelease({ fetchFn, token: 'tkn', warn: () => {} });
    expect(release.version).toBe('1.0.0-rc.4');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.github.com/repos/pelican/panel/releases?per_page=10');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tkn');
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  test('sends no Authorization header without a token', async () => {
    let headers;
    await latestRelease({
      fetchFn: async (_url, init) => {
        headers = init.headers;
        return json([rel('v1.0.0', '2026-11-19T00:00:00Z')]);
      },
      warn: () => {},
    });
    expect(headers.Authorization).toBeUndefined();
  });

  test('tries a network failure once more, then falls back with one line', async () => {
    let calls = 0;
    const { lines, warn } = collect();
    const release = await latestRelease({
      fetchFn: async () => {
        calls++;
        throw new Error('ECONNRESET');
      },
      retryDelayMs: 0,
      warn,
    });
    expect(release).toBeNull();
    expect(calls).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ECONNRESET');
  });

  test('uses the retry when it works', async () => {
    let calls = 0;
    const release = await latestRelease({
      fetchFn: async () => (++calls === 1 ? json({}, 502) : json([rel('v1.0.0-rc.4', '2026-11-19T18:47:34Z')])),
      retryDelayMs: 0,
      warn: () => {},
    });
    expect(calls).toBe(2);
    expect(release.version).toBe('1.0.0-rc.4');
  });

  test('a rate limit, bad JSON or no releases fall back at once, without a retry', async () => {
    for (const answer of [
      () => json({ message: 'API rate limit exceeded' }, 403),
      () => new Response('<html>oops</html>', { status: 200 }),
      () => json([]),
      () => json({ message: 'Not Found' }),
    ]) {
      let calls = 0;
      const { lines, warn } = collect();
      const release = await latestRelease({
        fetchFn: async () => {
          calls++;
          return answer();
        },
        retryDelayMs: 0,
        warn,
      });
      expect(release).toBeNull();
      expect(calls).toBe(1);
      expect(lines).toHaveLength(1);
    }
  });

  test('a request that hangs is cut off by the timeout', async () => {
    const { lines, warn } = collect();
    const started = Date.now();
    const release = await latestRelease({
      // Like fetch: rejects when the signal aborts.
      fetchFn: (_url, { signal }) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
      timeoutMs: 50,
      retryDelayMs: 0,
      warn,
    });
    expect(release).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(lines).toHaveLength(1);
  });
});
