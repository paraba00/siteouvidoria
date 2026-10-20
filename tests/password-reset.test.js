import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createApp } from '../server/app.js';
import { createAdmin, resetAdminPassword } from '../server/auth.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const targetEmail = 'reset-target@example.test';
const originalPassword = 'OriginalFixturePassword123!';
const replacementPassword = 'ReplacementFixturePassword456!';
const otherEmail = 'other-admin@example.test';
const otherPassword = 'UnaffectedFixturePassword789!';

async function start(dataDir) {
  const app = createApp({ dataDir, rateLimit: false, secureCookies: false, appOrigin: null });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  return {
    ...app,
    async request(path, { method = 'GET', body, cookie } = {}) {
      const response = await fetch(origin + path, {
        method,
        headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { response, data: await response.json() };
    },
  };
}

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'ouvidoria-password-reset-'));
  let app = await start(dataDir);
  t.after(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  await createAdmin(app.db, targetEmail, originalPassword);
  await createAdmin(app.db, otherEmail, otherPassword);
  return {
    dataDir,
    get app() { return app; },
    async restart() { await app.close(); app = await start(dataDir); },
  };
}

async function login(app, email = targetEmail, password = originalPassword) {
  const { response } = await app.request('/api/admin/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, 'valid credentials must allow login');
  return response.headers.get('set-cookie').split(';')[0];
}

function resetCLI(dataDir, input) {
  const result = spawnSync(process.execPath, ['scripts/reset-admin-password.js', '--stdin-json'], {
    cwd: root,
    env: { ...process.env, DATA_DIR: dataDir },
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.ifError(result.error);
  return result;
}

test('password reset CLI replaces one administrator password and revokes all of that account’s sessions', async (t) => {
  const fixtureState = await fixture(t);
  const { app, dataDir } = fixtureState;
  const firstCookie = await login(app);
  const secondCookie = await login(app);
  const otherCookie = await login(app, otherEmail, otherPassword);
  const submission = await app.request('/api/complaints', {
    method: 'POST',
    body: { anonymous: true, category: 'Outro', subject: 'Registro preservado', description: 'Este chamado deve permanecer intacto após a redefinição da senha.' },
  });
  assert.equal(submission.response.status, 201);
  const previousComplaints = app.db.prepare('SELECT * FROM complaints').all();

  const result = resetCLI(dataDir, { email: `  ${targetEmail.toUpperCase()}  `, password: replacementPassword });
  assert.equal(result.status, 0, 'CLI must succeed for an existing normalized email');
  assert.equal((result.stdout + result.stderr).includes(replacementPassword), false, 'CLI must never print the new password');
  for (const cookie of [firstCookie, secondCookie]) {
    assert.equal((await app.request('/api/admin/session', { cookie })).response.status, 401, 'all old target sessions must be invalidated');
  }
  assert.equal((await app.request('/api/admin/session', { cookie: otherCookie })).response.status, 200, 'another administrator stays logged in');
  assert.equal((await app.request('/api/admin/login', { method: 'POST', body: { email: targetEmail, password: originalPassword } })).response.status, 401, 'old password no longer authenticates');
  await login(app, targetEmail, replacementPassword);
  await login(app, otherEmail, otherPassword);
  assert.deepEqual(app.db.prepare('SELECT * FROM complaints').all(), previousComplaints, 'reset must preserve all complaint data');
  assert.equal(app.db.prepare('SELECT COUNT(*) AS count FROM admins').get().count, 2, 'reset must not create another account');
});

test('the replacement password and revoked sessions remain effective after restarting the application', async (t) => {
  const fixtureState = await fixture(t);
  const oldCookie = await login(fixtureState.app);
  const result = await resetAdminPassword(fixtureState.app.db, targetEmail, replacementPassword);
  assert.deepEqual(result, { email: targetEmail });
  await fixtureState.restart();
  assert.equal((await fixtureState.app.request('/api/admin/session', { cookie: oldCookie })).response.status, 401);
  assert.equal((await fixtureState.app.request('/api/admin/login', { method: 'POST', body: { email: targetEmail, password: originalPassword } })).response.status, 401);
  await login(fixtureState.app, targetEmail, replacementPassword);
});

test('invalid password, invalid email and unknown account leave passwords and active sessions unchanged', async (t) => {
  const { app, dataDir } = await fixture(t);
  const cookie = await login(app);
  const previousHash = app.db.prepare('SELECT password_hash FROM admins WHERE email = ?').get(targetEmail).password_hash;
  for (const [email, password] of [
    [targetEmail, 'short'],
    [targetEmail, 'x'.repeat(257)],
    ['invalid-address', replacementPassword],
    ['missing-admin@example.test', replacementPassword],
  ]) {
    await assert.rejects(resetAdminPassword(app.db, email, password));
    const result = resetCLI(dataDir, { email, password });
    assert.equal(result.status, 1, 'failed CLI reset must return a failure exit code');
    assert.equal((result.stdout + result.stderr).includes(password), false, 'failure must not echo supplied password');
    assert.equal(app.db.prepare('SELECT password_hash FROM admins WHERE email = ?').get(targetEmail).password_hash, previousHash);
    assert.equal((await app.request('/api/admin/session', { cookie })).response.status, 200, 'failed reset must not revoke the valid existing session');
  }
  assert.equal(app.db.prepare('SELECT COUNT(*) AS count FROM admins').get().count, 2);
  await login(app);
});

test('malformed or noninteractive CLI input fails without changing the existing account', async (t) => {
  const { app, dataDir } = await fixture(t);
  const cookie = await login(app);
  for (const input of ['{', 'null', '[]']) {
    const result = resetCLI(dataDir, input);
    assert.equal(result.status, 1);
  }
  const env = { ...process.env, DATA_DIR: dataDir };
  delete env.ADMIN_EMAIL;
  delete env.ADMIN_PASSWORD;
  const result = spawnSync(process.execPath, ['scripts/reset-admin-password.js'], { cwd: root, env, input: '', encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 1, 'CLI must not hang or reset anything when no terminal or credentials are provided');
  assert.equal((await app.request('/api/admin/session', { cookie })).response.status, 200);
  await login(app);
});

test('a database failure while revoking sessions rolls back the password change', async (t) => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  const previousHash = app.db.prepare('SELECT password_hash FROM admins WHERE email = ?').get(targetEmail).password_hash;
  app.db.exec("CREATE TRIGGER fail_reset_revocation BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'fixture reset failure'); END;");
  try {
    await assert.rejects(resetAdminPassword(app.db, targetEmail, replacementPassword), /fixture reset failure/);
    assert.equal(app.db.prepare('SELECT password_hash FROM admins WHERE email = ?').get(targetEmail).password_hash, previousHash, 'password update must be rolled back if session revocation fails');
    assert.equal((await app.request('/api/admin/session', { cookie })).response.status, 200, 'failed transaction preserves the existing valid session');
  } finally {
    app.db.exec('DROP TRIGGER fail_reset_revocation');
  }
  await login(app);
  assert.equal((await app.request('/api/admin/login', { method: 'POST', body: { email: targetEmail, password: replacementPassword } })).response.status, 401);
});
