#!/bin/bash
# Pelican one-command install: Docker Swarm, Traefik (automatic HTTPS) and the Panel, and Wings
# on the same server if you want it.
#
#   curl -fsSL https://pelican.dev/install.sh | sudo bash                   # on this server's IP
#   curl -fsSL https://pelican.dev/install.sh | sudo bash -s -- --domain panel.example.com \
#     --email you@example.com --profile production                        # HTTPS on a domain
#   curl -fsSL https://pelican.dev/install.sh | sudo bash -s -- --interactive  # asks you
#
# It asks nothing unless you pass --interactive: what you don't pass takes its default. Every
# option can also be an environment variable (PELICAN_DOMAIN, PELICAN_EMAIL, ... see --help),
# e.g. curl -fsSL https://pelican.dev/install.sh | sudo PELICAN_DOMAIN=panel.example.com \
#        PELICAN_EMAIL=you@example.com bash
#
# Docs: https://pelican.dev/docs/panel/install/ (every option, and how to change things later)
#
# What it does: checks the server, installs Docker if it's missing, starts a one-node Docker
# Swarm, and deploys a stack named "pelican" from /opt/pelican: Traefik on ports 80 and 443 and
# the Panel behind it. Without a domain the Panel is served on http://<this server's IP>; with
# --domain, Traefik gets a Let's Encrypt certificate on the first request and serves HTTPS (add
# the domain later and it switches). "production" adds MariaDB and Redis. With --wings it also
# installs Wings (the binary and systemd service, as in the docs).
#
# Settings live in /opt/pelican/pelican.env; change one and run /opt/pelican/deploy.sh. Running
# this script again keeps your keys and passwords, and updates the stack.

set -Eeuo pipefail

VERSION="1"
STACK="pelican"
DEFAULT_DIR="/opt/pelican"
PANEL_IMAGE_DEFAULT="ghcr.io/pelican/panel:latest"
TRAEFIK_IMAGE_DEFAULT="traefik:v3.7.19" # an exact version: updates are a change to this line
LE_PRODUCTION="https://acme-v02.api.letsencrypt.org/directory"
LE_STAGING="https://acme-staging-v02.api.letsencrypt.org/directory"
WINGS_RELEASES="https://github.com/pelican/wings/releases/latest/download"

# Address ranges, picked to stay clear of Docker's defaults (172.17/16), Wings' own network
# (172.18/16, pelican_nw) and the 10.0.0.0/x private networks many cloud providers use.
# Override them in the environment if they clash with your network.
SWARM_POOL="${PELICAN_SWARM_POOL:-10.203.0.0/16}"     # Swarm's overlay networks (/24 each)
GWBRIDGE_SUBNET="${PELICAN_GWBRIDGE_SUBNET:-10.204.0.0/24}" # docker_gwbridge: containers <-> host
PUBLIC_SUBNET="${PELICAN_PUBLIC_SUBNET:-10.203.250.0/24}"   # Traefik <-> Panel (TRUSTED_PROXIES)

# ---- Options -------------------------------------------------------------------------------
# Each starts from its PELICAN_* environment variable (for cloud-init and other tools); the
# command-line option wins over it.
truthy() { [[ "${1,,}" =~ ^(1|true|yes|y|on)$ ]]; }
falsy() { [[ "${1,,}" =~ ^(0|false|no|n|off)$ ]]; }

domain="${PELICAN_DOMAIN:-}"
email="${PELICAN_EMAIL:-}"
ip="${PELICAN_IP:-}"
profile="${PELICAN_PROFILE:-}"
with_wings=""
truthy "${PELICAN_WINGS:-}" && with_wings=yes
falsy "${PELICAN_WINGS:-}" && with_wings=no
wings_domain="${PELICAN_WINGS_DOMAIN:-}"
dir="${PELICAN_DIR:-$DEFAULT_DIR}"
panel_image="${PELICAN_IMAGE:-}"
staging=false
truthy "${PELICAN_STAGING:-}" && staging=true
check_dns=true
truthy "${PELICAN_SKIP_DNS_CHECK:-}" && check_dns=false
interactive=false
truthy "${PELICAN_INTERACTIVE:-}" && interactive=true
dry_run=false
truthy "${PELICAN_DRY_RUN:-}" && dry_run=true

