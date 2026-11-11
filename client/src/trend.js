// Turns the API's trend points into what the chart needs.
//
// `points` is [{ date: "2026-10-14", average: "135.3" }, ...]: one entry per day that HAS
// readings. Days without readings are simply absent, so nothing is ever drawn as zero.
export function buildChartModel(points, selectedDate) {
  const lastDay = Number(selectedDate.slice(8, 10)); // the selected day of the month (1-31)

  // The X axis is the day of the month, so a gap of missing days shows as a gap in time.
  const data = points.map((p) => ({ date: p.date, day: Number(p.date.slice(8, 10)), average: Number(p.average) }));

  // Label every day for short ranges, otherwise every few days, so labels fit on a phone.
  const step = Math.max(1, Math.ceil(lastDay / 8));
  const ticks = [];
  for (let day = 1; day <= lastDay; day += step) ticks.push(day);

  return { data, lastDay, ticks, domain: [0.5, lastDay + 0.5] }; // half-day padding keeps edge dots fully visible
}
