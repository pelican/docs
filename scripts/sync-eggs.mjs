#!/usr/bin/env node
/**
 * Builds data/eggs.json for the /eggs page and the homepage games strip.
 *
 * Source: the egg index that pelican-eggs regenerates every day from its egg
 * repositories (pelican-eggs/pelican-eggs.github.io, content/pelican.json).
 * For each egg it reads the egg file for its Docker image and any icon built
 * into the egg. Games are grouped by their folder in the egg repository (or by
 * GAME_BY_PATH, for folders that hold eggs for several games) and
 * looked up on Steam by exact name for their store artwork, the same way the
 * community "Egg Images" plugin does. Steam results are kept in the output
 * file, so later runs only look up games they haven't seen.
 *
 * Square icons (the `icon` field, used by the homepage games strip) come from
 * the icon each game's publisher uploads to Steam: the app's client icon (a
 * Windows .ico, up to 512px) or its 32px community icon, both on Steam's
 * community CDN. The hashes in their addresses come from the public SteamCMD
 * info API (api.steamcmd.net), so no API key is needed. Games on the homepage
 * (FEATURED in lib/eggs.ts) get a small local copy in public/img/games; the
 * rest keep the address of the 32px icon. Games that aren't on Steam use an
 * original drawing from public/img/games, or an icon built into their own egg.
 *
 * Each egg file also gives its default Docker image (the first one it lists),
 * the panel features it uses and its variable names (for search). Pelican Hub's
 * public API (hub.pelican.dev/api/eggs) is matched to the eggs by uuid for each
 * egg's Hub page, install count and last update. When the Hub can't be reached,
 * the values from the previous run are kept.
 *
 *   node scripts/sync-eggs.mjs            # refresh everything
 *   node scripts/sync-eggs.mjs --if-online # used by `pnpm build`: never fails the build
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'data/eggs.json');
const ICONS = join(root, 'public/img/eggs');
const GAME_ICONS = join(root, 'public/img/games');
const INDEX_URL = 'https://raw.githubusercontent.com/pelican-eggs/pelican-eggs.github.io/main/content/pelican.json';
const HUB_API = 'https://hub.pelican.dev/api/eggs';
const STEAM_ICON_CDN = 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps';
/** Largest side of a saved icon: 64 CSS pixels on a 2x screen. Smaller sources are not enlarged. */
const ICON_PX = 128;
const soft = process.argv.includes('--if-online');

// Original drawings (public/img/games) for games that have no Steam page.
// Nothing of the publisher's is copied in; the script never overwrites these.
const DRAWN_ICONS = {
  minecraft: '/img/games/minecraft.svg',
  'minecraft-bedrock': '/img/games/minecraft.svg',
};

const CATEGORY = {
  Minecraft: 'minecraft',
  'Games Steamcmd': 'games',
  'Games Standalone': 'games',
  Chatbots: 'bots',
  Voice: 'voice',
  Database: 'databases',
  Software: 'software',
  Storage: 'storage',
  Monitoring: 'monitoring',
  Generic: 'generic',
};
const CATEGORY_NAMES = {
  games: 'Games',
  minecraft: 'Minecraft',
  bots: 'Chat bots',
  voice: 'Voice',
  databases: 'Databases',
  software: 'Software',
  storage: 'Storage',
  monitoring: 'Monitoring',
  generic: 'Generic',
};

