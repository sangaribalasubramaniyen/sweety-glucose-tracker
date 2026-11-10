// Creates the database (if missing) and applies schema.sql.
// Usage: npm run db:setup   (from the repo root or server/)
require('../src/env');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');

  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error('Database name may only contain letters, numbers, underscores.');

  // 1. Connect to the default "postgres" database to create ours if needed.
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const adminClient = new Client({ connectionString: admin.toString() });
  await adminClient.connect();
  const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE ${dbName}`);
    console.log(`Created database "${dbName}"`);
  } else {
    console.log(`Database "${dbName}" already exists`);
  }
  await adminClient.end();

  // 2. Apply the schema to our database.
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await client.end();
  console.log('Schema applied');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
