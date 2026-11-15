#!/bin/bash
# Pelican one-command install: Docker Swarm, Traefik (automatic HTTPS) and the Panel, and Wings
# on the same server if you want it.
#
#   curl -fsSL https://pelican.dev/install.sh | sudo bash
#   curl -fsSL https://pelican.dev/install.sh | sudo bash -s -- --domain panel.example.com \
#     --email you@example.com --profile production --yes
#
# Docs: https://pelican.dev/docs/panel/install/ (every option, and how to change things later)
#
# What it does: checks the server, installs Docker if it's missing, starts a one-node Docker
# Swarm, and deploys a stack named "pelican" from /opt/pelican: Traefik on ports 80 and 443,
# which gets a Let's Encrypt certificate for your domain on the first request, and the Panel
# behind it. "production" adds MariaDB and Redis. With --wings it also installs Wings (the
# binary and systemd service, as in the docs) and routes its domain through Traefik.
#
# Settings live in /opt/pelican/pelican.env; change one and run /opt/pelican/deploy.sh. Running
# this script again keeps your keys and passwords, and updates the stack.

set -Eeuo pipefail

VERSION="1"
STACK="pelican"
DEFAULT_DIR="/opt/pelican"
PANEL_IMAGE_DEFAULT="ghcr.io/pelican/panel:latest"
TRAEFIK_IMAGE_DEFAULT="traefik:v3"
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
domain=""
email=""
profile=""
with_wings=""
wings_domain=""
dir="$DEFAULT_DIR"
panel_image=""
staging=false
check_dns=true
assume_yes=false
dry_run=false

usage() {
  cat <<EOF
Usage: install.sh [options]

  --domain DOMAIN        The Panel's address, e.g. panel.example.com (its DNS must point here)
  --email EMAIL          Email for Let's Encrypt (expiry notices)
  --profile NAME         quick: SQLite, the least to run (one server, small installs)
                         production: MariaDB and Redis (more servers and users)
  --wings                Also install Wings on this server
  --no-wings             Don't install Wings on this server
  --wings-domain DOMAIN  Wings' address, e.g. node.example.com (needs --wings)
  --dir PATH             Where the stack's files go (default $DEFAULT_DIR)
  --image IMAGE          Panel image (default $PANEL_IMAGE_DEFAULT)
  --staging              Use Let's Encrypt's staging server (test certificates, no rate limits)
  --skip-dns-check       Don't check that the domains point at this server (behind NAT, or
                         DNS that you set up afterwards: the certificate waits for it)
  --dry-run              Write the files to --dir (a temp folder by default) and show the plan;
                         change nothing on this server. No root needed.
  -y, --yes              Don't ask: use the options given (and the defaults for the rest)
  -h, --help             Show this help

Without --yes it asks for anything you didn't pass. With --yes, --domain and --email are needed.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) domain="${2:?--domain needs a value}"; shift 2 ;;
    --email) email="${2:?--email needs a value}"; shift 2 ;;
    --profile) profile="${2:?--profile needs a value}"; shift 2 ;;
    --wings) with_wings=yes; shift ;;
    --no-wings) with_wings=no; shift ;;
    --wings-domain) wings_domain="${2:?--wings-domain needs a value}"; shift 2 ;;
    --dir) dir="${2:?--dir needs a value}"; shift 2 ;;
    --image) panel_image="${2:?--image needs a value}"; shift 2 ;;
    --staging) staging=true; shift ;;
    --skip-dns-check) check_dns=false; shift ;;
    --dry-run) dry_run=true; shift ;;
    -y|--yes) assume_yes=true; shift ;;
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
can_ask() { ! $assume_yes && { : </dev/tty; } 2>/dev/null; }

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
valid_email() { [[ "$1" =~ ^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$ ]]; }

