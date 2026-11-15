<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Scripts and checks

- Everything runs with Bun: `bun install`, `bun run <script>`. Next.js builds on Node 22.
- Scripts live in `scripts/` and `router/`. Each one starts with a header saying what it does,
  `When:` it runs, how to `Run:` it, and where its `Tests:` are. `scripts/README.md` lists them
  all, with the rules a new script follows.
- Tests are `<name>.test.mjs` files next to the code, written with `bun:test`. Run them all with
  `bun test`.
- Before opening a pull request: `bun test`, `bun run typecheck`, `bun run build`. The build
  checks the pages before it (`check:content`), refreshes the egg data (`sync:eggs`, which uses
  the network and rewrites `data/eggs.json`, `public/data/eggs/`, `public/img/eggs/`, `public/img/games/`: don't
  commit those unless the task is about eggs), and checks the paths after it (`check:paths`).
- The paths this build serves on pelican.dev are in one file, `router/paths.mjs`. Change them
  there, and in the Hub's `DocsBuildService::ROOT_FILES` for the root files.
- A new MDX component goes in `mdx-components.tsx` and in `COMPONENTS` in
  `scripts/check-content.mjs`; a test fails if the two lists differ.
- How pelican.dev is served (the Hub on Forge, the docs under /docs) is in `router/README.md`.
