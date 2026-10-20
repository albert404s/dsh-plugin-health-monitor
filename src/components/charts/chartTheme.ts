/**
 * Single source of truth for every colour and font used inside ECharts.
 * Hex values mirror the CSS tokens in docs/design/01-visual-system.md §1.2.
 * Do not add local colour literals in chart components.
 */
export const chartTheme = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  monoFamily: 'ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace',
  fontSize: 12,
  axisFontSize: 11,

  strong: '#1A1A1A',
  text: '#4A4A46',
  axisText: '#686864',
  grid: '#EAEAE6',
  axisLine: '#8A8A84',
  threshold: '#8A8A84',
  labelBackground: 'rgba(255, 255, 255, 0.96)',
  axisPointerShadow: 'rgba(26, 26, 26, 0.05)',

  /** Neutral band used to mark platform-wide missing days; never a data value. */
  gapArea: 'rgba(150, 150, 144, 0.16)',
  gapSwatch: '#E5E5E0',

  tooltip: {
    background: '#FFFFFF',
    border: '#C9C9C4',
    title: '#1A1A1A',
    body: '#4A4A46',
    muted: '#686864',
    footer: '#686864',
    shadow: '0 16px 40px -16px rgba(26,26,26,.22), 0 1px 2px rgba(26,26,26,.06)',
  },

  risk: {
    low: '#2C5264',
    medium: '#7C5208',
    high: '#9E2E12',
    unknown: '#5A5A55',
  },
  riskFill: {
    low: 'rgba(44, 82, 100, 0.10)',
    medium: 'rgba(124, 82, 8, 0.12)',
    high: 'rgba(158, 46, 18, 0.16)',
    unknown: 'rgba(90, 90, 85, 0.08)',
  },
  riskSoft: {
    low: { bg: '#F0F5F8', text: '#2C5264' },
    medium: { bg: '#FCF5E6', text: '#7C5208' },
    high: { bg: '#FBEEE9', text: '#9E2E12' },
    unknown: { bg: '#F4F4F1', text: '#5A5A55' },
  },

  quadrant: {
    'hot-healthy': 'rgba(47, 94, 88, 0.050)',
    'niche-active': 'rgba(38, 38, 36, 0.025)',
    'hot-watch': 'rgba(138, 138, 132, 0.045)',
    quiet: 'rgba(90, 90, 85, 0.020)',
  },

  series: {
    popularity: '#262624',
    maintenance: '#2F5E58',
    bar: '#41413D',
    barHover: '#1A1A1A',
  },
  area: 'rgba(47, 94, 88, 0.08)',

  /** Selected / pinned point, not a brand action. */
  select: { border: '#1A1A1A', width: 3 },
} as const;

export const riskColor = (level: keyof typeof chartTheme.risk): string => chartTheme.risk[level];
export const riskFill = (level: keyof typeof chartTheme.riskFill): string => chartTheme.riskFill[level];
export const quadrantFill = (key: keyof typeof chartTheme.quadrant): string => chartTheme.quadrant[key];

export function tooltipChrome(): string {
  return `box-shadow:${chartTheme.tooltip.shadow};border-radius:6px;overflow:hidden;`;
}
