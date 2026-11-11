# Sweety - blood glucose tracker

Sweety lets a person sign up, record up to four blood glucose readings a day, and see
daily, month-to-date and previous-month summaries.

**Stack:** React (Vite) · Node.js + Express · PostgreSQL. The assignment title says MERN, but its
database requirement is PostgreSQL, so PostgreSQL is used throughout (no MongoDB).

## Features

- Sign up, log in, log out (bcrypt password hashing, session kept in an httpOnly cookie).
- Add, view (by day), edit and delete glucose readings. Four slots per day:

  | Stored key  | Shown as            |
  |-------------|---------------------|
  | `fasting`   | Morning (fasting)   |
  | `breakfast` | After breakfast     |
  | `lunch`     | After lunch         |
  | `dinner`    | After dinner        |

- Validation: whole numbers only, 40-600 mg/dl, a real calendar date that is not in the future,
  and one reading per user, date and slot (enforced by a database constraint).
- Reports for a selected date: **Daily**, **Month to date**, **Previous month** - each with
  reading count, highest, lowest and average (one decimal), and a friendly empty state.
- **Month-to-date glucose trend** (bonus): a line chart under the reports. It plots one point for
  each day that has readings, from the 1st of the selected month through the selected date, at
  that day's average in mg/dL (one decimal; hover or tap a point to see the date and average).
  Days without readings are left out, never drawn as zero, and readings from the previous month or
  after the selected date are not included. With no readings it shows "No readings to chart for this period."
  Built with [Recharts](https://recharts.org).
- Every reading and report query is scoped to the signed-in user.

## Prerequisites

- **Node.js 22 or newer** (developed on 22.22; the server test script uses a glob pattern that needs Node 21+) and npm.
- **PostgreSQL** with a user that may create databases (developed on PostgreSQL 18). The schema uses
  only standard features, but only version 18 has been tested.
- Git.

## Install

```bash
git clone https://github.com/sangaribalasubramaniyen/sweety-glucose-tracker.git
cd sweety-glucose-tracker
npm run install:all      # installs the server and client dependencies
```

## Configure

Copy the example file and put your PostgreSQL connection string in it:

```bash
cp .env.example .env     # on Windows PowerShell: Copy-Item .env.example .env
```

Edit `.env`. The only required value is `DATABASE_URL`
(`postgres://USER:PASSWORD@HOST:PORT/DATABASE_NAME`). URL-encode special characters in the
password (for example `@` becomes `%40`). `.env` is git-ignored. All variables are explained in `.env.example`.

## Set up PostgreSQL

Make sure PostgreSQL is running, then:

```bash
npm run db:setup         # creates the database if it is missing, then applies server/db/schema.sql
```

This is safe to run more than once. If it fails with "password authentication failed", the
password in `DATABASE_URL` is not the one PostgreSQL expects for that user.

## Run the app

Use two terminals from the repository root:

```bash
npm run dev:server       # API on http://localhost:4000  (health check: /api/health)
npm run dev:client       # React app on http://localhost:5173
```

Open http://localhost:5173. The dev server forwards `/api` requests to the API, so the browser
only talks to one origin.

## Demo data

```bash
npm run db:seed
```

Creates a fictional demo user and about 90 fictional readings (September and October 2026):

- Email: `demo@example.com`
- Password: `demo-password-123`
- **Demo report date: `2026-10-15`** - choose it in the Reports tab.

For that date the reports show:

| Report         | Range                       | Readings | Highest | Lowest | Average |
|----------------|-----------------------------|---------:|--------:|-------:|--------:|
| Daily          | 15 Oct 2026                 | 4        | 155     | 120    | 137.5   |
| Month to date  | 1 Oct - 15 Oct 2026         | 29       | 177     | 102    | 137.1   |
| Previous month | 1 Sep - 30 Sep 2026         | 31       | 174     | 97     | 140.6   |

The seed is repeatable: it upserts one demo user and upserts readings on
`(user, date, slot)`, so running it again creates no duplicates and resets only the demo user's
seeded values. It never reads or changes any other user's data. It also adds two readings just
outside the ranges (31 Aug and 1 Nov) to show that the boundaries are respected.

## Run the tests

```bash
npm test                 # server tests, then client tests
npm run test:server      # API + logic tests (Node's built-in test runner)
npm run test:client      # React Testing Library tests for the reading form (Vitest)
```

The server tests run against the real PostgreSQL database from `.env` (run `npm run db:setup`
first). They start the API on a random free port by themselves, so the dev server need not be running,
and they delete the accounts they create. They cover signup/login/logout, reading validation,
duplicate slots, cross-account isolation, report date boundaries (including January rolling back to
December), average rounding, empty reports and the seed script. The client tests cover the reading
form: an invalid value, a successful save and the duplicate-slot error.

## Production build

```bash
npm run build            # Vite production build into client/dist
```

The build is a compile check; deployment configuration (serving `client/dist`, HTTPS) is not included.

## Project structure

```
server/
  db/schema.sql, setup.js, seed.js   schema, database creation, demo data
  src/routes/                        auth, readings, reports
  src/middleware/requireAuth.js      session check; sets req.user
  src/validation.js, reports.js      pure logic (validation, date ranges, rounding)
  src/today.js                       the single definition of "today"
  test/                              API and logic tests
client/
  src/components/                    login/signup form, readings and reports screens
  src/slots.js                       slot keys -> labels
```

## API summary

All routes except signup and login need a signed-in session.

| Method and path                  | Purpose                                              |
|----------------------------------|------------------------------------------------------|
| `POST /api/auth/signup`          | `{ name, email, password }` - create account, sign in |
| `POST /api/auth/login`           | `{ email, password }`                                |
| `POST /api/auth/logout`          | end the session                                      |
| `GET /api/auth/me`               | current user (used to restore the session on refresh) |
| `GET /api/readings?date=`        | the signed-in user's readings for one day, in slot order (default: today) |
| `POST /api/readings`             | `{ date, slot, value }`                              |
| `PUT /api/readings/:id`          | edit a reading                                       |
| `DELETE /api/readings/:id`       | delete a reading                                     |
| `GET /api/reports?date=`         | daily, month-to-date and previous-month reports (default: today) |
| `GET /api/reports/trend?date=`   | per-day average points for the trend chart, 1st of the month through the date |

## Time zone

All date logic uses **one** definition of "today": the calendar date in the IANA time zone set by
`APP_TIMEZONE` in `.env`. **The default is `Asia/Kolkata` (IST, UTC+05:30).**

- The **server** computes "today" (`server/src/today.js`). It is never taken from the browser's
  clock, so a user whose laptop is set to another time zone gets the same answer.
- The API sends `today` to the React app, which uses it as the maximum of every date picker.
- A reading dated after "today" is rejected ("The date cannot be in the future").
- Reading dates are stored as plain `DATE` values (no time or zone) and passed around as
  `YYYY-MM-DD` strings, so they cannot shift by a day.

To use a different zone, set e.g. `APP_TIMEZONE=America/New_York` in `.env` and restart the API.

## Notes

**Assumptions**

- **Time zone:** the brief did not name one, so I chose `Asia/Kolkata`; change it with `APP_TIMEZONE` (see above).
- **Slots:** the four slot keys and their labels are listed under Features. Keys are stored in the
  database and the labels are only for display.
- **Readings** are whole numbers from 40 to 600 mg/dl. Decimals are rejected rather than rounded.

**Report definitions** (selected date `2026-10-15` as the example; all ranges are inclusive)

- **Daily:** 15 Oct only.
- **Month to date:** 1 Oct through 15 Oct.
- **Previous month:** the *entire* month before the selected date's month - 1 Sep through 30 Sep -
  not "the last 30 days" and not "up to the same day last month". If the selected date is in
  January, the previous month is December of the previous year.

**What I would improve with more time**

- Rate-limit login attempts and add account lockout; add password reset and email verification.
- Delete expired sessions on a schedule (they are rejected today but not removed).
- Add CSRF tokens on top of the `SameSite=Lax` cookie.
- Paginate and add a date-range view for readings; add charts and trends; CSV export.
- Optional per-user time zone instead of one app-wide zone.
- Use a migration tool instead of the idempotent `schema.sql`.
- End-to-end browser tests (for example Playwright), CI on every push, and Docker Compose for PostgreSQL.
- Component tests for the other screens and an accessibility audit.
- Serve the built client from Express for a single-process deployment.

## Screenshots

**Readings** - add a reading (left) and view one day's readings in slot order (right):

![Readings tab](docs/screenshots/readings.png)

**Reports** - daily, month-to-date and previous-month summaries for a chosen date:

![Reports tab](docs/screenshots/reports-desktop.png)

**Month-to-date glucose trend** - one point per day with readings (that day's average in mg/dL), from the 1st of the month through the selected date:

![Month-to-date glucose trend](docs/screenshots/glucose-trend.png)

**Log in:**

![Log in screen](docs/screenshots/login.png)
