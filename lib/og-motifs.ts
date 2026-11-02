/**
 * The picture on each docs share image (lib/og-image.tsx): a few lines copied
 * from the page itself, so the card shows what the page is about.
 *
 * Every line here must appear, word for word, in the page's MDX (whitespace
 * aside). `checkedMotif` drops a motif whose text is no longer on the page and
 * warns in the build log, and the card falls back to its section's picture.
 * A page that isn't listed gets that fallback too.
 */

export type Motif =
  /** A terminal or file window. `sh` lines get a `$` prompt, unless they are comments. */
  | { kind: 'code'; label: string; lang: 'sh' | 'file'; lines: string[] }
  /** A short table: a name and an optional note per row. `mark` highlights a row. */
  | { kind: 'rows'; label: string; rows: { name: string; note?: string; mark?: boolean }[] }
  /** An admonition quoted from the page. */
  | { kind: 'notice'; label: string; lines: string[] }
  /** MAJOR.MINOR.PATCH with what each part means, from the Releases section. */
  | { kind: 'semver'; rows: { version: string; note: string }[] }
  | FlowMotif;

/** A chart of the Panel, the machines running Wings and their servers. */
export type FlowMotif = { kind: 'flow'; root: string; nodes: { name: string; service: string; apps: string[] }[] };

