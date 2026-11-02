/**
 * Facts the homepage shows. Everything here was read from a real source on
 * 2 November 2026; the source is noted beside each block. Update it when the
 * numbers move (a new release, a new plugin count) rather than guessing.
 */

export const project = {
  // github.com/pelican/panel/releases
  version: '1.0.0-rc.2',
  released: '22 October 2026',
  // github.com/pelican/panel (stargazers, contributors on the default branch)
  stars: 2419,
  contributors: 235,
  since: 'March 2024',
  // hub.pelican.dev/plugins ("Showing 50 of 91 plugins")
  plugins: 91,
  asOf: 'November 2026',
  license: 'AGPL-3.0',
  // releases published between 2 Nov 2025 and 2 Nov 2026 (beta28 … rc.2)
  releasesInYear: 13,
} as const;

/* ---- What's been built since the fork --------------------------------------------
 * Each pull request checked on GitHub (pelican/panel); release is where it shipped.
 */
export const builtSinceFork: { title: string; ref: string; prs: number[]; icon: string }[] = [
  { title: 'A rebuilt UI on Filament v5', ref: 'beta34', prs: [2315], icon: 'layers' },
  { title: 'Plugins, without touching core', ref: 'beta30', prs: [1866], icon: 'plug' },
  { title: 'Passkeys. Passwords optional.', ref: 'beta35, 36', prs: [2192, 2318], icon: 'key' },
  { title: 'Backups, wherever you want them', ref: 'beta36', prs: [2125], icon: 'database' },
  { title: 'A real code editor, one-click SFTP', ref: 'beta30, 37', prs: [2013, 2500], icon: 'code' },
  { title: "Plugins can crash. The panel won't.", ref: 'rc.2', prs: [2640], icon: 'shield' },
];

/* ---- People in the last five releases (beta36 … rc.2), bots excluded ------------- */
export const recentContributors = [
  'lancepioch', 'Boy132', 'rmartinoscar', 'JoanFo1456', 'notAreYouScared', 'apple050620312', 'kazaminosuke',
  'LegacyAngel2K9', 'xLaugh', 'wu-zuan', 'morbyne', 'lotus64yt', 'l1monenko', 'hardcorefactions', 'execsuroot',
  'duckducktw', 'dualfroz', 'barnabehvrd', 'N7z', 'Fritztechnic', 'ByCoquito',
];

/* ---- Releases ----------------------------------------------------------------
 * From GitHub's compare view between consecutive tags of pelican/panel. Titles
 * are the commit titles, lightly shortened; `pr` is the pull request number.
 */
export interface Change {
  pr: number;
  title: string;
  area: string;
  authors: string[];
}

export interface Release {
  tag: string;
  label: string;
  date: string;
  changes: Change[];
  total: number;
}

export const releases: Release[] = [
  {
    tag: 'v1.0.0-rc.2',
    label: 'rc.2',
    date: '22 Oct',
    total: 19,
    changes: [
      { pr: 2640, title: 'Keep a crashing plugin from taking down the panel', area: 'Plugins', authors: ['lancepioch'] },
      { pr: 2663, title: 'Fire power webhooks for dashboard power actions', area: 'Webhooks', authors: ['lancepioch'] },
      { pr: 2650, title: 'Always load themes and language packs on all panels', area: 'Themes', authors: ['Boy132'] },
      { pr: 2661, title: 'Fix importing YAML egg files', area: 'Eggs', authors: ['lancepioch'] },
      { pr: 2651, title: 'Fix keybinds in the file editor', area: 'Files', authors: ['Boy132'] },
      { pr: 2672, title: 'Exclude suspended servers from node connectivity checks', area: 'Nodes', authors: ['notAreYouScared'] },
    ],
  },
  {
    tag: 'v1.0.0-rc.1',
    label: 'rc.1',
    date: '10 Oct',
    total: 60,
    changes: [
      { pr: 2498, title: 'A plugin system for webhooks', area: 'Webhooks', authors: ['JoanFo1456'] },
      { pr: 2510, title: 'Concurrent S3 part uploads for backups', area: 'Backups', authors: ['barnabehvrd'] },
      { pr: 2514, title: 'Tighten passkey origin checks and log every failure', area: 'Security', authors: ['lancepioch'] },
      { pr: 2511, title: 'An option to hide allocation ports', area: 'Network', authors: ['ByCoquito'] },
      { pr: 2531, title: 'Queue health monitoring', area: 'Health', authors: ['LegacyAngel2K9'] },
      { pr: 2563, title: 'Raise the support floor to PHP 8.4', area: 'Requirements', authors: ['lancepioch'] },
    ],
  },
  {
    tag: 'v1.0.0-beta38',
    label: 'beta38',
    date: '16 Aug',
    total: 3,
    changes: [
      { pr: 2494, title: 'Generate API docs from the request rules with Scramble', area: 'API', authors: ['Fritztechnic'] },
      { pr: 2516, title: 'Point the yolks references at the image that exists', area: 'Eggs', authors: ['lancepioch'] },
      { pr: 2515, title: 'Rename pelican-dev references to pelican', area: 'Project', authors: ['lancepioch'] },
    ],
  },
  {
    tag: 'v1.0.0-beta37',
    label: 'beta37',
    date: '13 Aug',
    total: 18,
    changes: [
      { pr: 2500, title: 'An SFTP button in the file list', area: 'Files', authors: ['Boy132'] },
      { pr: 2462, title: 'Enable opcache and tune PHP in the Docker image', area: 'Docker', authors: ['lancepioch'] },
      { pr: 2508, title: 'Fix "origin not allowed" for passkeys', area: 'Security', authors: ['JoanFo1456'] },
      { pr: 2441, title: 'Fix the server grid card freezing', area: 'Interface', authors: ['apple050620312'] },
      { pr: 2504, title: 'Lower the default backup part size to 128 MiB', area: 'Backups', authors: ['Boy132'] },
    ],
  },
  {
    tag: 'v1.0.0-beta36',
    label: 'beta36',
    date: '5 Aug',
    total: 37,
    changes: [
      { pr: 2192, title: 'Passkeys', area: 'Security', authors: ['JoanFo1456'] },
      { pr: 2125, title: 'Backup hosts', area: 'Backups', authors: ['Boy132'] },
      { pr: 2449, title: 'DB_SCHEMA support for PostgreSQL', area: 'Database', authors: ['l1monenko'] },
      { pr: 2419, title: 'Fix CPU pinning showing as disabled for thread 0', area: 'Admin', authors: ['wu-zuan'] },
      { pr: 2425, title: 'Fix a stale plugin snapshot on install', area: 'Plugins', authors: ['kazaminosuke'] },
    ],
  },
];

