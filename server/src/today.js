// The ONE definition of "today" for the whole app.
//
// "Today" is the calendar date in APP_TIMEZONE (default Asia/Kolkata), not the
// server's or the browser's local date. The API sends this value to the React
// app, so the date picker, validation and reports all agree.
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE, // throws RangeError at startup if the name is invalid
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}); // the en-CA locale formats dates as YYYY-MM-DD

// Returns today's date as "YYYY-MM-DD" in APP_TIMEZONE. `now` is injectable for tests.
function todayString(now = new Date()) {
  return formatter.format(now);
}

module.exports = { APP_TIMEZONE, todayString };