// Folder names that don't read or search well, mapped to the game's real name.
// Steam artwork is only used when this name matches a store entry exactly, so a
// wrong guess here means "no artwork", never the wrong game's artwork.
const STEAM_NAME = {
  gmod: "Garry's Mod",
  ark_survival_evolved: 'ARK: Survival Evolved',
  ark_survival_ascended: 'ARK: Survival Ascended',
  lotr_moria: 'The Lord of the Rings: Return to Moria',
  mount_blade_II_bannerlord: 'Mount & Blade II: Bannerlord',
  sonsoftheforest: 'Sons Of The Forest',
  scpsl: 'SCP: Secret Laboratory',
  team_fortress_2: 'Team Fortress 2',
  team_fortress_2_classic: 'Team Fortress 2 Classic',
  left4dead_2: 'Left 4 Dead 2',
  left4dead: 'Left 4 Dead',
  '7_days_to_die': '7 Days to Die',
  nmrih: 'No More Room in Hell',
  rdr: 'Red Dead Redemption 2',
  // Left as one group on purpose: one open-source project whose single release ships
  // its Red Alert, Tiberian Dawn and Dune 2000 mods, and needs none of the originals.
  openra: 'OpenRA',
  beamng: 'BeamNG.drive',
  eft: 'Escape from Tarkov (SPT)',
  // Both eggs run any GoldSrc game you point them at (CS 1.6 by default), so no one game's artwork.
  hlds_server: 'Custom GoldSrc engine game (HLDS)',
  cs2d: 'CS2D',
  ksp: 'Kerbal Space Program',
  // The same game in both repos (games-standalone/ddracenetwork, games-steamcmd/ddnet); "DDNet" on Steam.
  ddracenetwork: 'DDNet',
  ddnet: 'DDNet',
  // Zandronum is a multiplayer port of the classic Doom and Doom II, not the 2016 "DOOM" a bare "Doom" matched.
  doom: 'Doom + Doom II',
  empyrion: 'Empyrion - Galactic Survival',
  fof: 'Fistful of Frags',
  foundry_vtt: 'Foundry Virtual Tabletop',
  minetest: 'Luanti',
  mohaa: 'Medal of Honor: Allied Assault',
  neosvr: 'Neos VR',
  neverwinter_nights_ee: 'Neverwinter Nights: Enhanced Edition',
  openarena: 'OpenArena',
  openrct2: 'OpenRCT2',
  pavlov_vr: 'Pavlov',
  post_scriptum: 'Squad 44',
  sourcecoop: 'Source Co-op',
  stormworks: 'Stormworks: Build and Rescue',
  subnautica_nitrox_mod: 'Subnautica',
  the_ship: 'The Ship: Murder Party',
  thebattleforwesnoth: 'The Battle for Wesnoth',
  trackmania2020: 'Trackmania',
  urbanterror: 'Urban Terror',
  venice_unleashed: 'Battlefield 3 (Venice Unleashed)',
  vintage_story: 'Vintage Story',
  world_of_padman: 'World of Padman',
  citadel: 'Citadel: Forged with Fire',
  classicube: 'ClassiCube',
  hogwarp: 'Hogwarts Legacy',
  holdfast: 'Holdfast: Nations At War',
  losangelescrimes: 'Los Angeles Crimes',
  supertuxkart: 'SuperTuxKart',
  conan_exiles: 'Conan Exiles',
  wine: 'Windows games (Wine)',
  ftl_tachyon: 'FTL: Tachyon',
  tiny_block: 'Tiny Block',
  leaguesandbox: 'LeagueSandbox',
  nazi_zombies_portable: 'Nazi Zombies: Portable',
  daggerfall_online: 'Daggerfall Online',
  path_of_titans: 'Path of Titans',
  hytale: 'Hytale',
  clone_hero: 'Clone Hero',
  custom_source_engine: 'Custom Source engine game',
};

