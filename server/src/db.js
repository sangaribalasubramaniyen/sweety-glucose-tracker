require('./env');
const { Pool, types } = require('pg');

// By default node-postgres turns DATE columns into JavaScript Date objects in the
// server's local time zone, which can shift a date by one day. Keep them as the
// plain "YYYY-MM-DD" strings PostgreSQL stores.
types.setTypeParser(1082, (value) => value);

// DATABASE_URL looks like: postgres://user:password@localhost:5432/sweety
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
