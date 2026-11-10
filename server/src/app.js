const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Health check: confirms the API is up AND can reach PostgreSQL.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

module.exports = app;