// Folders that hold eggs for more than one game. Keys are "<repo>/<path in the repo>/"
// prefixes (the longest match wins); values are the game the egg is for. Variants
// of one game (Rust Autowipe, Valheim Plus, Terraria TShock…) don't need an entry.
// An egg in one of these folders that no entry covers is shown on its own and the
// sync warns, so a new mod can't land under the wrong game.
const GAME_BY_PATH = {
  // games-standalone/gta: multiplayer mods for different Grand Theft Auto games.
  'games-standalone/gta/fivem/': 'Grand Theft Auto V', // fivem.net: "a modification for Grand Theft Auto V"
  'games-standalone/gta/altv/': 'Grand Theft Auto V', // altv.mp: "multiplayer modification for Grand Theft Auto: V"
  'games-standalone/gta/ragemp/': 'Grand Theft Auto V', // RAGE Multiplayer: "multiplayer modification for Grand Theft Auto V" (egg README)
  'games-standalone/gta/ragecoop/': 'Grand Theft Auto V', // RAGECOOP-V: co-op for GTA V story mode, built on ScriptHookVDotNet
  'games-standalone/gta/samp/': 'Grand Theft Auto: San Andreas', // SA-MP: mod for the PC version of GTA: San Andreas
  'games-standalone/gta/openmp/': 'Grand Theft Auto: San Andreas', // open.mp: GTA San Andreas server, compatible with SA-MP
  'games-standalone/gta/mtasa/': 'Grand Theft Auto: San Andreas', // mtasa.com: "Multi Theft Auto: San Andreas"
  // gtaconnected.com: "Works on GTA III, Vice City, San Andreas, and GTA IV". It is
  // for no single game, so it is listed under its own name (with the games it runs on)
  // rather than under one of them.
  'games-standalone/gta/gtac/': 'GTA Connected (GTA III, Vice City, San Andreas, IV)',
  // games-steamcmd/counter_strike: two different Valve games.
  'games-steamcmd/counter_strike/counter_strike_2/': 'Counter-Strike 2',
  'games-steamcmd/counter_strike/counter_strike_source/': 'Counter-Strike: Source',
  // games-steamcmd/truck-simulator: SCS Software's two truck games, each with its own dedicated server.
  'games-steamcmd/truck-simulator/euro-truck-simulator2/': 'Euro Truck Simulator 2',
  'games-steamcmd/truck-simulator/american-truck-simulator/': 'American Truck Simulator',
  // games-steamcmd/arma: two Bohemia games (Reforger is its own game, not an Arma 3 version).
  'games-steamcmd/arma/arma3/': 'Arma 3',
  'games-steamcmd/arma/arma_reforger/': 'Arma Reforger',
  // games-standalone/cubeengine: two different free shooters built on the Cube engines.
  'games-standalone/cubeengine/assaultcube/': 'AssaultCube',
  'games-standalone/cubeengine/cube2/': 'Cube 2: Sauerbraten',
  // minecraft/proxy: Waterdog PE is a proxy for Bedrock Edition ("for Minecraft: Bedrock Edition").
  'minecraft/proxy/bedrock/': 'Minecraft: Bedrock Edition',
};
const MIXED_FOLDERS = new Set(
  Object.keys(GAME_BY_PATH)
    .filter((key) => key.startsWith('games-'))
    .map((key) => key.split('/').slice(0, 2).join('/') + '/'),
);
const gameByPath = (path) =>
  Object.entries(GAME_BY_PATH)
    .filter(([prefix]) => path.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;

// Display names whose Steam store entry is called something else. Only the
// artwork lookup uses these, and it still needs an exact match.
const STEAM_STORE_NAME = {
  // Since 2025 Steam sells GTA V as "Enhanced" and "Legacy"; both are the game these mods run on.
  'Grand Theft Auto V': 'Grand Theft Auto V Enhanced',
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const humanize = (s) =>
  s
    .replace(/[_-]+/g, ' ')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

async function getText(url, ms = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const n = i++;
        await fn(items[n], n);
      }
    }),
  );
}

/** Panel features the /eggs filters know about (lib/egg-helpers.ts has their labels). */
const FEATURES = new Set(['eula', 'java_version', 'gsl_token', 'steam_disk_space', 'pid_limit']);

/** Runtimes whose version range is worth naming when an egg offers several images. */
const IMAGE_FAMILY = {
  java: 'Java',
  nodejs: 'Node.js',
  node: 'Node.js',
  python: 'Python',
  dotnet: '.NET',
  mariadb: 'MariaDB',
  mongodb: 'MongoDB',
  postgres: 'PostgreSQL',
  redis: 'Redis',
};

