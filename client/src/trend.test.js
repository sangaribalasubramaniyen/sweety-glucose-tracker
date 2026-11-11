import { describe, expect, it } from 'vitest';
import { buildChartModel } from './trend.js';

describe('buildChartModel', () => {
  it('uses the day of the month as the x value and a number as the average', () => {
    const { data } = buildChartModel(
      [
        { date: '2026-10-01', average: '90.0' },
        { date: '2026-10-14', average: '135.3' },
      ],
      '2026-10-15'
    );
    expect(data).toEqual([
      { date: '2026-10-01', day: 1, average: 90 },
      { date: '2026-10-14', day: 14, average: 135.3 },
    ]);
  });

  it('adds nothing for days without readings (no zero values)', () => {
    const { data } = buildChartModel([{ date: '2026-10-02', average: '110.0' }, { date: '2026-10-09', average: '130.0' }], '2026-10-15');
    expect(data).toHaveLength(2);
    expect(data.every((p) => p.average > 0)).toBe(true);
  });

  it('spans day 1 through the selected day, with half-day padding', () => {
    expect(buildChartModel([], '2026-10-15').domain).toEqual([0.5, 15.5]);
    expect(buildChartModel([], '2026-10-01').domain).toEqual([0.5, 1.5]); // a one-day range still has width
  });

  it('labels every day on short ranges and every few days on long ones', () => {
    expect(buildChartModel([], '2026-10-08').ticks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(buildChartModel([], '2026-10-01').ticks).toEqual([1]);
    const long = buildChartModel([], '2026-10-31').ticks;
    expect(long[0]).toBe(1);
    expect(long.length).toBeLessThanOrEqual(8); // room on a 390px screen
    expect(Math.max(...long)).toBeLessThanOrEqual(31);
  });
});
