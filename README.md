# Sweety - blood glucose tracker

React + Node.js/Express + PostgreSQL. (Full setup, test commands, assumptions and
future improvements are added in Phase 6.)

## Time zone and the meaning of "today"

All date logic uses **one** definition of "today": the calendar date in the
IANA time zone set by `APP_TIMEZONE` in `.env`. **The default is `Asia/Kolkata` (IST, UTC+05:30).**

- The **server** computes "today" (`server/src/today.js`). It is never taken from the
  browser's clock, so a user whose laptop is set to another time zone gets the same answer.
- `GET /api/readings` returns `today`, and the React date picker uses it as its maximum.
- A reading dated after "today" is rejected by the API ("The date cannot be in the future").
- Reading dates are stored as plain `DATE` values (no time or zone), and are passed around
  as `YYYY-MM-DD` strings, so they can never shift by a day.
- Reports (Phase 4) use the same "today" and the selected date as a plain calendar date.

To use a different zone, set e.g. `APP_TIMEZONE=America/New_York` in `.env` and restart the API.
