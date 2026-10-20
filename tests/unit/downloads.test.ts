import { describe, expect, it } from 'vitest';
import {
  findPlatformGapDates,
  movingAverage,
  toDisplaySeries,
  type DailySeries,
  type DownloadPoint,
} from '../../src/lib/downloads';
import type { DailyDownload } from '../../src/lib/types';

const DATES = [
  '2026-10-10',
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
];

function series(values: number[], status: DailySeries['status'] = 'verified'): DailySeries {
  const daily: DailyDownload[] = DATES.map((date, index) => ({
    date,
    downloads: values[index] ?? 0,
  }));
  return { status, daily };
}

function points(values: Array<number | null>, missingIndexes: number[] = []): DownloadPoint[] {
  return values.map((value, index) => ({
    date: new Date(Date.UTC(2026,9,10+index)).toISOString().slice(0,10),
    downloads: value,
    missing: missingIndexes.includes(index),
  }));
}

describe('findPlatformGapDates', () => {
  it('flags a date when at least 5 verified packages report and 80% are zero', () => {
    // 10-13: five packages, all zero -> platform gap.
    // Other dates: five packages, one isolated zero -> not a gap.
    const packages = [
      series([10, 10, 10, 0, 10, 10, 10]),
      series([20, 20, 20, 0, 20, 20, 20]),
      series([30, 30, 30, 0, 30, 30, 30]),
      series([40, 40, 40, 0, 40, 40, 40]),
      series([50, 50, 50, 0, 50, 50, 50]),
    ];

    const gaps = findPlatformGapDates(packages);

    expect([...gaps]).toEqual(['2026-10-13']);
  });

  it('does not flag a date with fewer than 5 reporting packages', () => {
    const packages = [
      series([0, 1, 1, 1, 1, 1, 1]),
      series([0, 1, 1, 1, 1, 1, 1]),
      series([0, 1, 1, 1, 1, 1, 1]),
      series([0, 1, 1, 1, 1, 1, 1]),
    ];

    expect(findPlatformGapDates(packages).size).toBe(0);
  });

  it('keeps an isolated real zero out of the gap set and counts it in the mean', () => {
    const packages = [
      series([10, 20, 30, 0, 50, 60, 70]),
      series([10, 20, 30, 40, 50, 60, 70]),
      series([10, 20, 30, 40, 50, 60, 70]),
      series([10, 20, 30, 40, 50, 60, 70]),
      series([10, 20, 30, 40, 50, 60, 70]),
    ];

    const gaps = findPlatformGapDates(packages);
    expect(gaps.has('2026-10-13')).toBe(false);

    const display = toDisplaySeries(packages[0].daily, gaps);
    expect(display[3]).toEqual({ date: '2026-10-13', downloads: 0, missing: false });

    const average = movingAverage(display);
    // (10 + 20 + 30 + 0 + 50 + 60 + 70) / 7 = 34.285... -> 34
    expect(average[6]).toBe(34);
  });

  it('ignores unverified packages when counting platform coverage', () => {
    const packages = [
      series([0, 0, 0, 0, 0, 0, 0], 'unavailable'),
      series([1, 2, 3, 4, 5, 6, 7]),
    ];

    expect(findPlatformGapDates(packages).size).toBe(0);
  });
});

describe('toDisplaySeries', () => {
  it('nulls platform gap dates while keeping real zero values', () => {
    const gaps = new Set(['2026-10-13']);
    const display = toDisplaySeries(series([10, 20, 0, 0, 30, 40, 50]).daily, gaps);

    expect(display[2]).toEqual({ date: '2026-10-12', downloads: 0, missing: false });
    expect(display[3]).toEqual({ date: '2026-10-13', downloads: null, missing: true });
  });
});

describe('movingAverage', () => {
  it('returns null when any day in the 7-day window is a platform gap', () => {
    const display = points([10, 10, 10, null, 10, 10, 10, 10, 10, 10, 10], [3]);
    const average = movingAverage(display);

    expect(average.slice(0, 3)).toEqual([null, null, null]);
    // Windows ending 10-13 through 10-19 include the gap.
    expect(average.slice(3, 10)).toEqual([null, null, null, null, null, null, null]);
    // The window ending 10-20 (10-14..10-20) is complete again.
    expect(average[10]).toBe(10);
  });

  it('breaks the line for windows containing a missing point at any position', () => {
    const display = points([10, 10, 10, 10, 10, 10, 10, null, 10], [7]);
    const average = movingAverage(display);

    expect(average[6]).toBe(10);
    expect(average[7]).toBeNull();
    expect(average[8]).toBeNull();
  });
});
