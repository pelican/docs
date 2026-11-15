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
 *   _root/update-panel.sh, llms.txt …         the five files served at the site's root
 *   404.html                                  the docs' not-found page
 *   redirects.json                            netlify.toml's redirects under /docs
 *   BUILD.json                                which commit this is
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';

/** The files the docs tell people to download from pelican.dev's root. */
export const ROOT_FILES = ['llms.txt', 'llms-full.txt', 'update-panel.sh', 'migrate-panel.sh', 'migrate-wings.sh'];

/**
 * The redirects under /docs from netlify.toml (it stays the one list: Netlify's PR previews use
 * it too). Only real redirects (3xx); the rewrites (200) are rules the Hub has built in.
 */
export function docsRedirects(toml) {
  const { redirects = [] } = Bun.TOML.parse(toml);

  return redirects
    .map(({ from, to, status = 301 }) => ({ from, to, status }))
    .filter(({ from, to, status }) => from?.startsWith('/docs') && to && status >= 300 && status < 400);
}

async function pack(folder) {
  const needed = ['out/docs/index.html', 'out/_next/static', 'out/404.html', ...ROOT_FILES.map((name) => `out/${name}`)];
  for (const path of needed) {
    if (!existsSync(path)) throw new Error(`${path} is missing: run "bun run build" first`);
  }

  await rm(folder, { recursive: true, force: true });
  await mkdir(`${folder}/_root`, { recursive: true });

  await cp('out/docs', folder, { recursive: true });
  await cp('out/_next', `${folder}/_next`, { recursive: true });
  await cp('out/404.html', `${folder}/404.html`);
  for (const name of ROOT_FILES) {
    await cp(`out/${name}`, `${folder}/_root/${name}`);
  }

  const redirects = docsRedirects(await Bun.file('netlify.toml').text());
  await Bun.write(`${folder}/redirects.json`, `${JSON.stringify(redirects, null, 2)}\n`);

  const build = {
    sha: process.env.GITHUB_SHA ?? 'local',
    branch: process.env.GITHUB_REF_NAME ?? 'local',
    built_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  await Bun.write(`${folder}/BUILD.json`, `${JSON.stringify(build)}\n`);

  console.log(`pack-docs: ${folder} (${redirects.length} redirects, ${ROOT_FILES.length} root files)`);
}

if (import.meta.main) {
  process.chdir(`${import.meta.dir}/..`);
  await pack(process.argv[2] ?? 'dist-docs');
}
