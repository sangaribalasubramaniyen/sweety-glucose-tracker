// Auth API tests. They run against the real local PostgreSQL database
// (DATABASE_URL in .env) and delete the accounts they create.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const pool = require('../src/db');

const RUN = Date.now();
const email = (label) => `test-${label}-${RUN}@example.com`;
const PASSWORD = 'correct-horse-9';

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // port 0 = any free port
  });
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`test-%-${RUN}@example.com`]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// Small helper: sends JSON, optionally with a session cookie, returns status/body/cookie.
async function call(method, path, { body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  return {
    status: res.status,
    body: await res.json(),
    setCookie,
    cookie: setCookie ? setCookie.split(';')[0] : null, // "name=value" part to send back
  };
}

const signup = (label, extra = {}) =>
  call('POST', '/api/auth/signup', { body: { name: 'Test User', email: email(label), password: PASSWORD, ...extra } });

test('signup creates an account, signs in, and never returns the password', async () => {
  const res = await signup('ok');
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, email('ok'));
  assert.equal(res.body.user.name, 'Test User');
  assert.equal(res.body.user.password_hash, undefined);
  assert.match(res.setCookie, /HttpOnly/i);

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email('ok')]);
  assert.notEqual(rows[0].password_hash, PASSWORD); // stored hashed
  assert.match(rows[0].password_hash, /^\$2[aby]\$/); // bcrypt format
});

test('signup rejects missing/invalid fields with field-level messages', async () => {
  const res = await call('POST', '/api/auth/signup', { body: { name: '', email: 'nope', password: 'short' } });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.name && res.body.fields.email && res.body.fields.password);
});

test('duplicate email is rejected, even with different capitalisation', async () => {
  await signup('dup');
  const res = await signup('dup', { email: email('dup').toUpperCase() });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /already exists/i);
});

test('login works with correct credentials', async () => {
  await signup('login');
  const res = await call('POST', '/api/auth/login', { body: { email: email('login'), password: PASSWORD } });
  assert.equal(res.status, 200);
  assert.ok(res.cookie);
});

test('wrong password and unknown email give the same 401 message', async () => {
  await signup('wrong');
  const wrongPw = await call('POST', '/api/auth/login', { body: { email: email('wrong'), password: 'not-the-password' } });
  const noUser = await call('POST', '/api/auth/login', { body: { email: email('ghost'), password: PASSWORD } });
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.equal(wrongPw.body.error, noUser.body.error);
  assert.equal(wrongPw.cookie, null); // no session issued
});

test('unauthenticated access to a protected route is refused', async () => {
  const none = await call('GET', '/api/auth/me');
  assert.equal(none.status, 401);
  const forged = await call('GET', '/api/auth/me', { cookie: 'sweety_session=not-a-real-token' });
  assert.equal(forged.status, 401);
});

test('/me restores the session from the cookie', async () => {
  const { cookie } = await signup('me');
  const res = await call('GET', '/api/auth/me', { cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email('me'));
});

test('logout invalidates the session on the server, not just in the browser', async () => {
  const { cookie } = await signup('logout');
  assert.equal((await call('GET', '/api/auth/me', { cookie })).status, 200);

  const out = await call('POST', '/api/auth/logout', { cookie });
  assert.equal(out.status, 200);

  // Replaying the OLD cookie must fail, proving the session row was deleted.
  assert.equal((await call('GET', '/api/auth/me', { cookie })).status, 401);
});

test('an expired session is refused', async () => {
  const { cookie } = await signup('expired');
  await pool.query(
    `UPDATE sessions SET expires_at = now() - interval '1 minute'
      WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
    [email('expired')]
  );
  assert.equal((await call('GET', '/api/auth/me', { cookie })).status, 401);
});
