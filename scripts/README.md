# Scripts

Every script here and in `router/` follows the same rules, so you (or an agent) can find,
run and change one without reading the others first:

- **It runs on Bun:** it starts with `#!/usr/bin/env bun`, and `package.json` calls it with `bun`.
  Next.js itself still builds on Node 22.
- **Its header says what it does in one line,** then `When:` (what runs it), `Run:` (the
  command) and `Tests:`, then the details.
- **It has a `package.json` script,** named for what it does: `check:*`, `sync:*`, `pack:*`,
  `dev:*`.
- **Its tests sit next to it as `<name>.test.mjs`,** written with `bun:test` (`test`, `expect`).
  `bun test` runs every one of them, locally and in CI.
- **No new dependencies for a script.** Bun's own APIs (`Bun.file`, `Bun.write`,
  `Bun.TOML.parse`) and `node:` modules cover what they need.

| Script | What it does | When it runs | Command | Tests |
| --- | --- | --- | --- | --- |
| `check-content.mjs` | Fails if a page in `content/` could run code (MDX compiles pages to JavaScript) | Before every build, and in CI | `bun run check:content` | `check-content.test.mjs` |
| `sync-eggs.mjs` | Refreshes the egg data for the interim `/eggs` page and the homepage games strip | Before every build (`--if-online`: never fails it); by hand | `bun run sync:eggs` | none |
| `check-paths.mjs` | Fails if the build puts a file where pelican.dev won't serve it from this build | After every build, and in CI | `bun run check:paths` | none (runs on every build) |
| `pack-docs.mjs` | Packs `out/` into the folder the Hub serves on pelican.dev (docs, root files, 404 page, redirects) | In CI ("Publish docs build"); by hand to look at the result | `bun run pack:docs` | `pack-docs.test.mjs` |
| `../router/dev-server.mjs` | Shows pelican.dev as one site on your machine (docs from `out/`, the rest from a local Hub) | By hand | `bun run dev:site` | none |
| `../router/worker.mjs` | The Cloudflare Worker option for later (not deployed) | Not deployed | see `router/README.md` | `router/worker.test.mjs` |

`bun run build` runs the checks around Next.js: `prebuild` runs `check-content` and `sync-eggs`
(`--if-online`), and `postbuild` runs `check-paths`.

## Before a pull request

```sh
bun test              # every script's tests
bun run typecheck     # the site's TypeScript
bun run build         # the site, with the checks before and after
```

## Adding a script

1. Copy a script's header and fill in its one line, `When:`, `Run:` and `Tests:`.
2. Add a `package.json` script for it, with a name of the same kind as the others.
3. If it holds logic worth testing, export that part and test it in `<name>.test.mjs` with
   `bun:test`. `bun test` picks it up, and so does CI.
4. Add a row to the table above.
