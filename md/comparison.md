# Pelican vs Pterodactyl and other game panels

> Compare Pelican with Pterodactyl and other game server panels such as PufferPanel, Crafty Controller, TCAdmin, AMP and Calagopus.

Source: https://pelican.dev/docs/comparison/

Pelican is a free, open-source game server control panel built on modern Laravel and Filament.
It started as a fork of Pterodactyl and has since grown well beyond it.

## Why Pelican?

* **Make it yours** with plugins and themes from the [Hub](https://hub.pelican.dev)
* **Up and running in minutes** with Docker or the web installer
* **Modern logins** with passkeys, OAuth (11 providers) and two-factor authentication
* **Give staff exactly the access they need** with admin roles and permissions
* **Speak your users' language** with 32 languages, translated by the community
* **Keep backups safe** on S3 or local storage, configured per node

> **Tip: Already on Pterodactyl?**
>
> Migrate in place and keep your servers, users and data. Follow the [migration guide](https://pelican.dev/docs/guides/migrating-from-pterodactyl/).

> **Info: Try it yourself**
>
> See everything below in action on our [Demo](https://demo.pelican.dev)!

## What's new compared to Pterodactyl

### General

* First party Plugin system
* Roles & Permissions for Admins
* Webhooks
* Health page (cache, database, queue, scheduler, disk and version checks)
* Your own logo and favicon
* Replace Nests & Locations with Tags
* Improved Settings page
* Customization for Users (e.g. Server list layout, Console font)
* Config option for Binary Prefix (MiB/GiB)
* ![In Progress](https://img.shields.io/badge/In_Progress-orange) Rework allocations
* ![Planned](https://img.shields.io/badge/Planned-blue) More database types for Database Hosts

### Frontend

* Rewrite of Client Area in Filament
* Rewrite of Admin Area in Filament
* Available in 32 languages, translated by the community
* Light and dark mode
* User avatars
* Timezone configurable per User
* Switch from Webpack to Vite

### API

* Integrated API docs
* Application API for Database Hosts
* Application API for Server Transfers
* Application API for Mounts
* Uniform user transformers
* Rename `oom_disabled` to `oom_killer`

### Auth

* Passkeys
* OAuth with 11 providers, plus automatic account creation and linking
* Email two-factor alongside TOTP
* Replace Google reCAPTCHA with Cloudflare Turnstile

### Setup

* Easier Installation process (Web Installer)
* Dockerized Installation
* Egg selection during install
* PostgreSQL as Panel database
* SQLite as Panel database
* "Proper" support for MariaDB as Panel database (dedicated driver)
* Easier Database Host setup via Step-by-Step Wizard

### Server

* Server icons
* Per-server webhooks
* Backup-completed notifications
* Global search for files
* View install logs from within the Panel
* Activity log for server crashes
* Easier Schedule Cron setup
* "Delete files" schedule task
* Servers without Allocations
* IPv6 Support for Allocations
* Custom docker labels for server containers
* Delete backups when server is deleted
* ![Planned](https://img.shields.io/badge/Planned-blue) Server sorting

### Node

* Multiple backup hosts (local or S3), assigned per node
* Node diagnostics and one-click log upload
* Node resource statistics
* Node Ownership (assign nodes to roles)
* Disk quotas for servers
* CPU Limit for Nodes
* Automatically fetch Node IPs for easier Allocation setup
* Better proxy support
* Alias for SFTP address
* Automatic cleanup of dangling docker images
* Fixed `-1` overallocation

### Eggs

* Browse and import eggs from the panel
* Multiple startup commands per egg, selectable by users
* Easier Egg updating (usage of `update_url`)
* Import multiple eggs at once
* Sortable egg variables
* Change Egg format to YAML

### Hub

* Marketplace for Plugins & Themes
* Marketplace for Eggs
* Open Finances
* Support Tickets

## Pelican vs other panels

|                       | **Pelican** | Pterodactyl | PufferPanel | Crafty Controller | TCAdmin | AMP | Calagopus |
|-----------------------|-------------|-------------|-------------|-------------------|---------|-----|-----------|
| Free and Open Source  | ✅          | ✅          | ✅          | ✅                | ❌      | ❌  | ✅        |
| Plugins & Marketplace | ✅          | ✅          | ❌          | ❌                | ✅      | ❌  | ❌        |
| Themes                | ✅\*        | ❌          | ❌          | ✅                | ✅      | ✅  | ❌        |
| Roles & Permissions   | ✅          | ❌          | ✅          | ✅                | ✅      | ✅  | ✅        |
| Webhooks              | ✅          | ❌          | ❌          | ✅                | ❌      | ✅  | ❌        |
| Sign In with Steam    | ✅          | ❌          | ❌          | ❌                | ❌      | ❌  | ❌        |
| Passkeys              | ✅          | ❌          | ✅          | ✅                | ✅      | ❌  | ✅        |
| Light & Dark Mode     | ✅          | ❌          | ✅          | ✅                | ✅      | ❌  | ✅        |
| Web Installer         | ✅          | ❌          | ❌          | ❌                | ❌      | ✅  | ✅        |
| Captcha Login         | ✅          | ✅          | ❌          | ❌                | ❌      | ❌  | ✅        |
| Remote Backups        | ✅          | ✅          | ❌          | ❌                | ✅      | ✅  | ✅        |
| Database Management   | ✅          | ✅          | ❌          | ❌                | ✅      | ❌  | ✅        |
| Scheduled Tasks       | ✅          | ✅          | ❌          | ✅                | ✅      | ✅  | ✅        |
| Docker Install        | ✅          | ✅          | ✅          | ✅                | ✅      | ❌  | ✅        |
| Database Choice       | ✅          | ❌          | ✅          | ❌                | ❌      | ❌  | ❌        |
| Announcements         | ✅\*        | ❌          | ❌          | ❌                | ✅      | ❌  | ✅        |
| Self Update           | ❌          | ❌          | ❌          | ❌                | ✅      | ❌  | ❌        |

\* 1st Party Plugin support maintained by Pelican team

### Notes
- Plugins can add any features that Pelican doesn't have by default.
- Last Updated on 2026-10-11
