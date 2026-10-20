import type { DailyDownload, NpmStatus } from './types';
import { isCount, isUtcDay, normalizeDaily, shiftUtcDay } from './data-quality';

/**
 * npm download statistics occasionally return platform-wide zero days. The
 * collector already guards the derived weekly change; the UI must apply the
 * same rule so those days are not drawn or averaged as real zero downloads.
 *
 * Rule (kept in sync with scripts/collect.ts applyNpmGapGuard):
 * a date is a platform gap when at least 5 verified packages have a data point
 * and at least 80% of those points are zero.
 */
export const PLATFORM_GAP_MIN_SERIES = 5;
export const PLATFORM_GAP_ZERO_RATIO = 0.8;
export const MOVING_AVERAGE_WINDOW = 7;

export interface DailySeries {
  status: NpmStatus;
  daily: readonly DailyDownload[];
}

export interface DownloadPoint {
  date: string;
  downloads: number | null;
  /** True for absent/conflicting days or suspicious platform zero points; real zero stays valid. */
  missing: boolean;
}

export interface PlatformGapStats {
  total: number;
  zero: number;
}

/** Build the per-date package counts without mutating any source data. */
export function platformGapStats(series: readonly DailySeries[]): Map<string, PlatformGapStats> {
  const stats = new Map<string, PlatformGapStats>();
  for (const source of series) {
    if (source.status !== 'verified') continue;
    for (const day of normalizeDaily(source.daily).daily) {
      const entry = stats.get(day.date) ?? { total: 0, zero: 0 };
      entry.total += 1;
      if (day.downloads === 0) entry.zero += 1;
      stats.set(day.date, entry);
    }
  }
  return stats;
}

/** Dates that look like a platform-wide outage rather than real zero demand. */
export function findPlatformGapDates(series: readonly DailySeries[]): Set<string> {
  const dates = new Set<string>();
  for (const [date, stats] of platformGapStats(series)) {
    if (
      stats.total >= PLATFORM_GAP_MIN_SERIES &&
      stats.zero / stats.total >= PLATFORM_GAP_ZERO_RATIO
    ) {
      dates.add(date);
    }
  }
  return dates;
}

/** Convert daily evidence into a calendar series; mask only suspicious zeros and missing days. */
export function toDisplaySeries(
  daily: readonly DailyDownload[],
  gapDates: ReadonlySet<string>,
): DownloadPoint[] {
  const clean = normalizeDaily(daily);
  if (!clean.daily.length && !clean.conflictDates.length) return [];
  const dates = [...clean.daily.map(day=>day.date),...clean.conflictDates].sort();
  const start = dates[0], end = dates[dates.length-1];
  const byDay = new Map(clean.daily.map(day=>[day.date,day.downloads]));
  const points: DownloadPoint[] = [];
  // The API contract is monthly; cap malformed spans so the display is bounded.
  const first = Math.max(Date.parse(start), Date.parse(end)-399*86400000);
  for(let time=first;time<=Date.parse(end);time+=86400000) {
    const date=new Date(time).toISOString().slice(0,10), value=byDay.get(date);
    const missing=value === undefined || (value === 0 && gapDates.has(date));
    points.push({date,downloads:missing ? null : value!,missing});
  }
  return points;
}

/**
 * 7-day trailing mean. A window is only comparable when every day in it is
 * present; windows touching a platform gap return null so the line breaks.
 * Isolated real zeros stay in the window and are averaged normally.
 */
export function movingAverage(
  points: readonly DownloadPoint[],
  window = MOVING_AVERAGE_WINDOW,
): Array<number | null> {
  return points.map((_, index) => {
    if (!Number.isInteger(window) || window < 1 || index < window - 1) return null;
    const slice = points.slice(index - window + 1, index + 1);
    if (slice.some((point, offset) => point.missing || !isCount(point.downloads) || !isUtcDay(point.date) || (offset > 0 && shiftUtcDay(slice[offset-1].date,1) !== point.date))) return null;
    const sum = slice.reduce((total, point) => total + (point.downloads ?? 0), 0);
    return Math.round(sum / window);
  });
}
