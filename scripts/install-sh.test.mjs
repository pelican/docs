// bun test scripts/install-sh.test.mjs
// public/install.sh (pelican.dev/install.sh), run for real in --dry-run: the options and their
// errors, the files it writes (pelican.env, stack.yml, deploy.sh) for each profile, that a second
// run keeps the keys and passwords, and what deploy.sh hands to `docker stack deploy` (with a
// stub docker). Also shellcheck, when it's installed. The script lives in public/ (served as it
// is), so its test lives here.
import { describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const SCRIPT = join(import.meta.dir, '..', 'public', 'install.sh');

/** A bash of version 4 or newer (the script's servers have 5; macOS ships 3.2 as /bin/bash). */
function findBash() {
  for (const bash of ['/opt/homebrew/bin/bash', '/usr/local/bin/bash', '/usr/bin/bash', '/bin/bash', Bun.which('bash')]) {
    if (!bash || !existsSync(bash)) continue;
    const { stdout } = Bun.spawnSync([bash, '-c', 'echo ${BASH_VERSINFO[0]}']);
    if (Number(stdout.toString().trim()) >= 4) return bash;
  }
  return null;
}

const BASH = findBash();
const suite = BASH ? describe : describe.skip;

function install(args, env = {}) {
  const result = Bun.spawnSync([BASH, SCRIPT, ...args], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    stdin: 'ignore',
  });
  return { code: result.exitCode, out: result.stdout.toString() + result.stderr.toString() };
}

function dryRun(extra = [], dir = mkdtempSync(join(tmpdir(), 'pelican-install-'))) {
  const result = install(['--dry-run', '--yes', '--dir', dir, ...extra]);
  return { ...result, dir };
}

const BASE = ['--domain', 'panel.example.com', '--email', 'admin@pelican.test'];

