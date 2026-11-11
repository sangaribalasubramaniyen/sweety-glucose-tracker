import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrendChart from './TrendChart.jsx';

// The chart drawing itself needs a real browser layout, so it is checked in Chrome.
// These tests cover the title, the empty state and the accessible description.
describe('TrendChart', () => {
  const range = { from: '2026-10-01', to: '2026-10-15' };

  it('shows the title and range', () => {
    render(<TrendChart points={[]} {...range} />);
    expect(screen.getByRole('heading', { name: 'Month-to-date glucose trend' })).toBeInTheDocument();
    expect(screen.getByText('Daily average, 1 Oct 2026 to 15 Oct 2026')).toBeInTheDocument();
  });

  it('shows the friendly message, and no chart, when there are no readings', () => {
    render(<TrendChart points={[]} {...range} />);
    expect(screen.getByText('No readings to chart for this period.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('describes the chart for screen readers when there are readings', () => {
    render(<TrendChart points={[{ date: '2026-10-01', average: '90.0' }, { date: '2026-10-14', average: '135.3' }]} {...range} />);
    expect(screen.queryByText('No readings to chart for this period.')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/2 days with readings, October 2026/);
  });

  it('uses the singular for a single day', () => {
    render(<TrendChart points={[{ date: '2026-10-01', average: '90.0' }]} from="2026-10-01" to="2026-10-01" />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/1 day with readings/);
  });
});