usage() {
  cat <<EOF
Usage: install.sh [options]

It asks nothing unless you pass --interactive: what you don't pass takes its default (the Panel
on this server's IP, the quick profile, no Wings). Each option can also be set with the
environment variable in brackets; the option wins if both are set.

  --interactive          Ask for each choice, with explanations  [PELICAN_INTERACTIVE=1]
  --domain DOMAIN        Serve the Panel at this domain with HTTPS (Let's Encrypt), e.g.
                         panel.example.com; its DNS must point here. Without it the Panel is
                         served on http://<this server's IP>, and you can add a domain later.
                         [PELICAN_DOMAIN]
  --email EMAIL          Email for Let's Encrypt's notices (needed with --domain)  [PELICAN_EMAIL]
  --ip IP                The IP the Panel is served on without a domain (default: this
                         server's external IPv4 address, found automatically)  [PELICAN_IP]
  --profile NAME         quick: SQLite, the least to run (one server, small installs)
                         production: MariaDB and Redis (more servers and users)
                         (default quick)  [PELICAN_PROFILE]
  --wings, --no-wings    Install Wings on this server too, or not (default not)
                         [PELICAN_WINGS=1/0]
  --wings-domain DOMAIN  Wings' address with HTTPS, e.g. node.example.com (needs --wings and
                         --domain; without them Wings is on http://<IP>:8080)
                         [PELICAN_WINGS_DOMAIN]
  --dir PATH             Where the stack's files go (default $DEFAULT_DIR)  [PELICAN_DIR]
  --image IMAGE          Panel image (default $PANEL_IMAGE_DEFAULT)  [PELICAN_IMAGE]
  --staging              Use Let's Encrypt's staging server (test certificates, no rate
                         limits)  [PELICAN_STAGING=1]
  --skip-dns-check       Don't check that the domains point at this server (behind NAT, or
                         DNS that you set up afterwards: the certificate waits for it)
                         [PELICAN_SKIP_DNS_CHECK=1]
  --dry-run              Write the files to --dir (a temp folder by default) and show the plan;
                         change nothing on this server. No root needed.  [PELICAN_DRY_RUN=1]
  -h, --help             Show this help

With sudo, put the variables after it: curl ... | sudo PELICAN_DOMAIN=panel.example.com bash
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) domain="${2:?--domain needs a value}"; shift 2 ;;
    --email) email="${2:?--email needs a value}"; shift 2 ;;
    --ip) ip="${2:?--ip needs a value}"; shift 2 ;;
    --profile) profile="${2:?--profile needs a value}"; shift 2 ;;
    --wings) with_wings=yes; shift ;;
    --no-wings) with_wings=no; shift ;;
    --wings-domain) wings_domain="${2:?--wings-domain needs a value}"; shift 2 ;;
    --dir) dir="${2:?--dir needs a value}"; shift 2 ;;
    --image) panel_image="${2:?--image needs a value}"; shift 2 ;;
    --staging) staging=true; shift ;;
    --skip-dns-check) check_dns=false; shift ;;
    --dry-run) dry_run=true; shift ;;
    --interactive | -i) interactive=true; shift ;;
    -y|--yes) shift ;; # not asking is the default now; still accepted
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if $dry_run && [[ "$dir" == "$DEFAULT_DIR" ]]; then
  dir="$(mktemp -d -t pelican-install.XXXXXX)"
fi

# ---- Output --------------------------------------------------------------------------------
if [[ -t 1 ]]; then
  bold=$'\e[1m' dim=$'\e[2m' red=$'\e[31m' green=$'\e[32m' yellow=$'\e[33m' reset=$'\e[0m'
else
  bold="" dim="" red="" green="" yellow="" reset=""
fi
step() { printf '\n%s==> %s%s\n' "$bold" "$1" "$reset"; }
info() { printf '    %s\n' "$1"; }
ok() { printf '    %s✓%s %s\n' "$green" "$reset" "$1"; }
warn() { printf '    %s!%s %s\n' "$yellow" "$reset" "$1" >&2; }
die() { printf '\n%sError:%s %s\n' "$red" "$reset" "$1" >&2; exit 1; }

# run CMD...: runs a command, or in a dry run only shows it.
run() {
  if $dry_run; then
    printf '    %s$ %s%s\n' "$dim" "$*" "$reset"
  else
    "$@"
  fi
}

# quietly CMD...: runs a command and shows its output only if it fails (or, in a dry run, only
# shows the command). For commands that print what shouldn't be in the log, like swarm tokens.
quietly() {
  if $dry_run; then
    run "$@"
    return
  fi
  local output
  if ! output="$("$@" 2>&1)"; then
    printf '%s\n' "$output" >&2
    return 1
  fi
}

trap 'die "line $LINENO: \"$BASH_COMMAND\" failed. Nothing after this step ran; fix the cause and run the script again (it picks up where it stopped)."' ERR

# ---- Asking --------------------------------------------------------------------------------
can_ask() { $interactive && { : </dev/tty; } 2>/dev/null; }

# ask VAR "Question" default: prompts on the terminal (also under curl | bash).
ask() {
  local reply=""
  if can_ask; then
    read -rp "    $2${3:+ [$3]}: " reply </dev/tty || true
  fi
  printf -v "$1" '%s' "${reply:-$3}"
}

# confirm "Question" default(y/n): succeeds on yes.
confirm() {
  local answer
  ask answer "$1 (y/n)" "$2"
  [[ "${answer,,}" == y* ]]
}

valid_domain() { [[ "$1" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$ ]]; }
valid_ip() {
  local IFS=. part
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  for part in $1; do (( part <= 255 )) || return 1; done
}

# This server's external IPv4 address: what the internet sees (an outside service says), else
# the address of the interface that has the default route.
detect_ip() {
  local found
  found="$(curl -4 -fsS --max-time 5 https://ipv4.icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
  valid_ip "$found" || found="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' | head -1 || true)"
  valid_ip "$found" && printf '%s' "$found"
}

valid_email() { [[ "$1" =~ ^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$ ]]; }

