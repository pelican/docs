#!/bin/bash
# Pelican Panel update script.
#
# Usage: update-panel.sh [--dir PATH] [--user USER] [--group GROUP] [--yes]
#
# Everything that can be checked is checked before the panel is touched. The new release is
# downloaded, checksum-verified and extracted to a temp dir, then synced over the install with
# rsync. Your .env, storage, plugins and SQLite database are never overwritten.

set -Eeuo pipefail

REPO="https://github.com/pelican/panel"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/pelican_update_$TIMESTAMP.log"

install_dir=""
owner=""
group=""
assume_yes=false

usage() {
  echo "Usage: $0 [--dir PATH] [--user USER] [--group GROUP] [--yes]"
  echo "  --dir PATH     Panel location (default /var/www/pelican)"
  echo "  --user USER    Owner of the panel files (default: current owner)"
  echo "  --group GROUP  Group of the panel files (default: current group)"
  echo "  --yes          Accept all defaults without prompting"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) install_dir="${2:?--dir needs a value}"; shift 2 ;;
    --user) owner="${2:?--user needs a value}"; shift 2 ;;
    --group) group="${2:?--group needs a value}"; shift 2 ;;
    -y|--yes) assume_yes=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root or with sudo." >&2
  exit 1
fi

if ! $assume_yes && ! { : </dev/tty; } 2>/dev/null; then
  echo "No terminal available for prompts, run again with --yes to accept the defaults." >&2
  exit 1
fi

exec > >(tee -a "$LOG_FILE") 2>&1
echo "Update log: $LOG_FILE"

# ask VAR "Question" default: prompts unless --yes, in which case the default is used.
ask() {
  local reply=""
  if ! $assume_yes; then
    read -rp "$2 [$3]: " reply </dev/tty || true
  fi
  printf -v "$1" '%s' "${reply:-$3}"
}

# confirm "Question" default(y/n): succeeds on yes.
confirm() {
  local answer
  ask answer "$1 (y/n)" "$2"
  [[ "${answer,,}" == y* ]]
}

