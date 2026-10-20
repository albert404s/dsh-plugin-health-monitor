import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EChartsOption } from 'echarts';
import type { PluginRecord, RiskLevel } from '../../lib/types';
import { quadrantOf, hasQuadrantData } from '../../lib/scoring';
import { formatCompact, formatDateTime } from '../../lib/format';
import { escapeHtml } from '../../lib/html';
import { useEChart } from '../../hooks/useEChart';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const POPULARITY_THRESHOLD = 50;
export const MAINTENANCE_THRESHOLD = 60;

export const QUADRANTS = {
  'hot-healthy': {
    label: '高人气 · 健康',
    short: '热门且健康',
    description: '关注度与近期维护活动都处于本榜单上半区。',
    color: 'rgba(72, 215, 176, 0.045)',
  },
  'niche-active': {
    label: '小众 · 稳健',
    short: '冷门但维护活跃',
    description: '关注度低于中位参考，但近期维护活动较充足。',
    color: 'rgba(139, 124, 246, 0.035)',
  },
  'hot-watch': {
    label: '高人气 · 待维护',
    short: '热门但需关注',
    description: '关注度较高，但公开维护证据相对不足，需要结合详情判断。',
    color: 'rgba(244, 183, 92, 0.04)',
  },
  quiet: {
    label: '低活跃 · 观察',
    short: '低关注且低活跃',
    description: '两项指数均低于中位参考；可能仍在稳定使用，不等于质量差。',
    color: 'rgba(100, 116, 139, 0.035)',
  },
} as const;

const RISK_COLORS: Record<RiskLevel, string> = {
  high: '#ef7c8e',
  medium: '#f4b75c',
  low: '#8b7cf6',
  unknown: '#64748b',
};

interface QuadrantChartProps {
  plugins: PluginRecord[];
  height?: number;
  className?: string;
  showLabels?: boolean;
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
}

function tooltipHtml(plugin: PluginRecord): string {
  const downloads =
    plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
      ? formatCompact(plugin.npm.downloads30d)
      : '暂无可靠下载数据';
  const risk = plugin.scores.risk.label;
  return `
    <div style="min-width:230px;max-width:300px;font-family:Inter,'Segoe UI','Microsoft YaHei',sans-serif">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
        <strong style="color:#e7edf4;font-size:13px;font-weight:600">${escapeHtml(plugin.name)}</strong>
        <span style="font-family:ui-monospace,monospace;font-size:10px;color:#93a3b8">${escapeHtml(plugin.scores.maintenance.confidence)} confidence</span>
      </div>
      <div style="color:#93a3b8;font-size:11px;margin-bottom:10px">${escapeHtml(plugin.repo)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px 14px;font-size:11px;color:#c3ceda">
        <span>人气指数 <b style="color:#a89cff;float:right">${plugin.scores.popularity.score?.toFixed(1) ?? '—'}</b></span>
        <span>维护健康度 <b style="color:#48d7b0;float:right">${plugin.scores.maintenance.score?.toFixed(1) ?? '—'}</b></span>
        <span>Stars <b style="color:#e7edf4;float:right">${formatCompact(plugin.github.stars)}</b></span>
        <span>30 天下载 <b style="color:#e7edf4;float:right">${escapeHtml(downloads)}</b></span>
        <span style="grid-column:1/3">风险 <b style="color:#e7edf4;float:right">${escapeHtml(risk)}</b></span>
        <span style="grid-column:1/3">数据覆盖 <b style="color:#e7edf4;float:right">${escapeHtml(plugin.scores.completeness.available)}/${escapeHtml(plugin.scores.completeness.total)}</b></span>
      </div>
      <div style="border-top:1px solid #263449;margin-top:10px;padding-top:8px;color:#64748b;font-size:10px">
        最后采集 ${escapeHtml(formatDateTime(plugin.lastUpdatedAt))} · 点击查看体检详情
      </div>
    </div>`;
}

