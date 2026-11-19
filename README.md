# Pelican Docs

The source for the documentation at [pelican.dev/docs](https://pelican.dev/docs), covering [Pelican Panel](https://github.com/pelican/panel) and [Wings](https://github.com/pelican/wings).

Built with [Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.dev) as a static site. Today Netlify serves pelican.dev; after the switch the Pelican Hub serves these docs under /docs from Forge (decided, not done yet: see [router/README.md](router/README.md)). Netlify builds a preview for every pull request.

## Running it locally

You need Node.js 22 or newer (Next.js builds on Node) and [Bun](https://bun.com) 1.3 or newer (installs and runs the scripts).

```sh
bun install
bun run dev     # http://localhost:3000, reloads as you edit
bun run build   # the production site, written to out/ (checks the pages first, the paths and links after)
bun test        # the tests for scripts/ and router/
```

Every script in `scripts/` and `router/` runs on Bun and starts with the same header: what it does, when it runs, how to run it and where its tests are. [scripts/README.md](scripts/README.md) lists them all.

The build refreshes the egg data for the interim `/eggs` page (it uses the network), so it can change `data/eggs.json`, `public/data/eggs/`, `public/img/eggs/` and `public/img/games/`. Leave those out of a pull request unless it's about the egg data.

### Before a pull request

```sh
bun test && bun run typecheck && bun run build
```

## Where things are

| Path | What it is |
| --- | --- |
| `content/docs/` | The documentation. One `.mdx` file per page; the URL follows the folder. |
| `content/docs/**/meta.json` | Sidebar order and section names for that folder. |
| `content/pages/` | Stand-alone pages: `/support` and `/faq`. |
| `app/(home)/page.tsx` | The homepage. |
| `public/` | Files served as they are, including the `install.sh`, `update-panel.sh` and `migrate-*.sh` scripts (`install.sh` is tested in `scripts/install-sh.test.mjs`). |
| `netlify.toml` | Build settings and redirects such as `/discord`. |
| `ui/` | Design tokens (`tokens.css`) and site nav (`nav.json`) shared with the Hub; published at `/docs/ui/v1/`. |
| `scripts/` | The build's checks, the egg data sync and the packing for the Hub. Listed in [scripts/README.md](scripts/README.md). |
| `router/` | How pelican.dev is served: `dev-server.mjs` (one site on your machine) and `worker.mjs` (the Cloudflare option for later). See its README. |

## Writing a page

Create `content/docs/<section>/<name>.mdx` and add `<name>` to that folder's `meta.json`
so it shows up in the sidebar.

```mdx
---
title: Installing Wings
description: One sentence shown under the title and in search results.
---

Your content, in Markdown.
```

The title goes in the frontmatter, not as a `# Heading`.

### Callouts

```mdx
:::tip
Short tips work like this.
:::

<Admonition type="warning" title="Back up first">
  Or like this, when you want a title. Types: note, info, tip, warning, danger.
</Admonition>
```

### Tabs

```mdx
<Tabs groupId="webserver">
  <TabItem value="nginx" label="NGINX" default>…</TabItem>
  <TabItem value="apache" label="Apache">…</TabItem>
  <TabItem value="caddy" label="Caddy">…</TabItem>
</Tabs>
```

Tabs with the same `groupId` switch together on every page and remember the reader's choice.
Use `groupId="webserver"` with the values `nginx`, `apache` and `caddy`, and `groupId="ssl"`
with `https` and `http`, so they also follow the reader's setup (below).

### Code blocks

````mdx
```nginx title="/etc/nginx/sites-available/pelican.conf" {3,5}
````

`title` shows a file name above the block and `{3,5}` highlights lines 3 and 5.

### Filling in the reader's setup

Put a setup box on a page:

```mdx
<SetupPanel fields={['domain', 'webserver', 'ssl', 'php', 'path']} />
```

Then add `setup` to any code block that should use the reader's values:

````mdx
```nginx setup title="/etc/nginx/sites-available/pelican.conf"
server_name <domain>;
root /var/www/pelican/public;
fastcgi_pass unix:/run/php/php8.5-fpm.sock;
```
````

In blocks marked `setup`, `<domain>`, `/var/www/pelican` and the version in `php8.5` are replaced
with what the reader entered. Their choices are saved in their browser, so other pages pick them up too.
Blocks without `setup` are never changed.
