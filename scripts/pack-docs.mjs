#!/usr/bin/env node
/**
 * Packs the built site (out/) into what the Pelican Hub serves on pelican.dev, from Forge, for
 * /docs and the root files. The Hub's DocsBuildService installs this folder as it is:
 *
 *   index.html, panel/…, md/…, search.json …   out/docs/*        (served under /docs/)
 *   _next/…                                     out/_next/*       (pages load /docs/_next/…: assetPrefix)
 *   _root/update-panel.sh, llms.txt …           out/<root file>   (served at /update-panel.sh …)
 *   404.html                                    out/404.html      (the docs' not-found page)
 *   redirects.json                              netlify.toml      (its 3xx rules under /docs)
 *   BUILD.json                                  this commit       ({ sha, branch, built_at })
 *
 *   node scripts/pack-docs.mjs <folder>   (default: dist-docs)
 *
 * netlify.toml stays the one list of redirects (Netlify's PR previews use it); its rewrites
 * (status 200: /docs/_next, the .md copies) are the Hub's own rules and aren't copied.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(repo, 'out');

/** The root files the docs tell people to fetch; keep in step with router/README.md and scripts/check-paths.mjs. */
export const ROOT_FILES = ['llms.txt', 'llms-full.txt', 'update-panel.sh', 'migrate-panel.sh', 'migrate-wings.sh'];

/**
 * netlify.toml's redirects under /docs (3xx only), as { from, to, status }. `from` may end in
 * `/*` and `to` use `:splat`, as Netlify writes them.
 */
export function docsRedirects(toml) {
  const redirects = [];
  for (const block of toml.split(/^\[\[redirects\]\]\s*$/m).slice(1)) {
    const body = block.split(/^\[/m)[0];
    const field = (name) => body.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm'))?.[1];
    const from = field('from');
    const to = field('to');
    const status = Number(body.match(/^\s*status\s*=\s*(\d+)/m)?.[1] ?? 301);
    if (!from || !to || !from.startsWith('/docs') || status < 300 || status >= 400) continue;
    redirects.push({ from, to, status });
  }
  return redirects;
}

function pack(target) {
  for (const required of ['docs/index.html', '_next/static', '404.html']) {
    if (!existsSync(join(out, required))) throw new Error(`out/${required} is missing: run the build first`);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(join(target, '_root'), { recursive: true });

  cpSync(join(out, 'docs'), target, { recursive: true });
  cpSync(join(out, '_next'), join(target, '_next'), { recursive: true });
  cpSync(join(out, '404.html'), join(target, '404.html'));

  for (const file of ROOT_FILES) {
    if (!existsSync(join(out, file))) throw new Error(`out/${file} is missing`);
    cpSync(join(out, file), join(target, '_root', file));
  }

  const redirects = docsRedirects(readFileSync(join(repo, 'netlify.toml'), 'utf8'));
  writeFileSync(join(target, 'redirects.json'), `${JSON.stringify(redirects, null, 2)}\n`);

  const build = {
    sha: process.env.GITHUB_SHA ?? 'local',
    branch: process.env.GITHUB_REF_NAME ?? 'local',
    built_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  writeFileSync(join(target, 'BUILD.json'), `${JSON.stringify(build)}\n`);

  console.log(`pack-docs: ${target} (${redirects.length} redirects, ${ROOT_FILES.length} root files)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  pack(resolve(repo, process.argv[2] ?? 'dist-docs'));
}
