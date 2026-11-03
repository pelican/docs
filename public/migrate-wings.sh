#!/bin/bash
# Migrates Pterodactyl Wings to Pelican Wings. Run it on every node.
# Guide: https://pelican.dev/docs/guides/migrating-from-pterodactyl
#
#   sudo bash migrate-wings.sh --check   # only run the checks, change nothing
#   sudo bash migrate-wings.sh           # run the checks, then migrate

set -Eeuo pipefail

DISCORD="https://pelican.dev/discord"
OLD_CONFIG="/etc/pterodactyl/config.yml"
NEW_CONFIG="/etc/pelican/config.yml"
WINGS_BIN="/usr/local/bin/wings"
SERVICE="/etc/systemd/system/wings.service"

check_only=false
case "${1:-}" in
  "") ;;
  --check) check_only=true ;;
  *) echo "Usage: sudo bash $0 [--check]" >&2; exit 1 ;;
esac

errors=()
ok()   { echo "  ok    $1"; }
fail() { echo "  FAIL  $1"; errors+=("$1"); }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Pelican Wings migration from Pterodactyl"
echo
echo "Checking your system. Nothing is changed until you confirm."
echo

[ "$EUID" -eq 0 ] && ok "Running as root" || { echo "This script must be run as root or with sudo." >&2; exit 1; }
[ -d /run/systemd/system ] && ok "systemd" || fail "systemd is not running."

case "$(uname -m)" in
  x86_64) arch=amd64 ;;
  aarch64) arch=arm64 ;;
  *) arch=""; fail "Unsupported architecture $(uname -m). Wings supports x86_64 and arm64." ;;
esac
[ -n "$arch" ] && ok "Architecture $(uname -m)"

for tool in curl sha256sum systemctl docker; do
  command -v "$tool" >/dev/null 2>&1 || fail "Missing tool: $tool"
done
docker info >/dev/null 2>&1 && ok "Docker is running" || fail "Docker is not running. Wings needs Docker."

if [ ! -f "$OLD_CONFIG" ]; then
  fail "$OLD_CONFIG does not exist. Is this a Pterodactyl node?"
else
  missing=()
  for key in uuid token_id token remote; do
    grep -qE "^$key:" "$OLD_CONFIG" || missing+=("$key")
  done
  [ ${#missing[@]} -eq 0 ] && ok "Found $OLD_CONFIG" || fail "$OLD_CONFIG is missing: ${missing[*]}"

  # Pelican Wings has different defaults (/var/lib/pelican, user pelican), so these must be spelled out.
  # Pterodactyl Wings writes them on every start.
  missing=()
  for key in root_directory data username; do
    grep -qE "^\s+$key:" "$OLD_CONFIG" || missing+=("system.$key")
  done
  [ ${#missing[@]} -eq 0 ] && ok "Data paths and user are set in $OLD_CONFIG" || fail "$OLD_CONFIG doesn't set ${missing[*]}. Start Pterodactyl Wings once so it writes its full config, then run this again."
fi

[ -x "$WINGS_BIN" ] && ok "Found $WINGS_BIN" || fail "$WINGS_BIN does not exist."
[ -f "$SERVICE" ] && ok "Found $SERVICE" || fail "$SERVICE does not exist."
[ ! -e "$NEW_CONFIG" ] && ok "$NEW_CONFIG is free" || fail "$NEW_CONFIG already exists. Was this node already migrated?"

if [ -n "$arch" ]; then
  url="https://github.com/pelican/wings/releases/latest/download"
  if curl -fsSL -o "$tmp/wings_linux_$arch" "$url/wings_linux_$arch" && curl -fsSL -o "$tmp/checksums.txt" "$url/checksums.txt"; then
    if (cd "$tmp" && grep " wings_linux_$arch\$" checksums.txt | sha256sum -c --status); then
      chmod +x "$tmp/wings_linux_$arch"
      if new_version=$("$tmp/wings_linux_$arch" version 2>&1 | head -n1); then
        ok "Downloaded Pelican Wings ($new_version, checksum verified)"
      else
        fail "The downloaded Wings binary doesn't run: $new_version"
      fi
    else
      fail "The Wings download doesn't match its checksum. Try again later."
    fi
  else
    fail "Couldn't download Wings from GitHub."
  fi
fi

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

remote=$(grep -E '^remote:' "$OLD_CONFIG" | sed -E "s/^remote:\s*['\"]?([^'\"]*)['\"]?\s*$/\1/")
echo
echo "This node connects to the Panel at: $remote"
read -rp "New Panel URL, if it changed (leave empty to keep it): " new_remote
new_remote=${new_remote%/}
# Strict on purpose: the URL ends up in a sed replacement and a YAML value.
if [ -n "$new_remote" ] && [[ ! "$new_remote" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$ ]]; then
  echo "That doesn't look like a Panel URL. Use something like https://panel.example.com" >&2
  exit 1
fi

cat <<EOF

This will:
  1. Stop Wings (your game servers keep running)
  2. Replace $WINGS_BIN with Pelican Wings
  3. Copy $OLD_CONFIG to $NEW_CONFIG
  4. Update $SERVICE and start Wings again

Server files stay where they are. Make sure you have a backup of $OLD_CONFIG.

EOF
read -rp "Type 'yes' to continue: " confirm
[ "$confirm" = "yes" ] || { echo "Canceled."; exit 1; }

trap 'echo; echo "Something went wrong. Check: journalctl -u wings -n 50"; echo "Need help? Ask on Discord: $DISCORD"' ERR

echo
echo "==> Stopping Wings"
systemctl stop wings

echo "==> Installing Pelican Wings"
install -m 755 "$tmp/wings_linux_$arch" "$WINGS_BIN"

echo "==> Moving the config"
mkdir -p /etc/pelican
cp -p "$OLD_CONFIG" "$NEW_CONFIG"
[ -n "$new_remote" ] && sed -i -E "s|^remote:.*|remote: '$new_remote'|" "$NEW_CONFIG"

echo "==> Updating the service"
cat > "$SERVICE" <<'EOF'
[Unit]
Description=Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pelican
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now wings

echo "==> Waiting for Wings to start"
sleep 10
if ! systemctl is-active --quiet wings; then
  journalctl -u wings -n 30 --no-pager
  echo
  echo "Wings didn't start. See the log above."
  echo "Need help? Ask on Discord: $DISCORD"
  exit 1
fi

trap - ERR
cat <<EOF

Wings is migrated and running.
Check the node in the Pelican admin area: its heartbeat should turn green within a minute.
Need help? Ask on Discord: $DISCORD
EOF
