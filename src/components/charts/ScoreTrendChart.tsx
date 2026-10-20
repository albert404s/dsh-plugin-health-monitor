import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { HistoryPoint } from '../../lib/types';
import { formatDateTime } from '../../lib/format';
import { useEChart } from '../../hooks/useEChart';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { chartTheme, tooltipChrome } from './chartTheme';

interface ScoreTrendChartProps {
  points: HistoryPoint[];
  height?: number;
}

function axisLabelFor(point: HistoryPoint, index: number, spanMs: number): string {
  const date = new Date(point.t);
  if (!Number.isFinite(date.getTime())) return `#${index + 1}`;
  if (spanMs >= 36 * 60 * 60 * 1000) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return `#${index + 1}`;
}

export function ScoreTrendChart({ points, height = 260 }: ScoreTrendChartProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion();
  const option = useMemo<EChartsOption>(() => {
    const first = new Date(points[0]?.t ?? 0).getTime();
    const last = new Date(points[points.length - 1]?.t ?? 0).getTime();
    const spanMs = Math.max(0, last - first);
    const labels = points.map((point, index) => axisLabelFor(point, index, spanMs));
    return {
      animationDuration: reducedMotion ? 0 : 200,
      backgroundColor: 'transparent',
      aria: { enabled: true, label: { description: '插件人气指数与维护健康度历史趋势折线图' } },
      grid: { left: 40, right: 16, top: 32, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: chartTheme.tooltip.background,
        borderColor: chartTheme.tooltip.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: chartTheme.text, fontSize: 12, fontFamily: chartTheme.fontFamily },
        extraCssText: tooltipChrome(),
        axisPointer: { type: 'line', lineStyle: { color: chartTheme.threshold, width: 1, type: 'dashed' } },
        formatter: (raw: unknown) => {
          const params = raw as Array<{
            seriesName: string;
            value: number | null;
            color: string;
            dataIndex: number;
          }>;
          if (!Array.isArray(params) || params.length === 0) return '';
          const index = params[0].dataIndex;
          const point = points[index];
          const rows = params
            .map(
              (item) =>
                `<div style="display:flex;gap:18px;justify-content:space-between;line-height:18px"><span style="color:${chartTheme.tooltip.muted}">${item.seriesName}</span><b style="color:${chartTheme.strong};font-family:${chartTheme.monoFamily};font-weight:600">${item.value === null ? '—' : item.value.toFixed(1)}</b></div>`,
            )
            .join('');
          return `<div style="min-width:190px;padding:10px 12px;font-family:${chartTheme.fontFamily}"><div style="color:${chartTheme.tooltip.title};font-size:13px;font-weight:600;margin-bottom:6px">${point ? formatDateTime(point.t) : ''}</div>${rows}</div>`;
        },
      },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: chartTheme.tooltip.body, fontSize: 12, fontFamily: chartTheme.fontFamily },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        icon: 'roundRect',
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: chartTheme.axisLine } },
        axisTick: { show: true, length: 4, lineStyle: { color: chartTheme.axisLine } },
        axisLabel: {
          color: chartTheme.axisText,
          fontSize: 12,
          fontFamily: chartTheme.monoFamily,
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        axisLabel: {
          color: chartTheme.axisText,
          fontSize: 12,
          fontFamily: chartTheme.monoFamily,
        },
        splitLine: { lineStyle: { color: chartTheme.grid, type: 'solid', width: 1 } },
      },
      series: [
        {
          name: '维护健康度',
          type: 'line',
          data: points.map((point) => point.maintenance),
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          connectNulls: false,
          lineStyle: { color: chartTheme.series.maintenance, width: 2 },
          itemStyle: {
            color: chartTheme.tooltip.background,
            borderColor: chartTheme.series.maintenance,
            borderWidth: 2,
          },
          areaStyle: { color: chartTheme.area },
        },
        {
          name: '人气指数',
          type: 'line',
          data: points.map((point) => point.popularity),
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          connectNulls: false,
          lineStyle: { color: chartTheme.series.popularity, width: 2 },
          itemStyle: {
            color: chartTheme.tooltip.background,
            borderColor: chartTheme.series.popularity,
            borderWidth: 2,
          },
        },
      ],
    };
  }, [points, reducedMotion]);

  const chartRef = useEChart(option);
  return (
    <div style={{ height }} className="w-full">
      <div
        ref={chartRef}
        className="h-full w-full"
        role="img"
        aria-label="插件人气指数与维护健康度历史趋势"
      />
    </div>
  );
}
