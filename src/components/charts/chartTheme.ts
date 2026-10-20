/** ECharts consumes the same CSS colour tokens as the workbench. */
function token(name: string, alpha = 1): string {
  const value = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
  return 'rgba(' + (value || '135 155 181').split(/\s+/).join(',') + ',' + alpha + ')';
}
function readChartTheme() { return {
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif',
  monoFamily: 'ui-monospace,"Cascadia Code",Consolas,monospace',
  fontSize: 12, axisFontSize: 12,
  strong: token('fg-primary'), text: token('fg-body'), axisText: token('chart-axis'),
  grid: token('chart-grid'), axisLine: token('chart-axis-line'), threshold: token('chart-threshold'),
  labelBackground: token('surface', .95), axisPointerShadow: token('fg-primary', .04),
  gapArea: token('chart-gap', .4), gapSwatch: token('chart-gap'),
  tooltip: { background: token('surface'), border: token('line-strong'), title: token('fg-primary'), body: token('fg-body'), muted: token('fg-tertiary'), footer: token('fg-tertiary'), shadow: '0 16px 40px rgb(0 0 0 / .45)' },
  risk: { low: token('risk-low'), medium: token('risk-medium'), high: token('risk-high'), unknown: token('risk-unknown') },
  riskFill: { low: token('risk-low', .16), medium: token('risk-medium', .18), high: token('risk-high', .2), unknown: token('risk-unknown', .12) },
  riskSoft: { low: { bg: token('risk-low-soft'), text: token('risk-low') }, medium: { bg: token('risk-medium-soft'), text: token('risk-medium') }, high: { bg: token('risk-high-soft'), text: token('risk-high') }, unknown: { bg: token('risk-unknown-soft'), text: token('risk-unknown') } },
  quadrant: { 'hot-healthy': token('series-maintenance', .045), 'niche-active': token('series-popularity', .025), 'hot-watch': token('risk-medium', .025), quiet: token('fg-tertiary', .015) },
  series: { popularity: token('series-popularity'), maintenance: token('series-maintenance'), bar: token('series-bar'), barHover: token('series-bar-hover') },
  area: token('series-maintenance', .08), select: { border: token('brand'), width: 3 },
} as const; }
// Resolve after Vite has attached styles; ECharts needs comma-form rgba.
export const chartTheme = new Proxy({} as ReturnType<typeof readChartTheme>, { get: (_target, key: keyof ReturnType<typeof readChartTheme>) => readChartTheme()[key] });
export const riskColor = (level: keyof typeof chartTheme.risk): string => chartTheme.risk[level];
export const riskFill = (level: keyof typeof chartTheme.riskFill): string => chartTheme.riskFill[level];
export const quadrantFill = (key: keyof typeof chartTheme.quadrant): string => chartTheme.quadrant[key];
export function tooltipChrome(): string { return 'box-shadow:' + chartTheme.tooltip.shadow + ';border-radius:10px;overflow:hidden;'; }
