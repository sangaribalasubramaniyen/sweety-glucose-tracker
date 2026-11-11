// The demo seed must be repeatable and must never touch other users' data.
// The test uses its own demo email (cleaned up afterwards) so it never changes the real demo@example.com.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { call, signUp, startServer, stopServer, RUN } = require('./helpers');
const pool = require('../src/db');
const { seedDemo, buildDemoReadings, DEMO_PASSWORD, DEMO_REPORT_DATE } = require('../db/seed');

const DEMO = `test-seed-${RUN}@example.com`; // matches the cleanup pattern in helpers.js

before(startServer);
after(stopServer);

test('seed rows are unique and all in the past, with valid values and slots', () => {
  const rows = buildDemoReadings();
  const keys = rows.map((r) => `${r.date}|${r.slot}`);
  assert.equal(new Set(keys).size, rows.length); // no duplicate (date, slot)
  assert.ok(rows.every((r) => r.value >= 40 && r.value <= 600));
  assert.ok(rows.every((r) => ['fasting', 'breakfast', 'lunch', 'dinner'].includes(r.slot)));
});

test('running the seed twice creates no duplicates', async () => {
  const first = await seedDemo({ email: DEMO });
  const count = async () => (await pool.query('SELECT count(*)::int AS n FROM readings WHERE user_id = $1', [first.userId])).rows[0].n;
  const afterFirst = await count();
  const second = await seedDemo({ email: DEMO });

  assert.equal(second.userId, first.userId); // same user, not a second account
  assert.equal(await count(), afterFirst); // same number of readings
  assert.equal(afterFirst, buildDemoReadings().length);
  const users = await pool.query('SELECT count(*)::int AS n FROM users WHERE email = $1', [DEMO]);
  assert.equal(users.rows[0].n, 1);
});

test('re-seeding restores edited demo values but never touches another user', async () => {
  const other = await signUp('seed-other');
  // The other user has a reading on a date/slot the seed also uses.
  const [seeded] = buildDemoReadings();
  const add = await call('POST', '/api/readings', { cookie: other.cookie, body: { date: seeded.date, slot: seeded.slot, value: 77 } });
  assert.equal(add.status, 201);

  const demo = await seedDemo({ email: DEMO });
  await pool.query('UPDATE readings SET value = 500 WHERE user_id = $1', [demo.userId]); // someone edits the demo data
  await seedDemo({ email: DEMO });

  const restored = await pool.query('SELECT value FROM readings WHERE user_id = $1 AND reading_date = $2 AND slot = $3', [demo.userId, seeded.date, seeded.slot]);
  assert.equal(restored.rows[0].value, seeded.value); // demo data reset

  const mine = await pool.query('SELECT value FROM readings WHERE user_id = $1', [other.user.id]);
  assert.deepEqual(mine.rows, [{ value: 77 }]); // the other user's data is untouched
});

test('the demo user can log in, and the documented demo date gives non-empty reports', async () => {
  const login = await call('POST', '/api/auth/login', { body: { email: DEMO, password: DEMO_PASSWORD } });
  assert.equal(login.status, 200);
  const { body } = await call('GET', `/api/reports?date=${DEMO_REPORT_DATE}`, { cookie: login.cookie });

  // Independent calculation straight from the seed list (no SQL), including inclusive boundaries.
  const stats = (from, to) => {
    const v = buildDemoReadings().filter((r) => r.date >= from && r.date <= to).map((r) => r.value);
    const sum = v.reduce((a, b) => a + b, 0);
    return { count: v.length, highest: Math.max(...v), lowest: Math.min(...v), average: (Math.round((sum * 10) / v.length) / 10).toFixed(1) };
  };
  for (const key of ['daily', 'monthToDate', 'previousMonth']) {
    assert.ok(body[key].stats.count > 0, `${key} should not be empty`);
    assert.deepEqual(body[key].stats, stats(body[key].from, body[key].to), key);
  }
  assert.equal(body.daily.readings.length, 4); // all four slots on the demo day
  assert.deepEqual(body.daily.readings.map((r) => r.slot), ['fasting', 'breakfast', 'lunch', 'dinner']);
});
