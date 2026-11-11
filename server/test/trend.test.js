// Tests for GET /api/reports/trend (the data behind the month-to-date chart).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { call, signUp, startServer, stopServer } = require('./helpers');
const { buildTrend } = require('../src/reports');
const { todayString } = require('../src/today');

before(startServer);
after(stopServer);

const add = (cookie, date, slot, value) => call('POST', '/api/readings', { cookie, body: { date, slot, value } });
const trend = (cookie, date) => call('GET', `/api/reports/trend${date === undefined ? '' : `?date=${date}`}`, { cookie });

test('buildTrend: one point per row, one-decimal average, no zero-filling', () => {
  assert.deepEqual(
    buildTrend([
      { date: '2025-10-01', total: 90, count: 1 },
      { date: '2025-10-14', total: 541, count: 4 }, // 135.25 is a tie and rounds up
      { date: '2025-10-15', total: 361, count: 3 }, // 120.333...
    ]),
    [
      { date: '2025-10-01', average: '90.0' },
      { date: '2025-10-14', average: '135.3' },
      { date: '2025-10-15', average: '120.3' },
    ]
  );
  assert.deepEqual(buildTrend([]), []);
});

test('API: month-to-date points exclude later days, the previous month and the next month', async () => {
  const { cookie } = await signUp('trend-range');
  for (const [date, value] of [
    ['2025-09-30', 300], // previous month: excluded
    ['2025-10-01', 90], //  first day of the month: included
    ['2025-10-14', 150],
    ['2025-10-15', 200], //  the selected day: included
    ['2025-10-16', 500], //  after the selected date: excluded
    ['2025-11-01', 400], //  next month: excluded
  ]) {
    assert.equal((await add(cookie, date, 'fasting', value)).status, 201);
  }
  const { status, body } = await trend(cookie, '2025-10-15');
  assert.equal(status, 200);
  assert.equal(body.from, '2025-10-01');
  assert.equal(body.to, '2025-10-15');
  assert.deepEqual(body.points, [
    { date: '2025-10-01', average: '90.0' },
    { date: '2025-10-14', average: '150.0' },
    { date: '2025-10-15', average: '200.0' },
  ]);
});

test('API: several readings on one day produce a single averaged point', async () => {
  const { cookie } = await signUp('trend-avg');
  for (const [slot, value] of [['fasting', 100], ['breakfast', 120], ['lunch', 141]]) {
    await add(cookie, '2025-10-15', slot, value); // 361 / 3 = 120.333...
  }
  const { body } = await trend(cookie, '2025-10-15');
  assert.deepEqual(body.points, [{ date: '2025-10-15', average: '120.3' }]);
});

test('API: days without readings are absent, never zero', async () => {
  const { cookie } = await signUp('trend-gaps');
  await add(cookie, '2025-10-02', 'lunch', 110);
  await add(cookie, '2025-10-09', 'lunch', 130);
  const { body } = await trend(cookie, '2025-10-15');
  assert.deepEqual(body.points.map((p) => p.date), ['2025-10-02', '2025-10-09']); // 13 other days: no points
  assert.ok(body.points.every((p) => Number(p.average) >= 40));
});

test('API: points come back in date order whatever order they were entered in', async () => {
  const { cookie } = await signUp('trend-order');
  for (const date of ['2025-10-12', '2025-10-03', '2025-10-08']) await add(cookie, date, 'lunch', 100);
  const { body } = await trend(cookie, '2025-10-15');
  assert.deepEqual(body.points.map((p) => p.date), ['2025-10-03', '2025-10-08', '2025-10-12']);
});

test('API: nothing in the range gives an empty list', async () => {
  const { cookie } = await signUp('trend-empty');
  await add(cookie, '2025-09-20', 'fasting', 100); // only the previous month
  assert.deepEqual((await trend(cookie, '2025-10-15')).body.points, []);
  const none = await signUp('trend-none'); // a user with no readings at all
  assert.deepEqual((await trend(none.cookie, '2025-10-15')).body.points, []);
});

test('API: selecting the first of the month gives just that day', async () => {
  const { cookie } = await signUp('trend-first');
  await add(cookie, '2025-10-01', 'fasting', 111);
  await add(cookie, '2025-10-02', 'fasting', 222); // after the selected date
  const { body } = await trend(cookie, '2025-10-01');
  assert.deepEqual(body.points, [{ date: '2025-10-01', average: '111.0' }]);
});

test('API: a January selection never reaches back into December', async () => {
  const { cookie } = await signUp('trend-jan');
  await add(cookie, '2025-12-31', 'fasting', 300); // December: excluded
  await add(cookie, '2026-01-01', 'fasting', 100);
  await add(cookie, '2026-01-10', 'fasting', 120);
  const { body } = await trend(cookie, '2026-01-15');
  assert.equal(body.from, '2026-01-01');
  assert.deepEqual(body.points.map((p) => p.date), ['2026-01-01', '2026-01-10']);
});

test('API: changing the selected date changes the points', async () => {
  const { cookie } = await signUp('trend-change');
  await add(cookie, '2025-10-05', 'lunch', 100);
  await add(cookie, '2025-10-20', 'lunch', 200);
  assert.deepEqual((await trend(cookie, '2025-10-10')).body.points.map((p) => p.date), ['2025-10-05']);
  assert.deepEqual((await trend(cookie, '2025-10-25')).body.points.map((p) => p.date), ['2025-10-05', '2025-10-20']);
});

test('API: two accounts get only their own averages', async () => {
  const alice = await signUp('trend-alice');
  const bob = await signUp('trend-bob');
  await add(alice.cookie, '2025-10-10', 'fasting', 100);
  await add(bob.cookie, '2025-10-10', 'fasting', 300); // same date and slot, different values
  await add(bob.cookie, '2025-10-11', 'fasting', 310);
  assert.deepEqual((await trend(alice.cookie, '2025-10-15')).body.points, [{ date: '2025-10-10', average: '100.0' }]);
  assert.deepEqual((await trend(bob.cookie, '2025-10-15')).body.points, [
    { date: '2025-10-10', average: '300.0' },
    { date: '2025-10-11', average: '310.0' },
  ]);
});

test('API: requires sign-in, defaults to today, rejects bad dates', async () => {
  assert.equal((await trend(null, '2025-10-15')).status, 401);

  const { cookie } = await signUp('trend-dates');
  const res = await trend(cookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.date, todayString());
  assert.equal(res.body.to, todayString());

  const [y, m, d] = todayString().split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  for (const bad of ['nope', '2025-02-30', '', tomorrow]) {
    assert.equal((await trend(cookie, bad)).status, 400, `date "${bad}" should be rejected`);
  }
});

test('API: the existing /api/reports response is unchanged by the trend feature', async () => {
  const { cookie } = await signUp('trend-compat');
  await add(cookie, '2025-10-15', 'fasting', 100);
  const { body } = await call('GET', '/api/reports?date=2025-10-15', { cookie });
  assert.deepEqual(Object.keys(body).sort(), ['daily', 'date', 'monthToDate', 'previousMonth', 'today']);
  assert.deepEqual(Object.keys(body.monthToDate).sort(), ['from', 'stats', 'to']);
});