/** "Java 8–25" for an egg offering java_8 … java_25, "3 images" otherwise; null for one image. */
function imageNote(images) {
  if (images.length < 2) return null;
  const tags = images.map((image) => /:([a-z]+)_(\d+(?:\.\d+)*)$/.exec(image));
  const family = tags[0] && IMAGE_FAMILY[tags[0][1]];
  if (family && tags.every((t) => t && IMAGE_FAMILY[t[1]] === family)) {
    const versions = tags.map((t) => t[2]).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    return `${family} ${versions[0]}–${versions.at(-1)}`;
  }
  return `${images.length} images`;
}

const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');

/** The indented lines under a top-level YAML key ("docker_images:", "features:"). */
function yamlBlock(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.replace(/\s+$/, '') === `${key}:`);
  if (start < 0) return [];
  const block = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    if (line.trim()) block.push(line);
  }
  return block;
}

/** Pull what the page needs out of an egg file (JSON or YAML, either format). */
function readEgg(text) {
  const out = { uuid: null, images: [], icon: null, features: [], vars: [] };
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* YAML: read the few fields we need with patterns */
  }
  if (data) {
    const egg = data.egg ?? data;
    out.uuid = egg.uuid ?? null;
    // The first image is the default: the panel picks it for new servers.
    out.images = Object.values(egg.docker_images ?? {}).filter((v) => typeof v === 'string');
    if (!out.images.length && egg.image_docker) out.images = [egg.image_docker];
    out.features = Array.isArray(egg.features) ? egg.features : [];
    out.vars = (Array.isArray(egg.variables) ? egg.variables : []).map((v) => v?.env_variable);
    if (typeof egg.image === 'string' && egg.image.startsWith('data:image/')) out.icon = egg.image;
  } else {
    out.uuid = /^uuid:\s*['"]?([0-9a-f-]{36})/m.exec(text)?.[1] ?? null;
    // "  'Java 25': 'ghcr.io/…:java_25'"; keys may hold a colon too ("ghcr.io/…:wine_latest: ghcr.io/…").
    out.images = yamlBlock(text, 'docker_images')
      .map((line) => unquote(line.slice(line.lastIndexOf(': ') + 2)))
      .filter(Boolean);
    out.features = yamlBlock(text, 'features').map((line) => /^\s+-\s+(.+)$/.exec(line)?.[1]).map((f) => f && unquote(f));
    out.vars = [...text.matchAll(/^\s*(?:-\s+)?env_variable:\s*['"]?([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
    const icon = /^image:\s*['"]?(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+)/m.exec(text);
    if (icon) out.icon = icon[1];
  }
  out.features = [...new Set(out.features.filter((f) => FEATURES.has(f)))].sort();
  out.vars = [...new Set(out.vars.filter((v) => typeof v === 'string' && v))];
  return out;
}

/** Every egg on Pelican Hub, by uuid. Throws when any page fails, so a half list is never used. */
async function hubEggs() {
  const byUuid = new Map();
  let last = 1;
  for (let page = 1; page <= last; page++) {
    const data = JSON.parse(await getText(`${HUB_API}?per_page=100&page=${page}&sort=name`, 20000));
    if (!Array.isArray(data.data)) throw new Error(`unexpected Hub answer on page ${page}`);
    last = Math.min(Number(data.last_page) || 1, 50);
    for (const egg of data.data) {
      if (!egg.uuid) continue;
      if (!byUuid.has(egg.uuid)) byUuid.set(egg.uuid, []);
      byUuid.get(egg.uuid).push(egg);
    }
  }
  return byUuid;
}

/** "#" is legal in a repo path but ends a URL ("…/generic/…/c#/egg.yaml"), so encode it. */
const encodeEggUrl = (url) => url.replace(/#/g, '%23');

/** Steam store search, keeping only an exact name match. */
async function steamLookup(name) {
  // Steam's search finds nothing for a term with "+" in it ("DOOM + DOOM II"); the match below ignores it anyway.
  const term = name.replace(/\s*\+\s*/g, ' ');
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=us&l=en`;
  const data = JSON.parse(await getText(url, 10000));
  const hit = (data.items ?? []).find((item) => norm(item.name) === norm(name));
  if (!hit) return { steamAppId: null, art: null };
  return { steamAppId: hit.id, art: (await steamHeader(hit.id)) ?? hit.tiny_image ?? null };
}

/** The 460×215 store header (its address has a hash, so it must be asked for). */
async function steamHeader(appId) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`;
    const data = JSON.parse(await getText(url, 10000));
    return data[appId]?.data?.header_image ?? null;
  } catch {
    return null;
  }
}

async function getBuffer(url, ms = 20000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The homepage's games, read from lib/eggs.ts so the list lives in one place. */
function featuredSlugs() {
  const source = readFileSync(join(root, 'lib/eggs.ts'), 'utf8');
  const list = /export const FEATURED\s*=\s*\[([^\]]*)\]/.exec(source)?.[1];
  if (!list) {
    console.warn('eggs: FEATURED not found in lib/eggs.ts; no local icons this run');
    return new Set();
  }
  return new Set([...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]));
}

/** An icon built into the game's own egg (not a mod loader's or proxy's logo). */
function ownEggIcon(game) {
  return game.eggs.find((e) => e.icon && (game.eggs.length === 1 || norm(e.name) === norm(game.name)))?.icon ?? null;
}

/** Hashes of an app's Steam icons, from the public SteamCMD info API. */
async function steamIconHashes(appId) {
  const data = JSON.parse(await getText(`https://api.steamcmd.net/v1/info/${appId}`, 15000));
  const common = data?.data?.[appId]?.common ?? {};
  return { icon: common.icon ?? null, clienticon: common.clienticon ?? null };
}

/**
 * The largest picture in a Windows .ico file: PNG bytes, or raw RGBA decoded
 * from the older bitmap format (sharp reads neither .ico nor bitmaps).
 */
function largestIcoFrame(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const isPng = (d) => d.length > 24 && d.readUInt32BE(0) === 0x89504e47;
  let best = null;
  for (let i = 0, count = buf.readUInt16LE(4); i < count; i++) {
    const at = 6 + i * 16;
    if (at + 16 > buf.length) break;
    const size = buf.readUInt32LE(at + 8);
    const offset = buf.readUInt32LE(at + 12);
    const data = buf.subarray(offset, offset + size);
    if (data.length < 40) continue;
    const width = isPng(data) ? data.readUInt32BE(16) : data.readInt32LE(4);
    const bpp = isPng(data) ? 32 : data.readUInt16LE(14);
    if (!best || width > best.width || (width === best.width && bpp > best.bpp)) best = { width, bpp, data };
  }
  if (!best) return null;
  return isPng(best.data) ? { png: best.data } : { raw: decodeIcoBitmap(best.data) };
}

/** Decode an .ico bitmap (1/4/8/24/32 bits per pixel) to top-down RGBA. */
function decodeIcoBitmap(d) {
  const headerSize = d.readUInt32LE(0);
  const width = d.readInt32LE(4);
  const height = Math.abs(d.readInt32LE(8)) / 2; // the height counts the mask too
  const bpp = d.readUInt16LE(14);
  const compression = d.readUInt32LE(16);
  if (width <= 0 || height <= 0 || ![1, 4, 8, 24, 32].includes(bpp) || ![0, 3].includes(compression)) return null;
  let p = headerSize + (compression === 3 && headerSize === 40 ? 12 : 0);
  const palette = [];
  if (bpp <= 8) {
    const colors = d.readUInt32LE(32) || 1 << bpp;
    for (let i = 0; i < colors; i++, p += 4) palette.push([d[p + 2], d[p + 1], d[p]]);
  }
  const stride = Math.ceil((width * bpp) / 32) * 4;
  const maskStride = Math.ceil(width / 32) * 4;
  const maskStart = p + stride * height;
  if (maskStart > d.length) return null;
  const out = Buffer.alloc(width * height * 4);
  let hasAlpha = false;
  for (let y = 0; y < height; y++) {
    const row = p + (height - 1 - y) * stride; // rows are stored bottom-up
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let rgb;
      let a = 255;
      if (bpp === 32) {
        rgb = [d[row + x * 4 + 2], d[row + x * 4 + 1], d[row + x * 4]];
        a = d[row + x * 4 + 3];
        if (a) hasAlpha = true;
      } else if (bpp === 24) {
        rgb = [d[row + x * 3 + 2], d[row + x * 3 + 1], d[row + x * 3]];
      } else {
        const bit = x * bpp;
        rgb = palette[(d[row + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1)] ?? [0, 0, 0];
      }
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = a;
    }
  }
  // Without a real alpha channel, transparency comes from the 1-bit mask after the pixels.
  if (!hasAlpha && maskStart + maskStride * height <= d.length) {
    for (let y = 0; y < height; y++) {
      const row = maskStart + (height - 1 - y) * maskStride;
      for (let x = 0; x < width; x++) {
        if ((d[row + (x >> 3)] >> (7 - (x & 7))) & 1) out[(y * width + x) * 4 + 3] = 0;
        else if (bpp === 32) out[(y * width + x) * 4 + 3] = 255;
      }
    }
  }
  return { data: out, width, height };
}

/** Save a game's Steam icon as a small square WebP; false when it has none. */
async function saveSteamIcon(sharp, appId, hashes, file) {
  let input = null;
  if (hashes.clienticon) {
    try {
      const frame = largestIcoFrame(await getBuffer(`${STEAM_ICON_CDN}/${appId}/${hashes.clienticon}.ico`));
      if (frame?.png) input = sharp(frame.png);
      else if (frame?.raw) {
        const { data, width, height } = frame.raw;
        input = sharp(data, { raw: { width, height, channels: 4 } });
      }
    } catch {
      /* fall back to the 32px community icon */
    }
  }
  if (!input && hashes.icon) input = sharp(await getBuffer(`${STEAM_ICON_CDN}/${appId}/${hashes.icon}.jpg`));
  if (!input) return false;
  const { width = ICON_PX, height = ICON_PX } = await input.metadata();
  const side = Math.min(ICON_PX, Math.max(width, height)); // never enlarge; the browser scales small icons
  await input
    .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 90, effort: 6 })
    .toFile(file);
  return true;
}

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    console.warn('eggs: sharp is not installed; featured icons stay remote this run');
    return null;
  }
}

