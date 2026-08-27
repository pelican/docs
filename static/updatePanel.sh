#!/bin/bash
# Pelican Panel – Incremental Git-Based Update Script
# Applies only the files that changed between the current version and the latest release.

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# 0a.  Dependency check – git must be available
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo "git is not installed or not in PATH. Please install git and re-run this script." >&2
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 0b.  Root check
# ─────────────────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root or with sudo." >&2
  exit 1
fi

PANEL_REPO="https://github.com/pelican/panel.git"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# ─────────────────────────────────────────────────────────────────────────────
# 0c.  Log file – tee all output so we can upload it later
# ─────────────────────────────────────────────────────────────────────────────
LOG_FILE="/tmp/pelican_update_${TIMESTAMP}.log"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "Update log: $LOG_FILE"

# Upload log to logs.pelican.dev and print the URL.
upload_log() {
  if ! command -v curl &>/dev/null; then
    echo "curl not found – cannot upload log." >&2
    return 1
  fi
  local content
  content=$(cat "$LOG_FILE")
  local response
  response=$(curl -s -w "\n%{http_code}" \
    -F "c=$content" \
    -F "e=14d" \
    "https://logs.pelican.dev")
  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    # Parse the url field from JSON response
    local paste_url
    paste_url=$(echo "$body" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || true)
    if [ -n "$paste_url" ]; then
      echo ""
      echo "  ✓ Log uploaded."
      echo "  URL: $paste_url"
      echo ""
    else
      echo "Uploaded but could not parse URL from response: $body"
    fi
  else
    echo "Upload failed (HTTP $http_code): $body" >&2
    return 1
  fi
}

# Offer to upload the log – called on success and on error traps.
offer_log_upload() {
  echo ""
  echo "Log saved to: $LOG_FILE"
  echo "Note: the log contains command output, file paths, and version information from this run."
  read -rp "Upload log to logs.pelican.dev to share? (y/n) [n]: " upload_confirm </dev/tty || true
  upload_confirm="${upload_confirm:-n}"
  if [[ "${upload_confirm,,}" == "y" ]]; then
    upload_log
  fi
}

# Trap unexpected exits so we always offer the upload on failure.
_error_handler() {
  local exit_code=$?
  echo ""
  echo "Script exited unexpectedly (exit code $exit_code)."
  # Attempt to bring the panel back online if artisan down was already run
  if [ -n "${install_dir:-}" ] && [ -f "${install_dir}/artisan" ]; then
    echo "Attempting to bring the panel back online..."
    (cd "$install_dir" && php artisan up) || echo "WARNING: php artisan up failed — run manually: cd $install_dir && php artisan up"
  fi
  offer_log_upload
  exit "$exit_code"
}
trap '_error_handler' ERR

# ─────────────────────────────────────────────────────────────────────────────
# 1.  Installation directory
# ─────────────────────────────────────────────────────────────────────────────
read -rp "Enter the directory for the panel location [/var/www/pelican]: " install_dir
install_dir="${install_dir:-/var/www/pelican}"

if [ ! -d "$install_dir" ]; then
  echo "Directory $install_dir does not exist. Exiting..."
  exit 1
fi

env_file="$install_dir/.env"
if [ ! -f "$env_file" ]; then
  echo "File $env_file does not exist. Exiting..."
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2.  Owner / group (auto-detect with fallback)
# ─────────────────────────────────────────────────────────────────────────────
owner=$(stat -c '%U' "$install_dir" 2>/dev/null || echo "www-data")
read -rp "Enter the owner of the files [$owner]: " owner_input
owner="${owner_input:-$owner}"

group=$(stat -c '%G' "$install_dir" 2>/dev/null || echo "www-data")
read -rp "Enter the group of the files [$group]: " group_input
group="${group_input:-$group}"

read -rp "Show detailed file change list during update? (y/n) [n]: " verbose_confirm </dev/tty || true
verbose_confirm="${verbose_confirm:-n}"
VERBOSE=false
[[ "${verbose_confirm,,}" == "y" ]] && VERBOSE=true

# ─────────────────────────────────────────────────────────────────────────────
# 3.  Detect current version
# ─────────────────────────────────────────────────────────────────────────────
current_version=""

