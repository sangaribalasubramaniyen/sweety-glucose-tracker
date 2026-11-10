const pool = require('../db');
const { COOKIE_NAME, hashToken } = require('../sessions');

// Reusable guard for any route that needs a signed-in user.
//
//   router.get('/readings', requireAuth, handler)
//
// On success it sets req.user = { id, name, email } from the VERIFIED session.
// Handlers must always use req.user.id to scope queries ("WHERE user_id = $1"),
// and never trust a user id sent in the body, query string or URL.
async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Please sign in.' });

  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  if (rows.length === 0) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });

  req.user = rows[0];
  next();
}

module.exports = requireAuth;
