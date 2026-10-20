/**
 * Single source of truth for every colour and font used inside ECharts.
 * Chart components must not define their own hex values.
 */
export const chartTheme = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  monoFamily: 'ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace',
  fontSize: 12,
  strong: '#0F172A',
  text: '#334155',
  axisText: '#64748B',
  grid: '#EEF2F7',
  axisLine: '#CBD5E1',
  threshold: '#94A3B8',
  labelBackground: 'rgba(255, 255, 255, 0.92)',
  axisPointerShadow: 'rgba(37, 99, 235, 0.06)',
  /** Neutral band used to mark platform-wide missing days; never a data value. */
  gapArea: 'rgba(148, 163, 184, 0.16)',
  gapSwatch: '#E2E8F0',
  tooltip: {
    background: '#FFFFFF',
    border: '#E2E8F0',
    title: '#0F172A',
    body: '#334155',
    muted: '#64748B',
    footer: '#64748B',
    shadow: '0 12px 32px -8px rgba(15,23,42,.14)',
  },
  risk: {
    low: '#2563EB',
    medium: '#B45309',
    high: '#BE123C',
    unknown: '#64748B',
  },
  riskFill: {
    low: 'rgba(37, 99, 235, 0.10)',
    medium: 'rgba(180, 83, 9, 0.12)',
    high: 'rgba(190, 18, 60, 0.15)',
    unknown: 'rgba(100, 116, 139, 0.08)',
  },
  riskSoft: {
    low: { bg: '#EFF6FF', text: '#1D4ED8' },
    medium: { bg: '#FFFBEB', text: '#B45309' },
    high: { bg: '#FFF1F2', text: '#BE123C' },
    unknown: { bg: '#F8FAFC', text: '#64748B' },
  },
  quadrant: {
    'hot-healthy': 'rgba(15, 118, 110, 0.035)',
    'niche-active': 'rgba(37, 99, 235, 0.025)',
    'hot-watch': 'rgba(180, 83, 9, 0.03)',
    quiet: 'rgba(100, 116, 139, 0.02)',
  },
  series: {
    popularity: '#2563EB',
    maintenance: '#0F766E',
    bar: '#3B82F6',
    barHover: '#2563EB',
  },
  area: 'rgba(15, 118, 110, 0.08)',
} as const;

export const riskColor = (level: keyof typeof chartTheme.risk): string => chartTheme.risk[level];
export const riskFill = (level: keyof typeof chartTheme.riskFill): string => chartTheme.riskFill[level];
export const quadrantFill = (key: keyof typeof chartTheme.quadrant): string => chartTheme.quadrant[key];

export function tooltipChrome(): string {
  return `box-shadow:${chartTheme.tooltip.shadow};border-radius:8px;overflow:hidden;`;
}
