# Scripts

Every script here and in `router/` follows the same rules, so you (or an agent) can find,
run and change one without reading the others first:

- **It runs on Bun:** it starts with `#!/usr/bin/env bun`, and `package.json` calls it with `bun`.
  Next.js itself still builds on Node 22. (Two files have no shebang and no `package.json`
  script: `router/worker.mjs` runs on Cloudflare, and `router/paths.mjs` is only imported.)
- **Its header says what it does in one line,** then `When:` (what runs it), `Run:` (the
  command) and `Tests:`, then the details. `pack-docs.mjs` is a short one to copy.
- **It has a `package.json` script,** named for what it does: `check:*`, `sync:*`, `pack:*`,
  `dev:*`.
- **Its tests sit next to it as `<name>.test.mjs`,** written with `bun:test` (`test`, `expect`),
  and start with a comment naming the command (`// bun test scripts/<name>.test.mjs`) and what
  they cover.
  `bun test` runs every one of them, locally, in CI and before every publish.
- **Its logic can be tested without running it:** the work is in exported functions, and the
  part that runs it is under `if (import.meta.main)`, so a test can import the file safely.
  (A test may also run the script itself, as `check-content.test.mjs` does.)
- **No new dependencies.** Use Bun's own APIs (`Bun.file`, `Bun.write`, `Bun.TOML.parse`),
  `node:` modules and what `package.json` already has (`check-content` uses the MDX parser the
  site uses).
- **Shared facts live in one file.** The paths this build serves on pelican.dev (`/docs/*` and
  the root files) are in `router/paths.mjs`, and every script imports them from there.

| Script | What it does | When it runs | Command | Tests |
| --- | --- | --- | --- | --- |
| `check-content.mjs` | Fails if a page in `content/` could run code (MDX compiles pages to JavaScript) | Before every build, and in CI | `bun run check:content` | `check-content.test.mjs` |
| `sync-eggs.mjs` | Refreshes the egg data for the interim `/eggs` page and the homepage games strip. Uses the network and rewrites `data/eggs.json`, `public/data/eggs/`, `public/img/eggs/` and `public/img/games/` | Before every build (`--if-online`: no network keeps the saved data; a bug still fails); by hand | `bun run sync:eggs` | `sync-eggs.test.mjs` |
| `check-paths.mjs` | Fails if the build puts a file where pelican.dev won't serve it from this build, misses a root file, or a docs page loads something from outside `/docs/` | After every build, and in CI | `bun run check:paths` | `check-paths.test.mjs` |
| `check-links.mjs` | Fails if a link on a docs page goes to a docs page, file or `#anchor` that isn't in the build (links to the Hub and other sites aren't checked) | After every build, and in CI | `bun run check:links` | `check-links.test.mjs` |
| `pack-docs.mjs` | Packs `out/` into the folder the Hub serves on pelican.dev (docs, root files, 404 page, redirects) | Before every publish, in CI ("Publish docs build"); by hand to look at the result | `bun run pack:docs` | `pack-docs.test.mjs` |
| `../public/install.sh` | pelican.dev/install.sh: installs Docker, a one-node Swarm, Traefik (Let's Encrypt) and the Panel, optionally Wings. A bash script for servers, not a Bun one; the tests run it in `--dry-run` | Run by people on their servers (`curl … \| sudo bash`) | `bash public/install.sh --dry-run --help` | `install-sh.test.mjs` |
| `../router/paths.mjs` | Which paths are this build's: `/docs/*` and the root files | Imported by the scripts above and the router | (nothing to run) | `router/paths.test.mjs` |
| `../router/dev-server.mjs` | Shows pelican.dev as one site on your machine (docs from `out/`, the rest from a local Hub) | By hand | `bun run dev:site` | `router/dev-server.test.mjs` |
| `../router/worker.mjs` | The Cloudflare Worker option for later (not deployed) | Not deployed | see `router/README.md` | `router/worker.test.mjs` |

`bun run build` runs the checks around Next.js: `prebuild` runs `check-content` and `sync-eggs`
(`--if-online`), and `postbuild` runs `check-paths` and `check-links`.

**The build changes tracked files.** `sync-eggs` refreshes the egg data, so after `bun run build`
you may see changes in `data/eggs.json`, `public/data/eggs/`, `public/img/eggs/` and `public/img/games/`. Commit
them only when a pull request is about the egg data. Otherwise leave them out
(`git restore data public/data public/img/eggs public/img/games`).

## Before a pull request

```sh
bun test              # every script's tests
bun run typecheck     # the site's TypeScript
bun run build         # the site, with the checks before and after
```

## Adding a script

1. Copy `pack-docs.mjs`'s header and fill in its one line, `When:`, `Run:` and `Tests:`.
2. Put the work in exported functions, and run it under `if (import.meta.main)`.
3. Add a `package.json` script for it, with a name of the same kind as the others.
4. If it should run on every build, add it to `prebuild` (checks on the pages) or `postbuild`
   (checks on `out/`). CI and the publish workflow run the build, so it runs there too.
5. Test it in `<name>.test.mjs` with `bun:test`. `bun test` picks it up everywhere.
6. Add a row to the table above. If it runs on every build, also mention it where the build's
   checks are listed: the paragraph under the table, `README.md` ("Running it locally") and
   `AGENTS.md` ("Scripts and checks").