# secret LENGTH: letters and digits only, so it is safe in YAML, .env files and URLs.
secret() {
  local out=""
  while [[ ${#out} -lt $1 ]]; do
    out+="$(head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
  done
  printf '%s' "${out:0:$1}"
}

if $interactive && ! { : </dev/tty; } 2>/dev/null; then
  die "--interactive needs a terminal to ask on: pass the options instead (see --help)."
fi

# ---- Saved settings ------------------------------------------------------------------------
env_file="$dir/pelican.env"
declare -A saved=()

# Reads KEY='value' lines written by save_settings (not sourced: nothing in it runs).
load_settings() {
  [[ -f "$env_file" ]] || return 0
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value#\'}"
    value="${value%\'}"
    saved[$key]="$value"
  done <"$env_file"
}

setting() { printf '%s' "${saved[$1]:-}"; }

load_settings

# A subnet chosen on the first run stays (the stack's network and TRUSTED_PROXIES use it), unless
# PELICAN_PUBLIC_SUBNET asks for another.
if [[ -z "${PELICAN_PUBLIC_SUBNET:-}" && -n "$(setting PUBLIC_SUBNET)" ]]; then
  PUBLIC_SUBNET="$(setting PUBLIC_SUBNET)"
fi

# ---- Gather the options ----------------------------------------------------------------------
step "Pelican install (script v$VERSION)"
$dry_run && info "Dry run: files go to $dir, nothing on this server changes."
[[ -f "$env_file" ]] && info "Found $env_file: keeping its keys and passwords."

domain="${domain:-$(setting PANEL_DOMAIN)}"
email="${email:-$(setting LE_EMAIL)}"
old_profile="$(setting PROFILE)"
profile="${profile:-$old_profile}"
wings_domain="${wings_domain:-$(setting WINGS_DOMAIN)}"
[[ -z "$with_wings" && -n "$wings_domain" ]] && with_wings=yes
panel_image="${panel_image:-$(setting PANEL_IMAGE)}"
panel_image="${panel_image:-$PANEL_IMAGE_DEFAULT}"

if [[ -z "$domain" && -z "$(setting PANEL_IP)" ]]; then
  if can_ask; then
    info "With a domain (its DNS pointing here) the Panel gets HTTPS right away. Without one it's"
    info "served on http://<this server's IP>, and you can add a domain later."
  fi
  ask domain "Domain for the Panel, e.g. panel.example.com (empty: use this server's IP)" ""
fi
if [[ -n "$domain" ]]; then
  valid_domain "$domain" || die "\"$domain\" isn't a domain name like panel.example.com."
  if [[ -z "$email" ]]; then
    $interactive || die "--email (or PELICAN_EMAIL) is needed with --domain: Let's Encrypt sends certificate notices to it."
    ask email "Your email, for Let's Encrypt" ""
  fi
  valid_email "$email" || die "\"$email\" isn't an email address."
  case "${email##*@}" in
    example.com | example.net | example.org | localhost)
      # A dry run only shows the plan, so the docs' placeholder works there; a real run stops.
      if $dry_run; then
        warn "Let's Encrypt refuses addresses at ${email##*@}: use a real email for the real run."
      else
        die "Let's Encrypt refuses addresses at ${email##*@}: use a real email (it only sends certificate notices)."
      fi ;;
  esac
fi

# The IP the Panel is served on without a domain (kept, so adding a domain later is a small step).
ip="${ip:-$(setting PANEL_IP)}"
if [[ -z "$ip" ]] && ! $dry_run; then
  ip="$(detect_ip || true)"
fi
if [[ -n "$ip" ]]; then
  valid_ip "$ip" || die "\"$ip\" isn't an IPv4 address."
elif [[ -z "$domain" ]]; then
  $dry_run || die "Couldn't find this server's IP address: pass it with --ip."
fi

if [[ -z "$profile" ]]; then
  if can_ask; then
    info "Profiles: quick = SQLite, the least to run, fine for one server and a small community."
    info "          production = MariaDB and Redis, for more servers, users and nodes."
  fi
  ask profile "Profile (quick/production)" "quick"
fi
[[ "$profile" == quick || "$profile" == production ]] || die "--profile is quick or production, not \"$profile\"."
if [[ -n "$old_profile" && "$profile" != "$old_profile" ]]; then
  die "This install uses the $old_profile profile. Switching to $profile would start on an empty database; move the data first (see the docs: panel/install), then change PROFILE in $env_file."
fi

if [[ -z "$with_wings" ]]; then
  if confirm "Install Wings on this server too, to run game servers here?" "n"; then with_wings=yes; else with_wings=no; fi
fi
if [[ "$with_wings" == yes && -n "$domain" ]]; then
  # The Panel uses HTTPS, so Wings must too: it gets its own domain, through Traefik.
  if [[ -z "$wings_domain" ]]; then
    $interactive || die "--wings-domain (or PELICAN_WINGS_DOMAIN) is needed with --wings and --domain (e.g. node.example.com): with HTTPS, Wings needs its own domain."
    ask wings_domain "Wings' domain (its DNS must point here too), e.g. node.example.com" ""
  fi
  valid_domain "$wings_domain" || die "\"$wings_domain\" isn't a domain name like node.example.com."
  [[ "$wings_domain" != "$domain" ]] || die "Wings needs its own domain, not the Panel's ($domain)."
elif [[ -n "$wings_domain" && -z "$domain" ]]; then
  die "--wings-domain needs --domain: without a domain the Panel uses HTTP, and Wings is reached at http://<IP>:8080."
else
  [[ "$with_wings" == yes ]] || wings_domain=""
fi

# Let's Encrypt's server: staging only while --staging is passed (running again without it moves
# to real certificates); another CA set by hand in pelican.env is kept.
le_server="$LE_PRODUCTION"
saved_ca="$(setting LE_CA_SERVER)"
if $staging; then
  le_server="$LE_STAGING"
elif [[ "$saved_ca" == "$LE_STAGING" ]]; then
  info "Moving from Let's Encrypt staging to real certificates (no --staging this time)."
elif [[ -n "$saved_ca" ]]; then
  le_server="$saved_ca"
fi

app_key="$(setting APP_KEY)"
app_key="${app_key:-base64:$(head -c 32 /dev/urandom | base64)}"
db_password="$(setting DB_PASSWORD)"
db_root_password="$(setting DB_ROOT_PASSWORD)"
if [[ "$profile" == production ]]; then
  db_password="${db_password:-$(secret 32)}"
  db_root_password="${db_root_password:-$(secret 32)}"
fi

if [[ -n "$domain" ]]; then
  panel_url="https://$domain"
else
  panel_url="http://${ip:-<server IP>}"
fi
info "Panel:    $panel_url ($profile profile)"
[[ -z "$domain" ]] && warn "No domain: the Panel is served over plain HTTP. Add a domain for HTTPS before you rely on it (see the summary)."
if [[ "$with_wings" == yes ]]; then
  if [[ -n "$wings_domain" ]]; then info "Wings:    https://$wings_domain (on this server)"; else info "Wings:    http://${ip:-<IP>}:8080 (on this server)"; fi
fi
info "Files:    $dir"
$staging && warn "Let's Encrypt staging: browsers won't trust the certificate. Drop --staging for a real one."

# ---- Checks --------------------------------------------------------------------------------
if ! $dry_run && [[ $EUID -eq 0 ]]; then
  log_file="/var/log/pelican-install-$(date +%Y%m%d-%H%M%S).log"
  install -m 600 /dev/null "$log_file"
  exec > >(tee -a "$log_file") 2>&1
  info "Log: $log_file"
fi

step "Checking this server"
if $dry_run; then
  info "Skipped in a dry run: root, operating system, virtualization, ports 80/443 and DNS."
else
  [[ $EUID -eq 0 ]] || die "Run it as root, or with sudo: curl -fsSL https://pelican.dev/install.sh | sudo bash"
  [[ "$(uname -s)" == Linux ]] || die "Pelican runs on Linux; this is $(uname -s)."

  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) die "Unsupported processor: $(uname -m) (x86_64 and arm64 are)." ;;
  esac
  ok "Linux on $arch"

  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    os_name="$(. /etc/os-release && echo "${PRETTY_NAME:-$ID}")"
    ok "$os_name"
  fi

  virt="$(systemd-detect-virt 2>/dev/null || true)"
  case "$virt" in
    openvz | lxc | lxc-libvirt)
      die "This server runs under $virt, where Docker usually doesn't work. Use a KVM server or bare metal (see the docs: getting-started)." ;;
    *) ok "Virtualization: ${virt:-unknown}" ;;
  esac

  # Ports 80 and 443 must be free for Traefik, or already this stack's Traefik (a second run).
  for port in 80 443; do
    holder="$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'users:\(\("[^"]+' | head -1 | cut -d'"' -f2 || true)"
    [[ -n "$holder" ]] || continue
    if [[ "$holder" == docker* ]] && command -v docker >/dev/null 2>&1; then
      container="$(docker ps --filter "publish=$port" --format '{{.Names}}' 2>/dev/null | head -1 || true)"
      [[ "$container" == "${STACK}_traefik."* ]] && { ports_note=" (already this stack's Traefik)"; continue; }
      holder="the container ${container:-$holder}"
    fi
    die "Port $port is in use by $holder. Traefik needs ports 80 and 443: stop it (an earlier web server or Panel?) and run this again."
  done
  ok "Ports 80 and 443 are free${ports_note:-}"

  # DNS: Let's Encrypt can only issue a certificate if the domain reaches this server.
  $check_dns || info "DNS check skipped (--skip-dns-check)."
  $check_dns && public_ip="$(curl -4 -fsS --max-time 5 https://ipv4.icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
  for name in ${domain:+"$domain"} ${wings_domain:+"$wings_domain"}; do
    $check_dns || break
    resolved="$(getent ahostsv4 "$name" 2>/dev/null | awk '{print $1; exit}' || true)"
    if [[ -z "$resolved" ]]; then
      warn "$name doesn't resolve yet. Point an A record at ${public_ip:-this server} first, or the certificate can't be issued."
      confirm "Continue anyway?" "n" || die "Stopped: set up DNS for $name and run this again (or pass --skip-dns-check)."
    elif [[ -n "$public_ip" && "$resolved" != "$public_ip" ]]; then
      warn "$name points at $resolved, but this server's public address is $public_ip."
      warn "Behind a proxy or NAT that can be fine; a CDN proxy (Cloudflare's orange cloud) breaks the certificate."
      confirm "Continue anyway?" "n" || die "Stopped: point $name at $public_ip and run this again (or pass --skip-dns-check)."
    else
      ok "$name points at this server"
    fi
  done
fi

# ---- Docker --------------------------------------------------------------------------------
step "Docker"
if command -v docker >/dev/null 2>&1 && ! $dry_run; then
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '(not running)') is installed"
else
  if $dry_run; then
    info "If Docker is missing, it's installed with Docker's script (see the docs: getting-started)."
  else
    info "Installing Docker CE with Docker's script (see the docs: getting-started)."
  fi
  if $dry_run; then
    printf '    %s$ curl -fsSL https://get.docker.com | CHANNEL=stable sh%s\n' "$dim" "$reset"
  else
    curl -fsSL https://get.docker.com | CHANNEL=stable sh
  fi
