import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../server/app.js';
import { createAdmin } from '../server/auth.js';

const adminEmail = 'admin@example.test';
const adminPassword = 'VeryStrongTestPass123!';
const anonymousComplaint = {
  anonymous: true,
  category: 'Infraestrutura',
  subject: 'Acessibilidade na biblioteca',
  description: 'O elevador de acesso à biblioteca está indisponível há três dias.',
};

async function start(dataDir, options = {}) {
  const app = createApp({ dataDir, rateLimit: false, secureCookies: false, appOrigin: null, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const baseURL = `http://127.0.0.1:${app.server.address().port}`;
  return {
    ...app,
    baseURL,
    async request(path, { method = 'GET', body, cookie, origin = baseURL, raw } = {}) {
      const headers = {};
      if (origin !== null) headers.Origin = origin;
      if (cookie) headers.Cookie = cookie;
      if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${baseURL}${path}`, {
        method,
        headers,
        body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();
      return { response, data };
    },
  };
}

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'ouvidoria-api-'));
  let app;
  t.after(async () => {
    if (app) await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  app = await start(dataDir, options);
  await createAdmin(app.db, adminEmail, adminPassword);
  return app;
}

async function login(app) {
  const result = await app.request('/api/admin/login', {
    method: 'POST', body: { email: adminEmail, password: adminPassword },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.admin.email, adminEmail);
  const setCookie = result.response.headers.get('set-cookie');
  assert.ok(setCookie, 'login creates a session cookie');
  return { cookie: setCookie.split(';')[0], setCookie };
}

async function submit(app, body = anonymousComplaint) {
  const result = await app.request('/api/complaints', { method: 'POST', body });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  assert.match(result.data.protocol, /^OUV-\d{4}-[A-Fa-f0-9]{12}$/);
  assert.match(result.data.accessKey, /^[A-Fa-f0-9]{32}$/);
  assert.equal(result.data.status, 'open');
  assert.ok(Number.isFinite(Date.parse(result.data.createdAt)));
  return result.data;
}

function lookup(receipt) {
  return `/api/complaints/${encodeURIComponent(receipt.protocol)}?key=${encodeURIComponent(receipt.accessKey)}`;
}

test('the application health endpoint responds after opening its persistent database', async (t) => {
  const app = await fixture(t);
  const { response, data } = await app.request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
});

test('anonymous submissions discard identity and require both protocol and access key for consultation', async (t) => {
  const app = await fixture(t);
  const receipt = await submit(app, {
    ...anonymousComplaint, name: 'Must not be stored', email: 'discard@example.test',
  });
  const found = await app.request(lookup(receipt));
  assert.equal(found.response.status, 200);
  assert.equal(found.data.anonymous, true);
  assert.equal(found.data.subject, anonymousComplaint.subject);
  assert.equal(found.data.description, anonymousComplaint.description);
  for (const key of ['name', 'email', 'id', 'accessKey']) assert.equal(Object.hasOwn(found.data, key), false);

  const missingKey = await app.request(`/api/complaints/${receipt.protocol}`);
  const wrongKey = await app.request(`/api/complaints/${receipt.protocol}?key=0000000000000000`);
  assert.equal(missingKey.response.status, 404);
  assert.equal(wrongKey.response.status, 404);

  const { cookie } = await login(app);
  const listed = await app.request('/api/admin/complaints', { cookie });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.data.complaints.length, 1);
  const stored = listed.data.complaints[0];
  assert.equal(stored.protocol, receipt.protocol);
  assert.ok(stored.name === null || stored.name === '');
  assert.ok(stored.email === null || stored.email === '');
  assert.equal(Object.hasOwn(stored, 'accessKey'), false);
});

test('identified submissions expose contact information only to an authenticated administrator', async (t) => {
  const app = await fixture(t);
  const receipt = await submit(app, {
    ...anonymousComplaint, anonymous: false, name: 'Ana Silva', email: 'ana@example.test',
  });
  const found = await app.request(lookup(receipt));
  assert.equal(found.data.anonymous, false);
  assert.equal(Object.hasOwn(found.data, 'name'), false);
  assert.equal(Object.hasOwn(found.data, 'email'), false);
  const { cookie } = await login(app);
  const listed = await app.request('/api/admin/complaints', { cookie });
  assert.equal(listed.data.complaints[0].name, 'Ana Silva');
  assert.equal(listed.data.complaints[0].email, 'ana@example.test');
});

test('administrator login protects listing, session data and complaint updates', async (t) => {
  const app = await fixture(t);
  const receipt = await submit(app);
  for (const path of ['/api/admin/session', '/api/admin/complaints']) {
    const result = await app.request(path);
    assert.equal(result.response.status, 401);
  }
  const update = await app.request('/api/admin/complaints/1', {
    method: 'PATCH', body: { status: 'resolved', resolution: 'Problema resolvido.' },
  });
  assert.equal(update.response.status, 401);
  const invalid = await app.request('/api/admin/login', {
    method: 'POST', body: { email: adminEmail, password: 'WrongPassword123!' },
  });
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.response.headers.get('set-cookie'), null);
  const { cookie, setCookie } = await login(app);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=(?:Lax|Strict)/i);
  assert.match(setCookie, /Path=\//i);
  const session = await app.request('/api/admin/session', { cookie });
  assert.equal(session.response.status, 200);
  assert.equal(session.data.admin.email, adminEmail);
  assert.equal(JSON.stringify(session.data).includes(adminPassword), false);
  const found = await app.request(lookup(receipt));
  assert.equal(found.data.status, 'open', 'unauthorized update has no effect');
});

test('an administrator can resolve and reopen a complaint, and consultation reflects the outcome', async (t) => {
  const app = await fixture(t);
  const receipt = await submit(app);
  const { cookie } = await login(app);
  const listed = await app.request('/api/admin/complaints', { cookie });
  const id = listed.data.complaints[0].id;
  const resolved = await app.request(`/api/admin/complaints/${id}`, {
    method: 'PATCH', cookie,
    body: { status: 'resolved', resolution: 'O elevador foi reparado e voltou a funcionar.' },
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.data.complaint.status, 'resolved');
  assert.ok(Number.isFinite(Date.parse(resolved.data.complaint.resolvedAt)));
  const found = await app.request(lookup(receipt));
  assert.equal(found.data.status, 'resolved');
  assert.equal(found.data.resolution, 'O elevador foi reparado e voltou a funcionar.');
  const reopened = await app.request(`/api/admin/complaints/${id}`, {
    method: 'PATCH', cookie, body: { status: 'open', resolution: '' },
  });
  assert.equal(reopened.response.status, 200);
  assert.equal(reopened.data.complaint.status, 'open');
  assert.equal(reopened.data.complaint.resolvedAt, null);
  assert.equal((await app.request(lookup(receipt))).data.status, 'open');
});

test('logout revokes the session server-side, including a previously copied cookie', async (t) => {
  const app = await fixture(t);
  const { cookie } = await login(app);
  const result = await app.request('/api/admin/logout', { method: 'POST', cookie });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.ok, true);
  const session = await app.request('/api/admin/session', { cookie });
  assert.equal(session.response.status, 401);
  const listing = await app.request('/api/admin/complaints', { cookie });
  assert.equal(listing.response.status, 401);
});

test('complaint validation rejects missing or invalid input without creating records', async (t) => {
  const app = await fixture(t);
  const cases = [
    {},
    { ...anonymousComplaint, anonymous: 'true' },
    { ...anonymousComplaint, category: 'Inventada' },
    { ...anonymousComplaint, subject: 'x' },
    { ...anonymousComplaint, subject: 'x'.repeat(161) },
    { ...anonymousComplaint, description: 'Insuficiente' },
    { ...anonymousComplaint, description: 'x'.repeat(10001) },
    { ...anonymousComplaint, anonymous: false },
    { ...anonymousComplaint, anonymous: false, name: 'A', email: 'ana@example.test' },
    { ...anonymousComplaint, anonymous: false, name: 'Ana Silva', email: 'inválido' },
  ];
  for (const body of cases) {
    const result = await app.request('/api/complaints', { method: 'POST', body });
    assert.equal(result.response.status, 400, JSON.stringify(body).slice(0, 200));
  }
  const { cookie } = await login(app);
  const listed = await app.request('/api/admin/complaints', { cookie });
  assert.equal(listed.data.complaints.length, 0);
});

test('resolution validation preserves the original complaint on invalid updates', async (t) => {
  const app = await fixture(t);
  const receipt = await submit(app);
  const { cookie } = await login(app);
  const listed = await app.request('/api/admin/complaints', { cookie });
  const id = listed.data.complaints[0].id;
  for (const body of [
    { status: 'deleted' },
    { status: 'resolved', resolution: '' },
    { status: 'resolved', resolution: 'x'.repeat(5001) },
  ]) {
    const result = await app.request(`/api/admin/complaints/${id}`, { method: 'PATCH', cookie, body });
    assert.equal(result.response.status, 400);
  }
  assert.equal((await app.request(lookup(receipt))).data.status, 'open');
  const missing = await app.request('/api/admin/complaints/999999', {
    method: 'PATCH', cookie, body: { status: 'resolved', resolution: 'Problema resolvido.' },
  });
  assert.equal(missing.response.status, 404);
});

test('cross-origin writes are rejected before changing complaint state', async (t) => {
  const app = await fixture(t);
  const blocked = await app.request('/api/complaints', {
    method: 'POST', origin: 'https://untrusted.example', body: anonymousComplaint,
  });
  assert.equal(blocked.response.status, 403);
  const receipt = await submit(app);
  const { cookie } = await login(app);
  const listed = await app.request('/api/admin/complaints', { cookie });
  const result = await app.request(`/api/admin/complaints/${listed.data.complaints[0].id}`, {
    method: 'PATCH', cookie, origin: 'https://untrusted.example',
    body: { status: 'resolved', resolution: 'Alteração externa indevida.' },
  });
  assert.equal(result.response.status, 403);
  assert.equal((await app.request(lookup(receipt))).data.status, 'open');
});

test('SQL and HTML text remain data and cannot bypass login or damage later submissions', async (t) => {
  const app = await fixture(t);
  const text = '<script>alert("x")</script> \'); DROP TABLE complaints; --';
  const receipt = await submit(app, { ...anonymousComplaint, subject: text, description: text });
  const found = await app.request(lookup(receipt));
  assert.equal(found.data.subject, text);
  assert.equal(found.data.description, text);
  const injection = await app.request('/api/admin/login', {
    method: 'POST', body: { email: "' OR 1=1 --", password: adminPassword },
  });
  assert.ok([400, 401].includes(injection.response.status));
  const second = await submit(app);
  assert.notEqual(second.protocol, receipt.protocol);
  assert.notEqual(second.accessKey, receipt.accessKey);
});

test('malformed JSON and unknown API routes fail without exposing database or stack details', async (t) => {
  const app = await fixture(t);
  const malformed = await app.request('/api/complaints', { method: 'POST', raw: '{"anonymous":' });
  assert.equal(malformed.response.status, 400);
  const missing = await app.request('/api/does-not-exist');
  assert.equal(missing.response.status, 404);
  for (const data of [malformed.data, missing.data]) {
    const serialized = JSON.stringify(data);
    assert.equal(/SQLITE_|node_modules|at \w+ \(/.test(serialized), false);
  }
});

test('complaints, administrative accounts and resolution survive application restart', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'ouvidoria-persistence-'));
  let current;
  t.after(async () => {
    if (current) await current.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  current = await start(dataDir);
  await createAdmin(current.db, adminEmail, adminPassword);
  const receipt = await submit(current, {
    ...anonymousComplaint, anonymous: false, name: 'Ana Silva', email: 'ana@example.test',
  });
  const firstSession = await login(current);
  const listed = await current.request('/api/admin/complaints', { cookie: firstSession.cookie });
  const updated = await current.request(`/api/admin/complaints/${listed.data.complaints[0].id}`, {
    method: 'PATCH', cookie: firstSession.cookie,
    body: { status: 'resolved', resolution: 'Reparo concluído pela equipe de manutenção.' },
  });
  assert.equal(updated.response.status, 200);
  await current.close();
  current = undefined;
  current = await start(dataDir);
  const found = await current.request(lookup(receipt));
  assert.equal(found.response.status, 200);
  assert.equal(found.data.status, 'resolved');
  assert.equal(found.data.resolution, 'Reparo concluído pela equipe de manutenção.');
  const { cookie } = await login(current);
  const retained = await current.request('/api/admin/complaints', { cookie });
  assert.equal(retained.data.complaints.length, 1);
  assert.equal(retained.data.complaints[0].email, 'ana@example.test');
});
