/**
 * Egg types and helpers that are safe to use in the browser. Nothing here
 * imports data/eggs.json, so a client component can use them without the
 * whole catalogue landing in its JavaScript. lib/eggs.ts re-exports all of it.
 */

export interface EggEntry {
  name: string;
  description: string;
  /** Raw egg file, as a panel imports it ("#" encoded as %23). */
  url: string;
  /** Default Docker image: the first one the egg lists, which the panel picks for new servers. */
  image: string | null;
  /** The other images on offer, in short: "Java 8–25", "3 images"; null when there is one. */
  imageNote: string | null;
  /** An icon built into the egg file, saved under /img/eggs. */
  icon: string | null;
  /** Panel features the egg turns on (keys of FEATURES). */
  features: string[];
  /** Its variables' env_variable names, for search. */
  vars: string[];
  /** The egg's page on Pelican Hub (variables, images, install script, Install to Panel). */
  hubUrl: string | null;
  /** Installs counted by Pelican Hub; null when the egg isn't on the Hub. */
  installs: number | null;
  /** When Pelican Hub last updated the egg (ISO date). */
  updatedAt: string | null;
}

export interface EggGame {
  slug: string;
  name: string;
  category: string;
  steamAppId: number | null;
  /** Wide picture for the /eggs cards: Steam store artwork, an original drawing, or its own egg's icon. */
  art: string | null;
  /**
   * Square icon for the homepage: a local copy of the publisher's Steam icon
   * (/img/games/*.webp), an original drawing (/img/games/*.svg), its own egg's
   * icon (/img/eggs/*), or the address of Steam's 32px community icon.
   */
  icon: string | null;
  eggs: EggEntry[];
}

/** Usual default ports for well-known games. The panel assigns real ports per server. */
export const USUAL_PORTS: Record<string, string> = {
  minecraft: '25565',
  'minecraft-bedrock': '19132',
  rust: '28015',
  palworld: '8211',
  valheim: '2456',
  'project-zomboid': '16261',
  enshrouded: '15636',
  satisfactory: '7777',
  'counter-strike-2': '27015',
  '7-days-to-die': '26900',
  terraria: '7777',
  factorio: '34197',
};

/** The egg file on GitHub (for reading), from its raw download URL. */
export function eggSourceUrl(rawUrl: string): string {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+)$/.exec(rawUrl);
  return m ? `https://github.com/${m[1]}/${m[2]}/blob/${m[3]}/${m[4]}` : rawUrl;
}

/** What a server runs on, worked out from the egg's default Docker image. Order is the filter order. */
export const RUNTIMES = [
  { id: 'java', label: 'Java' },
  { id: 'steamcmd', label: 'SteamCMD' },
  { id: 'wine', label: 'Wine / Proton' },
  { id: 'game', label: 'Game image' },
  { id: 'dotnet', label: '.NET / Mono' },
  { id: 'node', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'bun', label: 'Bun' },
  { id: 'other', label: 'Debian / other' },
] as const;

export type RuntimeId = (typeof RUNTIMES)[number]['id'];

export function runtimeOf(image: string | null): RuntimeId {
  const img = (image ?? '').toLowerCase();
  const tag = img.slice(img.lastIndexOf(':') + 1);
  if (/^(wine|proton)/.test(tag)) return 'wine'; // yolks:wine_latest, steamcmd:proton
  if (img.includes('steamcmd')) return 'steamcmd';
  if (tag.startsWith('java')) return 'java';
  if (/^(dotnet|mono)/.test(tag)) return 'dotnet';
  if (/^node/.test(tag)) return 'node';
  if (tag.startsWith('python')) return 'python';
  if (tag.startsWith('bun')) return 'bun';
  // Images made for one game or engine (parkervcp/games:source, yolks:games_source…).
  if (/\/games:/.test(img) || tag.startsWith('games_')) return 'game';
  return 'other';
}

/** Panel features an egg can turn on. Each watches the console for a known problem and offers a fix. */
export const FEATURES = [
  { id: 'eula', label: 'EULA prompt', hint: 'Offers to accept the Minecraft EULA when the server stops for it' },
  { id: 'java_version', label: 'Java version switch', hint: 'Offers another Java image when the server needs one' },
  { id: 'gsl_token', label: 'Steam token prompt', hint: 'Asks for a new Steam game server token when it expires' },
  { id: 'steam_disk_space', label: 'Disk space warning', hint: 'Explains when SteamCMD runs out of disk space' },
  { id: 'pid_limit', label: 'Process limit warning', hint: 'Explains when the server hits its process limit' },
] as const;

/** Lower-cased words of a search; an egg matches when its text holds every one. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}