fi
quietly systemctl enable --now docker

# ---- Swarm ---------------------------------------------------------------------------------
step "Docker Swarm"
swarm_state="inactive"
$dry_run || swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo inactive)"
if [[ "$swarm_state" == active ]]; then
  ok "This server is already in a swarm: using it"
  gw_subnet="$(docker network inspect docker_gwbridge --format '{{(index .IPAM.Config 0).Subnet}}' 2>/dev/null || true)"
  if [[ "$with_wings" == yes && "$gw_subnet" == 172.18.* ]]; then
    warn "docker_gwbridge uses $gw_subnet, which Wings' network (pelican_nw, 172.18.0.0/16) also wants."
    warn "Give Wings another subnet in /etc/pelican/config.yml (docker.network.interface and subnet) before starting it."
  fi
else
  # docker_gwbridge has to exist before "swarm init", or Docker gives it 172.18.0.0/16 (Wings').
  if $dry_run || ! docker network inspect docker_gwbridge >/dev/null 2>&1; then
    quietly docker network create --subnet "$GWBRIDGE_SUBNET" \
      --opt com.docker.network.bridge.name=docker_gwbridge \
      --opt com.docker.network.bridge.enable_icc=false \
      --opt com.docker.network.bridge.enable_ip_masquerade=true \
      docker_gwbridge
  fi
  advertise=""
  $dry_run || advertise="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' | head -1)"
  # Quietly: its output holds the swarm's join token, which doesn't belong in a log.
  quietly docker swarm init --advertise-addr "${advertise:-127.0.0.1}" \
    --default-addr-pool "$SWARM_POOL" --default-addr-pool-mask-length 24
  $dry_run || ok "Swarm started"
