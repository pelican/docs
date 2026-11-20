#!/bin/bash
# Migrates a Pterodactyl Panel to Pelican.
# Guide: https://pelican.dev/docs/guides/migrating-from-pterodactyl
#
#   sudo bash migrate-panel.sh --check   # only run the checks, change nothing
#   sudo bash migrate-panel.sh           # run the checks, then migrate

set -Eeuo pipefail

DISCORD="https://pelican.dev/discord"
PELICAN_DIR="/var/www/pelican"
MIN_PTERODACTYL="1.11.4"
MIN_MYSQL="8.4"
MIN_MARIADB="10.11"

check_only=false
case "${1:-}" in
  "") ;;
  --check) check_only=true ;;
  *) echo "Usage: sudo bash $0 [--check]" >&2; exit 1 ;;
esac

errors=()
ok()   { echo "  ok    $1"; }
warn() { echo "  warn  $1"; }
fail() { echo "  FAIL  $1"; errors+=("$1"); }

# version_ge 1.11.10 1.11.4 -> true
version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; }

tmp=$(mktemp -d)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

echo "Pelican migration from Pterodactyl"
echo
echo "Checking your system. Nothing is changed until you confirm."
echo

# --- System -----------------------------------------------------------------

[ "$EUID" -eq 0 ] && ok "Running as root" || { echo "This script must be run as root or with sudo." >&2; exit 1; }
[ "$(uname -s)" = "Linux" ] && ok "Linux" || fail "This script only supports Linux."
case "$(uname -m)" in
  x86_64|aarch64) ok "Architecture $(uname -m)" ;;
  *) fail "Unsupported architecture $(uname -m). Pelican supports x86_64 and arm64." ;;
esac
[ -d /run/systemd/system ] && ok "systemd" || fail "systemd is not running. The queue worker needs systemd."

missing=()
for tool in curl tar unzip sha256sum sha384sum mysql crontab systemctl php; do
  command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
