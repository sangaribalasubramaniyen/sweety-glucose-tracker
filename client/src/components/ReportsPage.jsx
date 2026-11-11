import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { SLOTS } from '../slots.js';
import { prettyDate } from './ReadingList.jsx';
import TrendChart from './TrendChart.jsx';

const labelFor = (key) => SLOTS.find((s) => s.key === key)?.label ?? key;

// "2026-09-01" -> "September 2026"
function monthName(iso) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Four numbers for one period. Values arrive ready to show (average is already "135.3").
function Stats({ stats }) {
  const tiles = [
    ['Readings', stats.count, null],
    ['Highest', stats.highest, 'mg/dl'],
    ['Lowest', stats.lowest, 'mg/dl'],
    ['Average', stats.average, 'mg/dl'],
  ];
  return (
    <dl className="stats">
      {tiles.map(([label, value, unit]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <span className="metric">{value}</span>
            {unit && <span className="unit">{unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReportCard({ title, subtitle, stats, emptyText, children }) {
  return (
    <section className="card">
      <div>
        <h2>{title}</h2>
        <p className="subtitle">{subtitle}</p>
      </div>
      {stats.count === 0 ? <p className="empty-text">{emptyText}</p> : <Stats stats={stats} />}
      {stats.count > 0 && children}
    </section>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // No date -> the server answers for today in the app time zone.
  const load = useCallback(async (date) => {
    try {
      const query = date ? `?date=${date}` : '';
      // The reports and the chart data are fetched together, so they always describe the same date.
      const [report, trend] = await Promise.all([api(`/reports${query}`), api(`/reports/trend${query}`)]);
      setData({ ...report, trend });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return error ? <p className="form-error" role="alert">{error}</p> : <p>Loading reports...</p>;

  const { daily, monthToDate, previousMonth } = data;

  return (
    <>
      <div className="card date-card">
        <h2>Reports</h2>
        <div className="date-picker">
          <label>
            Choose a report date
            <input type="date" value={data.date} max={data.today} onChange={(e) => e.target.value && load(e.target.value)} />
          </label>
          <button type="button" className="secondary" onClick={() => load()} disabled={data.date === data.today}>
            Today
          </button>
        </div>
        <p className="subtitle">All three reports below are based on this date.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <ReportCard
        title="Daily report"
        subtitle={prettyDate(daily.from)}
        stats={daily.stats}
        emptyText={`No readings for ${prettyDate(daily.from)}. Add some on the Readings tab.`}
      >
        <ul className="readings">
          {daily.readings.map((r) => (
            <li key={r.id}>
              <span className="slot">{labelFor(r.slot)}</span>
              <strong>{r.value} mg/dl</strong>
            </li>
          ))}
        </ul>
      </ReportCard>

      {/* Side by side on desktop, stacked on mobile (see .report-grid in styles.css) */}
      <div className="report-grid">
        <ReportCard
          title="Month to date"
          subtitle={`${prettyDate(monthToDate.from)} to ${prettyDate(monthToDate.to)}`}
          stats={monthToDate.stats}
          emptyText="No readings so far this month."
        />

        <ReportCard
          title="Previous month"
          subtitle={`${monthName(previousMonth.from)} (${prettyDate(previousMonth.from)} to ${prettyDate(previousMonth.to)})`}
          stats={previousMonth.stats}
          emptyText={`No readings in ${monthName(previousMonth.from)}.`}
        />
      </div>

      <TrendChart points={data.trend.points} from={data.trend.from} to={data.trend.to} />
    </>
  );
}