config_app="$install_dir/config/app.php"
if [ -f "$config_app" ]; then
  current_version=$(grep -oP "'version'\s*=>\s*'\K[^']+" "$config_app" | tr -d '[:space:]' || true)
fi

if [ -z "$current_version" ]; then
  read -rp "Could not detect current version from config/app.php. Enter it manually (e.g. v1.0.0-beta34): " current_version
fi

# Normalise: ensure leading 'v'
[[ "$current_version" != v* ]] && current_version="v${current_version}"
echo "Current installed version: $current_version"

# ─────────────────────────────────────────────────────────────────────────────
# 4.  Clone / update a local mirror of the panel repo
# ─────────────────────────────────────────────────────────────────────────────
tmp_repo="/tmp/pelican_panel_repo_${TIMESTAMP}"
echo ""
echo "Cloning Pelican Panel repository to $tmp_repo (this may take a moment)..."
git clone --bare "$PANEL_REPO" "$tmp_repo" --quiet

# Point git at the bare repo without cd-ing into it.
# Some git versions (safe.bareRepository=explicit) refuse diff/show when the
# bare repo is merely the CWD; setting GIT_DIR explicitly is always accepted.
export GIT_DIR="$tmp_repo"

# Fetch all tags
git fetch --tags --quiet

# ─────────────────────────────────────────────────────────────────────────────
# 5.  Collect and sort version tags
# ─────────────────────────────────────────────────────────────────────────────
mapfile -t all_tags < <(git tag -l 'v*' | sort -V)

