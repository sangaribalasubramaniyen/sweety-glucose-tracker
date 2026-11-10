const crypto = require('crypto');
const pool = require('./db');

const COOKIE_NAME = 'sweety_session';
const SESSION_DAYS = 7;

// We store only a hash of the token, never the token itself.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const cookieOptions = () => ({
  httpOnly: true, // JavaScript in the page cannot read the cookie (limits XSS damage)
  sameSite: 'lax', // not sent on cross-site POSTs (basic CSRF protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  path: '/',
});

// Creates a session row and sets the cookie on the response.
async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), expires: expiresAt });
}

// Deletes the session row (real logout) and clears the cookie.
async function endSession(req, res) {
  const token = req.cookies[COOKIE_NAME];
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

module.exports = { COOKIE_NAME, hashToken, startSession, endSession };
