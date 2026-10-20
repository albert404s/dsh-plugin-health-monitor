import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EChartsOption } from 'echarts';
import type { PluginRecord, RiskLevel } from '../../lib/types';
import { quadrantOf, hasQuadrantData } from '../../lib/scoring';
import { formatCompact, formatDateTime } from '../../lib/format';
import { escapeHtml } from '../../lib/html';
import { useEChart } from '../../hooks/useEChart';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { chartTheme, quadrantFill, riskColor, riskFill, tooltipChrome } from './chartTheme';

export const POPULARITY_THRESHOLD = 50;
export const MAINTENANCE_THRESHOLD = 60;

export const QUADRANTS = {
  'hot-healthy': {
    label: '高人气 · 健康',
    short: '热门且健康',
    description: '关注度与近期维护活动都处于本榜单上半区。',
  },
  'niche-active': {
    label: '小众 · 稳健',
    short: '冷门但维护活跃',
    description: '关注度低于中位参考，但近期维护活动较充足。',
  },
  'hot-watch': {
    label: '高人气 · 待维护',
    short: '热门但需关注',
    description: '关注度较高，但公开维护证据相对不足，需要结合详情判断。',
  },
  quiet: {
    label: '低活跃 · 观察',
    short: '低关注且低活跃',
    description: '两项指数均低于中位参考；可能仍在稳定使用，不等于质量差。',
  },
} as const;

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high: '高风险信号',
  medium: '需要关注',
  low: '未见公开风险',
  unknown: '风险信息不完整',
};

interface QuadrantChartProps {
  plugins: PluginRecord[];
  unpositionedPlugins?: PluginRecord[];
  totalCount?: number;
  height?: number;
  className?: string;
  showLabels?: boolean;
  showLegend?: boolean;
  showUnpositioned?: boolean;
  ariaLabel?: string;
}

interface QuadrantDatum {
  id: string;
  name: string;
  repo: string;
  value: [number, number, number];
  risk: RiskLevel;
  downloads: number | null;
  completeness: number;
  maintenanceConfidence: string;
  itemStyle: {
    color: string;
    borderColor: string;
    borderWidth: number;
  };
  label: { show: boolean };
}

function tooltipHtml(plugin: PluginRecord): string {
  const downloads =
    plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
      ? formatCompact(plugin.npm.downloads30d)
      : '暂无可靠下载数据';
  const risk = plugin.scores.risk.level;
  const riskLabel = RISK_LABELS[risk];
  const riskStyle = chartTheme.riskSoft[risk];
  const row = (label: string, value: string, mono = true): string =>
    `<span style="color:${chartTheme.tooltip.muted}">${escapeHtml(label)}</span><b style="color:${chartTheme.strong};text-align:right;font-weight:600;${
      mono ? `font-family:${chartTheme.monoFamily};` : ''
    }">${escapeHtml(value)}</b>`;
  return `
    <div style="min-width:236px;max-width:300px;font-family:${chartTheme.fontFamily};background:${chartTheme.tooltip.background}">
      <div style="padding:12px 14px 10px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <strong style="color:${chartTheme.tooltip.title};font-size:13px;line-height:18px;font-weight:600">${escapeHtml(plugin.name)}</strong>
          <span style="flex:none;border-radius:2px;padding:2px 6px;font-size:12px;line-height:16px;background:${riskStyle.bg};color:${riskStyle.text}">${escapeHtml(riskLabel)}</span>
        </div>
        <div style="color:${chartTheme.tooltip.muted};font-size:12px;line-height:18px;margin-top:4px">${escapeHtml(plugin.repo)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px;line-height:18px;color:${chartTheme.tooltip.body};margin-top:10px">
          ${row('人气指数', plugin.scores.popularity.score?.toFixed(1) ?? '—')}
          ${row('维护健康度', plugin.scores.maintenance.score?.toFixed(1) ?? '—')}
          ${row('GitHub Stars', formatCompact(plugin.github.stars))}
          ${row('30 天下载', downloads)}
          <span style="grid-column:1/3;display:flex;justify-content:space-between;gap:12px">${row('数据覆盖', `${plugin.scores.completeness.available}/${plugin.scores.completeness.total}`)}</span>
        </div>
      </div>
      <div style="border-top:1px solid ${chartTheme.tooltip.border};padding:8px 14px;color:${chartTheme.tooltip.footer};font-size:12px;line-height:18px">
        ${escapeHtml(CONFIDENCE_LABELS[plugin.scores.maintenance.confidence] ?? plugin.scores.maintenance.confidence)} · 最后采集 ${escapeHtml(formatDateTime(plugin.lastUpdatedAt))} · 点击查看详情
      </div>
    </div>`;
}

