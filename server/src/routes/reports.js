const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { checkDate } = require('../validation');
const { todayString } = require('../today');
const { getReportRanges, buildStats, buildTrend } = require('../reports');

const router = express.Router();
router.use(requireAuth);

const SLOT_ORDER = "array_position(ARRAY['fasting','breakfast','lunch','dinner'], slot)";

// Count / highest / lowest / sum for one user over an inclusive date range.
async function statsFor(userId, { from, to }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count, max(value) AS highest, min(value) AS lowest, sum(value)::int AS total
       FROM readings
      WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3`,
    [userId, from, to]
  );
  return buildStats(rows[0]);
}

// GET /api/reports?date=YYYY-MM-DD  (defaults to today in APP_TIMEZONE)
// Returns the daily, month-to-date and previous-month reports in one response.
// Every query filters on the signed-in user's id.
router.get('/', async (req, res) => {
  const today = todayString();
  const date = req.query.date ?? today;
  const dateError = checkDate(date, today);
  if (dateError) return res.status(400).json({ error: dateError, fields: { date: dateError } });

  const userId = req.user.id;
  const ranges = getReportRanges(date);

  const [daily, monthToDate, previousMonth, dayReadings] = await Promise.all([
    statsFor(userId, ranges.daily),
    statsFor(userId, ranges.monthToDate),
    statsFor(userId, ranges.previousMonth),
    pool.query(
      `SELECT id, slot, value FROM readings WHERE user_id = $1 AND reading_date = $2 ORDER BY ${SLOT_ORDER}`,
      [userId, date]
    ),
  ]);

  res.json({
    today,
    date,
    daily: { ...ranges.daily, stats: daily, readings: dayReadings.rows },
    monthToDate: { ...ranges.monthToDate, stats: monthToDate },
    previousMonth: { ...ranges.previousMonth, stats: previousMonth },
  });
});

// GET /api/reports/trend?date=YYYY-MM-DD  (defaults to today in APP_TIMEZONE)
// One point per day that has readings, from the first day of the selected month through the
// selected date (inclusive): that day's average glucose, rounded to one decimal.
// Same sign-in requirement, date rules and per-user scoping as the reports above.
router.get('/trend', async (req, res) => {
  const today = todayString();
  const date = req.query.date ?? today;
  const dateError = checkDate(date, today);
  if (dateError) return res.status(400).json({ error: dateError, fields: { date: dateError } });

  const { from, to } = getReportRanges(date).monthToDate;
  const { rows } = await pool.query(
    `SELECT reading_date AS date, count(*)::int AS count, sum(value)::int AS total
       FROM readings
      WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3
      GROUP BY reading_date
      ORDER BY reading_date`,
    [req.user.id, from, to]
  );
  res.json({ date, from, to, points: buildTrend(rows) });
});

module.exports = router;