if [ ${#all_tags[@]} -eq 0 ]; then
  echo "No version tags found in the repository. Exiting..."
  rm -rf "$tmp_repo"
  exit 1
fi

latest_version="${all_tags[-1]}"
echo "Latest available version: $latest_version"

if [ "$current_version" = "$latest_version" ]; then
  echo "Panel is already up to date ($current_version). Nothing to do."
  rm -rf "$tmp_repo"
  trap - ERR
  offer_log_upload
  exit 0
fi

# Build the ordered list of versions strictly newer than current
upgrade_path=()
found_current=false
for tag in "${all_tags[@]}"; do
  if [ "$tag" = "$current_version" ]; then
    found_current=true
    continue
  fi
  if $found_current; then
    upgrade_path+=("$tag")
  fi
done

if [ ${#upgrade_path[@]} -eq 0 ]; then
  if ! $found_current; then
    echo "WARNING: Current version tag '$current_version' not found in repository."
    echo "Cannot determine safe upgrade path. Exiting."
  else
    echo "Panel is already at the latest known tag ($current_version). Nothing to do."
  fi
  rm -rf "$tmp_repo"
  exit 1
fi

echo ""
echo "Upgrade path:"
prev="$current_version"
for v in "${upgrade_path[@]}"; do
  echo "  $prev -> $v"
  prev="$v"
done

# ─────────────────────────────────────────────────────────────────────────────
# 6.  DB check
# ─────────────────────────────────────────────────────────────────────────────
db_connection=$(grep "^DB_CONNECTION=" "$env_file" | cut -d '=' -f2 | tr -d "\"'" || echo "sqlite")
db_connection="${db_connection:-sqlite}"
echo ""
echo "DB_CONNECTION: $db_connection"

db_database=""
if [ "$db_connection" = "sqlite" ]; then
  db_database=$(grep "^DB_DATABASE=" "$env_file" | cut -d '=' -f2 | tr -d "\"'" || true)
  db_database="${db_database:-database/database.sqlite}"
  # Resolve relative paths against the install directory
  if [[ "$db_database" != /* ]]; then
    db_database="$install_dir/$db_database"
  fi
  # If the resolved path doesn't exist but the file lives in the database/ subdirectory, try that
  if [ ! -f "$db_database" ] && [ -f "$install_dir/database/$(basename "$db_database")" ]; then
    db_database="$install_dir/database/$(basename "$db_database")"
  fi
  echo "SQLite database: $db_database"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7.  Backup
# ─────────────────────────────────────────────────────────────────────────────
read -rp "Do you want to create a backup before updating? (y/n) [y]: " backup_confirm
backup_confirm="${backup_confirm:-y}"
if [[ "${backup_confirm,,}" != "y" ]]; then
  echo "Backup canceled. Aborting."
  rm -rf "$tmp_repo"
  exit 1
fi

backup_dir="$install_dir/backup_${TIMESTAMP}"
mkdir -p "$backup_dir/storage/app"
echo "Backup directory: $backup_dir"

cp -a "$env_file" "$backup_dir/.env.backup"
echo "  ✓ Backed up .env"

if [ -d "$install_dir/storage/app/public" ]; then
  cp -a "$install_dir/storage/app/public" "$backup_dir/storage/app/"
  echo "  ✓ Backed up storage/app/public"
fi

if [ "$db_connection" = "sqlite" ]; then
  if ! command -v sqlite3 &>/dev/null; then
    echo "ERROR: sqlite3 is required to back up the SQLite database but is not installed. Install sqlite3 and re-run." >&2
    rm -rf "$tmp_repo"
    exit 1
  fi
  if [ ! -f "$db_database" ]; then
    echo "ERROR: SQLite database not found at '$db_database'. Aborting."
    rm -rf "$tmp_repo"
    exit 1
  fi
  db_backup_file="$backup_dir/$(basename "$db_database").backup"
  sqlite3 "$db_database" ".backup '$db_backup_file'"
  echo "  ✓ Backed up SQLite database"
else
  echo ""
  echo "WARNING: MySQL/MariaDB databases are NOT backed up by this script."
  read -rp "Pause now and make your own DB backup, then continue? (y/n) [y]: " db_warn
  db_warn="${db_warn:-y}"
  if [[ "${db_warn,,}" != "y" ]]; then
    echo "Update canceled."
    rm -rf "$tmp_repo"
    exit 1
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8.  Paths that are never overwritten
# ─────────────────────────────────────────────────────────────────────────────
PROTECTED_PATHS=(
  ".env"
  "storage/app/public"
)
# Add the dynamic SQLite path if applicable
if [ "$db_connection" = "sqlite" ] && [ -n "$db_database" ]; then
  if [[ "$db_database" == "$install_dir/"* ]]; then
    db_rel_path="${db_database#$install_dir/}"
    PROTECTED_PATHS+=("$db_rel_path")
  else
    echo "NOTE: SQLite database is outside the install directory; it will not be overwritten by the update."
  fi
fi

is_protected() {
  local file="$1"
  for protected in "${PROTECTED_PATHS[@]}"; do
    if [[ "$file" == "$protected" || "$file" == "$protected/"* ]]; then
      return 0
    fi
  done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# 9.  Put the panel into maintenance mode
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Putting panel into maintenance mode..."
(cd "$install_dir" && php artisan down) || echo "WARNING: php artisan down failed — continuing anyway."

# ─────────────────────────────────────────────────────────────────────────────
# 10.  Apply each version hop
# ─────────────────────────────────────────────────────────────────────────────
needs_composer=false
needs_migrations=false
any_changes=false

prev_tag="$current_version"

for next_tag in "${upgrade_path[@]}"; do
  echo ""
  echo "-----------------------------------------"
  echo " Applying changes: $prev_tag -> $next_tag"
  echo "-----------------------------------------"

  # Capture diff output to a temp file so we can:
  #   1. Read exit code reliably (process-substitution swallows it).
  #   2. Read the file cleanly without subshell/pipefail edge-cases.
  diff_file=$(mktemp)
  diff_err_file=$(mktemp)
  diff_exit=0
  git diff --name-status "${prev_tag}" "${next_tag}" > "$diff_file" 2>"$diff_err_file" || diff_exit=$?

  added=0; modified=0; deleted=0; renamed=0; skipped=0; diff_lines=0

  if [ "$diff_exit" -ne 0 ]; then
    echo "  [ERROR]  git diff failed (exit $diff_exit) for ${prev_tag}..${next_tag}:"
    cat "$diff_err_file"
    rm -f "$diff_file" "$diff_err_file"
    exit 1
  fi
  rm -f "$diff_err_file"

  while IFS=$'\t' read -r status old_path new_path; do
    ((diff_lines++)) || true

    # For non-rename/copy entries new_path is empty; the target file is old_path
    file="${new_path:-$old_path}"

    case "$status" in
      A|M|C*)
        # Added, Modified, Copied -> extract from next_tag and write
        if is_protected "$file"; then
          echo "  [SKIP ]  $file  (protected)"
          ((skipped++)) || true
          continue
        fi
        dest="$install_dir/$file"
        mkdir -p "$(dirname "$dest")"
        tmp_dest="$(mktemp "$(dirname "$dest")/.tmp_XXXXXX")"
        if git show "${next_tag}:${file}" > "$tmp_dest" 2>/dev/null && mv -f "$tmp_dest" "$dest"; then
          if [ "$status" = "A" ]; then
            $VERBOSE && echo "  [ADD  ]  $file"
            ((added++)) || true
          else
            $VERBOSE && echo "  [MOD  ]  $file"
            ((modified++)) || true
          fi
          [[ "$file" == composer.json || "$file" == composer.lock ]] && needs_composer=true
          [[ "$file" == database/migrations/* || "$file" == database/Seeders/* ]] && needs_migrations=true
        else
          rm -f "$tmp_dest"
          echo "  [WARN ]  Could not extract $file from $next_tag"
          ((skipped++)) || true
        fi
        ;;

      R*)
        # Renamed -> write new path first, then remove old path
        if is_protected "$file"; then
          echo "  [SKIP ]  $file  (protected)"
          ((skipped++)) || true
          continue
        fi
        dest="$install_dir/$file"
        mkdir -p "$(dirname "$dest")"
        tmp_dest="$(mktemp "$(dirname "$dest")/.tmp_XXXXXX")"
        if git show "${next_tag}:${file}" > "$tmp_dest" 2>/dev/null; then
          mv "$tmp_dest" "$dest"
          if ! is_protected "$old_path" && [ -f "$install_dir/$old_path" ]; then
            rm -f "$install_dir/$old_path"
            $VERBOSE && echo "  [DEL  ]  $old_path  (renamed)"
            ((deleted++)) || true
          fi
          $VERBOSE && echo "  [ADD  ]  $file  (renamed from $old_path)"
          ((renamed++)) || true
          [[ "$file" == composer.json || "$file" == composer.lock ]] && needs_composer=true
          [[ "$file" == database/migrations/* ]] && needs_migrations=true
        else
          rm -f "$tmp_dest"
          echo "  [WARN ]  Could not extract $file from $next_tag"
          ((skipped++)) || true
        fi
        ;;

      D)
        # Deleted
        if is_protected "$file"; then
          echo "  [SKIP ]  $file  (protected)"
          ((skipped++)) || true
          continue
        fi
        if [ -f "$install_dir/$file" ]; then
          rm -f "$install_dir/$file"
          $VERBOSE && echo "  [DEL  ]  $file"
          ((deleted++)) || true
        fi
        ;;

      *)
        $VERBOSE && echo "  [SKIP ]  $file  (unhandled status: $status)"
        ((skipped++)) || true
        ;;
    esac
  done < "$diff_file"
  rm -f "$diff_file"

  if [ "$diff_lines" -eq 0 ]; then
    echo "  No file changes detected between $prev_tag and $next_tag."
  else
    any_changes=true
    echo ""
    echo "  Summary for $prev_tag -> $next_tag:"
    echo "    Added:    $added"
    echo "    Modified: $modified"
    echo "    Deleted:  $deleted"
    echo "    Renamed:  $renamed"
    echo "    Skipped:  $skipped"
  fi

  prev_tag="$next_tag"
done

# Delete temp repo
rm -rf "$tmp_repo"
unset GIT_DIR

# ─────────────────────────────────────────────────────────────────────────────
# 11.  Fetch the latest release (public/build + config/app.php version)
# ─────────────────────────────────────────────────────────────────────────────
# This is done for the final release 
echo ""
echo "Fetching release tarball for $latest_version to update public/build..."
release_tarball=$(mktemp --suffix=.tar.gz)
tarball_url="https://github.com/pelican/panel/releases/download/${latest_version}/panel.tar.gz"
if curl -fsSL "$tarball_url" -o "$release_tarball"; then
  # Wipe old compiled assets to prevent stale files
  rm -rf "${install_dir}/public/build"
  mkdir -p "${install_dir}/public/build"

  # Extract public/build (tarball root may be bare or wrapped in a subdirectory)
  tarball_listing=$(tar -tzf "$release_tarball" 2>/dev/null)
  if echo "$tarball_listing" | grep -q '^public/build/'; then
    tar -xzf "$release_tarball" -C "$install_dir" --strip-components=0 \
        --wildcards 'public/build/*' 2>/dev/null || true
  elif echo "$tarball_listing" | grep -q '/public/build/'; then
    # Wrapped in a top-level directory — strip one component
    tar -xzf "$release_tarball" -C "$install_dir" --strip-components=1 \
        --wildcards '*/public/build/*' 2>/dev/null || true
  else
    echo "  [WARN ]  public/build not found in release tarball for $latest_version"
  fi

  # Update config/app.php version to match the latest release tag (strip leading 'v')
  tag_version="${latest_version#v}"
  if [ -f "${install_dir}/config/app.php" ]; then
    sed -i "s/'version'[[:space:]]*=>[[:space:]]*'[^']*'/'version' => '${tag_version}'/" \
        "${install_dir}/config/app.php"
    echo "  [MOD  ]  config/app.php (version -> ${tag_version})"
  fi

  $VERBOSE && echo "  [OK   ]  public/build updated from release tarball."
else
  echo "  [WARN ]  Could not download release from $tarball_url — public/build not updated."
  echo "           Attempting to build assets locally with yarn (yarn install && yarn build)..."
  (
    cd "$install_dir"
    if yarn install 2>&1; then
      if yarn build 2>&1; then
        $VERBOSE && echo "  [OK   ]  Assets built successfully via yarn build."
      else
        echo "  [ERROR]  yarn build failed. Frontend assets will be outdated and/or broken :/"
        echo "           Try to run manually: cd $install_dir && yarn install && yarn build"
      fi
    else
      echo "  [ERROR]  yarn install failed. Frontend assets will be outdated and/or broken :/"
      echo "           Try to run manually: cd $install_dir && yarn install && yarn build"
    fi
  ) || true
fi
rm -f "$release_tarball"


# ─────────────────────────────────────────────────────────────────────────────
# 12.  Post-update steps
# ─────────────────────────────────────────────────────────────────────────────
if ! $any_changes; then
  echo ""
  echo "No file changes were applied. Panel may already be at $latest_version."
  echo ""
  echo "Bringing panel back online..."
  (cd "$install_dir" && php artisan up) || echo "WARNING: php artisan up failed — run manually: cd $install_dir && php artisan up"
  trap - ERR
  offer_log_upload
  exit 0
fi

cd "$install_dir"

if $needs_composer || [ ! -d "$install_dir/vendor" ]; then
  echo ""
  echo "Running Composer..."
  COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction
fi

echo ""
echo "Clearing & optimizing cache..."
php artisan optimize:clear
php artisan filament:optimize

echo ""
echo "Ensuring storage symlinks..."
php artisan storage:link

if $needs_migrations; then
  echo ""
  echo "Running database migrations..."
  php artisan migrate --seed --force
else
  # Always run migrations to be safe; migrations are idempotent
  echo ""
  echo "Running database migrations (idempotent)..."
  php artisan migrate --force
fi

echo ""
echo "Restarting queue workers..."
php artisan queue:restart

# ─────────────────────────────────────────────────────────────────────────────
# 13.  Permissions
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Setting permissions..."

chmod_cmd="chmod -R 755 \"$install_dir\"/storage/* \"$install_dir\"/bootstrap/cache"
chown_cmd="chown -R $owner:$group \"$install_dir\""

chmod -R 755 "$install_dir"/storage/* "$install_dir"/bootstrap/cache \
  || echo "WARNING: chmod failed – run manually: sudo $chmod_cmd"
chown -R "$owner:$group" "$install_dir" \
  || echo "WARNING: chown failed – run manually: sudo $chown_cmd"

# ─────────────────────────────────────────────────────────────────────────────
# 14.  Bring the panel back online
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Bringing panel back online..."
(cd "$install_dir" && php artisan up) || echo "WARNING: php artisan up failed — run manually: cd $install_dir && php artisan up"

# ─────────────────────────────────────────────────────────────────────────────
# 15.  Done
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " Panel updated: $current_version -> $latest_version"
echo "=================================================="
echo ""
echo "Backup saved to: $backup_dir"
echo ""
echo "If you had custom themes installed, rebuild assets manually:"
echo "  cd $install_dir && yarn install && yarn build"
echo ""
echo "To verify permissions:"
echo "  sudo $chmod_cmd"
echo "  sudo $chown_cmd"

# Disable the ERR trap so a clean exit doesn't trigger the error handler.
trap - ERR
offer_log_upload

exit 0