fi

# Everything runs on this node, next to its data (the volumes are local), even in a bigger swarm.
node_id="this-node"
$dry_run || node_id="$(docker info --format '{{.Swarm.NodeID}}')"

gw_ip="${GWBRIDGE_SUBNET%.*}.1"
if ! $dry_run; then
  gw_ip="$(docker network inspect docker_gwbridge --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo "$gw_ip")"
fi

# ---- Files ---------------------------------------------------------------------------------
step "Writing $dir"
umask 077
mkdir -p "$dir/traefik"

{
  echo "# Pelican stack settings, written by pelican.dev/install.sh (v$VERSION)."
  echo "# Change a value, then run ./deploy.sh to apply it. Keep this file private and backed"
  echo "# up: APP_KEY decrypts your Panel's data, and nothing can recover it if it's lost."
  echo "PROFILE='$profile'"
  echo "# PANEL_DOMAIN empty: the Panel is served on http://PANEL_IP. Set a domain (and LE_EMAIL)"
  echo "# and run ./deploy.sh to switch to HTTPS."
  echo "PANEL_DOMAIN='$domain'"
  echo "PANEL_IP='$ip'"
  echo "LE_EMAIL='$email'"
  echo "LE_CA_SERVER='$le_server'"
  echo "PANEL_IMAGE='$panel_image'"
  # The version this script pins (a new script moves Traefik along); PELICAN_TRAEFIK_IMAGE for another.
  echo "TRAEFIK_IMAGE='${PELICAN_TRAEFIK_IMAGE:-$TRAEFIK_IMAGE_DEFAULT}'"
  echo "PUBLIC_SUBNET='$PUBLIC_SUBNET'"
  echo "SWARM_NODE_ID='$node_id'"
  echo "APP_KEY='$app_key'"
  if [[ "$profile" == production ]]; then
    echo "DB_PASSWORD='$db_password'"
    echo "DB_ROOT_PASSWORD='$db_root_password'"
  fi
  echo "WINGS_DOMAIN='$wings_domain'"
  echo "WINGS_UPSTREAM='$(setting WINGS_UPSTREAM | grep . || echo "http://$gw_ip:8080")'"
} >"$env_file"
chmod 600 "$env_file"
ok "pelican.env (settings, keys and passwords; readable by root only)"

# The stack. Values come from pelican.env through deploy.sh, so it never holds a secret itself.
cat >"$dir/stack.yml" <<'YAML'
# The Pelican stack, written by pelican.dev/install.sh. Deploy it with ./deploy.sh, which reads
# the ${...} values from pelican.env. Docs: https://pelican.dev/docs/panel/install/
services:
  traefik:
    image: ${TRAEFIK_IMAGE}
    command:
      # The routes are in traefik/pelican.yml, which deploy.sh writes from pelican.env: the
      # Panel on its domain with HTTPS, or on the server's IP over HTTP. No Docker socket needed.
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true
      - --entryPoints.web.address=:80
      - --entryPoints.websecure.address=:443
      # Uploads to the Panel and to Wings can take longer than Traefik's 60 second default.
      - --entryPoints.web.transport.respondingTimeouts.readTimeout=600s
      - --entryPoints.websecure.transport.respondingTimeouts.readTimeout=600s
      - --certificatesResolvers.letsencrypt.acme.email=${LE_EMAIL}
      # One store per CA (deploy.sh names it), so test certificates never outlive --staging.
      - --certificatesResolvers.letsencrypt.acme.storage=/letsencrypt/${ACME_STORAGE}
      - --certificatesResolvers.letsencrypt.acme.caServer=${LE_CA_SERVER}
      - --certificatesResolvers.letsencrypt.acme.httpChallenge.entryPoint=web
      - --ping=true
      - --log.level=INFO
    ports:
      # "host" mode keeps visitors' real IP addresses (Swarm's routing mesh would hide them).
      - { target: 80, published: 80, protocol: tcp, mode: host }
      - { target: 443, published: 443, protocol: tcp, mode: host }
    volumes:
      - letsencrypt:/letsencrypt
      - ${PELICAN_DIR}/traefik:/etc/traefik/dynamic:ro
    networks:
      - public
    healthcheck:
      test: ["CMD", "traefik", "healthcheck", "--ping"]
      interval: 10s # counted as running once healthy: check often, so `docker service ls` says 1/1 soon
      timeout: 5s
      retries: 3
    deploy:
      placement:
        constraints:
          - "node.id == ${SWARM_NODE_ID}"
      restart_policy:
        condition: any

  panel:
    image: ${PANEL_IMAGE}
    environment:
      APP_URL: "${PANEL_URL}" # https://PANEL_DOMAIN, or http://PANEL_IP without one (deploy.sh)
      APP_KEY: "${APP_KEY}"
      APP_ENV: production
      APP_DEBUG: "false"
      XDG_DATA_HOME: /pelican-data
      # Traefik takes the requests (and terminates HTTPS) and forwards them over the public network.
      BEHIND_PROXY: "true"
      TRUSTED_PROXIES: "${PUBLIC_SUBNET}"