/* ---- Hub plugins ---------------------------------------------------------------
 * The three most-downloaded plugins on hub.pelican.dev/plugins whose Hub page has a
 * real screenshot of the plugin in the panel, read on 2 November 2026. (Player
 * Counter, #3 by downloads, only has a title banner there, so it is skipped.)
 * Name, author, Official label and downloads are as the Hub shows them.
 *
 * `shot` is a screenshot from the plugin's Hub page ("Screenshots" tab), resized to
 * WebP in public/img/plugins/, cropped to the plugin's own part of the page (crop box
 * noted per plugin, in original pixels). `original` is the untouched full-size file
 * on Pelican's storage (the lightbox shows it); `position` is the thumbnail's
 * object-position inside its 16:10 frame.
 * The screenshots belong to the plugins' authors.
 */
const shot = (id: string) => `https://peli.nyc3.digitaloceanspaces.com/plugin-screenshots/${id}.png`;

export interface HubPlugin {
  name: string;
  slug: string;
  author: string;
  official: boolean;
  downloads: number;
  desc: string;
  shot: {
    src: string;
    width: number;
    height: number;
    position: string;
    alt: string;
    original: { src: string; width: number; height: number };
  };
}

export const hubPlugins: HubPlugin[] = [
  {
    name: 'Modpack Manager',
    slug: 'modpack-manager',
    author: 'cosmii02',
    official: false,
    downloads: 1485,
    desc: 'Browse and install modpacks from CurseForge, Modrinth, FTB and ATLauncher.',
    shot: {
      src: '/img/plugins/modpack-manager.webp',
      // crop 1520×950 at 680,0 of 2560×1440
      width: 1200,
      height: 750,
      position: '50% 0',
      original: { src: shot('C1pTmroQlMI0aeWfE6idqDIdzh9vcnKRHUnCdglH'), width: 2560, height: 1440 },
      alt: "Modpack Manager's Modpack Browser on a server: the active modpack, a search across CurseForge, Modrinth, FTB and ATLauncher, and popular modpacks with Install buttons.",
    },
  },
  {
    name: 'Minecraft Modrinth',
    slug: 'minecraft-modrinth',
    author: 'Boy132',
    official: true,
    downloads: 1122,
    desc: 'Download, update and manage Minecraft mods and plugins from Modrinth.',
    shot: {
      src: '/img/plugins/minecraft-modrinth.webp',
      // crop 1472×920 at 340,0 of 1875×920
      width: 1200,
      height: 750,
      position: '0 0',
      original: { src: shot('ZzMBugIE6suG0UrRpsJ9kIC9lbLSmM8sK71gObEd'), width: 1875, height: 920 },
      alt: 'The Minecraft Plugins page on a server: Minecraft version, loader, and a list of Modrinth plugins with their authors, downloads and install buttons.',
    },
  },
  {
    name: 'System Status Monitor',
    slug: 'system-status-monitor',
    author: '✖_𝕠𝕝𝕝𝕚',
    official: false,
    downloads: 676,
    desc: 'CPU, memory, disk and uptime of the panel machine, live.',
    shot: {
      src: '/img/plugins/system-status-monitor.webp',
      // crop 848×530 at 0,0 of 1497×530
      width: 848,
      height: 530,
      position: '0 0',
      original: { src: shot('8Hg20mRr0sFpIHccPFNA5veCQUeD3C5SULPGjogv'), width: 1497, height: 530 },
      alt: 'The panel dashboard (in French) with System Status Monitor: CPU, memory and disk usage bars.',
    },
  },
];

/* ---- Activity --------------------------------------------------------------------
 * Commits on main per month, from the GitHub commits API for pelican/panel.
 */
export const monthlyCommits: { month: string; label: string; commits: number }[] = [
  { month: '2025-09', label: 'Sep 2025', commits: 40 },
  { month: '2025-10', label: 'Oct 2025', commits: 36 },
  { month: '2025-11', label: 'Nov 2025', commits: 52 },
  { month: '2025-12', label: 'Dec 2025', commits: 51 },
  { month: '2026-01', label: 'Jan 2026', commits: 41 },
  { month: '2026-02', label: 'Feb 2026', commits: 56 },
  { month: '2026-03', label: 'Mar 2026', commits: 4 },
  { month: '2026-04', label: 'Apr 2026', commits: 12 },
  { month: '2026-05', label: 'May 2026', commits: 22 },
  { month: '2026-06', label: 'Jun 2026', commits: 33 },
  { month: '2026-07', label: 'Jul 2026', commits: 28 },
  { month: '2026-08', label: 'Aug 2026', commits: 50 },
  { month: '2026-09', label: 'Sep 2026', commits: 38 },
  { month: '2026-10', label: 'Oct 2026', commits: 48 },
];