/** pelican.env as an object (KEY='value' lines). */
function settings(dir) {
  const values = {};
  for (const line of readFileSync(join(dir, 'pelican.env'), 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)='(.*)'$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const stack = (dir) => parse(readFileSync(join(dir, 'stack.yml'), 'utf8'));

suite('install.sh options', () => {
  test('--help lists the options and exits 0', () => {
    const { code, out } = install(['--help']);
    expect(code).toBe(0);
    for (const flag of ['--domain', '--email', '--profile', '--wings', '--wings-domain', '--dry-run', '--yes', '--staging']) {
      expect(out).toContain(flag);
    }
  });

  test('an unknown option fails with exit 2', () => {
    expect(install(['--nope']).code).toBe(2);
  });

  test('--yes needs --domain and --email, and says so', () => {
    expect(dryRun(['--email', 'admin@pelican.test']).out).toContain('--domain is needed with --yes');
    expect(dryRun(['--domain', 'panel.example.com']).out).toContain('--email is needed with --yes');
  });

  test('bad values are refused before anything is written', () => {
    const domain = dryRun(['--domain', 'not a domain', '--email', 'admin@pelican.test']);
    expect(domain.code).not.toBe(0);
    expect(domain.out).toContain("isn't a domain name");
    expect(existsSync(join(domain.dir, 'pelican.env'))).toBe(false);

    expect(dryRun(['--domain', 'panel.example.com', '--email', "o'brien@example.com"]).out).toContain("isn't an email");
    expect(dryRun([...BASE, '--profile', 'enterprise']).out).toContain('--profile is quick or production');
    // Let's Encrypt refuses contacts at example.com (seen on a real run), so it's caught up front.
    expect(dryRun(['--domain', 'panel.example.com', '--email', 'admin@example.com']).out).toContain("Let's Encrypt refuses addresses at example.com");
  });

  test('--wings needs its own --wings-domain', () => {
    expect(dryRun([...BASE, '--wings']).out).toContain('--wings-domain is needed');
    expect(dryRun([...BASE, '--wings', '--wings-domain', 'panel.example.com']).out).toContain('Wings needs its own domain');
  });

  test('without a terminal and without --yes it asks for --yes instead of guessing', () => {
    const { code, out } = install(['--dry-run', ...BASE]);
    expect(code).not.toBe(0);
    expect(out).toContain('No terminal for questions');
  });
});

suite('install.sh files', () => {
  test('quick: Traefik and the Panel, nothing else; secrets stay in pelican.env', () => {
    const { code, out, dir } = dryRun(BASE);
    expect(code).toBe(0);
    expect(out).toContain('Dry run: nothing changed');

    const env = settings(dir);
    expect(env.PROFILE).toBe('quick');
    expect(env.PANEL_DOMAIN).toBe('panel.example.com');
    expect(env.APP_KEY).toMatch(/^base64:[A-Za-z0-9+/]{43}=$/);
    expect(env.DB_PASSWORD).toBeUndefined();
    expect(statSync(join(dir, 'pelican.env')).mode & 0o777).toBe(0o600);
    expect(out).not.toContain(env.APP_KEY);

    const file = stack(dir);
    expect(Object.keys(file.services).sort()).toEqual(['panel', 'traefik']);
    expect(readFileSync(join(dir, 'stack.yml'), 'utf8')).not.toContain('#PRODUCTION');

    // Traefik: real client IPs (host mode), redirect to HTTPS, Let's Encrypt from pelican.env.
    const traefik = file.services.traefik;
    expect(traefik.ports).toEqual([
      { target: 80, published: 80, protocol: 'tcp', mode: 'host' },
      { target: 443, published: 443, protocol: 'tcp', mode: 'host' },
    ]);
    expect(traefik.command).toContain('--providers.swarm.network=pelican_public');
    expect(traefik.command).toContain('--entryPoints.web.http.redirections.entryPoint.to=websecure');
    expect(traefik.command).toContain('--certificatesResolvers.letsencrypt.acme.caServer=${LE_CA_SERVER}');
    expect(traefik.deploy.placement.constraints).toContain('node.id == ${SWARM_NODE_ID}');

    // The Panel: behind Traefik, trusting only the public network it shares with Traefik.
    const panel = file.services.panel;
    expect(panel.environment).toMatchObject({
      APP_URL: 'https://${PANEL_DOMAIN}',
      APP_KEY: '${APP_KEY}',
      BEHIND_PROXY: 'true',
      TRUSTED_PROXIES: '${PUBLIC_SUBNET}',
    });
    expect(panel.environment.DB_CONNECTION).toBeUndefined();
    expect(panel.volumes).toContain('pelican-plugins:/var/www/html/plugins');
    expect(panel.deploy.labels['traefik.http.routers.pelican-panel.rule']).toBe('Host(`${PANEL_DOMAIN}`)');
    expect(panel.deploy.labels['traefik.http.services.pelican-panel.loadbalancer.server.port']).toBe('80');
    expect(file.networks.public.ipam.config[0].subnet).toBe('${PUBLIC_SUBNET}');
    expect(env.PUBLIC_SUBNET).toBe('10.203.250.0/24');
  });

  test('production: MariaDB and Redis on an internal network, with generated passwords', () => {
    const { code, dir } = dryRun([...BASE, '--profile', 'production']);
    expect(code).toBe(0);
    const env = settings(dir);
    expect(env.DB_PASSWORD).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(env.DB_ROOT_PASSWORD).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(env.DB_PASSWORD).not.toBe(env.DB_ROOT_PASSWORD);

    const file = stack(dir);
    expect(Object.keys(file.services).sort()).toEqual(['cache', 'database', 'panel', 'traefik']);
    expect(file.services.panel.environment).toMatchObject({
      DB_CONNECTION: 'mariadb',
      DB_HOST: 'database',
      DB_PASSWORD: '${DB_PASSWORD}',
      CACHE_STORE: 'redis',
      SESSION_DRIVER: 'redis',
      QUEUE_CONNECTION: 'redis',
      REDIS_HOST: 'cache',
    });
    expect(file.services.panel.networks).toEqual(['public', 'internal']);
    expect(file.services.database.networks).toEqual(['internal']);
    expect(file.services.database.environment.MARIADB_PASSWORD).toBe('${DB_PASSWORD}');
    expect(file.networks.internal).toEqual({ driver: 'overlay', internal: true });
    expect(Object.keys(file.volumes)).toEqual(expect.arrayContaining(['pelican-db', 'pelican-redis']));
  });

  test('a second run keeps APP_KEY and the passwords, and refuses to switch profiles', () => {
    const first = dryRun([...BASE, '--profile', 'production']);
    const before = settings(first.dir);
    const again = dryRun([], first.dir); // everything comes from pelican.env
    expect(again.code).toBe(0);
    expect(again.out).toContain('keeping its keys and passwords');
    const after = settings(first.dir);
    expect(after.APP_KEY).toBe(before.APP_KEY);
    expect(after.DB_PASSWORD).toBe(before.DB_PASSWORD);
    expect(after.DB_ROOT_PASSWORD).toBe(before.DB_ROOT_PASSWORD);

    const switched = dryRun(['--profile', 'quick'], first.dir);
    expect(switched.code).not.toBe(0);
    expect(switched.out).toContain('uses the production profile');
  });

  test("--staging uses Let's Encrypt staging", () => {
    const { dir } = dryRun([...BASE, '--staging']);
    expect(settings(dir).LE_CA_SERVER).toBe('https://acme-staging-v02.api.letsencrypt.org/directory');
  });

  test('the address ranges can be changed for networks that clash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pelican-install-'));
    const result = install(['--dry-run', '--yes', '--dir', dir, ...BASE], {
      PELICAN_PUBLIC_SUBNET: '10.99.1.0/24',
      PELICAN_GWBRIDGE_SUBNET: '10.99.2.0/24',
    });
    expect(result.code).toBe(0);
    expect(settings(dir).PUBLIC_SUBNET).toBe('10.99.1.0/24');
    expect(settings(dir).WINGS_UPSTREAM).toBe('http://10.99.2.1:8080');
    expect(result.out).toContain('--subnet 10.99.2.0/24');
  });
});

