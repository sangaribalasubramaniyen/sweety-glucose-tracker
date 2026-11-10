const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { validateReading, checkDate } = require('../validation');
const { todayString } = require('../today');
const { slotLabel } = require('../slots');

const router = express.Router();
router.use(requireAuth); // every route below needs a signed-in user

// Every query below filters on user_id = req.user.id (from the verified session).
// A reading that belongs to someone else is treated exactly like one that does not exist.
const COLUMNS = 'id, reading_date AS date, slot, value';
const SLOT_ORDER = "array_position(ARRAY['fasting','breakfast','lunch','dinner'], slot)";

const invalid = (res, fields) => res.status(400).json({ error: 'Please fill in the highlighted fields.', fields });
const notFound = (res) => res.status(404).json({ error: 'Reading not found.' });
const duplicate = (res, slot) =>
  res.status(409).json({
    error: `You already have a reading for ${slotLabel(slot)} on that date. Edit that one instead.`,
    fields: { slot: 'This time slot already has a reading for that date.' },
  });

// Route ids must be plain integers that fit in a PostgreSQL INTEGER.
const parseId = (raw) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null);

// GET /api/readings?date=YYYY-MM-DD -> MY readings for that one day, in slot order.
// Without ?date it defaults to today (in APP_TIMEZONE). Also returns `today`
// so the React date picker knows its maximum.
router.get('/', async (req, res) => {
  const today = todayString();
  const date = req.query.date ?? today;
  const dateError = checkDate(date, today);
  if (dateError) return res.status(400).json({ error: dateError, fields: { date: dateError } });

  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM readings WHERE user_id = $1 AND reading_date = $2 ORDER BY ${SLOT_ORDER}`,
    [req.user.id, date]
  );
  res.json({ today, date, readings: rows });
});

// POST /api/readings { date, slot, value }
router.post('/', async (req, res) => {
  const { errors, data } = validateReading(req.body, todayString());
  if (errors) return invalid(res, errors);
  try {
    const { rows } = await pool.query(
      `INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [req.user.id, data.date, data.slot, data.value] // user id comes from the session, not the body
    );
    res.status(201).json({ reading: rows[0] });
  } catch (err) {
    if (err.code === '23505') return duplicate(res, data.slot); // readings_one_per_slot
    throw err;
  }
});

// PUT /api/readings/:id { date, slot, value }
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);
  const { errors, data } = validateReading(req.body, todayString());
  if (errors) return invalid(res, errors);
  try {
    const { rows } = await pool.query(
      `UPDATE readings SET reading_date = $1, slot = $2, value = $3, updated_at = now()
        WHERE id = $4 AND user_id = $5
        RETURNING ${COLUMNS}`,
      [data.date, data.slot, data.value, id, req.user.id]
    );
    if (rows.length === 0) return notFound(res);
    res.json({ reading: rows[0] });
  } catch (err) {
    if (err.code === '23505') return duplicate(res, data.slot);
    throw err;
  }
});

// DELETE /api/readings/:id
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);
  const result = await pool.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (result.rowCount === 0) return notFound(res);
  res.json({ ok: true });
});

module.exports = router;