export function QuadrantChart({
  plugins,
  unpositionedPlugins,
  totalCount,
  height = 460,
  className,
  showLabels = true,
  showLegend = true,
  showUnpositioned = true,
  ariaLabel = 'DSH 插件人气指数与维护健康度四象限散点图',
}: QuadrantChartProps): JSX.Element {
  const navigate = useNavigate();
  const isNarrow = useMediaQuery('(max-width: 1279px)');
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const reducedMotion = usePrefersReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const effectiveShowLabels = showLabels && !isNarrow;
  const positioned = useMemo(() => plugins.filter(hasQuadrantData), [plugins]);
  const topIds = useMemo(() => {
    const ranked = [...positioned].sort(
      (a, b) => (b.scores.popularity.score ?? 0) - (a.scores.popularity.score ?? 0),
    );
    return new Set(ranked.slice(0, 3).map((plugin) => plugin.id));
  }, [positioned]);

  const option = useMemo<EChartsOption>(() => {
    const data: QuadrantDatum[] = positioned.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      repo: plugin.repo,
      value: [
        plugin.scores.popularity.score ?? 0,
        plugin.scores.maintenance.score ?? 0,
        plugin.github.stars,
      ],
      risk: plugin.scores.risk.level,
      downloads: plugin.npm.status === 'verified' ? plugin.npm.downloads30d : null,
      completeness: plugin.scores.completeness.score,
      maintenanceConfidence: plugin.scores.maintenance.confidence,
      itemStyle: {
        color: riskFill(plugin.scores.risk.level),
        borderColor: riskColor(plugin.scores.risk.level),
        borderWidth: plugin.scores.risk.level === 'high' ? 2.5 : 1.5,
      },
      label: { show: effectiveShowLabels && topIds.has(plugin.id) },
    }));
    const pluginById = new Map(positioned.map((plugin) => [plugin.id, plugin]));
    const highRiskData = data.filter((item) => item.risk === 'high');
    const maxStars = Math.max(...positioned.map((plugin) => plugin.github.stars), 1);
    const symbolSize = (stars: number): number => {
      const normalized = Math.log10(stars + 1) / Math.log10(maxStars + 1);
      return Math.round(8 + normalized * 14);
    };
    const axisLabel = {
      color: chartTheme.axisText,
      fontSize: chartTheme.axisFontSize,
      fontFamily: chartTheme.monoFamily,
    };

    return {
      animationDuration: reducedMotion ? 0 : 200,
      animationEasing: 'cubicOut',
      backgroundColor: 'transparent',
      aria: {
        enabled: true,
        label: { description: ariaLabel },
      },
      grid: {
        left: 40,
        // Top labels are centered on the bubble and can overhang the plot area;
        // reserve extra room so the right-most pill stays inside the canvas.
        right: isNarrow ? 32 : 48,
        top: 24,
        bottom: 36,
        containLabel: true,
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: chartTheme.tooltip.background,
        borderColor: chartTheme.tooltip.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: chartTheme.text, fontSize: 12, fontFamily: chartTheme.fontFamily },
        extraCssText: tooltipChrome(),
        formatter: (raw: unknown) => {
          const params = raw as { data?: QuadrantDatum };
          const plugin = params.data ? pluginById.get(params.data.id) : null;
          return plugin ? tooltipHtml(plugin) : '';
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        axisLine: { lineStyle: { color: chartTheme.axisLine } },
        axisTick: { show: true, length: 4, lineStyle: { color: chartTheme.axisLine } },
        axisLabel,
        splitLine: { lineStyle: { color: chartTheme.grid, type: 'solid', width: 1 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel,
        splitLine: { lineStyle: { color: chartTheme.grid, type: 'solid', width: 1 } },
      },
      series: [
        {
          // A static outer ring is the non-colour cue for high-risk bubbles.
          name: '高风险外环',
          type: 'scatter',
          z: 1,
          silent: true,
          data: highRiskData,
          symbolSize: (value: unknown) => {
            const numbers = value as number[];
            return symbolSize(Array.isArray(numbers) ? numbers[2] : 1) + 10;
          },
          itemStyle: {
            color: 'transparent',
            borderColor: chartTheme.risk.high,
            borderWidth: 1,
            opacity: 0.35,
          },
          emphasis: { disabled: true },
          label: { show: false },
          tooltip: { show: false },
        },
        {
          name: '插件',
          type: 'scatter',
          z: 2,
          data,
          selectedMode: 'single',
          select: {
            itemStyle: {
              borderColor: chartTheme.select.border,
              borderWidth: chartTheme.select.width,
            },
            label: {
              show: true,
              color: chartTheme.strong,
              backgroundColor: chartTheme.labelBackground,
            },
          },
          symbolSize: (value: unknown) => {
            const numbers = value as number[];
            return symbolSize(Array.isArray(numbers) ? numbers[2] : 1);
          },
          label: {
            formatter: (params: unknown) => {
              const dataItem = (params as { data?: QuadrantDatum }).data;
              if (!dataItem || !topIds.has(dataItem.id)) return '';
              return dataItem.name.length > 14 ? `${dataItem.name.slice(0, 13)}…` : dataItem.name;
            },
            position: 'top',
            distance: 6,
            color: chartTheme.text,
            fontSize: chartTheme.fontSize,
            fontFamily: chartTheme.fontFamily,
            backgroundColor: chartTheme.labelBackground,
            borderColor: chartTheme.tooltip.border,
            borderWidth: 1,
            borderRadius: 2,
            padding: [2, 4],
          },
          labelLayout: { hideOverlap: true },
          emphasis: {
            scale: 1.18,
            itemStyle: {
              borderWidth: 2.5,
            },
            label: {
              show: true,
              color: chartTheme.strong,
              backgroundColor: chartTheme.tooltip.background,
            },
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            lineStyle: { color: chartTheme.threshold, type: 'dashed', width: 1 },
            label: {
              show: true,
              position: 'end',
              color: chartTheme.axisText,
              fontSize: 10,
              fontFamily: chartTheme.monoFamily,
              backgroundColor: chartTheme.labelBackground,
              borderRadius: 2,
              padding: [2, 4],
            },
            data: [
              { xAxis: POPULARITY_THRESHOLD, label: { formatter: 'X 50' } },
              { yAxis: MAINTENANCE_THRESHOLD, label: { formatter: 'Y 60' } },
            ],
          },
          markArea: {
            silent: true,
            data: [
              [
                {
                  xAxis: 0,
                  yAxis: MAINTENANCE_THRESHOLD,
                  itemStyle: { color: quadrantFill('niche-active') },
                },
                { xAxis: POPULARITY_THRESHOLD, yAxis: 100 },
              ],
              [
                {
                  xAxis: POPULARITY_THRESHOLD,
                  yAxis: MAINTENANCE_THRESHOLD,
                  itemStyle: { color: quadrantFill('hot-healthy') },
                },
                { xAxis: 100, yAxis: 100 },
              ],
              [
                {
                  xAxis: 0,
                  yAxis: 0,
                  itemStyle: { color: quadrantFill('quiet') },
                },
                { xAxis: POPULARITY_THRESHOLD, yAxis: MAINTENANCE_THRESHOLD },
              ],
              [
                {
                  xAxis: POPULARITY_THRESHOLD,
                  yAxis: 0,
                  itemStyle: { color: quadrantFill('hot-watch') },
                },
                { xAxis: 100, yAxis: MAINTENANCE_THRESHOLD },
              ],
            ],
          },
        },
      ],
    };
  }, [positioned, ariaLabel, effectiveShowLabels, topIds, reducedMotion, isNarrow]);

  const chartRef = useEChart(option, {
    click: (raw, chart) => {
      const params = raw as { data?: QuadrantDatum; dataIndex?: number };
      const id = params.data?.id;
      if (!id) return;
      // Touch devices get a tooltip on the first tap and open the detail on the second.
      if (isCoarsePointer && activeId !== id) {
        setActiveId(id);
        const dataIndex = params.dataIndex ?? positioned.findIndex((plugin) => plugin.id === id);
        if (dataIndex >= 0) {
          chart.dispatchAction({ type: 'showTip', seriesIndex: 1, dataIndex });
          chart.dispatchAction({ type: 'highlight', seriesIndex: 1, dataIndex });
        }
        return;
      }
      navigate(`/plugins/${encodeURIComponent(id)}`);
    },
  });

  const unpositioned = (unpositionedPlugins ?? plugins).filter((plugin) => !hasQuadrantData(plugin));
  return (
    <div className={className}>
      <div className="relative w-full min-w-0" style={{ height }}>
        <div ref={chartRef} className="h-full w-full" role="img" aria-label={ariaLabel} />
        {positioned.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <p className="text-sm leading-6 text-content-secondary">当前没有可定位插件。</p>
              <Link
                to="/quadrant#unpositioned-plugins"
                className="mt-1 inline-flex min-h-9 items-center text-xs text-content-secondary underline underline-offset-4 hover:text-brand-text"
              >
                查看未定位原因
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      {showLegend ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-hairline pt-3 text-xs text-content-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full border-[1.5px] bg-transparent"
              style={{ borderColor: riskColor('low') }}
            />
            未见公开风险
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full border-[1.5px] bg-transparent"
              style={{ borderColor: riskColor('medium') }}
            />
            需要关注
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
              <span
                className="absolute inset-0 rounded-full border opacity-35"
                style={{ borderColor: riskColor('high') }}
              />
              <span
                className="h-2 w-2 rounded-full border-[1.5px] bg-transparent"
                style={{ borderColor: riskColor('high') }}
              />
            </span>
            高风险信号 · 外环
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full border-[1.5px] border-dashed bg-transparent"
              style={{ borderColor: riskColor('unknown') }}
            />
            风险信息不完整
          </span>
          <span className="ml-auto text-content-muted">气泡面积 ≈ Star 量级</span>
        </div>
      ) : null}
      {isCoarsePointer ? (
        <p className="mt-2 text-2xs text-content-muted">触屏设备：第一次点按查看概要，再次点按进入详情。</p>
      ) : null}
      {showUnpositioned && unpositioned.length > 0 ? (
        <details
          id="unpositioned-plugins"
          className="mt-3 rounded-control border border-line bg-surface-subtle px-3 py-2 text-xs"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs">
            <span>{unpositioned.length} 个插件未进入象限</span>
            <span className="text-content-muted">缺少维护评分或经核验下载量，点击查看原因</span>
          </summary>
          <ul className="mt-2 space-y-1.5 text-content-secondary">
            {unpositioned.map((plugin) => (
              <li key={plugin.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{plugin.name}</span>
                <span className="text-content-muted">
                  {plugin.scores.maintenance.status === 'insufficient'
                    ? '维护证据不足'
                    : plugin.npm.status !== 'verified' || plugin.npm.downloads30d === null
                      ? '无可靠 npm 下载数据'
                      : '维护样本不足'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}数据表替代视图</caption>
          <thead>
            <tr>
              <th>插件</th>
              <th>人气指数</th>
              <th>维护健康度</th>
              <th>风险等级</th>
              <th>数据覆盖</th>
            </tr>
          </thead>
          <tbody>
            {positioned.map((plugin) => (
              <tr key={plugin.id}>
                <td>{plugin.repo}</td>
                <td>{plugin.scores.popularity.score}</td>
                <td>{plugin.scores.maintenance.score}</td>
                <td>{plugin.scores.risk.label}</td>
                <td>{plugin.scores.completeness.score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function quadrantLabel(popularity: number, maintenance: number): string {
  return QUADRANTS[quadrantOf(popularity, maintenance)].label;
}

export function quadrantCounts(plugins: PluginRecord[]): Record<keyof typeof QUADRANTS, number> {
  const result: Record<keyof typeof QUADRANTS, number> = {
    'hot-healthy': 0,
    'hot-watch': 0,
    'niche-active': 0,
    quiet: 0,
  };
  for (const plugin of plugins.filter(hasQuadrantData)) {
    result[quadrantOf(plugin.scores.popularity.score ?? 0, plugin.scores.maintenance.score ?? 0)] += 1;
  }
  return result;
}
