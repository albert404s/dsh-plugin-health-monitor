import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { HistoryPoint } from '../../lib/types';
import { formatDateTime } from '../../lib/format';
import { useEChart } from '../../hooks/useEChart';

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

export function ScoreTrendChart({ points, height = 280 }: ScoreTrendChartProps): JSX.Element {
  const option = useMemo<EChartsOption>(() => {
    const first = new Date(points[0]?.t ?? 0).getTime();
    const last = new Date(points[points.length - 1]?.t ?? 0).getTime();
    const spanMs = Math.max(0, last - first);
    const labels = points.map((point, index) => axisLabelFor(point, index, spanMs));
    return {
      animationDuration: 450,
      backgroundColor: 'transparent',
      aria: { enabled: true, label: { description: '插件人气指数与维护健康度历史趋势折线图' } },
      grid: { left: 38, right: 18, top: 34, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(11,16,23,0.97)',
        borderColor: '#263449',
        textStyle: { color: '#c3ceda', fontSize: 11 },
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
                `<div style="display:flex;gap:18px;justify-content:space-between"><span style="color:#93a3b8">${item.seriesName}</span><b style="color:${item.color}">${item.value === null ? '—' : item.value.toFixed(1)}</b></div>`,
            )
            .join('');
          return `<div style="min-width:190px"><div style="color:#e7edf4;margin-bottom:8px">${point ? formatDateTime(point.t) : ''}</div>${rows}</div>`;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#93a3b8', fontSize: 10 },
        itemWidth: 14,
        itemHeight: 2,
        icon: 'roundRect',
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#263449' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { color: '#64748b', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(38,52,73,0.4)', type: 'dashed' } },
      },
      series: [
        {
          name: '维护健康度',
          type: 'line',
          data: points.map((point) => point.maintenance),
          showSymbol: true,
          symbolSize: 5,
          connectNulls: false,
          lineStyle: { color: '#48d7b0', width: 2 },
          itemStyle: { color: '#48d7b0' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(72,215,176,0.14)' },
                { offset: 1, color: 'rgba(72,215,176,0)' },
              ],
            },
          },
        },
        {
          name: '人气指数',
          type: 'line',
          data: points.map((point) => point.popularity),
          showSymbol: true,
          symbolSize: 5,
          connectNulls: false,
          lineStyle: { color: '#a89cff', width: 2 },
          itemStyle: { color: '#a89cff' },
        },
      ],
    };
  }, [points]);

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
