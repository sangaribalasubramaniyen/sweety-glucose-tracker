require('./env');
const { Pool } = require('pg');

// DATABASE_URL looks like: postgres://user:password@localhost:5432/sweety
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