[ ${#missing[@]} -eq 0 ] && ok "Required tools installed" || fail "Missing tools: ${missing[*]}. Install them first."

# --- Pterodactyl ------------------------------------------------------------

read -rp "Pterodactyl directory [/var/www/pterodactyl]: " ptero_dir
ptero_dir=${ptero_dir:-/var/www/pterodactyl}
ptero_dir=$(realpath -m "$ptero_dir")
env_file="$ptero_dir/.env"

env_get() { { grep -E "^$1=" "$env_file" || true; } | tail -n1 | cut -d= -f2- | sed -E "s/^\"(.*)\"\$/\1/; s/^'(.*)'\$/\1/"; }

have_env=false
if [ ! -f "$ptero_dir/artisan" ]; then
  fail "No Pterodactyl install found in $ptero_dir."
elif [ ! -f "$env_file" ]; then
  fail "$env_file does not exist."
else
  have_env=true
  ok "Pterodactyl found in $ptero_dir"

  ptero_version=$(grep -oP "'version'\s*=>\s*'\K[^']+" "$ptero_dir/config/app.php" || true)
  if [[ ! "$ptero_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    fail "Couldn't read the Pterodactyl version (got '$ptero_version'). Update to the latest Pterodactyl release first."
  elif version_ge "$ptero_version" "$MIN_PTERODACTYL"; then
    ok "Pterodactyl $ptero_version"
  else
    fail "Pterodactyl $ptero_version is too old. Update to $MIN_PTERODACTYL or newer first: https://pterodactyl.io/panel/1.0/updating.html"
  fi

  app_key=$(env_get APP_KEY)
  [[ "$app_key" == base64:* ]] && ok "APP_KEY is set" || fail "APP_KEY in $env_file is missing or invalid. Without it, encrypted data can't be read."

  # Often missing, since Pterodactyl defaults to mysql. Pelican defaults to sqlite, so it's set from the detected server below.
  db_connection=$(env_get DB_CONNECTION)
  case "$db_connection" in
    ""|mysql|mariadb) ;;
    *) fail "DB_CONNECTION is '$db_connection' in $env_file. Pelican can only migrate a MySQL or MariaDB database." ;;
  esac
fi

# --- Pelican target ---------------------------------------------------------

if [ -e "$PELICAN_DIR" ] && [ -n "$(ls -A "$PELICAN_DIR" 2>/dev/null)" ]; then
  fail "$PELICAN_DIR already exists and is not empty. Move it away first."
else
  ok "$PELICAN_DIR is free"
fi

disk_dir=$(dirname "$PELICAN_DIR"); [ -d "$disk_dir" ] || disk_dir=/
free_kb=$(df -Pk "$disk_dir" | awk 'NR==2 {print $4}')
[ "$free_kb" -ge 1048576 ] && ok "Disk space ($((free_kb / 1024)) MB free)" || fail "Less than 1 GB free in $disk_dir."

# --- Pelican release + PHP --------------------------------------------------

release_ok=false
if curl -fsSL -o "$tmp/panel.tar.gz" https://github.com/pelican/panel/releases/latest/download/panel.tar.gz \
  && curl -fsSL -o "$tmp/checksum.txt" https://github.com/pelican/panel/releases/latest/download/checksum.txt; then
  if [ "$(awk '{print $1}' "$tmp/checksum.txt")" = "$(sha256sum "$tmp/panel.tar.gz" | awk '{print $1}')" ]; then
    mkdir "$tmp/panel"
    tar -xzf "$tmp/panel.tar.gz" -C "$tmp/panel"
    release_ok=true
    ok "Downloaded the latest Pelican release (checksum verified)"
  else
    fail "The Pelican download doesn't match its checksum. Try again later."
  fi
else
  fail "Couldn't download Pelican from GitHub."
fi

if command -v php >/dev/null 2>&1; then
  php_version=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')

  if $release_ok; then
    if command -v composer >/dev/null 2>&1; then
      composer=(composer)
    elif curl -fsSL -o "$tmp/composer-setup.php" https://getcomposer.org/installer \
      && [ "$(curl -fsSL https://composer.github.io/installer.sig)" = "$(sha384sum "$tmp/composer-setup.php" | awk '{print $1}')" ] \
      && php "$tmp/composer-setup.php" --quiet --install-dir="$tmp" --filename=composer.phar; then
      composer=(php "$tmp/composer.phar")
    else
      composer=()
      fail "Couldn't download Composer or verify its installer signature."
    fi

    # Compares PHP and every required extension against Pelican's own composer.json and composer.lock.
    if [ ${#composer[@]} -gt 0 ]; then
      if reqs=$(cd "$tmp/panel" && COMPOSER_ALLOW_SUPERUSER=1 "${composer[@]}" check-platform-reqs --no-dev --lock --no-interaction 2>&1); then
        ok "PHP $php_version and extensions match Pelican's composer.json"
      else
        fail "PHP $php_version doesn't meet Pelican's requirements (https://pelican.dev/docs/panel/getting-started#dependencies):"
        { grep -iE 'failed|missing' <<<"$reqs" || echo "$reqs"; } | sed -E 's/ +/ /g; s/ $//; s/^/          /'
      fi
    fi
  fi

  php_modules=$(php -m | tr '[:upper:]' '[:lower:]')
  missing=()
  for ext in pdo_mysql gd bcmath xml curl mbstring intl zip; do
    grep -qx "$ext" <<<"$php_modules" || missing+=("php$php_version-${ext/pdo_mysql/mysql}")
  done
  [ ${#missing[@]} -eq 0 ] && ok "PHP extensions for MySQL, GD, BCMath, XML, cURL" || fail "Missing PHP extensions. Install: ${missing[*]}"

  if command -v "php-fpm$php_version" >/dev/null 2>&1 || php-fpm -v 2>/dev/null | head -n1 | grep -q "^PHP $php_version"; then
    ok "PHP-FPM $php_version installed"
  else
    fail "PHP-FPM $php_version is not installed (the command line uses PHP $php_version, so PHP-FPM must match). Install php$php_version-fpm."
  fi
fi

# --- Database ---------------------------------------------------------------

if $have_env && command -v mysql >/dev/null 2>&1; then
  db_host=$(env_get DB_HOST); db_host=${db_host:-127.0.0.1}
  db_port=$(env_get DB_PORT); db_port=${db_port:-3306}
  db_name=$(env_get DB_DATABASE); db_name=${db_name:-panel}
  db_user=$(env_get DB_USERNAME)
  db_pass=$(env_get DB_PASSWORD)

  # Keeps the password off the command line and out of `ps`.
  install -m 600 /dev/null "$tmp/my.cnf"
  printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' \
    "$db_host" "$db_port" "$db_user" "$(printf '%s' "$db_pass" | sed 's/\\/\\\\/g; s/"/\\"/g')" > "$tmp/my.cnf"
  sql() { mysql --defaults-extra-file="$tmp/my.cnf" -N -B "$db_name" -e "$1"; }

  if db_server=$(sql "SELECT VERSION()" 2>"$tmp/mysql.err"); then
    ok "Connected to database '$db_name' on $db_host:$db_port"

    db_version=$(grep -oE '^[0-9]+\.[0-9]+(\.[0-9]+)?' <<<"$db_server")
    if [[ "$db_server" == *MariaDB* ]]; then
      db_connection=mariadb
      version_ge "$db_version" "$MIN_MARIADB" && ok "MariaDB $db_version" || fail "MariaDB $db_version is too old. Pelican needs MariaDB $MIN_MARIADB or newer."
    else
      db_connection=mysql
      version_ge "$db_version" "$MIN_MYSQL" && ok "MySQL $db_version" || fail "MySQL $db_version is too old. Pelican needs MySQL $MIN_MYSQL or newer."
    fi
    ok "DB_CONNECTION will be set to $db_connection"

    # Effective global and database-level privileges of this user on $db_name, including wildcard grants like `pan%`.
    privileges=$(sql "SELECT DISTINCT PRIVILEGE_TYPE FROM (
        SELECT GRANTEE, PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES
        UNION ALL
        SELECT GRANTEE, PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE DATABASE() LIKE TABLE_SCHEMA
      ) p WHERE GRANTEE = CONCAT('''', SUBSTRING_INDEX(CURRENT_USER(), '@', 1), '''@''', SUBSTRING_INDEX(CURRENT_USER(), '@', -1), '''')" || true)
    missing=()
    for priv in SELECT INSERT UPDATE DELETE CREATE ALTER DROP INDEX REFERENCES; do
      grep -qx "$priv" <<<"$privileges" || missing+=("$priv")
    done
    if [ ${#missing[@]} -eq 0 ]; then
      ok "Database user privileges on '$db_name'"
    else
      fail "Database user '$db_user' is missing privileges on '$db_name': ${missing[*]}. Grant them directly to the user (privileges from roles aren't counted)."
    fi

    sql "SELECT 1 FROM migrations LIMIT 1" >/dev/null 2>&1 && ok "Pterodactyl tables found" || fail "No migrations table in '$db_name'. Is this the Pterodactyl database?"
  else
    fail "Can't connect to the database with the DB_* settings in $env_file: $(tail -n1 "$tmp/mysql.err")"
  fi
fi

# --- Services ---------------------------------------------------------------

if systemctl cat pteroq.service >/dev/null 2>&1; then
  ok "pteroq queue worker found"
  has_pteroq=true
else
  warn "No pteroq service found. Make sure no other Pterodactyl queue worker is running."
  has_pteroq=false
fi

if $have_env; then
  web_user=$(stat -c '%U' "$ptero_dir/storage" 2>/dev/null || true)
  if [ -z "$web_user" ] || [ "$web_user" = "root" ]; then
    web_user=""
    for candidate in www-data nginx apache caddy; do
      id "$candidate" >/dev/null 2>&1 && { web_user=$candidate; break; }
    done
  fi
  read -rp "Webserver user [${web_user:-www-data}]: " answer
  web_user=${answer:-${web_user:-www-data}}
  if [ "$web_user" = "root" ]; then
    fail "The webserver user can't be root."
  elif id "$web_user" >/dev/null 2>&1; then
    web_group=$(id -gn "$web_user")
    ok "Webserver user $web_user:$web_group"
  else
    fail "User '$web_user' does not exist."
  fi
fi

# --- Result -----------------------------------------------------------------

echo
if [ ${#errors[@]} -gt 0 ]; then
  echo "Found ${#errors[@]} problem(s). Fix them and run this script again:"
  printf '  - %s\n' "${errors[@]}"
  echo
  echo "Need help? Ask on Discord: $DISCORD"
  exit 1
fi

echo "All checks passed."
$check_only && exit 0

cat <<EOF

This will:
  1. Put Pterodactyl in maintenance mode and stop its queue worker and cron job
  2. Install Pelican in $PELICAN_DIR and copy your .env into it
  3. Upgrade the database '$db_name' to Pelican
  4. Set up the Pelican queue worker and cron job for $web_user
  5. Bring Pelican online

Your servers keep running. You'll point your webserver at Pelican afterwards.

  !! The database upgrade can't be undone. !!
  Back up your database and $ptero_dir before you continue.

EOF
read -rp "Type 'yes' once you have a backup: " confirm
[ "$confirm" = "yes" ] || { echo "Canceled."; exit 1; }

step=""
on_error() {
  echo
  echo "Failed while: $step"
  echo "Your Pterodactyl files are untouched in $ptero_dir. Restore your database backup before trying again."
  echo "Need help? Ask on Discord: $DISCORD"
}
trap on_error ERR
run() { step="$1"; echo; echo "==> $1"; }

# True if the user's crontab has an uncommented line containing this literal text.
has_cron() { crontab -l -u "$1" 2>/dev/null | awk -v s="$2" 'index($0, s) && $0 !~ /^[[:space:]]*#/ { found = 1 } END { exit !found }'; }

run "Stopping Pterodactyl"
(cd "$ptero_dir" && php artisan down)
$has_pteroq && systemctl disable --now pteroq
for cron_user in root "$web_user"; do
  if has_cron "$cron_user" "$ptero_dir/artisan schedule:run"; then
    crontab -l -u "$cron_user" | awk -v s="$ptero_dir/artisan schedule:run" 'index($0, s) && $0 !~ /^[[:space:]]*#/ { $0 = "# " $0 } { print }' | crontab -u "$cron_user" -
    echo "Disabled the Pterodactyl cron job for $cron_user"
  fi
done

run "Installing Pelican"
mkdir -p "$PELICAN_DIR"
cp -a "$tmp/panel/." "$PELICAN_DIR/"
cd "$PELICAN_DIR"
cp "$env_file" .env
sed -i -E '/^(HASHIDS_SALT|HASHIDS_LENGTH|APP_THEME|APP_ENVIRONMENT_ONLY|DB_CONNECTION)=/d' .env
printf '\nDB_CONNECTION=%s\n' "$db_connection" >> .env  # leading newline in case .env lacks a trailing one
COMPOSER_ALLOW_SUPERUSER=1 "${composer[@]}" install --no-dev --optimize-autoloader --no-interaction
rm -f bootstrap/cache/config.php

run "Upgrading the database"
php artisan optimize:clear
php artisan migrate --seed --force
php artisan storage:link

run "Setting permissions"
chmod -R 755 storage/* bootstrap/cache/
chown -R "$web_user:$web_group" "$PELICAN_DIR"

run "Setting up the queue worker"
php artisan p:environment:queue-service --service-name=pelican-queue --user="$web_user" --group="$web_group" --overwrite --no-interaction
systemctl is-active --quiet pelican-queue

run "Setting up the cron job"
cron_line="* * * * * php $PELICAN_DIR/artisan schedule:run >> /dev/null 2>&1"
if ! has_cron "$web_user" "$PELICAN_DIR/artisan schedule:run"; then
  (crontab -l -u "$web_user" 2>/dev/null || true; echo "$cron_line") | crontab -u "$web_user" -
fi

run "Bringing Pelican online"
php artisan up

trap - ERR
cat <<EOF

Pelican is installed and your data is migrated.

Next steps:
  1. Point your webserver at $PELICAN_DIR/public and disable the Pterodactyl site:
     https://pelican.dev/docs/panel/webserver-config
  2. On every node, migrate Wings:
     https://pelican.dev/docs/guides/migrating-from-pterodactyl#migrate-wings

Your users log in with their existing email or username and password.
Need help? Ask on Discord: $DISCORD
EOF