#PRODUCTION_ENV
    volumes:
      - pelican-data:/pelican-data
      - pelican-logs:/var/www/html/storage/logs
      - pelican-plugins:/var/www/html/plugins
    networks:
      - public
#PRODUCTION_NETWORK
    deploy:
      replicas: 1
      placement:
        constraints:
          - "node.id == ${SWARM_NODE_ID}"
      update_config:
        order: stop-first
      restart_policy:
        condition: any
#PRODUCTION_SERVICES

volumes:
  letsencrypt:
  pelican-data:
  pelican-logs:
  pelican-plugins:
#PRODUCTION_VOLUMES

networks:
  public:
    driver: overlay
    ipam:
      config:
        - subnet: ${PUBLIC_SUBNET}
#PRODUCTION_NETWORKS
YAML

# The production profile's parts, put in where the markers are (or the markers dropped).
# The ${...} in them are for docker stack deploy to fill in, not the shell.
# shellcheck disable=SC2016
production_env='      DB_CONNECTION: mariadb
      DB_HOST: database
      DB_PORT: "3306"
      DB_DATABASE: panel
      DB_USERNAME: pelican
      DB_PASSWORD: "${DB_PASSWORD}"
      CACHE_STORE: redis
      SESSION_DRIVER: redis
      QUEUE_CONNECTION: redis
      REDIS_HOST: cache'
production_network='      - internal'
# shellcheck disable=SC2016
production_services='
  database:
    image: mariadb:11.4
    environment:
      MARIADB_DATABASE: panel
      MARIADB_USER: pelican
      MARIADB_PASSWORD: "${DB_PASSWORD}"
      MARIADB_ROOT_PASSWORD: "${DB_ROOT_PASSWORD}"
      MARIADB_AUTO_UPGRADE: "1"
    volumes:
      - pelican-db:/var/lib/mysql
    networks:
      - internal
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
    deploy:
      placement:
        constraints:
          - "node.id == ${SWARM_NODE_ID}"
      restart_policy:
        condition: any

  cache:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - pelican-redis:/data
    networks:
      - internal
    deploy:
      placement:
        constraints:
          - "node.id == ${SWARM_NODE_ID}"
      restart_policy:
        condition: any'
production_volumes='  pelican-db:
  pelican-redis:'
production_networks='  internal:
    driver: overlay
    internal: true'

fill() {
  local marker="$1" text="$2" file="$dir/stack.yml" out=""
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "#$marker" ]]; then
      [[ "$profile" == production ]] && out+="$text"$'\n'
    else
      out+="$line"$'\n'
    fi
  done <"$file"
  printf '%s' "$out" >"$file"
}
fill PRODUCTION_ENV "$production_env"
fill PRODUCTION_NETWORK "$production_network"
fill PRODUCTION_SERVICES "$production_services"
fill PRODUCTION_VOLUMES "$production_volumes"
fill PRODUCTION_NETWORKS "$production_networks"
chmod 644 "$dir/stack.yml"
ok "stack.yml (the services: Traefik, the Panel$([[ "$profile" == production ]] && echo ", MariaDB, Redis"))"

cat >"$dir/deploy.sh" <<'DEPLOY'
#!/bin/bash
# Applies pelican.env and stack.yml to the running stack: run it after changing either.
# Written by pelican.dev/install.sh. It also updates the Panel when a new image is out
# (docker stack deploy checks the registry for each image tag).
set -Eeuo pipefail
cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
. ./pelican.env
set +a
export PELICAN_DIR="$PWD"

# Traefik keeps certificates and its account per CA: production in acme.json, any other CA
# (staging) in a file of its own, so switching CAs starts clean.
if [[ "${LE_CA_SERVER:-}" == "https://acme-v02.api.letsencrypt.org/directory" || -z "${LE_CA_SERVER:-}" ]]; then
  export ACME_STORAGE="acme.json"
else
  ACME_STORAGE="acme-$(sed -E 's#^https?://##; s#[^A-Za-z0-9.-]+#-#g; s#-+$##' <<<"$LE_CA_SERVER").json"
  export ACME_STORAGE
fi

