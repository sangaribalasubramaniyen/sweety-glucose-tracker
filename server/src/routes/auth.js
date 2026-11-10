const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { startSession, endSession } = require('../sessions');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A real bcrypt hash of a throwaway string. When the email doesn't exist we
// still run bcrypt.compare against it, so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// POST /api/auth/signup  { name, email, password }
router.post('/signup', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  const errors = {};
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or fewer.';
  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (Buffer.byteLength(password) > 72) errors.password = 'Password must be 72 bytes or fewer.'; // bcrypt limit
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    await startSession(res, rows[0].id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on users.email
      return res.status(409).json({ error: 'An account with this email already exists.', fields: { email: 'Already registered.' } });
    }
    throw err;
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const { rows } = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  // Same message whether the email or the password was wrong.
  if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  await startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.json({ ok: true });
});

// GET /api/auth/me  -> lets the React app restore the session after a refresh
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