export function QuadrantChart({
  plugins,
  height = 460,
  className,
  showLabels = true,
  ariaLabel = 'DSH 插件人气指数与维护健康度四象限散点图',
}: QuadrantChartProps): JSX.Element {
  const navigate = useNavigate();
  const isCompact = useMediaQuery('(max-width: 767px)');
  const effectiveShowLabels = showLabels && !isCompact;
  const positioned = useMemo(() => plugins.filter(hasQuadrantData), [plugins]);
  const topIds = useMemo(() => {
    const ranked = [...positioned].sort(
      (a, b) => (b.scores.popularity.score ?? 0) - (a.scores.popularity.score ?? 0),
    );
    return new Set(ranked.slice(0, 4).map((plugin) => plugin.id));
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
      downloads:
        plugin.npm.status === 'verified' ? plugin.npm.downloads30d : null,
      completeness: plugin.scores.completeness.score,
      maintenanceConfidence: plugin.scores.maintenance.confidence,
    }));
    const pluginById = new Map(positioned.map((plugin) => [plugin.id, plugin]));
    const maxStars = Math.max(...positioned.map((plugin) => plugin.github.stars), 1);
    const symbolSize = (stars: number): number => {
      const normalized = Math.log10(stars + 1) / Math.log10(maxStars + 1);
      return Math.round(12 + normalized * 22);
    };

    return {
      animationDuration: 500,
      animationEasing: 'cubicOut',
      backgroundColor: 'transparent',
      aria: {
        enabled: true,
        label: {
          description: ariaLabel,
        },
      },
      grid: { left: 44, right: 22, top: 50, bottom: 44, containLabel: true },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(11, 16, 23, 0.97)',
        borderColor: '#263449',
        borderWidth: 1,
        padding: 0,
        extraCssText: 'box-shadow:0 18px 50px rgba(0,0,0,.45);border-radius:8px;',
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
        name: '人气指数 →',
        nameLocation: 'end',
        nameGap: 26,
        nameTextStyle: { color: '#93a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#263449' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10, formatter: (value: number) => `${value}` },
        splitLine: { lineStyle: { color: 'rgba(38,52,73,0.45)', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        name: '维护健康度 →',
        nameTextStyle: { color: '#93a3b8', fontSize: 11, padding: [0, 0, 4, 0] },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(38,52,73,0.45)', type: 'dashed' } },
      },
      graphic: [
        {
          type: 'text',
          left: '7%',
          top: '8%',
          silent: true,
          style: {
            text: '小众 · 稳健',
            fill: 'rgba(147,163,184,0.65)',
            font: '10px Inter, "Microsoft YaHei", sans-serif',
          },
        },
        {
          type: 'text',
          right: '5%',
          top: '8%',
          silent: true,
          style: {
            text: '高人气 · 健康',
            fill: 'rgba(72,215,176,0.72)',
            font: '10px Inter, "Microsoft YaHei", sans-serif',
          },
        },
        {
          type: 'text',
          left: '7%',
          bottom: '13%',
          silent: true,
          style: {
            text: '低活跃 · 观察',
            fill: 'rgba(100,116,139,0.65)',
            font: '10px Inter, "Microsoft YaHei", sans-serif',
          },
        },
        {
          type: 'text',
          right: '5%',
          bottom: '13%',
          silent: true,
          style: {
            text: '高人气 · 待维护',
            fill: 'rgba(244,183,92,0.7)',
            font: '10px Inter, "Microsoft YaHei", sans-serif',
          },
        },
      ],
      series: [
        {
          type: 'scatter',
          data,
          symbolSize: (value: unknown) => {
            const numbers = value as number[];
            return symbolSize(Array.isArray(numbers) ? numbers[2] : 1);
          },
          itemStyle: {
            color: (params: unknown) => {
              const dataItem = (params as { data?: QuadrantDatum }).data;
              return RISK_COLORS[dataItem?.risk ?? 'unknown'];
            },
            borderColor: 'rgba(231,237,244,0.38)',
            borderWidth: 1,
            opacity: 0.9,
          },
          label: {
            show: effectiveShowLabels,
            formatter: (params: unknown) => {
              const dataItem = (params as { data?: QuadrantDatum }).data;
              if (!dataItem || !topIds.has(dataItem.id)) return '';
              return dataItem.name.length > 18 ? `${dataItem.name.slice(0, 17)}…` : dataItem.name;
            },
            position: 'top',
            distance: 7,
            color: '#c3ceda',
            fontSize: 9,
            fontFamily: 'Inter, "Microsoft YaHei", sans-serif',
          },
          labelLayout: { hideOverlap: true },
          emphasis: {
            scale: 1.45,
            itemStyle: {
              borderColor: '#e7edf4',
              borderWidth: 1.5,
              opacity: 1,
            },
            label: { show: true, color: '#e7edf4' },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(147,163,184,0.3)', type: 'dashed', width: 1 },
            label: { show: false },
            data: [{ xAxis: POPULARITY_THRESHOLD }, { yAxis: MAINTENANCE_THRESHOLD }],
          },
          markArea: {
            silent: true,
            data: [
              [
                {
                  xAxis: 0,
                  yAxis: MAINTENANCE_THRESHOLD,
                  itemStyle: { color: QUADRANTS['niche-active'].color },
                },
                { xAxis: POPULARITY_THRESHOLD, yAxis: 100 },
              ],
              [
                {
                  xAxis: POPULARITY_THRESHOLD,
                  yAxis: MAINTENANCE_THRESHOLD,
                  itemStyle: { color: QUADRANTS['hot-healthy'].color },
                },
                { xAxis: 100, yAxis: 100 },
              ],
              [
                {
                  xAxis: 0,
                  yAxis: 0,
                  itemStyle: { color: QUADRANTS.quiet.color },
                },
                { xAxis: POPULARITY_THRESHOLD, yAxis: MAINTENANCE_THRESHOLD },
              ],
              [
                {
                  xAxis: POPULARITY_THRESHOLD,
                  yAxis: 0,
                  itemStyle: { color: QUADRANTS['hot-watch'].color },
                },
                { xAxis: 100, yAxis: MAINTENANCE_THRESHOLD },
              ],
            ],
          },
        },
      ],
    };
  }, [positioned, ariaLabel, effectiveShowLabels, topIds]);

  const chartRef = useEChart(option, {
    click: (raw) => {
      const params = raw as { data?: QuadrantDatum };
      if (params.data?.id) navigate(`/plugins/${encodeURIComponent(params.data.id)}`);
    },
  });

  const unpositioned = plugins.filter((plugin) => !hasQuadrantData(plugin));
  return (
    <div className={className}>
      <div className="relative w-full" style={{ height }}>
        <div ref={chartRef} className="h-full w-full" role="img" aria-label={ariaLabel} />
        {positioned.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-sm text-sm leading-6 text-ink-300">
              当前没有同时具备“已评分维护数据”和“经核验 npm 下载量”的插件，因此不把它们强行放进象限。
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-700/60 pt-3 text-[11px] text-ink-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" /> 未见公开风险记录
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" /> 需要关注
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose" /> 高风险信号
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-400" /> 风险信息不完整
        </span>
        <span className="ml-auto text-ink-400">
          气泡面积 ≈ Star 量级 · 共定位 {positioned.length}/{plugins.length}
        </span>
      </div>
      {unpositioned.length > 0 ? (
        <details className="mt-3 rounded-md border border-ink-700/70 bg-ink-850/60 px-3 py-2 text-xs">
          <summary className="cursor-pointer list-none text-ink-300 marker:hidden">
            <span className="text-amber">{unpositioned.length} 个插件未进入象限</span>
            <span className="ml-2 text-ink-400">缺少维护评分或经核验下载量，点击查看原因</span>
          </summary>
          <ul className="mt-2 space-y-1.5 text-ink-300">
            {unpositioned.map((plugin) => (
              <li key={plugin.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{plugin.name}</span>
                <span className="text-ink-400">
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
      <table className="sr-only">
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
  );
}

export function quadrantLabel(popularity: number, maintenance: number): string {
  return QUADRANTS[quadrantOf(popularity, maintenance)].label;
}
