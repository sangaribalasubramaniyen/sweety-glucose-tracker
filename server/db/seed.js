// Demo data for Sweety. Safe to run any number of times:
//   npm run db:seed
//
// - Creates (or updates) ONE demo user, identified by its email address.
// - Writes fictional readings with INSERT ... ON CONFLICT, keyed on
//   (user_id, reading_date, slot), so re-running never creates duplicates.
// - Every statement is scoped to the demo user's id: other users' data is never touched.
//
// The dates are fixed (not relative to today) so the demo report date below always
// gives the same numbers. They are all in the past, so the "no future dates" rule is respected.
require('../src/env');
const bcrypt = require('bcrypt');
const pool = require('../src/db');

const DEMO_EMAIL = 'demo@example.com';
const DEMO_NAME = 'Demo User';
const DEMO_PASSWORD = 'demo-password-123'; // fictional demo account only
const DEMO_REPORT_DATE = '2026-10-15'; // select this date in the Reports tab

const SLOTS = ['fasting', 'breakfast', 'lunch', 'dinner'];
const pad = (n) => String(n).padStart(2, '0');

// Fictional, deterministic values: fasting readings are lowest, after-meal readings higher.
const valueFor = (month, day, slotIndex) => 95 + ((day * 11 + slotIndex * 17 + month * 5) % 60) + slotIndex * 8;

// Builds the list of { date, slot, value } rows to insert.
function buildDemoReadings() {
  const rows = [];
  const add = (year, month, day, slotIndexes) => {
    for (const s of slotIndexes) {
      rows.push({ date: `${year}-${pad(month)}-${pad(day)}`, slot: SLOTS[s], value: valueFor(month, day, s) });
    }
  };
  // 1-3 slots per day, varying by day, so the data looks like real use.
  const someSlots = (day) => Array.from({ length: 1 + (day % 3) }, (_, k) => (day + k) % 4);

  // Previous month (September 2026): every other day, plus both end days.
  for (let d = 1; d <= 30; d++) if (d % 2 === 1 || d === 30) add(2026, 9, d, someSlots(d));

  // The selected day (15 October 2026): all four slots, to show the slot-ordered daily list.
  add(2026, 10, 15, [3, 2, 1, 0]); // inserted out of order on purpose; the app sorts by slot

  // Rest of October: most days, including the first, the day before and after the selected day, and the last.
  for (let d = 1; d <= 31; d++) if (d !== 15 && (d % 3 !== 0 || d === 1 || d === 14 || d === 16 || d === 31)) add(2026, 10, d, someSlots(d));

  // Decoys just outside the report ranges (31 Aug and 1 Nov): they must NOT appear in the October reports.
  add(2026, 8, 31, [0]);
  add(2026, 11, 1, [0]);
  return rows;
}

// Creates/updates the demo user and upserts its readings. Returns a summary.
async function seedDemo({ email = DEMO_EMAIL } = {}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: users } = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [DEMO_NAME, email, passwordHash]
  );
  const userId = users[0].id;

  const readings = buildDemoReadings();
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, value)
     SELECT $1, d, s, v FROM unnest($2::date[], $3::text[], $4::int[]) AS t(d, s, v)
     ON CONFLICT (user_id, reading_date, slot) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [userId, readings.map((r) => r.date), readings.map((r) => r.slot), readings.map((r) => r.value)]
  );
  return { userId, email, readingsSeeded: readings.length };
}

module.exports = { seedDemo, buildDemoReadings, DEMO_EMAIL, DEMO_PASSWORD, DEMO_REPORT_DATE };

if (require.main === module) {
  seedDemo()
    .then(async (r) => {
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM readings WHERE user_id = $1', [r.userId]);
      console.log(`Demo user ready: ${r.email}  (password: ${DEMO_PASSWORD})`);
      console.log(`Readings written: ${r.readingsSeeded}; demo user now has ${rows[0].n} readings in total`);
      console.log(`Try the Reports tab with the date ${DEMO_REPORT_DATE}`);
    })
    .catch((err) => {
      const missingTables = err.code === '42P01';
      console.error(missingTables ? 'Seed failed: tables not found. Run "npm run db:setup" first.' : `Seed failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