suite('deploy.sh', () => {
  /** Runs deploy.sh with a stub docker that records its arguments and environment. */
  function deploy(dir) {
    const bin = mkdtempSync(join(tmpdir(), 'pelican-bin-'));
    const record = join(bin, 'calls');
    writeFileSync(
      join(bin, 'docker'),
      `#!/bin/sh\n{ echo "ARGS $*"; echo "PANEL_DOMAIN=$PANEL_DOMAIN"; echo "PELICAN_DIR=$PELICAN_DIR"; echo "APP_KEY_SET=\${APP_KEY:+yes}"; } >> "${record}"\n`,
    );
    chmodSync(join(bin, 'docker'), 0o755);
    const result = Bun.spawnSync([BASH, join(dir, 'deploy.sh')], { env: { PATH: `${bin}:${process.env.PATH}` } });
    return { code: result.exitCode, calls: existsSync(record) ? readFileSync(record, 'utf8') : '' };
  }

  test('deploys the stack with pelican.env exported, and no Wings route without Wings', () => {
    const { dir } = dryRun(BASE);
    const { code, calls } = deploy(dir);
    expect(code).toBe(0);
    expect(calls).toMatch(/ARGS stack deploy (--detach=true )?--compose-file stack\.yml pelican/);
    expect(calls).toContain('PANEL_DOMAIN=panel.example.com');
    expect(calls).toContain(`PELICAN_DIR=${dir}`);
    expect(calls).toContain('APP_KEY_SET=yes');
    expect(existsSync(join(dir, 'traefik', 'wings.yml'))).toBe(false);
  });

  test('with Wings, it writes the Traefik route to Wings on the host', () => {
    const { dir } = dryRun([...BASE, '--wings', '--wings-domain', 'node.example.com']);
    expect(settings(dir).WINGS_DOMAIN).toBe('node.example.com');
    expect(deploy(dir).code).toBe(0);

    const route = parse(readFileSync(join(dir, 'traefik', 'wings.yml'), 'utf8'));
    expect(route.http.routers['pelican-wings']).toEqual({
      rule: 'Host(`node.example.com`)',
      entryPoints: ['websecure'],
      service: 'pelican-wings',
      tls: { certResolver: 'letsencrypt' },
    });
    expect(route.http.services['pelican-wings'].loadBalancer.servers).toEqual([{ url: 'http://10.204.0.1:8080' }]);
  });
});

const shellcheck = Bun.which('shellcheck');
(shellcheck && BASH ? test : test.skip)('shellcheck finds nothing in install.sh or the deploy.sh it writes', () => {
  const { dir } = dryRun(BASE);
  for (const file of [SCRIPT, join(dir, 'deploy.sh')]) {
    const result = Bun.spawnSync([shellcheck, '-s', 'bash', file]);
    expect(result.stdout.toString()).toBe('');
    expect(result.exitCode).toBe(0);
  }
});
