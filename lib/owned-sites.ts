/**
 * Websites Pelican owns. Links to them never show the "You're leaving
 * pelican.dev" dialog (see components/external-link-guard.tsx). The only
 * question is which tab they open in:
 *
 * | Link                                                 | Tab      |
 * | ---------------------------------------------------- | -------- |
 * | pelican.dev and *.pelican.dev (hub, …)               | same tab |
 * | ...except `newTabSubdomains` (demo)                  | new tab  |
 * | Pelican's places on other domains (`ownedElsewhere`) | new tab  |
 *
 * Everything else, including other people's GitHub profiles and repos, still
 * asks first.
 */

/** pelican.dev and its subdomains. */
export function isPelicanSite(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'pelican.dev' || host.endsWith('.pelican.dev');
}

/**
 * pelican.dev subdomains that open in a new tab instead of the same tab,
 * because they're a separate app people try out alongside this site, not more
 * pages of it. Exact hostnames, any path.
 */
export const newTabSubdomains = [
  'demo.pelican.dev', // the live demo panel
] as const;

/**
 * Pelican's places on other domains, as "host" (the whole site) or
 * "host/first/segments" (only URLs whose path starts with exactly those
 * segments). Segments are compared whole and case-insensitively, so
 * "github.com/pelican" matches github.com/pelican/panel but not
 * github.com/pelicanfoo or github.com/pelican-evil.
 */
export const ownedElsewhere = [
  'github.com/pelican', // github.com/pelican: verified org, blog = pelican.dev
  'github.com/pelican-eggs', // the eggs org, linked from pelican/panel
  'github.com/sponsors/pelican',
  'raw.githubusercontent.com/pelican',
  'raw.githubusercontent.com/pelican-eggs',
  'pelican-eggs.github.io', // the eggs site (pelican-eggs/pelican-eggs.github.io)
  'peli.nyc3.digitaloceanspaces.com', // Pelican's image storage (hub plugin screenshots)
  'discord.gg/pelican-panel', // the official community Discord invite
  'discord.com/invite/pelican-panel', // where that invite redirects
] as const;

/** True if `url` is one of `ownedElsewhere`. */
export function isOwnedElsewhere(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  return ownedElsewhere.some((entry) => {
    const [entryHost, ...entrySegments] = entry.toLowerCase().split('/');
    return entryHost === host && entrySegments.every((seg, i) => segments[i] === seg);
  });
}

/**
 * How a link to a Pelican-owned site opens: 'same-tab', 'new-tab', or null
 * when `url` isn't Pelican's (the caller asks first).
 */
export function ownedSiteTab(url: URL): 'same-tab' | 'new-tab' | null {
  const host = url.hostname.toLowerCase();
  if ((newTabSubdomains as readonly string[]).includes(host)) return 'new-tab';
  if (isPelicanSite(host)) return 'same-tab';
  if (isOwnedElsewhere(url)) return 'new-tab';
  return null;
}