async function main() {
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  const known = new Map((previous?.games ?? []).map((g) => [g.slug, g]));

  const index = JSON.parse(await getText(INDEX_URL));
  const groups = new Map();

  for (const nest of index.nests) {
    const category = CATEGORY[nest.nest_type] ?? 'generic';
    for (const entry of nest.Eggs) {
      const url = entry.download_url;
      // .../pelican-eggs/<repo>/refs/heads/main/<path…>/egg-x.json
      const repo = /\/pelican-eggs\/([^/]+)\/refs\/heads\//.exec(url)?.[1] ?? '';
      const parts = url.split('/refs/heads/main/')[1]?.split('/') ?? [];
      const repoPath = `${repo}/${parts.join('/')}`;
      const folder = category === 'minecraft' ? 'minecraft' : category === 'games' ? parts[0] : null;
      const override = category === 'minecraft' || category === 'games' ? gameByPath(repoPath) : null;
      const unlisted = !override && category === 'games' && MIXED_FOLDERS.has(`${repo}/${folder}/`);
      if (unlisted) console.warn(`eggs: ${repoPath} is in a folder with several games but not in GAME_BY_PATH; listed on its own`);
      const gameName =
        override ??
        (category === 'minecraft'
          ? parts[0] === 'bedrock'
            ? 'Minecraft: Bedrock Edition'
            : 'Minecraft'
          : folder && !unlisted
            ? STEAM_NAME[folder] ?? humanize(folder)
            : entry.egg.name);
      const slug = gameName === 'Minecraft: Bedrock Edition' ? 'minecraft-bedrock' : slugify(gameName);
      if (!groups.has(slug)) groups.set(slug, { slug, name: gameName, category, folder, eggs: [] });
      groups.get(slug).eggs.push({
        name: entry.egg.name,
        description: (entry.egg.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 220),
        url: encodeEggUrl(url),
        image: null,
        imageNote: null,
        icon: null,
        features: [],
        vars: [],
        hubUrl: null,
        installs: null,
        updatedAt: null,
      });
    }
  }

  // Egg files: Docker images, features, variables and built-in icon.
  const allEggs = [...groups.values()].flatMap((g) => g.eggs.map((e) => ({ g, e })));
  const uuids = new Map();
  mkdirSync(ICONS, { recursive: true });
  let read = 0;
  await pool(allEggs, 16, async ({ g, e }) => {
    try {
      const egg = readEgg(await getText(e.url));
      e.image = egg.images[0] ?? null;
      e.imageNote = imageNote(egg.images);
      e.features = egg.features;
      e.vars = egg.vars;
      if (egg.uuid) uuids.set(e, egg.uuid);
      if (egg.icon) {
        const [, ext, b64] = /^data:image\/([a-z+]+);base64,(.+)$/.exec(egg.icon) ?? [];
        if (b64) {
          const file = `${slugify(g.slug + '-' + e.name)}.${ext === 'svg+xml' ? 'svg' : ext}`;
          writeFileSync(join(ICONS, file), Buffer.from(b64, 'base64'));
          e.icon = `/img/eggs/${file}`;
        }
      }
      read++;
    } catch {
      /* keep the egg without extras */
    }
  });

  // Pelican Hub: each egg's page, install count and last update, matched by uuid.
  // Offline or rate-limited: keep what the previous run found.
  const knownEggs = new Map((previous?.games ?? []).flatMap((g) => g.eggs.map((e) => [encodeEggUrl(e.url), e])));
  let hubFetchedAt = previous?.hubFetchedAt ?? null;
  let hubMatched = 0;
  try {
    const hub = await hubEggs();
    hubFetchedAt = new Date().toISOString();
    // Two eggs in the index can carry the same uuid (one copied from another); then
    // only the one whose name matches the Hub's gets the link, never a guess.
    const sharing = new Map();
    for (const uuid of uuids.values()) sharing.set(uuid, (sharing.get(uuid) ?? 0) + 1);
    for (const { e } of allEggs) {
      const uuid = uuids.get(e);
      const candidates = (uuid && hub.get(uuid)) || [];
      const byName = candidates.find((h) => norm(h.name) === norm(e.name));
      const hit = byName ?? (sharing.get(uuid) === 1 && candidates.length === 1 ? candidates[0] : null);
      if (!hit) continue;
      e.hubUrl = hit.url;
      e.installs = Number(hit.install_count) || 0;
      e.updatedAt = hit.updated_at ?? null;
      hubMatched++;
    }
  } catch (error) {
    console.warn(`eggs: Pelican Hub not reached (${error.message}); keeping the previous Hub data`);
    for (const { e } of allEggs) {
      const old = knownEggs.get(e.url);
      if (!old) continue;
      e.hubUrl = old.hubUrl ?? null;
      e.installs = old.installs ?? null;
      e.updatedAt = old.updatedAt ?? null;
    }
  }

  // Steam artwork for games, cached from the previous run.
  const games = [...groups.values()];
  let looked = 0;
  await pool(
    games.filter((g) => g.category === 'games'),
    4,
    async (g) => {
      const cached = known.get(g.slug);
      // Reuse earlier matches; try again for games that had none.
      if (cached?.steamAppId) {
        g.steamAppId = cached.steamAppId;
        g.art = cached.art;
        // Older runs kept the small capsule image; upgrade it to the header once.
        if (!g.art || g.art.includes('capsule_231x87')) g.art = (await steamHeader(g.steamAppId)) ?? g.art;
        return;
      }
      try {
        Object.assign(g, await steamLookup(STEAM_STORE_NAME[g.name] ?? g.name));
        looked++;
      } catch {
        g.steamAppId = null;
        g.art = null;
      }
    },
  );

  // Square icons. Featured games get a local WebP (once; the file is the cache);
  // other Steam games keep the address of their 32px community icon.
  const featured = featuredSlugs();
  const sharp = featured.size ? await loadSharp() : null;
  mkdirSync(GAME_ICONS, { recursive: true });
  let iconLookups = 0;
  let iconFiles = 0;
  await pool(games, 4, async (g) => {
    g.steamAppId ??= null;
    g.icon = DRAWN_ICONS[g.slug] ?? null;
    if (g.icon) return;
    if (!g.steamAppId) {
      g.icon = ownEggIcon(g);
      return;
    }
    const file = join(GAME_ICONS, `${g.slug}.webp`);
    if (existsSync(file)) {
      g.icon = `/img/games/${g.slug}.webp`;
      return;
    }
    const cached = known.get(g.slug);
    const cachedRemote = cached?.steamAppId === g.steamAppId && cached.icon?.startsWith(STEAM_ICON_CDN) ? cached.icon : null;
    if (cachedRemote && !(featured.has(g.slug) && sharp)) {
      g.icon = cachedRemote;
      return;
    }
    try {
      const hashes = await steamIconHashes(g.steamAppId);
      iconLookups++;
      if (featured.has(g.slug) && sharp && (await saveSteamIcon(sharp, g.steamAppId, hashes, file).catch(() => false))) {
        g.icon = `/img/games/${g.slug}.webp`;
        iconFiles++;
        return;
      }
      g.icon = hashes.icon ? `${STEAM_ICON_CDN}/${g.steamAppId}/${hashes.icon}.jpg` : null;
    } catch {
      g.icon = cachedRemote;
    }
  });

  for (const g of games) {
    // No store artwork: fall back to an original drawing, or an icon built into the game's own egg.
    g.art ??= DRAWN_ICONS[g.slug] ?? ownEggIcon(g);
    delete g.folder;
    g.eggs.sort((a, b) => a.name.localeCompare(b.name));
  }
  games.sort((a, b) => b.eggs.length - a.eggs.length || a.name.localeCompare(b.name));

  const categories = Object.entries(CATEGORY_NAMES)
    .map(([id, name]) => ({ id, name, count: games.filter((g) => g.category === id).reduce((n, g) => n + g.eggs.length, 0) }))
    .filter((c) => c.count > 0);

  const out = { generatedAt: new Date().toISOString(), source: INDEX_URL, hubFetchedAt, categories, games };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(
    `eggs: ${allEggs.length} eggs (${read} files read) in ${games.length} groups; ` +
      `${allEggs.filter(({ e }) => e.hubUrl).length} on Pelican Hub (${hubMatched} matched this run), ` +
      `${allEggs.filter(({ e }) => e.installs).length} with installs; ` +
      `${games.filter((g) => g.art).length} with artwork (${looked} Steam lookups), ` +
      `${games.filter((g) => g.icon).length} with square icons (${iconLookups} icon lookups, ${iconFiles} saved) → data/eggs.json`,
  );
}

main().catch((error) => {
  if (soft && existsSync(OUT)) {
    console.warn(`eggs: could not refresh (${error.message}); using the saved data/eggs.json`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});
