import type { DailyDownload } from './types';
const DAY = 86_400_000;
export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function normalizeGithubRepository(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let value = input.trim().replace(/^git\+/, '').replace(/^git@github\.com:/i, 'https://github.com/').replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/').replace(/^github:/i, 'https://github.com/').replace(/^git:\/\/github\.com\//i, 'https://github.com/');
  if (/^(www\.)?github\.com\//i.test(value)) value = 'https://' + value;
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) value = 'https://github.com/' + value;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) || url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '').slice(1);
    return /^[\w.-]+\/[\w.-]+$/.test(path) ? path.toLowerCase() : null;
  } catch { return null; }
}
export function isUtcDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function shiftUtcDay(day: string, offset: number): string {
  if (!isUtcDay(day) || !Number.isInteger(offset)) throw new Error('无效 UTC 日期或偏移');
  return new Date(Date.parse(day) + offset * DAY).toISOString().slice(0,10);
}
export function normalizeDaily(raw: readonly unknown[], bounds: { start?: string; end?: string } = {}): { daily: DailyDownload[]; conflictDates: string[]; invalidCount: number; notes: string[] } {
  const byDate = new Map<string, number>();
  const conflicts = new Set<string>();
  let invalidCount = 0;
  for (const value of raw) {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const date = row.date ?? row.day;
    if (!isUtcDay(date) || !isCount(row.downloads) || (bounds.start && date < bounds.start) || (bounds.end && date > bounds.end)) { invalidCount++; continue; }
    const previous = byDate.get(date);
    if (previous !== undefined && previous !== row.downloads) conflicts.add(date);
    else byDate.set(date, row.downloads);
  }
  const conflictDates = [...conflicts].sort();
  const notes: string[] = [];
  if (invalidCount) notes.push(invalidCount + ' 条非法或超出 UTC 窗口的日记录已隔离。');
  if (conflictDates.length) notes.push('同日下载冲突，该日不可用：' + conflictDates.join('、'));
  return { daily: [...byDate].filter(([date]) => !conflicts.has(date)).sort(([a],[b]) => a.localeCompare(b)).map(([date,downloads]) => ({date,downloads})), conflictDates, invalidCount, notes };
}
/** A true calendar window; an absent or conflicting day never becomes zero. */
export function calendarWindowSum(daily: readonly DailyDownload[], end: string, days: number): number | null {
  if (!isUtcDay(end) || !Number.isInteger(days) || days < 1) return null;
  const clean = normalizeDaily(daily).daily;
  const map = new Map(clean.map((item) => [item.date,item.downloads]));
  let sum = 0;
  for (let offset = 1 - days; offset <= 0; offset++) {
    const value = map.get(shiftUtcDay(end, offset)); if (value === undefined) return null;
    sum += value; if (!Number.isSafeInteger(sum)) return null;
  }
  return sum;
}
