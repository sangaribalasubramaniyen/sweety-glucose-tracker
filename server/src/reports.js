// Pure helpers for reports (no database): date ranges and rounding.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Turns the selected date ("YYYY-MM-DD") into the three report ranges.
// All ranges are inclusive, and are plain calendar dates (no time zone involved).
//
//   selected 2026-10-15 ->
//     daily         2026-10-15 .. 2026-10-15
//     monthToDate   2026-10-01 .. 2026-10-15
//     previousMonth 2026-09-01 .. 2026-09-30   (the WHOLE month before the selected month)
function getReportRanges(selected) {
  const [y, m] = selected.split('-').map(Number);

  // Month before the selected one. January rolls back to December of the previous year.
  const prevYear = m === 1 ? y - 1 : y;
  const prevMonth = m === 1 ? 12 : m - 1;
  // Day 0 of month m is the last day of month m-1 (Date.UTC months are 0-based).
  const lastDayOfPrevMonth = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();

  return {
    daily: { from: selected, to: selected },
    monthToDate: { from: ymd(y, m, 1), to: selected },
    previousMonth: { from: ymd(prevYear, prevMonth, 1), to: ymd(prevYear, prevMonth, lastDayOfPrevMonth) },
  };
}

// Average of whole-number readings, rounded half-up to one decimal, returned as
// a string so "100.0" keeps its decimal. Works from the integer sum and count so
// there is no accumulated floating-point error. Returns null when there are no readings.
function roundedAverage(sum, count) {
  if (!count) return null;
  return (Math.round((sum * 10) / count) / 10).toFixed(1);
}

// Turns one row of SQL aggregates into the stats object sent to the browser.
function buildStats({ count, highest, lowest, total }) {
  if (!count) return { count: 0, highest: null, lowest: null, average: null };
  return { count, highest, lowest, average: roundedAverage(total, count) };
}

module.exports = { getReportRanges, roundedAverage, buildStats };
