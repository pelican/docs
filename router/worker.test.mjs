// node --test router/worker.test.mjs (bun run test:router): the Worker's routing, with fetch
// replaced by a recorder, so nothing leaves the machine.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDocsPath, route } from './worker.mjs';

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
    assert.equal(isDocsPath(path), true, path);
  }
  for (const path of ['/', '/docsfoo', '/plugins', '/eggs/paper', '/faq', '/sitemap.xml', '/robots.txt', '/update-wings.sh']) {
    assert.equal(isDocsPath(path), false, path);
  }
});

test('a docs page is fetched from Netlify without the visitor\'s cookies, and sets none', async () => {
  const { calls, fetchImpl } = recorder(() => new Response('<html>', { headers: { 'set-cookie': 'nf=1', 'cache-control': 'public, max-age=0, must-revalidate' } }));

  const response = await route(visit('/docs/panel/update/?ref=x', { headers: { cookie: 'pelican_session=abc', authorization: 'Bearer t', accept: 'text/html' } }), env, fetchImpl);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://pelica.netlify.app/docs/panel/update/?ref=x');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].headers.get('cookie'), null);
  assert.equal(calls[0].headers.get('authorization'), null);
  assert.equal(calls[0].headers.get('accept'), 'text/html');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(await response.text(), '<html>');
});

test('Netlify\'s trailing-slash redirect stays on pelican.dev', async () => {
  const { fetchImpl } = recorder(() => new Response(null, { status: 301, headers: { location: 'https://pelica.netlify.app/docs/panel/getting-started/' } }));

  const response = await route(visit('/docs/panel/getting-started'), env, fetchImpl);

  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), '/docs/panel/getting-started/');
});

test('the docs answer only GET and HEAD', async () => {
  const { calls, fetchImpl } = recorder();

  const response = await route(visit('/docs/', { method: 'POST', body: 'x' }), env, fetchImpl);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  assert.equal(calls.length, 0);
});

test('everything else goes to the Hub, which is told the visitor came to pelican.dev', async () => {
  const { calls, fetchImpl } = recorder(() => new Response('hub', { headers: { 'set-cookie': 'pelican_session=new; Domain=.pelican.dev' } }));

  const response = await route(visit('/plugins?q=backup', { headers: { cookie: 'pelican_session=abc', 'cf-connecting-ip': '203.0.113.7' } }), env, fetchImpl);

  assert.equal(calls[0].url, 'https://hub.pelican.dev/plugins?q=backup');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].headers.get('x-forwarded-host'), 'pelican.dev');
  assert.equal(calls[0].headers.get('x-forwarded-proto'), 'https');
  assert.equal(calls[0].headers.get('x-forwarded-port'), '443');
  assert.equal(calls[0].headers.get('x-forwarded-for'), '203.0.113.7');
  // The Hub's own session: its cookie goes both ways.
  assert.equal(calls[0].headers.get('cookie'), 'pelican_session=abc');
  assert.equal(response.headers.get('set-cookie'), 'pelican_session=new; Domain=.pelican.dev');
});

test('a form post reaches the Hub with its body', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/livewire/update', { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json' } }), env, fetchImpl);

  assert.equal(calls[0].init.method, 'POST');
  assert.equal(await new Response(calls[0].init.body).text(), '{"a":1}');
});

test('a Hub redirect to its own address stays on pelican.dev; others are left alone', async () => {
  const own = recorder(() => new Response(null, { status: 302, headers: { location: 'https://hub.pelican.dev/dashboard' } }));
  assert.equal((await route(visit('/login'), env, own.fetchImpl)).headers.get('location'), '/dashboard');

  const away = recorder(() => new Response(null, { status: 302, headers: { location: 'https://discord.com/oauth2/authorize?x=1' } }));
  assert.equal((await route(visit('/login/discord'), env, away.fetchImpl)).headers.get('location'), 'https://discord.com/oauth2/authorize?x=1');
});

test('Next.js prefetches of Hub pages are answered here, without a request to the Hub', async () => {
  const { calls, fetchImpl } = recorder();

  assert.equal((await route(visit('/plugins', { headers: { rsc: '1' } }), env, fetchImpl)).status, 404);
  assert.equal((await route(visit('/eggs?_rsc=abc'), env, fetchImpl)).status, 404);
  assert.equal(calls.length, 0);
});

test('dot segments are resolved before routing, so /docs/.. cannot reach the Hub as a docs path', async () => {
  const { calls, fetchImpl } = recorder();

  await route(visit('/docs/%2e%2e/plugins'), env, fetchImpl);
  await route(visit('/docs/../update-panel.sh'), env, fetchImpl);

  assert.equal(calls[0].url, 'https://hub.pelican.dev/plugins');
  assert.equal(calls[1].url, 'https://pelica.netlify.app/update-panel.sh');
});