# The Panel's address: its domain with HTTPS, or the server's IP over HTTP until it has one.
if [[ -n "${PANEL_DOMAIN:-}" ]]; then
  if [[ -z "${LE_EMAIL:-}" ]]; then
    echo "PANEL_DOMAIN is set, so LE_EMAIL is needed too (Let's Encrypt's notices): add it to pelican.env." >&2
    exit 1
  fi
  export PANEL_URL="https://$PANEL_DOMAIN"
elif [[ -n "${PANEL_IP:-}" ]]; then
  export PANEL_URL="http://$PANEL_IP"
else
  echo "Set PANEL_DOMAIN (or PANEL_IP) in pelican.env." >&2
  exit 1
fi

# Traefik's routes (file provider, watched): rewritten from pelican.env on every deploy.
mkdir -p traefik
rm -f traefik/wings.yml # an older name of this file
{
  echo "# Written by deploy.sh from pelican.env: change the settings there, not here."
  echo "http:"
  echo "  routers:"
  if [[ -n "${PANEL_DOMAIN:-}" ]]; then
    echo "    pelican-panel:"
    echo "      rule: \"Host(\`$PANEL_DOMAIN\`)\""
    echo "      entryPoints: [websecure]"
    echo "      service: pelican-panel"
    echo "      tls:"
    echo "        certResolver: letsencrypt"
    if [[ -n "${WINGS_DOMAIN:-}" ]]; then
      echo "    pelican-wings:"
      echo "      rule: \"Host(\`$WINGS_DOMAIN\`)\""
      echo "      entryPoints: [websecure]"
      echo "      service: pelican-wings"
      echo "      tls:"
      echo "        certResolver: letsencrypt"
    fi
    # Plain HTTP goes to HTTPS (Let's Encrypt's own checks on port 80 still get through): the
    # Panel's and Wings' names to themselves, anything else (the server's IP) to the Panel.
    hosts="Host(\`$PANEL_DOMAIN\`)"
    [[ -n "${WINGS_DOMAIN:-}" ]] && hosts+=" || Host(\`$WINGS_DOMAIN\`)"
    echo "    pelican-to-https:"
    echo "      rule: \"$hosts\""
    echo "      entryPoints: [web]"
    echo "      middlewares: [pelican-to-https]"
    echo "      service: noop@internal"
    echo "    pelican-to-domain:"
    echo "      rule: \"PathPrefix(\`/\`)\""
    echo "      priority: 1"
    echo "      entryPoints: [web]"
    echo "      middlewares: [pelican-to-domain]"
    echo "      service: noop@internal"
    echo "  middlewares:"
    echo "    pelican-to-https:"
    echo "      redirectScheme:"
    echo "        scheme: https"
    echo "        permanent: true"
    echo "    pelican-to-domain:"
    echo "      redirectRegex:"
    echo "        regex: \"^https?://[^/]+(.*)\""
    # shellcheck disable=SC2016 # ${1} is the regex group, for Traefik
    echo "        replacement: \"https://$PANEL_DOMAIN"'${1}'"\""
  else
    # No domain yet: the Panel answers on port 80, whatever the address used.
    echo "    pelican-panel:"
    echo "      rule: \"PathPrefix(\`/\`)\""
    echo "      priority: 1"
    echo "      entryPoints: [web]"
    echo "      service: pelican-panel"
  fi
  echo "  services:"
  echo "    pelican-panel:"
  echo "      loadBalancer:"
  echo "        servers:"
  echo "          - url: \"http://panel:80\""
  if [[ -n "${PANEL_DOMAIN:-}" && -n "${WINGS_DOMAIN:-}" ]]; then
    echo "    pelican-wings:"
    echo "      loadBalancer:"
    echo "        servers:"
    echo "          - url: \"$WINGS_UPSTREAM\""
  fi
} >traefik/pelican.yml

# --detach=true: start the update and return (newer Docker asks for it to be explicit).
detach=()
if docker stack deploy --help 2>/dev/null | grep -q -- '--detach'; then detach=(--detach=true); fi
docker stack deploy "${detach[@]}" --compose-file stack.yml pelican
DEPLOY
chmod 700 "$dir/deploy.sh"
ok "deploy.sh (applies changes; run it after editing pelican.env)"

# ---- Wings ---------------------------------------------------------------------------------
if [[ "$with_wings" == yes ]]; then
  step "Wings"
  wings_arch="${arch:-amd64}"
  run mkdir -p /etc/pelican /var/run/wings
  # Download beside it and rename over it: a running Wings' file can't be written ("text file
  # busy"), but it can be replaced. The running Wings keeps its version until it restarts.
  run curl -fsSL -o /usr/local/bin/wings.new "$WINGS_RELEASES/wings_linux_$wings_arch"
  run chmod u+x /usr/local/bin/wings.new
  run mv -f /usr/local/bin/wings.new /usr/local/bin/wings
  if ! $dry_run && systemctl is-active --quiet wings 2>/dev/null; then
    info "Wings is running: systemctl restart wings starts the version just downloaded."
  fi
  if $dry_run; then
    info "Would write /etc/systemd/system/wings.service (the unit from the docs: wings/install)."
  else
    cat >/etc/systemd/system/wings.service <<'UNIT'
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
UNIT
    ok "$(/usr/local/bin/wings version 2>/dev/null | head -1 | grep . || echo Wings) and its service are installed"
  fi
  # Started once it has a configuration from the Panel (see the summary below).
  quietly systemctl daemon-reload
  quietly systemctl enable wings
fi

