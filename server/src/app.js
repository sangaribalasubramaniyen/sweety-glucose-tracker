const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use((req, res, next) => {
  req.body ??= {}; // Express 5 leaves req.body undefined when there is no JSON body
  next();
});
app.use(cookieParser());

// Health check: confirms the API is up AND can reach PostgreSQL.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

app.use('/api/auth', authRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Last-resort error handler (Express 5 forwards errors from async handlers here).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

module.exports = app;
