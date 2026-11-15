// bun test router/worker.test.mjs  (all tests: bun test)
// The Worker's routing, with fetch replaced by a recorder, so nothing leaves the machine.
import { expect, test } from 'bun:test';
import { isDocsPath } from './paths.mjs';
import { onOrigin, route } from './worker.mjs';

const env = { DOCS_ORIGIN: 'https://pelica.netlify.app', HUB_ORIGIN: 'https://hub.pelican.dev' };

/** A fetch that records what it was asked for and answers with `reply`. */
function recorder(reply = () => new Response('ok')) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init, headers: new Headers(init.headers) });
    return reply(String(url), init);
  };
  return { calls, fetchImpl };
}

const visit = (path, init = {}) => new Request(`https://pelican.dev${path}`, init);

test('docs paths and the five root files go to the docs build, everything else to the Hub', () => {
  for (const path of ['/docs', '/docs/', '/docs/panel/getting-started/', '/docs/_next/static/a.css', '/llms.txt', '/llms-full.txt', '/update-panel.sh', '/migrate-panel.sh', '/migrate-wings.sh']) {
    expect({ path, docs: isDocsPath(path) }).toEqual({ path, docs: true });
  }
  for (const path of ['/', '/docsfoo', '/plugins', '/eggs/paper', '/faq', '/sitemap.xml', '/robots.txt', '/update-wings.sh']) {
    expect({ path, docs: isDocsPath(path) }).toEqual({ path, docs: false });
  }
});

test('a docs page is fetched from Netlify without the visitor\'s cookies, and sets none', async () => {
  const { calls, fetchImpl } = recorder(() => new Response('<html>', { headers: { 'set-cookie': 'nf=1', 'cache-control': 'public, max-age=0, must-revalidate' } }));

  const response = await route(visit('/docs/panel/update/?ref=x', { headers: { cookie: 'pelican_session=abc', authorization: 'Bearer t', accept: 'text/html' } }), env, fetchImpl);

  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe('https://pelica.netlify.app/docs/panel/update/?ref=x');
  expect(calls[0].init.redirect).toBe('manual');
  expect(calls[0].headers.get('cookie')).toBe(null);
  expect(calls[0].headers.get('authorization')).toBe(null);
  expect(calls[0].headers.get('accept')).toBe('text/html');
  expect(response.headers.get('set-cookie')).toBe(null);
  expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
  expect(await response.text()).toBe('<html>');
});

test('Netlify\'s trailing-slash redirect stays on pelican.dev', async () => {
  const { fetchImpl } = recorder(() => new Response(null, { status: 301, headers: { location: 'https://pelica.netlify.app/docs/panel/getting-started/' } }));

  const response = await route(visit('/docs/panel/getting-started'), env, fetchImpl);

  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('/docs/panel/getting-started/');
});

test('the docs answer only GET and HEAD', async () => {
  const { calls, fetchImpl } = recorder();

  const response = await route(visit('/docs/', { method: 'POST', body: 'x' }), env, fetchImpl);

  expect(response.status).toBe(405);
  expect(response.headers.get('allow')).toBe('GET, HEAD');
  expect(calls.length).toBe(0);
});

test('everything else goes to the Hub, which is told the visitor came to pelican.dev', async () => {
  const { calls, fetchImpl } = recorder(() => new Response('hub', { headers: { 'set-cookie': 'pelican_session=new; Domain=.pelican.dev' } }));

  const response = await route(visit('/plugins?q=backup', { headers: { cookie: 'pelican_session=abc', 'cf-connecting-ip': '203.0.113.7' } }), env, fetchImpl);

  expect(calls[0].url).toBe('https://hub.pelican.dev/plugins?q=backup');
  expect(calls[0].init.redirect).toBe('manual');
  expect(calls[0].headers.get('x-forwarded-host')).toBe('pelican.dev');
  expect(calls[0].headers.get('x-forwarded-proto')).toBe('https');
  expect(calls[0].headers.get('x-forwarded-port')).toBe('443');
  expect(calls[0].headers.get('x-forwarded-for')).toBe('203.0.113.7');
  // The Hub's own session: its cookie goes both ways.
  expect(calls[0].headers.get('cookie')).toBe('pelican_session=abc');
  expect(response.headers.get('set-cookie')).toBe('pelican_session=new; Domain=.pelican.dev');
});

test('a form post reaches the Hub with its body', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/livewire/update', { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json' } }), env, fetchImpl);

  expect(calls[0].init.method).toBe('POST');
  expect(await new Response(calls[0].init.body).text()).toBe('{"a":1}');
});