# ---- Firewall ------------------------------------------------------------------------------
if ! $dry_run && command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
  step "Firewall (ufw)"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  if [[ "$with_wings" == yes ]]; then
    ufw allow 2022/tcp >/dev/null # SFTP
    if [[ -n "$wings_domain" ]]; then
      # Traefik reaches Wings over docker_gwbridge; nothing else needs 8080.
      ufw allow in on docker_gwbridge to any port 8080 proto tcp >/dev/null
    else
      ufw allow 8080/tcp >/dev/null # browsers and the Panel reach Wings directly
    fi
  fi
  ok "Allowed 80 and 443$([[ "$with_wings" == yes ]] && echo ", 2022 (SFTP) and 8080 (Wings)")"
fi

# ---- Deploy --------------------------------------------------------------------------------
step "Starting the stack"
run "$dir/deploy.sh"

if ! $dry_run; then
  # Wait for Swarm to start (or replace) every service first, so the check below reaches the new
  # Panel, not the one being replaced (a changed setting restarts it).
  info "Waiting for the services to start..."
  sleep 3
  for _ in $(seq 1 60); do
    services="$(docker service ls --filter "label=com.docker.stack.namespace=$STACK" --format '{{.Name}} {{.Replicas}}')"
    starting="$(awk '{ split($2, r, "/"); if (r[1] != r[2]) print $1 }' <<<"$services")"
    updating="$(while read -r svc _; do
      [[ -n "$svc" ]] && docker service inspect "$svc" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}'
    done <<<"$services" | grep -c updating || true)"
    [[ -z "$starting" && "$updating" == 0 ]] && break
    sleep 5
  done

  ready=false
  check=(curl -fsS --max-time 5 -o /dev/null)
  if [[ -n "$domain" ]]; then
    info "Waiting for the Panel and its certificate (the first start runs for a minute or two)..."
    target="https://$domain/up"
    $staging && check+=(-k) # the staging certificate isn't trusted, by design
  else
    info "Waiting for the Panel (the first start runs for a minute or two)..."
    target="http://127.0.0.1/up" # Traefik serves the Panel on port 80 at any address
  fi
  for _ in $(seq 1 60); do
    if "${check[@]}" "$target" 2>/dev/null; then
      ready=true
      break
    fi
    sleep 5
  done
  if $ready; then
    if [[ -n "$domain" ]]; then
      ok "$panel_url answers$($staging || echo ", with a valid certificate")"
    else
      ok "$panel_url answers"
    fi
  elif [[ -n "$domain" ]] && curl -kfsS --max-time 5 -o /dev/null --resolve "$domain:443:127.0.0.1" "https://$domain/up" 2>/dev/null; then
    warn "The Panel runs, but the certificate isn't there yet. Check: docker service logs ${STACK}_traefik 2>&1 | grep -i acme"
  else
    warn "The Panel hasn't answered yet. Check: docker service ps ${STACK}_panel --no-trunc and docker service logs ${STACK}_panel"
  fi
fi

# ---- Summary -------------------------------------------------------------------------------
step "Done"
info "Finish the setup in your browser:  $panel_url/installer"
[[ "$profile" == production ]] && info "(The database and cache are ready: MariaDB and Redis.)"
cat <<EOF

    Your files, in $dir:
      pelican.env   settings, APP_KEY and passwords: back it up somewhere safe, off this server
      stack.yml     the services
      deploy.sh     run it after changing pelican.env, and to update the Panel

    Useful commands:
      docker service ls                         what's running
      docker service logs -f ${STACK}_panel        the Panel's logs
      docker service logs ${STACK}_traefik         Traefik's (certificates)
EOF
if [[ -z "$domain" ]]; then
  cat <<EOF

    No domain yet, so the Panel uses plain HTTP: logins cross the network unencrypted.
    To switch to HTTPS, point a domain's A record at ${ip:-this server}, then run this script
    again with --domain panel.example.com --email you@your-domain (it keeps everything else),
    or set PANEL_DOMAIN and LE_EMAIL in $env_file and run $dir/deploy.sh.
EOF
fi
if [[ "$with_wings" == yes && -z "$wings_domain" ]]; then
  cat <<EOF

    Wings is installed; it starts once it has a configuration:
      1. In the Panel: Admin > Nodes > Create, with FQDN ${ip:-<server IP>}, HTTP (no SSL),
         "Not Behind Proxy" and port 8080.
      2. Copy the node's configuration to /etc/pelican/config.yml (or run its Auto Deploy
         command), then: systemctl start wings
      3. Wings (8080), SFTP (2022) and the ports you allocate to game servers must be open in
         your provider's firewall too. When you add a domain for HTTPS, Wings needs one too.
EOF
elif [[ "$with_wings" == yes ]]; then
  cat <<EOF

    Wings is installed; it starts once it has a configuration:
      1. In the Panel: Admin > Nodes > Create, with FQDN $wings_domain, SSL (HTTPS),
         "Behind Proxy", port 443 for the Panel to connect to and 8080 for Wings to listen on.
      2. Copy the node's configuration to /etc/pelican/config.yml (or run its Auto Deploy
         command). Traefik handles HTTPS, so in that file api.port is 8080 and
         api.ssl.enabled is false. Then: systemctl start wings
      3. Players' SFTP uses port 2022, and game servers the ports you allocate: open them
         in your provider's firewall too.
EOF
fi
if $dry_run; then
  printf '\n    %sDry run: nothing changed. The files are in %s.%s\n' "$bold" "$dir" "$reset"
fi
