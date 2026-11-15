// bun test scripts/install-sh.test.mjs
// public/install.sh (pelican.dev/install.sh), run for real in --dry-run: the options and their
// errors, the files it writes (pelican.env, stack.yml, deploy.sh) for each profile, with and
// without a domain, that a second run keeps the keys and passwords, and what deploy.sh writes
// (Traefik's routes) and hands to `docker stack deploy` (with a stub docker). Also shellcheck, when it's installed. The script lives in public/ (served as it
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

function dryRun(extra = [], dir = mkdtempSync(join(tmpdir(), 'pelican-install-')), env = {}) {
  const result = install(['--dry-run', '--dir', dir, ...extra], env);
  return { ...result, dir };
}

const BASE = ['--domain', 'panel.example.com', '--email', 'admin@pelican.test'];
const IP = ['--ip', '203.0.113.10']; // no domain: the Panel on the server's IP (given, as a dry run doesn't look it up)

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
  test('--help lists the options and their environment variables, and exits 0', () => {
    const { code, out } = install(['--help']);
    expect(code).toBe(0);
    for (const flag of ['--interactive', '--domain', '--email', '--ip', '--profile', '--wings', '--wings-domain', '--dry-run', '--staging']) {
      expect(out).toContain(flag);
    }
    for (const name of ['PELICAN_DOMAIN', 'PELICAN_EMAIL', 'PELICAN_PROFILE', 'PELICAN_WINGS', 'PELICAN_IP', 'PELICAN_INTERACTIVE']) {
      expect(out).toContain(name);
    }
    expect(out).not.toContain('--yes'); // not asking is the default; there's nothing to say yes to
  });

  test('an unknown option fails with exit 2', () => {
    expect(install(['--nope']).code).toBe(2);
  });

  test('it asks nothing by default: no options means the Panel on the IP, quick, no Wings', () => {
    const { code, out, dir } = dryRun(IP);
    expect(code).toBe(0);
    expect(settings(dir)).toMatchObject({ PANEL_DOMAIN: '', PANEL_IP: '203.0.113.10', LE_EMAIL: '', PROFILE: 'quick', WINGS_DOMAIN: '' });
    expect(out).not.toContain('Wings:');
    // A domain needs an email; without --interactive that's an error naming both ways to give it.
    expect(dryRun(['--domain', 'panel.example.com']).out).toContain('--email (or PELICAN_EMAIL) is needed with --domain');
  });

  test('--yes from older instructions is still accepted', () => {
    expect(dryRun([...IP, '--yes']).code).toBe(0);
  });

  test('every option can be an environment variable, and the option wins over it', () => {
    const fromEnv = dryRun([], undefined, {
      PELICAN_DOMAIN: 'panel.example.com',
      PELICAN_EMAIL: 'admin@pelican.test',
      PELICAN_PROFILE: 'production',
      PELICAN_WINGS: 'yes',
      PELICAN_WINGS_DOMAIN: 'node.example.com',
      PELICAN_STAGING: '1',
    });
    expect(fromEnv.code).toBe(0);
    expect(settings(fromEnv.dir)).toMatchObject({
      PANEL_DOMAIN: 'panel.example.com',
      LE_EMAIL: 'admin@pelican.test',
      PROFILE: 'production',
      WINGS_DOMAIN: 'node.example.com',
      LE_CA_SERVER: 'https://acme-staging-v02.api.letsencrypt.org/directory',
    });

    const overridden = dryRun(['--profile', 'quick', '--no-wings'], undefined, { PELICAN_PROFILE: 'production', PELICAN_WINGS: '1', PELICAN_IP: '203.0.113.10' });
    expect(settings(overridden.dir)).toMatchObject({ PROFILE: 'quick', WINGS_DOMAIN: '', PANEL_IP: '203.0.113.10' });
  });

  test('bad values are refused before anything is written', () => {
    const domain = dryRun(['--domain', 'not a domain', '--email', 'admin@pelican.test']);
    expect(domain.code).not.toBe(0);
    expect(domain.out).toContain("isn't a domain name");
    expect(existsSync(join(domain.dir, 'pelican.env'))).toBe(false);

    expect(dryRun(['--domain', 'panel.example.com', '--email', "o'brien@example.com"]).out).toContain("isn't an email");
    expect(dryRun([...BASE, '--profile', 'enterprise']).out).toContain('--profile is quick or production');
    expect(dryRun(['--ip', '300.1.2.3']).out).toContain("isn't an IPv4 address");
    // Let's Encrypt refuses contacts at example.com (seen on a real run), so it's caught up front.
    expect(dryRun(['--domain', 'panel.example.com', '--email', 'admin@example.com']).out).toContain("Let's Encrypt refuses addresses at example.com");
  });

  test('with a domain, Wings needs its own; without one, it needs none (and may not have one)', () => {
    expect(dryRun([...BASE, '--wings']).out).toContain('--wings-domain (or PELICAN_WINGS_DOMAIN) is needed');
    expect(dryRun([...BASE, '--wings', '--wings-domain', 'panel.example.com']).out).toContain('Wings needs its own domain');
    const ip = dryRun([...IP, '--wings']);
    expect(ip.code).toBe(0);
    expect(ip.out).toContain('http://203.0.113.10:8080');
    expect(settings(ip.dir).WINGS_DOMAIN).toBe('');
    expect(dryRun([...IP, '--wings', '--wings-domain', 'node.example.com']).out).toContain('--wings-domain needs --domain');
  });

  test('--interactive without a terminal stops and says to pass the options instead', () => {
    const { code, out } = install(['--dry-run', '--interactive', ...BASE]);
    expect(code).not.toBe(0);
    expect(out).toContain('--interactive needs a terminal');
    expect(install(['--dry-run', ...BASE], { PELICAN_INTERACTIVE: '1' }).out).toContain('--interactive needs a terminal');
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

    // Traefik: real client IPs (host mode), routes from the file deploy.sh writes, Let's Encrypt
    // from pelican.env, and no Docker socket (it doesn't need one).
    const traefik = file.services.traefik;
    expect(traefik.ports).toEqual([
      { target: 80, published: 80, protocol: 'tcp', mode: 'host' },
      { target: 443, published: 443, protocol: 'tcp', mode: 'host' },
    ]);
    expect(traefik.command).toContain('--providers.file.directory=/etc/traefik/dynamic');
    expect(traefik.command).toContain('--certificatesResolvers.letsencrypt.acme.caServer=${LE_CA_SERVER}');
    expect(traefik.command.join(' ')).not.toContain('providers.swarm');
    expect(traefik.volumes.join(' ')).not.toContain('docker.sock');
    expect(traefik.deploy.placement.constraints).toEqual(['node.id == ${SWARM_NODE_ID}']);

    // The Panel: behind Traefik, trusting only the public network it shares with Traefik.
    const panel = file.services.panel;
    expect(panel.environment).toMatchObject({
      APP_URL: '${PANEL_URL}',
      APP_KEY: '${APP_KEY}',
      BEHIND_PROXY: 'true',
      TRUSTED_PROXIES: '${PUBLIC_SUBNET}',
    });
    expect(panel.environment.DB_CONNECTION).toBeUndefined();
    expect(panel.volumes).toContain('pelican-plugins:/var/www/html/plugins');
    expect(panel.deploy.labels).toBeUndefined();
    expect(file.networks.public.ipam.config[0].subnet).toBe('${PUBLIC_SUBNET}');
    expect(env.PUBLIC_SUBNET).toBe('10.203.250.0/24');
    // Traefik is pinned to an exact version (updates are deliberate), unless asked otherwise.
    expect(env.TRAEFIK_IMAGE).toMatch(/^traefik:v\d+\.\d+\.\d+$/);
    expect(settings(dryRun(BASE, undefined, { PELICAN_TRAEFIK_IMAGE: 'traefik:v3.6.25' }).dir).TRAEFIK_IMAGE).toBe('traefik:v3.6.25');
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
    const result = install(['--dry-run', '--dir', dir, ...BASE], {
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
      `#!/bin/sh\n{ echo "ARGS $*"; echo "PANEL_URL=$PANEL_URL"; echo "PELICAN_DIR=$PELICAN_DIR"; echo "APP_KEY_SET=\${APP_KEY:+yes}"; } >> "${record}"\n`,
    );
    chmodSync(join(bin, 'docker'), 0o755);
    const result = Bun.spawnSync([BASH, join(dir, 'deploy.sh')], { env: { PATH: `${bin}:${process.env.PATH}` } });
    return {
      code: result.exitCode,
      err: result.stderr.toString(),
      calls: existsSync(record) ? readFileSync(record, 'utf8') : '',
    };
  }

  const routes = (dir) => parse(readFileSync(join(dir, 'traefik', 'pelican.yml'), 'utf8')).http;

  test('without a domain: the Panel on http://<IP>, on port 80 at any address, no HTTPS', () => {
    const { dir } = dryRun(IP);
    const { code, calls } = deploy(dir);
    expect(code).toBe(0);
    expect(calls).toMatch(/ARGS stack deploy (--detach=true )?--compose-file stack\.yml pelican/);
    expect(calls).toContain('PANEL_URL=http://203.0.113.10');
    expect(calls).toContain(`PELICAN_DIR=${dir}`);
    expect(calls).toContain('APP_KEY_SET=yes');

    const http = routes(dir);
    expect(http.routers).toEqual({
      'pelican-panel': { rule: 'PathPrefix(`/`)', priority: 1, entryPoints: ['web'], service: 'pelican-panel' },
    });
    expect(http.services['pelican-panel'].loadBalancer.servers).toEqual([{ url: 'http://panel:80' }]);
    expect(http.middlewares).toBeUndefined();
  });

  test('with a domain: HTTPS with Let\'s Encrypt, and plain HTTP sent to HTTPS', () => {
    const { dir } = dryRun(BASE);
    const { code, calls } = deploy(dir);
    expect(code).toBe(0);
    expect(calls).toContain('PANEL_URL=https://panel.example.com');

    const http = routes(dir);
    expect(http.routers['pelican-panel']).toEqual({
      rule: 'Host(`panel.example.com`)',
      entryPoints: ['websecure'],
      service: 'pelican-panel',
      tls: { certResolver: 'letsencrypt' },
    });
    // HTTP to the Panel's name goes to HTTPS; anything else on port 80 (the bare IP) to the Panel.
    expect(http.routers['pelican-to-https']).toMatchObject({ rule: 'Host(`panel.example.com`)', entryPoints: ['web'], middlewares: ['pelican-to-https'] });
    expect(http.middlewares['pelican-to-https']).toEqual({ redirectScheme: { scheme: 'https', permanent: true } });
    expect(http.routers['pelican-to-domain']).toMatchObject({ rule: 'PathPrefix(`/`)', priority: 1, entryPoints: ['web'], middlewares: ['pelican-to-domain'] });
    expect(http.middlewares['pelican-to-domain']).toEqual({ redirectRegex: { regex: '^https?://[^/]+(.*)', replacement: 'https://panel.example.com${1}' } });
    expect(http.routers['pelican-wings']).toBeUndefined();
  });

  test('adding a domain later: set it in pelican.env and deploy again', () => {
    const { dir } = dryRun(IP);
    const file = join(dir, 'pelican.env');
    writeFileSync(file, readFileSync(file, 'utf8').replace("PANEL_DOMAIN=''", "PANEL_DOMAIN='panel.example.com'"));

    const missingEmail = deploy(dir);
    expect(missingEmail.code).not.toBe(0);
    expect(missingEmail.err).toContain('LE_EMAIL is needed');

    writeFileSync(file, readFileSync(file, 'utf8').replace("LE_EMAIL=''", "LE_EMAIL='admin@pelican.test'"));
    const { code, calls } = deploy(dir);
    expect(code).toBe(0);
    expect(calls).toContain('PANEL_URL=https://panel.example.com');
    expect(routes(dir).routers['pelican-panel'].tls).toEqual({ certResolver: 'letsencrypt' });
  });

  test('adding a domain later by running the script again keeps everything else', () => {
    const first = dryRun(IP);
    const before = settings(first.dir);
    const again = dryRun(BASE, first.dir);
    expect(again.code).toBe(0);
    const after = settings(first.dir);
    expect(after).toMatchObject({ PANEL_DOMAIN: 'panel.example.com', PANEL_IP: '203.0.113.10', APP_KEY: before.APP_KEY });
  });

  test('with Wings on a domain, Traefik routes it to Wings on the host', () => {
    const { dir } = dryRun([...BASE, '--wings', '--wings-domain', 'node.example.com']);
    expect(settings(dir).WINGS_DOMAIN).toBe('node.example.com');
    expect(deploy(dir).code).toBe(0);

    const http = routes(dir);
    expect(http.routers['pelican-wings']).toEqual({
      rule: 'Host(`node.example.com`)',
      entryPoints: ['websecure'],
      service: 'pelican-wings',
      tls: { certResolver: 'letsencrypt' },
    });
    expect(http.services['pelican-wings'].loadBalancer.servers).toEqual([{ url: 'http://10.204.0.1:8080' }]);
    expect(http.routers['pelican-to-https'].rule).toBe('Host(`panel.example.com`) || Host(`node.example.com`)');
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
