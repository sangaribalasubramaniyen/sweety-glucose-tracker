// Shared helpers for API tests: start the app on a free port, call it with
// JSON + an optional session cookie, and clean up the accounts a run creates.
const app = require('../src/app');
const pool = require('../src/db');

const RUN = Date.now();
const PASSWORD = 'correct-horse-9';
const email = (label) => `test-${label}-${RUN}@example.com`;

let server;
let base;

async function startServer() {
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // port 0 = any free port
  });
  base = `http://localhost:${server.address().port}`;
}

async function stopServer() {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`test-%-${RUN}@example.com`]); // readings cascade
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

// Sends JSON, optionally with a session cookie. Returns { status, body, cookie }.
async function call(method, path, { body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, body: await res.json(), cookie: setCookie ? setCookie.split(';')[0] : null };
}

// Creates a fresh account and returns its session cookie.
async function signUp(label) {
  const res = await call('POST', '/api/auth/signup', { body: { name: `User ${label}`, email: email(label), password: PASSWORD } });
  return { cookie: res.cookie, user: res.body.user };
}

module.exports = { call, signUp, startServer, stopServer, email, PASSWORD };
