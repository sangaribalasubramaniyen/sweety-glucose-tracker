// Readings API tests against the real local database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { call, signUp, startServer, stopServer } = require('./helpers');
const { todayString } = require('../src/today');

// Date helper: today (in APP_TIMEZONE) shifted by N days, as YYYY-MM-DD.
function daysFromToday(n) {
  const [y, m, d] = todayString().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const PAST = '2026-01-10';
const add = (cookie, body) => call('POST', '/api/readings', { cookie, body });
const list = async (cookie, date = PAST) => (await call('GET', `/api/readings?date=${date}`, { cookie })).body.readings;

before(startServer);
after(stopServer);

test('creates a reading and lists it with a plain YYYY-MM-DD date', async () => {
  const { cookie } = await signUp('create');
  const res = await add(cookie, { date: PAST, slot: 'fasting', value: 110 });
  assert.equal(res.status, 201);
  assert.deepEqual({ ...res.body.reading, id: undefined }, { id: undefined, date: PAST, slot: 'fasting', value: 110 });

  const readings = await list(cookie);
  assert.equal(readings.length, 1);
  assert.equal(readings[0].date, PAST); // not shifted by a time zone
});

test('accepts the boundary values 40 and 600 and a value sent as a string', async () => {
  const { cookie } = await signUp('bounds');
  assert.equal((await add(cookie, { date: PAST, slot: 'fasting', value: 40 })).status, 201);
  assert.equal((await add(cookie, { date: PAST, slot: 'breakfast', value: 600 })).status, 201);
  assert.equal((await add(cookie, { date: PAST, slot: 'lunch', value: '123' })).status, 201);
});

test('rejects a missing value, decimals, non-numbers and out-of-range values', async () => {
  const { cookie } = await signUp('badvalue');
  const tryValue = async (value) => {
    const res = await add(cookie, { date: PAST, slot: 'fasting', value });
    assert.equal(res.status, 400, `value ${JSON.stringify(value)} should be rejected`);
    return res.body.fields.value;
  };
  assert.match(await tryValue(undefined), /enter a glucose value/i);
  assert.match(await tryValue(''), /enter a glucose value/i);
  assert.match(await tryValue('   '), /enter a glucose value/i);
  assert.match(await tryValue(100.5), /whole number/i);
  assert.match(await tryValue('100.5'), /whole number/i);
  assert.match(await tryValue('100.0'), /whole number/i);
  assert.match(await tryValue('abc'), /must be a number/i);
  assert.match(await tryValue('1e2'), /must be a number/i);
  assert.match(await tryValue(39), /between 40 and 600 mg\/dl/i);
  assert.match(await tryValue(601), /between 40 and 600 mg\/dl/i);
  assert.match(await tryValue(-5), /between 40 and 600 mg\/dl/i);
  assert.equal((await list(cookie)).length, 0); // nothing was saved
});

test('rejects a missing or unknown slot and a missing or malformed date', async () => {
  const { cookie } = await signUp('badother');
  const slot = await add(cookie, { date: PAST, value: 100 });
  assert.match(slot.body.fields.slot, /choose a time/i);
  const unknown = await add(cookie, { date: PAST, slot: 'snack', value: 100 });
  assert.equal(unknown.status, 400);
  const noDate = await add(cookie, { slot: 'fasting', value: 100 });
  assert.match(noDate.body.fields.date, /choose a date/i);
  const badDate = await add(cookie, { date: '10/01/2026', slot: 'fasting', value: 100 });
  assert.match(badDate.body.fields.date, /YYYY-MM-DD/);
  const fakeDate = await add(cookie, { date: '2026-02-30', slot: 'fasting', value: 100 });
  assert.match(fakeDate.body.fields.date, /valid date/i);
});

test('rejects future dates but accepts today (APP_TIMEZONE)', async () => {
  const { cookie } = await signUp('future');
  const tomorrow = await add(cookie, { date: daysFromToday(1), slot: 'fasting', value: 100 });
  assert.equal(tomorrow.status, 400);
  assert.match(tomorrow.body.fields.date, /future/i);
  assert.equal((await add(cookie, { date: todayString(), slot: 'fasting', value: 100 })).status, 201);
  assert.equal((await add(cookie, { date: daysFromToday(-1), slot: 'fasting', value: 100 })).status, 201);
});

test('GET returns the server-defined today', async () => {
  const { cookie } = await signUp('today');
  const res = await call('GET', '/api/readings', { cookie });
  assert.equal(res.body.today, todayString());
});

test('a second reading for the same date and slot is refused; all four slots are allowed', async () => {
  const { cookie } = await signUp('dup');
  assert.equal((await add(cookie, { date: PAST, slot: 'lunch', value: 100 })).status, 201);
  const dup = await add(cookie, { date: PAST, slot: 'lunch', value: 150 });
  assert.equal(dup.status, 409);
  assert.match(dup.body.error, /After lunch/);
  assert.ok(dup.body.fields.slot);

  for (const slot of ['fasting', 'breakfast', 'dinner']) {
    assert.equal((await add(cookie, { date: PAST, slot, value: 100 })).status, 201);
  }
  assert.equal((await list(cookie)).length, 4);
  // The same slot on a different date is fine.
  assert.equal((await add(cookie, { date: '2026-01-11', slot: 'lunch', value: 100 })).status, 201);
});

test('two users can each have a reading for the same date and slot', async () => {
  const a = await signUp('same-a');
  const b = await signUp('same-b');
  assert.equal((await add(a.cookie, { date: PAST, slot: 'fasting', value: 100 })).status, 201);
  assert.equal((await add(b.cookie, { date: PAST, slot: 'fasting', value: 120 })).status, 201);
});

test('edits a reading, including its date and slot', async () => {
  const { cookie } = await signUp('edit');
  const { body } = await add(cookie, { date: PAST, slot: 'fasting', value: 100 });
  const id = body.reading.id;

  const same = await call('PUT', `/api/readings/${id}`, { cookie, body: { date: PAST, slot: 'fasting', value: 130 } });
  assert.equal(same.status, 200); // saving over itself is not a duplicate
  assert.equal(same.body.reading.value, 130);

  const moved = await call('PUT', `/api/readings/${id}`, { cookie, body: { date: '2026-01-09', slot: 'dinner', value: 130 } });
  assert.equal(moved.status, 200);
  assert.deepEqual([moved.body.reading.date, moved.body.reading.slot], ['2026-01-09', 'dinner']);
});

test('edit validates input and refuses to move onto an occupied slot', async () => {
  const { cookie } = await signUp('editbad');
  await add(cookie, { date: PAST, slot: 'lunch', value: 100 });
  const { body } = await add(cookie, { date: PAST, slot: 'dinner', value: 100 });
  const id = body.reading.id;

  const clash = await call('PUT', `/api/readings/${id}`, { cookie, body: { date: PAST, slot: 'lunch', value: 100 } });
  assert.equal(clash.status, 409);
  const range = await call('PUT', `/api/readings/${id}`, { cookie, body: { date: PAST, slot: 'dinner', value: 700 } });
  assert.equal(range.status, 400);
  const future = await call('PUT', `/api/readings/${id}`, { cookie, body: { date: daysFromToday(1), slot: 'dinner', value: 100 } });
  assert.equal(future.status, 400);

  const unchanged = (await list(cookie)).find((r) => r.id === id);
  assert.deepEqual([unchanged.slot, unchanged.value], ['dinner', 100]);
});

test('deletes a reading', async () => {
  const { cookie } = await signUp('delete');
  const { body } = await add(cookie, { date: PAST, slot: 'fasting', value: 100 });
  assert.equal((await call('DELETE', `/api/readings/${body.reading.id}`, { cookie })).status, 200);
  assert.equal((await list(cookie)).length, 0);
  assert.equal((await call('DELETE', `/api/readings/${body.reading.id}`, { cookie })).status, 404); // already gone
});

test('cross-account: a user cannot see, edit or delete another user\'s reading', async () => {
  const alice = await signUp('alice');
  const bob = await signUp('bob');
  const { body } = await add(alice.cookie, { date: PAST, slot: 'fasting', value: 100 });
  const id = body.reading.id;

  assert.deepEqual(await list(bob.cookie), []); // not in Bob's list

  const edit = await call('PUT', `/api/readings/${id}`, { cookie: bob.cookie, body: { date: PAST, slot: 'fasting', value: 222 } });
  assert.equal(edit.status, 404);
  const del = await call('DELETE', `/api/readings/${id}`, { cookie: bob.cookie });
  assert.equal(del.status, 404);

  const [still] = await list(alice.cookie); // Alice's reading is untouched
  assert.equal(still.value, 100);
});

test('cross-account: a user_id sent in the body is ignored', async () => {
  const alice = await signUp('inject-a');
  const bob = await signUp('inject-b');
  const res = await add(bob.cookie, { date: PAST, slot: 'fasting', value: 100, user_id: alice.user.id, userId: alice.user.id });
  assert.equal(res.status, 201);
  assert.equal((await list(alice.cookie)).length, 0);
  assert.equal((await list(bob.cookie)).length, 1);
});

test('every readings route requires sign-in', async () => {
  assert.equal((await call('GET', '/api/readings')).status, 401);
  assert.equal((await call('POST', '/api/readings', { body: { date: PAST, slot: 'fasting', value: 100 } })).status, 401);
  assert.equal((await call('PUT', '/api/readings/1', { body: { date: PAST, slot: 'fasting', value: 100 } })).status, 401);
  assert.equal((await call('DELETE', '/api/readings/1')).status, 401);
});

test('malformed ids return 404 instead of crashing', async () => {
  const { cookie } = await signUp('ids');
  assert.equal((await call('DELETE', '/api/readings/abc', { cookie })).status, 404);
  assert.equal((await call('DELETE', '/api/readings/99999999999', { cookie })).status, 404);
});

test('GET shows only the selected day, in slot order regardless of entry order', async () => {
  const { cookie } = await signUp('dayview');
  // Entered in reverse order, on two different days.
  for (const [slot, value] of [['dinner', 140], ['lunch', 130], ['breakfast', 120], ['fasting', 100]]) {
    await add(cookie, { date: PAST, slot, value });
  }
  await add(cookie, { date: '2026-01-11', slot: 'fasting', value: 99 });

  const day = await call('GET', `/api/readings?date=${PAST}`, { cookie });
  assert.equal(day.body.date, PAST);
  assert.deepEqual(day.body.readings.map((r) => r.slot), ['fasting', 'breakfast', 'lunch', 'dinner']);
  assert.deepEqual(day.body.readings.map((r) => r.value), [100, 120, 130, 140]);

  const other = await list(cookie, '2026-01-11');
  assert.deepEqual(other.map((r) => r.value), [99]); // the other day's reading is not mixed in
  assert.deepEqual(await list(cookie, '2026-01-12'), []); // a day with nothing
});

test('GET without a date defaults to today in APP_TIMEZONE', async () => {
  const { cookie } = await signUp('default');
  await add(cookie, { date: todayString(), slot: 'lunch', value: 111 });
  await add(cookie, { date: daysFromToday(-1), slot: 'lunch', value: 222 });
  const res = await call('GET', '/api/readings', { cookie });
  assert.equal(res.body.date, todayString());
  assert.deepEqual(res.body.readings.map((r) => r.value), [111]);
});

test('GET rejects an invalid, empty or future date', async () => {
  const { cookie } = await signUp('baddate');
  for (const date of ['nope', '2026-02-30', '', daysFromToday(1)]) {
    const res = await call('GET', `/api/readings?date=${date}`, { cookie });
    assert.equal(res.status, 400, `date "${date}" should be rejected`);
    assert.ok(res.body.fields.date);
  }
});

test('cross-account: with readings on the SAME date, each user lists only their own', async () => {
  const alice = await signUp('iso-a');
  const bob = await signUp('iso-b');
  await add(alice.cookie, { date: PAST, slot: 'fasting', value: 101 });
  await add(alice.cookie, { date: PAST, slot: 'lunch', value: 102 });
  await add(bob.cookie, { date: PAST, slot: 'fasting', value: 201 });
  await add(bob.cookie, { date: PAST, slot: 'dinner', value: 202 });

  assert.deepEqual((await list(alice.cookie)).map((r) => r.value), [101, 102]);
  assert.deepEqual((await list(bob.cookie)).map((r) => r.value), [201, 202]);

  // Bob tries to tamper with Alice's reading; both lists are unchanged afterwards.
  const [aliceFasting] = await list(alice.cookie);
  await call('PUT', `/api/readings/${aliceFasting.id}`, { cookie: bob.cookie, body: { date: PAST, slot: 'fasting', value: 999 } });
  await call('DELETE', `/api/readings/${aliceFasting.id}`, { cookie: bob.cookie });
  assert.deepEqual((await list(alice.cookie)).map((r) => r.value), [101, 102]);
  assert.deepEqual((await list(bob.cookie)).map((r) => r.value), [201, 202]);
});
