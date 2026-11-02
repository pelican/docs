# Pelican Docs

The website and documentation at [pelican.dev](https://pelican.dev), built with
[Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.dev) and served by Netlify as a static site.

## Running it locally

You need Node.js 22 or newer and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev        # http://localhost:3000, reloads as you edit
pnpm build      # the production site, written to out/
```

## Where things are

| Path | What it is |
| --- | --- |
| `content/docs/` | The documentation. One `.mdx` file per page; the URL follows the folder. |
| `content/docs/**/meta.json` | Sidebar order and section names for that folder. |
| `content/pages/` | Stand-alone pages: `/support` and `/faq`. |
| `app/(home)/page.tsx` | The homepage. |
| `public/` | Files served as they are, including the `update-panel.sh` and `migrate-*.sh` scripts. |
| `netlify.toml` | Build settings and redirects such as `/discord`. |

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
