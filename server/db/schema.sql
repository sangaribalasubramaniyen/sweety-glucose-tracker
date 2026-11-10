-- Sweety schema. Safe to run more than once (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- emails are stored lowercase so "A@x.com" and "a@x.com" are the same user
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE IF NOT EXISTS readings (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  slot         TEXT NOT NULL,
  value        INTEGER NOT NULL,  -- mg/dl, whole numbers only
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only four slots exist.
  CONSTRAINT readings_slot_valid CHECK (slot IN ('fasting', 'breakfast', 'lunch', 'dinner')),
  -- Valid range is 40-600 mg/dl.
  CONSTRAINT readings_value_range CHECK (value BETWEEN 40 AND 600),
  -- One reading per user, per date, per slot. With 4 slots this also means
  -- a user can never have more than 4 readings on a day.
  CONSTRAINT readings_one_per_slot UNIQUE (user_id, reading_date, slot)
);

-- Reports filter by user and date range; the UNIQUE constraint above already
-- creates an index on (user_id, reading_date, slot) that covers those queries.
