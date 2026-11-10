// Report tests: pure date-range / rounding logic, then the API against the real database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { call, signUp, startServer, stopServer } = require('./helpers');
const { getReportRanges, roundedAverage, buildStats } = require('../src/reports');
const { todayString } = require('../src/today');

before(startServer);
after(stopServer);

// ---------- Pure logic: date ranges ----------

test('ranges for 15 October: day, 1-15 October, all of September', () => {
  assert.deepEqual(getReportRanges('2026-10-15'), {
    daily: { from: '2026-10-15', to: '2026-10-15' },
    monthToDate: { from: '2026-10-01', to: '2026-10-15' },
    previousMonth: { from: '2026-09-01', to: '2026-09-30' },
  });
});

test('January rolls back to December of the previous year', () => {
  const r = getReportRanges('2026-01-15');
  assert.deepEqual(r.previousMonth, { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(r.monthToDate, { from: '2026-01-01', to: '2026-01-15' });
});

test('previous month length: 30/31 days, February, and leap years', () => {
  assert.equal(getReportRanges('2026-12-05').previousMonth.to, '2026-11-30'); // December -> November (30)
  assert.equal(getReportRanges('2026-08-05').previousMonth.to, '2026-07-31'); // August -> July (31)
  assert.equal(getReportRanges('2026-03-31').previousMonth.to, '2026-02-28'); // 2026 is not a leap year
  assert.equal(getReportRanges('2024-03-31').previousMonth.to, '2024-02-29'); // 2024 is
  assert.equal(getReportRanges('2100-03-10').previousMonth.to, '2100-02-28'); // century, not a leap year
  assert.equal(getReportRanges('2000-03-10').previousMonth.to, '2000-02-29'); // divisible by 400, is a leap year
});

test('first and last day of a month', () => {
  const first = getReportRanges('2026-10-01');
  assert.deepEqual(first.monthToDate, { from: '2026-10-01', to: '2026-10-01' }); // just one day
  const last = getReportRanges('2026-10-31');
  assert.deepEqual(last.monthToDate, { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(last.previousMonth, { from: '2026-09-01', to: '2026-09-30' });
});

// ---------- Pure logic: average rounding ----------

test('average is rounded half-up to one decimal and always shows one decimal', () => {
  assert.equal(roundedAverage(300, 3), '100.0'); // exact: keeps ".0"
  assert.equal(roundedAverage(361, 3), '120.3'); // 120.333... rounds down
  assert.equal(roundedAverage(362, 3), '120.7'); // 120.666... rounds up
  assert.equal(roundedAverage(541, 4), '135.3'); // 135.25 is a tie: rounds up
  assert.equal(roundedAverage(1203, 10), '120.3');
  assert.equal(roundedAverage(1, 8), '0.1'); // 0.125 -> 0.1
  assert.equal(roundedAverage(150, 1), '150.0');
  assert.equal(roundedAverage(0, 0), null); // nothing to average
});

test('buildStats returns zero count and nulls for an empty range', () => {
  assert.deepEqual(buildStats({ count: 0, highest: null, lowest: null, total: null }), {
    count: 0, highest: null, lowest: null, average: null,
  });
});

// ---------- API ----------

const add = (cookie, date, slot, value) => call('POST', '/api/readings', { cookie, body: { date, slot, value } });
const report = (cookie, date) => call("GET", `/api/reports${date === undefined ? "" : `?date=${date}`}`, { cookie });

// Seeds readings around every boundary of a report for 15 October 2025.
async function seedOctober(cookie) {
  const rows = [
    ['2025-08-31', 'fasting', 300], // before the previous month: in NO report
    ['2025-09-01', 'fasting', 100], // first day of previous month (included)
    ['2025-09-15', 'lunch', 111], //   middle of previous month
    ['2025-09-30', 'fasting', 140], // last day of previous month (included)
    ['2025-10-01', 'fasting', 90], //  first day of month-to-date (included)
    ['2025-10-14', 'lunch', 150], //   day before the selected date
    ['2025-10-15', 'dinner', 201], //  selected day (entered before fasting on purpose)
    ['2025-10-15', 'fasting', 100], // selected day
    ['2025-10-16', 'fasting', 500], // day AFTER the selected date: in NO report
    ['2025-11-01', 'fasting', 400], // next month: in NO report
  ];
  for (const [date, slot, value] of rows) {
    assert.equal((await add(cookie, date, slot, value)).status, 201);
  }
}

test('API: daily, month-to-date and previous-month reports use the exact boundaries', async () => {
  const { cookie } = await signUp('rep-oct');
  await seedOctober(cookie);
  const { status, body } = await report(cookie, '2025-10-15');
  assert.equal(status, 200);
  assert.equal(body.date, '2025-10-15');

  // Daily: 15 Oct only -> 100 and 201
  assert.deepEqual(body.daily.stats, { count: 2, highest: 201, lowest: 100, average: '150.5' });
  // Month-to-date: 1-15 Oct inclusive -> 90, 150, 100, 201 (16 Oct excluded). Average 135.25 -> 135.3
  assert.deepEqual(body.monthToDate, {
    from: '2025-10-01', to: '2025-10-15',
    stats: { count: 4, highest: 201, lowest: 90, average: '135.3' },
  });
  // Previous month: all of September, both end days included, 31 Aug and October excluded
  assert.deepEqual(body.previousMonth, {
    from: '2025-09-01', to: '2025-09-30',
    stats: { count: 3, highest: 140, lowest: 100, average: '117.0' },
  });
});

test('API: daily report lists readings in slot order', async () => {
  const { cookie } = await signUp('rep-order');
  await seedOctober(cookie); // dinner was entered before fasting
  const { body } = await report(cookie, '2025-10-15');
  assert.deepEqual(body.daily.readings.map((r) => [r.slot, r.value]), [['fasting', 100], ['dinner', 201]]);
});

test('API: January selection reports December of the previous year', async () => {
  const { cookie } = await signUp('rep-jan');
  for (const [date, slot, value] of [
    ['2025-11-30', 'fasting', 300], // November: excluded
    ['2025-12-01', 'fasting', 100], // first day of December
    ['2025-12-31', 'fasting', 200], // last day of December
    ['2026-01-01', 'fasting', 150], // January: month-to-date
    ['2026-01-16', 'fasting', 400], // after the selected date: excluded
  ]) {
    await add(cookie, date, slot, value);
  }
  const { body } = await report(cookie, '2026-01-15');
  assert.deepEqual(body.previousMonth, {
    from: '2025-12-01', to: '2025-12-31',
    stats: { count: 2, highest: 200, lowest: 100, average: '150.0' },
  });
  assert.deepEqual(body.monthToDate.stats, { count: 1, highest: 150, lowest: 150, average: '150.0' });
  assert.deepEqual(body.daily.stats, { count: 0, highest: null, lowest: null, average: null });
});

test('API: a user with no readings gets empty reports, not errors', async () => {
  const { cookie } = await signUp('rep-empty');
  const { status, body } = await report(cookie, '2025-10-15');
  assert.equal(status, 200);
  const empty = { count: 0, highest: null, lowest: null, average: null };
  assert.deepEqual(body.daily.stats, empty);
  assert.deepEqual(body.monthToDate.stats, empty);
  assert.deepEqual(body.previousMonth.stats, empty);
  assert.deepEqual(body.daily.readings, []);
});

test('API: a single reading gives the same highest, lowest and average', async () => {
  const { cookie } = await signUp('rep-single');
  await add(cookie, '2025-10-15', 'lunch', 123);
  const { body } = await report(cookie, '2025-10-15');
  assert.deepEqual(body.daily.stats, { count: 1, highest: 123, lowest: 123, average: '123.0' });
});

test('API: average of 3 readings rounds to one decimal', async () => {
  const { cookie } = await signUp('rep-round');
  for (const [slot, value] of [['fasting', 100], ['breakfast', 120], ['lunch', 141]]) {
    await add(cookie, '2025-10-15', slot, value); // 361 / 3 = 120.333...
  }
  const { body } = await report(cookie, '2025-10-15');
  assert.equal(body.daily.stats.average, '120.3');
});

test('API: defaults to today in APP_TIMEZONE; rejects invalid and future dates', async () => {
  const { cookie } = await signUp('rep-default');
  const res = await report(cookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.date, todayString());

  const [y, m, d] = todayString().split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  for (const bad of ['nope', '2025-02-30', '', tomorrow]) {
    const r = await report(cookie, bad);
    assert.equal(r.status, 400, `date "${bad}" should be rejected`);
  }
});

test('API: reports require sign-in', async () => {
  assert.equal((await report(null, '2025-10-15')).status, 401);
});

test('API: two accounts with readings in the same periods get separate reports', async () => {
  const alice = await signUp('rep-alice');
  const bob = await signUp('rep-bob');
  const carol = await signUp('rep-carol'); // has no readings at all

  // Same dates and slots, different values.
  for (const [date, slot, a, b] of [
    ['2025-09-10', 'fasting', 100, 300],
    ['2025-10-02', 'lunch', 110, 310],
    ['2025-10-15', 'fasting', 120, 320],
  ]) {
    await add(alice.cookie, date, slot, a);
    await add(bob.cookie, date, slot, b);
  }

  const a = (await report(alice.cookie, '2025-10-15')).body;
  const b = (await report(bob.cookie, '2025-10-15')).body;
  const c = (await report(carol.cookie, '2025-10-15')).body;

  assert.deepEqual(a.daily.stats, { count: 1, highest: 120, lowest: 120, average: '120.0' });
  assert.deepEqual(a.monthToDate.stats, { count: 2, highest: 120, lowest: 110, average: '115.0' });
  assert.deepEqual(a.previousMonth.stats, { count: 1, highest: 100, lowest: 100, average: '100.0' });
  assert.deepEqual(a.daily.readings.map((r) => r.value), [120]);

  assert.deepEqual(b.daily.stats, { count: 1, highest: 320, lowest: 320, average: '320.0' });
  assert.deepEqual(b.monthToDate.stats, { count: 2, highest: 320, lowest: 310, average: '315.0' });
  assert.deepEqual(b.previousMonth.stats, { count: 1, highest: 300, lowest: 300, average: '300.0' });
  assert.deepEqual(b.daily.readings.map((r) => r.value), [320]);

  assert.equal(c.daily.stats.count + c.monthToDate.stats.count + c.previousMonth.stats.count, 0); // sees none of theirs
  assert.deepEqual(c.daily.readings, []);
});