# secret LENGTH: letters and digits only, so it is safe in YAML, .env files and URLs.
secret() {
  local out=""
  while [[ ${#out} -lt $1 ]]; do
    out+="$(head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
  done
  printf '%s' "${out:0:$1}"
}

if ! $assume_yes && ! { : </dev/tty; } 2>/dev/null; then
  die "No terminal for questions: pass the options and --yes (see --help)."
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

if [[ -z "$domain" ]]; then
  $assume_yes && die "--domain is needed with --yes (the Panel's address, e.g. panel.example.com)."
  ask domain "The Panel's domain (its DNS must point at this server), e.g. panel.example.com" ""
fi
valid_domain "$domain" || die "\"$domain\" isn't a domain name like panel.example.com."

if [[ -z "$email" ]]; then
  $assume_yes && die "--email is needed with --yes (Let's Encrypt sends certificate notices to it)."
  ask email "Your email, for Let's Encrypt" ""
fi
valid_email "$email" || die "\"$email\" isn't an email address."
case "${email##*@}" in
  example.com | example.net | example.org | localhost)
    die "Let's Encrypt refuses addresses at ${email##*@}: use a real email (it only sends certificate notices)." ;;
esac

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
if [[ "$with_wings" == yes ]]; then
  if [[ -z "$wings_domain" ]]; then
    $assume_yes && die "--wings-domain is needed with --wings and --yes (e.g. node.example.com)."
    ask wings_domain "Wings' domain (its DNS must point here too), e.g. node.example.com" ""
  fi
  valid_domain "$wings_domain" || die "\"$wings_domain\" isn't a domain name like node.example.com."
  [[ "$wings_domain" != "$domain" ]] || die "Wings needs its own domain, not the Panel's ($domain)."
else
  wings_domain=""
fi

le_server="$LE_PRODUCTION"
if $staging; then
  le_server="$LE_STAGING"
elif [[ -n "$(setting LE_CA_SERVER)" ]]; then
  le_server="$(setting LE_CA_SERVER)"
fi

app_key="$(setting APP_KEY)"
app_key="${app_key:-base64:$(head -c 32 /dev/urandom | base64)}"
db_password="$(setting DB_PASSWORD)"
db_root_password="$(setting DB_ROOT_PASSWORD)"
if [[ "$profile" == production ]]; then
  db_password="${db_password:-$(secret 32)}"
  db_root_password="${db_root_password:-$(secret 32)}"
fi

info "Panel:    https://$domain ($profile profile)"
[[ "$with_wings" == yes ]] && info "Wings:    https://$wings_domain (on this server)"
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
  for name in "$domain" ${wings_domain:+"$wings_domain"}; do
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
  echo "PANEL_DOMAIN='$domain'"
  echo "LE_EMAIL='$email'"
  echo "LE_CA_SERVER='$le_server'"
  echo "PANEL_IMAGE='$panel_image'"
  echo "TRAEFIK_IMAGE='$(setting TRAEFIK_IMAGE | grep . || echo "$TRAEFIK_IMAGE_DEFAULT")'"
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
      - --providers.swarm.endpoint=unix:///var/run/docker.sock
      - --providers.swarm.exposedByDefault=false
      - --providers.swarm.network=pelican_public
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true
      - --entryPoints.web.address=:80
      - --entryPoints.web.http.redirections.entryPoint.to=websecure
      - --entryPoints.web.http.redirections.entryPoint.scheme=https
      - --entryPoints.websecure.address=:443
      - --entryPoints.websecure.http.tls.certResolver=letsencrypt
      # Uploads to the Panel and to Wings can take longer than Traefik's 60 second default.
      - --entryPoints.websecure.transport.respondingTimeouts.readTimeout=600s
      - --certificatesResolvers.letsencrypt.acme.email=${LE_EMAIL}
      - --certificatesResolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesResolvers.letsencrypt.acme.caServer=${LE_CA_SERVER}
      - --certificatesResolvers.letsencrypt.acme.httpChallenge.entryPoint=web
      - --ping=true
      - --log.level=INFO
    ports:
      # "host" mode keeps visitors' real IP addresses (Swarm's routing mesh would hide them).
      - { target: 80, published: 80, protocol: tcp, mode: host }
      - { target: 443, published: 443, protocol: tcp, mode: host }
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
      - ${PELICAN_DIR}/traefik:/etc/traefik/dynamic:ro
    networks:
      - public
    healthcheck:
      test: ["CMD", "traefik", "healthcheck", "--ping"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      placement:
        constraints:
          - node.role == manager
          - "node.id == ${SWARM_NODE_ID}"
      restart_policy:
        condition: any

  panel:
    image: ${PANEL_IMAGE}
    environment:
      APP_URL: "https://${PANEL_DOMAIN}"
      APP_KEY: "${APP_KEY}"
      APP_ENV: production
      APP_DEBUG: "false"
      XDG_DATA_HOME: /pelican-data
      # Traefik terminates HTTPS and forwards from the public network.
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
      labels:
        traefik.enable: "true"
        traefik.http.routers.pelican-panel.rule: "Host(`${PANEL_DOMAIN}`)"
        traefik.http.routers.pelican-panel.entrypoints: websecure
        traefik.http.routers.pelican-panel.tls.certresolver: letsencrypt
        traefik.http.services.pelican-panel.loadbalancer.server.port: "80"
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

# Wings on this server: Traefik routes its domain to Wings on the host (file provider).
if [[ -n "${WINGS_DOMAIN:-}" ]]; then
  cat >traefik/wings.yml <<EOF
# Written by deploy.sh from pelican.env (WINGS_DOMAIN, WINGS_UPSTREAM): change it there.
http:
  routers:
    pelican-wings:
      rule: "Host(\`${WINGS_DOMAIN}\`)"
      entryPoints: [websecure]
      service: pelican-wings
      tls:
        certResolver: letsencrypt
  services:
    pelican-wings:
      loadBalancer:
        servers:
          - url: "${WINGS_UPSTREAM}"
EOF
else
  rm -f traefik/wings.yml
fi

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
  run curl -fsSL -o /usr/local/bin/wings "$WINGS_RELEASES/wings_linux_$wings_arch"
  run chmod u+x /usr/local/bin/wings
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
    # Traefik reaches Wings over docker_gwbridge.
    ufw allow in on docker_gwbridge to any port 8080 proto tcp >/dev/null
  fi
  ok "Allowed 80 and 443$([[ "$with_wings" == yes ]] && echo ", 2022 (SFTP) and Traefik to Wings on 8080")"
fi

# ---- Deploy --------------------------------------------------------------------------------
step "Starting the stack"
run "$dir/deploy.sh"

if ! $dry_run; then
  info "Waiting for the Panel and its certificate (the first start runs for a minute or two)..."
  ready=false
  check=(curl -fsS --max-time 5 -o /dev/null)
  $staging && check+=(-k) # the staging certificate isn't trusted, by design
  for _ in $(seq 1 60); do
    if "${check[@]}" "https://$domain/up" 2>/dev/null; then
      ready=true
      break
    fi
    sleep 5
  done
  if $ready; then
    ok "https://$domain answers$($staging || echo ", with a valid certificate")"
  elif curl -kfsS --max-time 5 -o /dev/null --resolve "$domain:443:127.0.0.1" "https://$domain/up" 2>/dev/null; then
    warn "The Panel runs, but the certificate isn't there yet. Check: docker service logs ${STACK}_traefik 2>&1 | grep -i acme"
  else
    warn "The Panel hasn't answered yet. Check: docker service ps ${STACK}_panel --no-trunc and docker service logs ${STACK}_panel"
  fi
fi

# ---- Summary -------------------------------------------------------------------------------
step "Done"
info "Finish the setup in your browser:  https://$domain/installer"
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
if [[ "$with_wings" == yes ]]; then
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
