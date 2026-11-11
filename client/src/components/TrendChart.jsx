import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildChartModel } from '../trend.js';
import { prettyDate } from './ReadingList.jsx';

const BLUE = '#1f6feb'; // same blue as the buttons and tabs
const MUTED = '#5b6b7b';

// "2026-10-15" -> "October 2026"
const monthLabel = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// Shown when you hover or tap a dot: the full date and that day's average.
function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { date, average } = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{prettyDate(date)}</div>
      <div>
        Average: <strong>{average.toFixed(1)}</strong> mg/dL
      </div>
    </div>
  );
}

// Month-to-date line chart: one point per day with readings, from the 1st of the selected
// month through the selected date. `points` come from GET /api/reports/trend.
export default function TrendChart({ points, from, to }) {
  const { data, ticks, domain } = buildChartModel(points, to);

  return (
    <section className="card">
      <div>
        <h2>Month-to-date glucose trend</h2>
        <p className="subtitle">
          Daily average, {prettyDate(from)} to {prettyDate(to)}
        </p>
      </div>

      {data.length === 0 ? (
        <p className="empty-text">No readings to chart for this period.</p>
      ) : (
        <div
          className="chart-box"
          role="img"
          aria-label={`Line chart of the daily average glucose in mg/dL on the ${data.length} ${data.length === 1 ? 'day' : 'days'} with readings, ${monthLabel(to)}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#e3e8ed" vertical={false} />
              <XAxis
                dataKey="day"
                type="number"
                domain={domain}
                ticks={ticks}
                allowDecimals={false}
                tick={{ fontSize: 12, fill: MUTED }}
                stroke="#b8c2cc"
                height={44}
                label={{ value: `Day of ${monthLabel(to)}`, position: 'insideBottom', offset: 0, fontSize: 12, fill: MUTED }}
              />
              {/* Not anchored at zero, so small changes stay visible */}
              <YAxis
                domain={['dataMin - 10', 'dataMax + 10']}
                allowDecimals={false}
                tick={{ fontSize: 12, fill: MUTED }}
                stroke="#b8c2cc"
                width={64}
                label={{ value: 'mg/dL', angle: -90, position: 'insideLeft', fontSize: 12, fill: MUTED }}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#b8c2cc' }} />
              <Line
                type="linear"
                dataKey="average"
                name="Average"
                stroke={BLUE}
                strokeWidth={2}
                dot={{ r: 5, fill: BLUE, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: BLUE, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
