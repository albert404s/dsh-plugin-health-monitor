import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { DailyDownload } from '../../lib/types';
import { formatCompact, formatNumber } from '../../lib/format';
import { escapeHtml } from '../../lib/html';
import { useEChart } from '../../hooks/useEChart';

interface DownloadBarsProps {
  daily: DailyDownload[];
  height?: number;
}

function movingAverage(daily: DailyDownload[], window = 7): Array<number | null> {
  return daily.map((_, index) => {
    if (index < window - 1) return null;
    const slice = daily.slice(index - window + 1, index + 1);
    return Math.round(slice.reduce((sum, item) => sum + item.downloads, 0) / window);
  });
}

export function DownloadBars({ daily, height = 260 }: DownloadBarsProps): JSX.Element {
  const option = useMemo<EChartsOption>(() => {
    const labels = daily.map((item) => item.date.slice(5));
    return {
      animationDuration: 450,
      backgroundColor: 'transparent',
      aria: { enabled: true, label: { description: 'npm 最近 30 天下载量柱状图与 7 日移动平均线' } },
      grid: { left: 38, right: 18, top: 30, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(11,16,23,0.97)',
        borderColor: '#263449',
        borderWidth: 1,
        textStyle: { color: '#c3ceda', fontSize: 11 },
        formatter: (raw: unknown) => {
          const params = raw as Array<{
            axisValue: string;
            seriesName: string;
            value: number | null;
            color: string;
          }>;
          if (!Array.isArray(params) || params.length === 0) return '';
          const rows = params
            .map(
              (item) =>
                `<div style="display:flex;gap:20px;justify-content:space-between"><span style="color:#93a3b8">${escapeHtml(item.seriesName)}</span><b style="color:${escapeHtml(item.color)}">${item.value === null ? '—' : escapeHtml(formatNumber(item.value))}</b></div>`,
            )
            .join('');
          return `<div style="min-width:160px"><div style="color:#e7edf4;margin-bottom:8px">${escapeHtml(params[0].axisValue)}</div>${rows}</div>`;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#93a3b8', fontSize: 10 },
        itemWidth: 12,
        itemHeight: 4,
        icon: 'roundRect',
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#263449' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          interval: daily.length > 18 ? 4 : 2,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          formatter: (value: number) => formatCompact(value),
        },
        splitLine: { lineStyle: { color: 'rgba(38,52,73,0.4)', type: 'dashed' } },
      },
      series: [
        {
          name: '日下载量',
          type: 'bar',
          data: daily.map((item) => item.downloads),
          barMaxWidth: 15,
          itemStyle: {
            color: 'rgba(139,124,246,0.55)',
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: { itemStyle: { color: 'rgba(168,156,255,0.9)' } },
        },
        {
          name: '7 日均值',
          type: 'line',
          data: movingAverage(daily),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: '#f4b75c', width: 1.5 },
          itemStyle: { color: '#f4b75c' },
        },
      ],
    };
  }, [daily]);

  const chartRef = useEChart(option);
  return (
    <div style={{ height }} className="w-full">
      <div
        ref={chartRef}
        className="h-full w-full"
        role="img"
        aria-label="npm 最近 30 天下载量趋势"
      />
    </div>
  );
}
