#!/usr/bin/env bun
/**
 * Packs the built site (out/) into the folder the Pelican Hub serves on pelican.dev.
 *
 * When:  in CI, after the build ("Publish docs build" workflow); by hand to look at the result
 * Run:   bun run pack:docs          (or: bun scripts/pack-docs.mjs [folder], default dist-docs/)
 * Tests: bun test scripts/pack-docs.test.mjs
 *
 * What the folder holds:
 *
 *   index.html, panel/, md/, search.json …   the docs, served under /docs/
 *   _next/                                    their scripts and styles
 *   _root/update-panel.sh, llms.txt …         the root files (ROOT_FILES)
 *   404.html                                  the docs' not-found page
 *   redirects.json                            netlify.toml's redirects under /docs
 *   BUILD.json                                which commit this is
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ROOT_FILES } from '../router/paths.mjs';

/**
 * The redirects under /docs from netlify.toml (it stays the one list: Netlify's PR previews use
 * it too). Only real redirects (3xx); the rewrites (200) are rules the Hub has built in.
 */
export function docsRedirects(toml) {
  const { redirects = [] } = Bun.TOML.parse(toml);
  const underDocs = (from) => from === '/docs' || from?.startsWith('/docs/');

  return redirects
    .map(({ from, to, status = 301 }) => ({ from, to, status }))
    .filter(({ from, to, status }) => underDocs(from) && to && status >= 300 && status < 400);
}

/**
 * Packs `src` (the built site) into `folder`, which is emptied first. The folder's name must
 * start with "dist", so a typo like `bun run pack:docs .` can't delete the repo or the build.
 */
export async function pack(folder, { src = 'out', toml = 'netlify.toml' } = {}) {
  if (!basename(folder).startsWith('dist')) {
    throw new Error(`The output folder's name must start with "dist" (got "${folder}"): it is deleted first.`);
  }

  const needed = ['docs/index.html', '_next/static', '404.html', ...ROOT_FILES];
  for (const path of needed) {
    if (!existsSync(join(src, path))) throw new Error(`${join(src, path)} is missing: run "bun run build" first`);
  }

  // Read before anything is deleted, so a broken netlify.toml leaves the old folder alone.
  const redirects = docsRedirects(await Bun.file(toml).text());

  await rm(folder, { recursive: true, force: true });
  await mkdir(join(folder, '_root'), { recursive: true });

  await cp(join(src, 'docs'), folder, { recursive: true });
  await cp(join(src, '_next'), join(folder, '_next'), { recursive: true });
  await cp(join(src, '404.html'), join(folder, '404.html'));
  for (const name of ROOT_FILES) {
    await cp(join(src, name), join(folder, '_root', name));
  }

  await Bun.write(join(folder, 'redirects.json'), `${JSON.stringify(redirects, null, 2)}\n`);

  // BUILD_SHA/BUILD_BRANCH: the commit and branch built, when they aren't the ones that started
  // the run (the daily publish starts on main and also builds feat/fumadocs-next).
  const build = {
    sha: process.env.BUILD_SHA || process.env.GITHUB_SHA || 'local',
    branch: process.env.BUILD_BRANCH || process.env.GITHUB_REF_NAME || 'local',
    built_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  await Bun.write(join(folder, 'BUILD.json'), `${JSON.stringify(build)}\n`);

  return { redirects: redirects.length, rootFiles: ROOT_FILES.length };
}

if (import.meta.main) {
  process.chdir(join(import.meta.dir, '..'));
  const folder = process.argv[2] ?? 'dist-docs';
  const { redirects, rootFiles } = await pack(folder);
  console.log(`pack-docs: ${folder} (${redirects} redirects, ${rootFiles} root files)`);
}