/** Keyed by the page's slugs joined with "/", like "panel/advanced/redis"; "" is the docs introduction. */
export const DOCS_MOTIFS: Record<string, Motif> = {
  /* ---- Introduction: its "Example Setup" chart ---- */
  '': {
    kind: 'flow',
    root: 'Pelican Panel',
    nodes: [
      { name: 'Basement Server', service: 'Wings', apps: ['FTB Minecraft', 'Factorio', 'GTA FiveM', 'Project Zomboid'] },
      { name: 'Rented Server', service: 'Wings', apps: ['Palworld', 'Discord Bot'] },
    ],
  },

  /* ---- Panel ---- */
  'panel/getting-started': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: [
      'sudo mkdir -p /var/www/pelican',
      'cd /var/www/pelican',
      'curl -L https://github.com/pelican/panel/releases/latest/download/panel.tar.gz | sudo tar -xzv',
    ],
  },
  'panel/webserver-config': {
    kind: 'code',
    label: 'pelican.conf',
    lang: 'file',
    lines: ['server {', '    listen 443 ssl;', '    http2 on;', '    server_name <domain>;', '    root /var/www/pelican/public;', '    index index.php;'],
  },
  'panel/panel-setup': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: [
      'sudo php artisan p:environment:setup',
      'sudo chmod -R 755 storage/* bootstrap/cache/',
      'sudo chown -R www-data:www-data /var/www/pelican',
    ],
  },
  'panel/optional-config': {
    kind: 'code',
    label: '.env',
    lang: 'file',
    lines: ['BACKUP_MAX_PART_SIZE=1073741824', 'BACKUP_PRESIGNED_URL_LIFESPAN=120', 'AWS_BACKUPS_STORAGE_CLASS='],
  },
  'panel/update': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['cd /var/www/pelican', 'sudo php artisan down', 'sudo php artisan migrate --seed --force', 'sudo php artisan up'],
  },
  'panel/advanced/redis': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo apt install -y lsb-release curl gpg', 'php artisan p:redis:setup'],
  },
  'panel/advanced/mysql': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: [
      'curl -sSL https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | sudo bash',
      'sudo apt install -y mariadb-server',
    ],
  },
  'panel/advanced/artisan': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['php artisan p:info', 'php artisan p:user:make [options]', 'php artisan p:node:make [options]'],
  },
  'panel/advanced/docker': {
    kind: 'code',
    label: 'compose.yml',
    lang: 'file',
    lines: ['services:', '  panel:', '    image: ghcr.io/pelican/panel:latest', '    restart: always'],
  },
  'panel/advanced/podman': {
    kind: 'code',
    label: 'pelican.yaml',
    lang: 'file',
    lines: ['apiVersion: v1', 'kind: Pod', 'metadata:', '  name: pelican'],
  },
  'panel/advanced/cloudflare-tunnel': {
    kind: 'code',
    label: '.env',
    lang: 'file',
    lines: ['TUNNEL_TOKEN=paste-your-tunnel-token-here'],
  },
  'panel/advanced/api-docs': {
    kind: 'rows',
    label: '/docs/api',
    rows: [
      { name: 'Application API', mark: true },
      { name: 'Client API' },
    ],
  },
  'panel/advanced/plugins': {
    kind: 'code',
    label: 'update.json',
    lang: 'file',
    lines: ['{', '  "*": {', '    "version": "1.1.0",', '    "download_url": "..."', '  }', '}'],
  },

  /* ---- Wings ---- */
  'wings/install': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo mkdir -p /etc/pelican /var/run/wings', 'sudo chmod u+x /usr/local/bin/wings', 'sudo wings --debug', 'sudo systemctl enable --now wings'],
  },
  'wings/optional-config': {
    kind: 'code',
    label: 'config.yml',
    lang: 'file',
    lines: ['docker:', '  registries:', '    registry.example.com:', '      username: "registryusername"', '      password: "registrypassword"'],
  },
  'wings/update': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo wings update', 'sudo systemctl restart wings'],
  },

  /* ---- Eggs ---- */
  'eggs/creating-a-custom-egg': {
    kind: 'code',
    label: 'Configuration files',
    lang: 'file',
    lines: ['{', '  "server.properties": {', '    "parser": "properties",', '    "find": {', '      "server-ip": "0.0.0.0",', '      "enable-query": "true",'],
  },
  'eggs/creating-a-custom-yolk': {
    kind: 'code',
    label: 'Dockerfile',
    lang: 'file',
    lines: [
      'FROM --platform=$TARGETOS/$TARGETARCH eclipse-temurin:8-jdk-noble',
      'USER container',
      'ENV USER=container HOME=/home/container',
      'WORKDIR /home/container',
      'CMD ["/entrypoint.sh"]',
    ],
  },

  /* ---- Guides ---- */
  'guides/docker': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['curl -sSL https://get.docker.com/ | CHANNEL=stable sudo sh', 'sudo systemctl enable --now docker'],
  },
  'guides/mounts': {
    kind: 'code',
    label: 'config.yml',
    lang: 'file',
    lines: ['allowed_mounts:', '  - /var/lib/pelican/mounts'],
  },
  'guides/ssl': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo apt install -y python3-certbot-nginx', 'certbot certonly --nginx -d example.com', 'certbot renew'],
  },
  'guides/php-upgrade': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo add-apt-repository -y ppa:ondrej/php', 'sudo apt -y update', 'sudo apt -y install php8.5 php8.5-{gd,mysql,mbstring,bcmath,xml,curl,zip,intl,sqlite3,fpm}'],
  },
  'guides/database-hosts': {
    kind: 'code',
    label: 'mysql',
    lang: 'file',
    lines: [
      "CREATE USER 'pelicanuser'@'127.0.0.1' IDENTIFIED BY 'yourPassword';",
      "GRANT ALL PRIVILEGES ON *.* TO 'pelicanuser'@'127.0.0.1' WITH GRANT OPTION;",
    ],
  },
  'guides/change-panel-domain': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo nano /etc/nginx/sites-available/pelican.conf'],
  },
  'guides/uninstalling': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['sudo rm -rf /var/www/pelican', 'systemctl disable --now wings', 'sudo rm /usr/local/bin/wings', 'sudo rm -rf /var/lib/pelican'],
  },
  'guides/migrating-from-pterodactyl': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['curl -fsSLo migrate-panel.sh https://pelican.dev/migrate-panel.sh', 'sudo bash migrate-panel.sh --check'],
  },
  'guides/translating': {
    kind: 'code',
    label: 'php',
    lang: 'file',
    lines: ["'greeting' => 'Hello :name!',", "'model_label' => 'Backup Host|Backup Hosts',"],
  },
  'guides/troubleshooting': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['tail -n 1000 /var/www/pelican/storage/logs/laravel-$(date +%F).log | grep "\\[$(date +%Y)"'],
  },
  'guides/disk-quotas/about': {
    kind: 'notice',
    label: 'Danger',
    lines: ['Support for disk quotas is still being worked on!'],
  },
  'guides/disk-quotas/ext4-xfs': {
    kind: 'code',
    label: 'sh',
    lang: 'sh',
    lines: ['mkfs.ext4 -O quota -E quotatype=prjquota /dev/sdb', 'umount /var/lib/pelican/volumes/', 'tune2fs -Q prjquota /dev/sdb'],
  },

  /* ---- Project ---- */
  versioning: {
    kind: 'semver',
    rows: [
      { version: '2.0.0', note: 'breaking changes' },
      { version: '1.1.0', note: 'add features' },
      { version: '1.0.1', note: 'bug and security fixes' },
    ],
  },
  comparison: {
    kind: 'rows',
    label: 'Compared',
    rows: [
      { name: 'Pelican', mark: true },
      { name: 'Pterodactyl' },
      { name: 'PufferPanel' },
      { name: 'Crafty Controller' },
      { name: 'TCAdmin' },
      { name: 'AMP' },
      { name: 'Calagopus' },
    ],
  },
  contributors: {
    kind: 'rows',
    label: 'Core Team',
    rows: [
      { name: 'Lance Pioch', note: 'Project Lead & Fullstack Dev', mark: true },
      { name: 'Michael Parker', note: 'Egg / Docker Maintainer' },
      { name: 'Charles Morgan', note: 'Fullstack Dev' },
      { name: 'Boy132', note: 'Fullstack Dev' },
      { name: 'Martin Oscar', note: 'Fullstack Dev' },
    ],
  },
};

/** Words of a motif that must be on the page. Labels are window titles, not quotes, so they're skipped. */
function quotedText(motif: Motif): string[] {
  switch (motif.kind) {
    case 'code':
    case 'notice':
      return motif.lines;
    case 'rows':
      return motif.rows.flatMap((r) => [r.name, ...(r.note ? [r.note] : [])]);
    case 'semver':
      return motif.rows.flatMap((r) => [r.version, r.note]);
    case 'flow':
      return [motif.root, ...motif.nodes.flatMap((n) => [n.name, n.service, ...n.apps])];
  }
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The page's motif, if every line of it is still on the page (`mdx` is the raw file). */
export function checkedMotif(key: string, mdx: string): Motif | undefined {
  const motif = DOCS_MOTIFS[key];
  if (!motif) return undefined;
  const page = squash(mdx);
  const missing = quotedText(motif).filter((line) => !page.includes(squash(line)));
  if (missing.length > 0) {
    console.warn(`[og] ${key}: share image motif dropped, no longer on the page: ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
    return undefined;
  }
  return motif;
}