upload_log() {
  local response http_code body paste_url
  response=$(curl -s -w "\n%{http_code}" -F "c=<$LOG_FILE" -F "e=14d" "https://logs.pelican.dev") || true
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  paste_url=$(echo "$body" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  if [[ "$http_code" == "200" && -n "$paste_url" ]]; then
    echo "  Log uploaded: $paste_url"
  else
    echo "  Log upload failed (HTTP $http_code): $body"
  fi
}

offer_log_upload() {
  echo ""
  echo "Log saved to: $LOG_FILE"
  echo "Note: the log contains command output, file paths, and version information from this run."
  if confirm "Upload log to logs.pelican.dev to share with the Pelican team?" n; then
    upload_log
  fi
}

tmp=""
backup_dir=""
in_maintenance=false
files_synced=false

on_exit() {
  local code=$?
  [[ -n "$tmp" ]] && rm -rf "$tmp"
  [[ $code -eq 0 ]] && return

  echo ""
  echo "Update failed (exit code $code)."
  if $files_synced; then
    # Files are already (partly) replaced, so bringing the panel up would serve broken code.
    echo "The panel was left in maintenance mode because its files were already being replaced."
    echo "Fix the error above, then run this script again to finish the update."
    echo "Backup: $backup_dir"
  elif $in_maintenance; then
    echo "No panel files were changed. Bringing the panel back online..."
    (cd "$install_dir" && php artisan up) || echo "Run manually: cd $install_dir && php artisan up"
  fi
  offer_log_upload
}
trap on_exit EXIT

env_get() {
  # Strip only matching surrounding quotes, so quotes inside a value (e.g. a password) are kept.
  grep -E "^$1=" "$install_dir/.env" | tail -n1 | cut -d '=' -f 2- | sed -E -e 's/^"(.*)"$/\1/' -e t -e "s/^'(.*)'$/\1/" || true
}

errors=()
warnings=()

fail_on_errors() {
  if [[ ${#errors[@]} -gt 0 ]]; then
    echo ""
    echo "Cannot update, please fix the following first:"
    printf '  - %s\n' "${errors[@]}"
    echo "Nothing was changed."
    exit 1
  fi
}

# ─── Preflight: nothing below changes the panel ────────────────────────────────

echo ""
echo "Checking requirements..."

missing=()
for cmd in curl tar rsync php composer sha256sum; do
  command -v "$cmd" >/dev/null || missing+=("$cmd")
done
[[ ${#missing[@]} -gt 0 ]] && errors+=("Missing required commands: ${missing[*]}")
fail_on_errors

[[ -n "$install_dir" ]] || ask install_dir "Enter the directory for the panel location" /var/www/pelican
for f in artisan .env config/app.php; do
  [[ -e "$install_dir/$f" ]] || errors+=("$install_dir/$f not found, is this a Pelican panel install?")
done
fail_on_errors
# Absolute, so paths stay right after the cd below (a relative --dir would otherwise point rsync at a nested dir).
install_dir=$(cd "$install_dir" && pwd -P)

# storage/ is never synced and must be writable by the web server, so its owner is the reliable default.
[[ -n "$owner" ]] || ask owner "Enter the owner of the files (www-data, apache, nginx)" "$(stat -c '%U' "$install_dir/storage")"
[[ -n "$group" ]] || ask group "Enter the group of the files (www-data, apache, nginx)" "$(stat -c '%G' "$install_dir/storage")"
id -u "$owner" >/dev/null 2>&1 || errors+=("User '$owner' does not exist")
getent group "$group" >/dev/null || errors+=("Group '$group' does not exist")
[[ "$owner" != "root" ]] || warnings+=("Files will be owned by root, the web server probably cannot write to storage. Use --user www-data (or your web server user)")

[[ -n "$(env_get APP_KEY)" ]] || errors+=("APP_KEY is not set in $install_dir/.env, without it your encrypted data cannot be read")

current_version=$(sed -n "s/.*'version' => '\([^']*\)'.*/\1/p" "$install_dir/config/app.php" | head -n1)
if [[ -z "$current_version" ]]; then
  current_version="unknown"
  warnings+=("Could not read the installed version from config/app.php")
fi

latest_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "$REPO/releases/latest") || true
latest_tag="${latest_url##*/}"
if [[ "$latest_tag" != v* ]]; then
  errors+=("Could not find the latest release at $REPO/releases/latest, check your network")
fi
fail_on_errors
latest_version="${latest_tag#v}"

if [[ "$current_version" != "unknown" ]]; then
  # version_compare orders pre-releases correctly (1.0.0-rc.1 < 1.0.0), unlike sort -V.
  # shellcheck disable=SC2016
  cmp=$(php -r 'echo version_compare($argv[1], $argv[2]);' "$current_version" "$latest_version")
  if [[ "$cmp" == "0" && -f "$install_dir/storage/framework/down" ]]; then
    # A failed run leaves the new config/app.php in place, so only maintenance mode tells us it didn't finish.
    warnings+=("The panel is in maintenance mode, likely from an unfinished update. $latest_version will be applied again")
  elif [[ "$cmp" == "0" ]]; then
    echo "The panel is already on the latest version ($latest_version)."
    confirm "Reinstall $latest_version anyway?" n || exit 0
  elif [[ "$cmp" == "1" ]]; then
    warnings+=("Installed version $current_version is newer than the latest release $latest_version, this will downgrade the panel")
  fi
fi

echo "Downloading $latest_tag..."
tmp=$(mktemp -d)
curl -fsSL -o "$tmp/panel.tar.gz" "$REPO/releases/download/$latest_tag/panel.tar.gz"
expected_checksum=$(curl -fsSL "$REPO/releases/download/$latest_tag/checksum.txt" | awk '{ print $1 }') || true
calculated_checksum=$(sha256sum "$tmp/panel.tar.gz" | awk '{ print $1 }')
if [[ -z "$expected_checksum" || "$expected_checksum" != "$calculated_checksum" ]]; then
  errors+=("Checksum mismatch for panel.tar.gz (expected '$expected_checksum', got '$calculated_checksum'), the download may be corrupted")
fi
fail_on_errors
echo "Checksum verified."

mkdir "$tmp/stage"
tar -xzf "$tmp/panel.tar.gz" -C "$tmp/stage"
for f in artisan composer.json composer.lock; do
  [[ -e "$tmp/stage/$f" ]] || errors+=("The release tarball is missing $f")
done
fail_on_errors

needs_build=false
if [[ ! -f "$tmp/stage/public/build/manifest.json" ]]; then
  needs_build=true
  if command -v yarn >/dev/null; then
    warnings+=("The release has no prebuilt frontend assets, they will be built with yarn")
  else
    warnings+=("The release has no prebuilt frontend assets and yarn is not installed, the panel UI may be broken until you run: yarn install && yarn build")
  fi
fi

export COMPOSER_ALLOW_SUPERUSER=1
if ! platform_output=$(composer check-platform-reqs --no-dev --lock --no-interaction -d "$tmp/stage" 2>&1); then
  errors+=("Your PHP $(php -r 'echo PHP_VERSION;') does not meet the requirements of $latest_tag:
$(echo "$platform_output" | grep -wE 'missing|failed' | sed 's/^/      /' || true)")
fi

cli_php=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
fpm_versions=$(find /run/php -maxdepth 1 -name 'php*-fpm.sock' 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | sort -u | tr '\n' ' ' || true)
if [[ -n "$fpm_versions" && " $fpm_versions" != *" $cli_php "* ]]; then
  warnings+=("PHP CLI is $cli_php but PHP-FPM is running ${fpm_versions% }, your web server may use a different PHP than this update checked")
fi

# Composer before 2.8.10 floods the output with deprecation notices on PHP 8.4+.
composer_version=$(composer --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
if [[ -n "$composer_version" ]] && printf '%s\n' 8.4 "$cli_php" | sort -VC && ! printf '%s\n' 2.8.10 "$composer_version" | sort -VC; then
  warnings+=("Composer $composer_version prints deprecation notices on PHP $cli_php, they are harmless. Silence them with: composer self-update")
fi

db_connection=$(env_get DB_CONNECTION)
db_connection="${db_connection:-sqlite}"
db_file=""
dump_cmd=""
case "$db_connection" in
  sqlite)
    db_database=$(env_get DB_DATABASE)
    db_database="${db_database:-database.sqlite}"
    if [[ "$db_database" == /* ]]; then db_file="$db_database"; else db_file="$install_dir/database/$db_database"; fi
    [[ -f "$db_file" ]] || errors+=("SQLite database $db_file not found")
    ;;
  mysql|mariadb)
    dump_cmd=$(command -v mariadb-dump || command -v mysqldump || true)
    [[ -n "$dump_cmd" ]] || warnings+=("mysqldump is not installed, your $db_connection database will NOT be backed up. Make your own backup before continuing!")
    ;;
  *)
    warnings+=("Database backups are not supported for $db_connection, make your own backup before continuing!")
    ;;
esac

if compgen -G "$install_dir/plugins/*/" >/dev/null; then
  warnings+=("Plugins are installed, check that they support $latest_version")
fi

warnings+=("Changes you made to panel files (custom themes, edited views, etc.) will be overwritten. Your .env, storage, plugins and database are kept")

needed_kb=$(( $(du -sk "$tmp/stage" | cut -f1) + 102400 ))
[[ -d "$install_dir/storage/app/public" ]] && needed_kb=$(( needed_kb + $(du -sk "$install_dir/storage/app/public" | cut -f1) ))
[[ -n "$db_file" && -f "$db_file" ]] && needed_kb=$(( needed_kb + $(du -sk "$db_file" | cut -f1) ))
available_kb=$(df -Pk "$install_dir" | awk 'NR==2 { print $4 }')
if [[ "$available_kb" -lt "$needed_kb" ]]; then
  errors+=("Not enough disk space in $install_dir: $((available_kb / 1024)) MB free, about $((needed_kb / 1024)) MB needed")
fi

fail_on_errors

backup_dir="$install_dir/backup_$TIMESTAMP"
echo ""
echo "=================================================="
echo " Panel:   $install_dir ($owner:$group, $db_connection)"
echo " Update:  $current_version -> $latest_version"
echo " Backup:  $backup_dir"
echo " Release: $REPO/releases/tag/$latest_tag"
echo "=================================================="
if [[ ${#warnings[@]} -gt 0 ]]; then
  echo "Warnings:"
  printf '  - %s\n' "${warnings[@]}"
fi
echo ""
if ! confirm "Continue with the update?" y; then
  echo "Update canceled, nothing was changed."
  exit 0
fi

# ─── Backup ────────────────────────────────────────────────────────────────────

echo ""
echo "Backing up to $backup_dir..."
mkdir -p "$backup_dir/storage/app"
chmod 700 "$backup_dir"
cp -a "$install_dir/.env" "$backup_dir/.env.backup"
echo "  Backed up .env"
if [[ -d "$install_dir/storage/app/public" ]]; then
  cp -a "$install_dir/storage/app/public" "$backup_dir/storage/app/"
  echo "  Backed up storage/app/public"
fi
if [[ -n "$db_file" ]]; then
  # VACUUM INTO gives a consistent copy (including WAL contents) while the panel is still online;
  # it uses PHP's pdo_sqlite, which the panel already needs, so no sqlite3 CLI is required.
  # shellcheck disable=SC2016
  php -r '$db = new PDO("sqlite:" . $argv[1]); $db->exec("VACUUM INTO " . $db->quote($argv[2]));' \
    "$db_file" "$backup_dir/$(basename "$db_file").backup"
  echo "  Backed up SQLite database"
elif [[ -n "$dump_cmd" ]]; then
  db_socket=$(env_get DB_SOCKET)
  if [[ -n "$db_socket" ]]; then
    # Same as Laravel: DB_SOCKET (unix_socket) wins over host/port.
    db_target=(--socket="$db_socket")
  else
    db_host=$(env_get DB_HOST)
    db_port=$(env_get DB_PORT)
    db_target=(-h "${db_host:-127.0.0.1}" -P "${db_port:-3306}")
  fi
  MYSQL_PWD="$(env_get DB_PASSWORD)" "$dump_cmd" --single-transaction --no-tablespaces "${db_target[@]}" \
    -u "$(env_get DB_USERNAME)" "$(env_get DB_DATABASE)" > "$backup_dir/database.sql"
  echo "  Backed up $db_connection database"
fi

# ─── Update ────────────────────────────────────────────────────────────────────

cd "$install_dir"

echo ""
if [[ -f storage/framework/down ]]; then
  # Already down (e.g. a failed earlier run, where artisan may not even boot). Leave it down on failure.
  echo "Panel is already in maintenance mode."
else
  echo "Enabling maintenance mode..."
  # Pre-rendered so visitors get a 503 page, not a 500, while the files are being replaced.
  php artisan down --render="errors::503"
  in_maintenance=true
fi

echo "Updating panel files..."
# Set before rsync: if it fails halfway, the files are already mixed and the panel must stay down.
files_synced=true
db_excludes=()
if [[ "$db_file" == "$install_dir/"* ]]; then
  # An SQLite file kept somewhere else inside the install (absolute DB_DATABASE) must survive --delete too.
  db_excludes=(--exclude="/${db_file#"$install_dir"/}" --exclude="/${db_file#"$install_dir"/}-*")
fi
rsync -a --no-owner --no-group --delete \
  --exclude=/.env --exclude=/storage/ --exclude=/plugins/ --exclude=/vendor/ \
  --exclude=/node_modules/ --exclude='/backup*' --exclude='/database/*.sqlite*' \
  --exclude=/public/storage "${db_excludes[@]}" \
  "$tmp/stage/" "$install_dir/"
# Add any new storage folders from the release without touching existing files.
rsync -a --no-owner --no-group --ignore-existing "$tmp/stage/storage/" "$install_dir/storage/"

echo "Installing Composer dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction --no-progress

if $needs_build; then
  echo "Building frontend assets..."
  if ! command -v yarn >/dev/null || ! { yarn install && yarn build; }; then
    echo "WARNING: Could not build frontend assets. Run manually: cd $install_dir && yarn install && yarn build"
  fi
fi

echo "Optimizing..."
php artisan optimize:clear
php artisan filament:optimize

if [[ ! -e public/storage ]]; then
  echo "Creating storage symlink..."
  php artisan storage:link
fi

echo "Updating database..."
php artisan migrate --seed --force

echo "Setting permissions..."
chmod -R 755 "$install_dir"/storage/* "$install_dir"/bootstrap/cache || echo "WARNING: chmod failed"
chown -R "$owner:$group" "$install_dir" || echo "WARNING: chown failed"

php artisan queue:restart
php artisan up
in_maintenance=false

echo ""
echo "=================================================="
echo " Panel updated: $current_version -> $latest_version"
echo "=================================================="
echo "Backup saved to: $backup_dir"
echo ""
echo "If you had custom themes installed, rebuild the panel assets:"
echo "  cd $install_dir && yarn install && yarn build"
offer_log_upload