test('a Hub redirect to its own address stays on pelican.dev; others are left alone', async () => {
  const own = recorder(() => new Response(null, { status: 302, headers: { location: 'https://hub.pelican.dev/dashboard' } }));
  expect((await route(visit('/login'), env, own.fetchImpl)).headers.get('location')).toBe('/dashboard');

  const away = recorder(() => new Response(null, { status: 302, headers: { location: 'https://discord.com/oauth2/authorize?x=1' } }));
  expect((await route(visit('/login/discord'), env, away.fetchImpl)).headers.get('location')).toBe('https://discord.com/oauth2/authorize?x=1');
});

test('Next.js prefetches of Hub pages are answered here, without a request to the Hub', async () => {
  const { calls, fetchImpl } = recorder();

  expect((await route(visit('/plugins', { headers: { rsc: '1' } }), env, fetchImpl)).status).toBe(404);
  expect((await route(visit('/eggs?_rsc=abc'), env, fetchImpl)).status).toBe(404);
  expect(calls.length).toBe(0);
});

test('dot segments are resolved before routing, so /docs/.. cannot reach the Hub as a docs path', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/docs/%2e%2e/plugins'), env, fetchImpl);
  await route(visit('/docs/../update-panel.sh'), env, fetchImpl);

  expect(calls[0].url).toBe('https://hub.pelican.dev/plugins');
  expect(calls[1].url).toBe('https://pelica.netlify.app/update-panel.sh');
});

test('a path starting with // never leaves the two origins (it would carry the visitor\'s cookies)', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('//attacker.example/steal?x=1', { headers: { cookie: 'pelican_session=abc' } }), env, fetchImpl);
  await route(visit('//attacker.example'), env, fetchImpl);
  await route(visit('/docs//attacker.example/x'), env, fetchImpl);

  expect(new URL(calls[0].url).host).toBe('hub.pelican.dev');
  expect(calls[0].url).toBe('https://hub.pelican.dev//attacker.example/steal?x=1');
  expect(new URL(calls[1].url).host).toBe('hub.pelican.dev');
  expect(new URL(calls[2].url).host).toBe('pelica.netlify.app');
  expect(calls[2].url).toBe('https://pelica.netlify.app/docs//attacker.example/x');
});

test('the target keeps the origin and takes only the path and query', () => {
  const target = onOrigin(new URL('https://pelican.dev//evil.test:8080/a%2Fb?q=%2F%2Fx#frag'), 'https://hub.pelican.dev');

  expect(target.origin).toBe('https://hub.pelican.dev');
  expect(target.pathname).toBe('//evil.test:8080/a%2Fb');
  expect(target.search).toBe('?q=%2F%2Fx');
  expect(target.hash).toBe('');
});

test('a visitor\'s own X-Forwarded-For never reaches the Hub', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/plugins', { headers: { 'x-forwarded-for': '1.2.3.4' } }), env, fetchImpl);
  await route(visit('/plugins', { headers: { 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '203.0.113.7' } }), env, fetchImpl);

  expect(calls[0].headers.get('x-forwarded-for')).toBe(null);
  expect(calls[1].headers.get('x-forwarded-for')).toBe('203.0.113.7');
});

test('a redirect to a look-alike host is left alone', async () => {
  const { fetchImpl } = recorder(() => new Response(null, { status: 302, headers: { location: 'https://hub.pelican.dev.example.com/x' } }));

  expect((await route(visit('/login'), env, fetchImpl)).headers.get('location')).toBe('https://hub.pelican.dev.example.com/x');
});

test('a docs path stays a docs path for Next.js payloads and HEAD requests', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/docs/panel/', { headers: { rsc: '1' } }), env, fetchImpl);
  await route(visit('/docs/panel/', { method: 'HEAD' }), env, fetchImpl);

  expect(calls.map((call) => [call.url, call.init.method])).toEqual([
    ['https://pelica.netlify.app/docs/panel/', 'GET'],
    ['https://pelica.netlify.app/docs/panel/', 'HEAD'],
  ]);
});

test('origins with a trailing slash work, and a missing one says which setting', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/docs/'), { ...env, DOCS_ORIGIN: 'https://pelica.netlify.app/' }, fetchImpl);
  expect(calls[0].url).toBe('https://pelica.netlify.app/docs/');

  await expect(route(visit('/plugins'), { DOCS_ORIGIN: env.DOCS_ORIGIN }, fetchImpl)).rejects.toThrow('HUB_ORIGIN');
});

test('an encoded slash is one path segment, so /docs%2F... is the Hub\'s, as in the browser', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/docs%2Fpanel/'), env, fetchImpl);

  expect(new URL(calls[0].url).host).toBe('hub.pelican.dev');
});

