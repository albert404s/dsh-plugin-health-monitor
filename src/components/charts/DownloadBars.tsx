import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { DailyDownload } from '../../lib/types';
import {
  MOVING_AVERAGE_WINDOW,
  movingAverage,
  toDisplaySeries,
} from '../../lib/downloads';
import { formatCompact, formatNumber } from '../../lib/format';
import { escapeHtml } from '../../lib/html';
import { useEChart } from '../../hooks/useEChart';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { chartTheme, tooltipChrome } from './chartTheme';

const EMPTY_GAP_DATES: ReadonlySet<string> = new Set();

interface DownloadBarsProps {
  daily: DailyDownload[];
  height?: number;
  /** Platform-wide missing dates computed from the full plugin snapshot. */
  gapDates?: ReadonlySet<string>;
}

export function DownloadBars({ daily, height = 260, gapDates = EMPTY_GAP_DATES }: DownloadBarsProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion();
  const points = useMemo(() => toDisplaySeries(daily, gapDates), [daily, gapDates]);
  const hasMissingDays = points.some((point) => point.missing);
  const option = useMemo<EChartsOption>(() => {
    const labels = points.map((point) => point.date.slice(5));
    const gapLabels = points.filter((point) => point.missing).map((point) => point.date.slice(5));
    const ariaDescription = hasMissingDays
      ? 'npm 最近 30 天下载量柱状图与 7 日移动平均线；灰色区域为数据缺失日，不按 0 计入均值'
      : 'npm 最近 30 天下载量柱状图与 7 日移动平均线';

    return {
      animationDuration: reducedMotion ? 0 : 200,
      backgroundColor: 'transparent',
      aria: { enabled: true, label: { description: ariaDescription } },
      grid: { left: 40, right: 16, top: 34, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: chartTheme.tooltip.background,
        borderColor: chartTheme.tooltip.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: chartTheme.text, fontSize: 12, fontFamily: chartTheme.fontFamily },
        extraCssText: tooltipChrome(),
        axisPointer: { type: 'shadow', shadowStyle: { color: chartTheme.axisPointerShadow } },
        formatter: (raw: unknown) => {
          const params = raw as Array<{
            axisValue: string;
            seriesName: string;
            value: number | null;
            color: string;
            dataIndex: number;
          }>;
          if (!Array.isArray(params) || params.length === 0) return '';
          const point = points[params[0].dataIndex];
          const rows = params
            .map((item) => {
              const valueText = point?.missing
                ? item.seriesName === '日下载量'
                  ? '数据缺失'
                  : '—'
                : typeof item.value === 'number'
                  ? formatNumber(item.value)
                  : '—';
              return `<div style="display:flex;gap:20px;justify-content:space-between;line-height:18px"><span style="color:${chartTheme.tooltip.muted}">${escapeHtml(item.seriesName)}</span><b style="color:${chartTheme.strong};font-family:${chartTheme.monoFamily};font-weight:600">${escapeHtml(valueText)}</b></div>`;
            })
            .join('');
          const footer = point?.missing
            ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid ${chartTheme.tooltip.border};color:${chartTheme.tooltip.muted};font-size:12px;line-height:18px">数据缺失日，不按 0 计入均值</div>`
            : '';
          return `<div style="min-width:170px;padding:10px 12px;font-family:${chartTheme.fontFamily}"><div style="color:${chartTheme.tooltip.title};font-size:13px;font-weight:600;margin-bottom:6px">${escapeHtml(params[0].axisValue)}</div>${rows}${footer}</div>`;
        },
      },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: chartTheme.text, fontSize: 12, fontFamily: chartTheme.fontFamily },
        inactiveColor: chartTheme.axisText,
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        icon: 'roundRect',
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: chartTheme.axisLine } },
        axisTick: { show: true, length: 4, lineStyle: { color: chartTheme.axisLine } },
        axisLabel: {
          color: chartTheme.axisText,
          fontSize: chartTheme.axisFontSize,
          fontFamily: chartTheme.monoFamily,
          interval: points.length > 18 ? 4 : 2,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: chartTheme.axisText,
          fontSize: chartTheme.axisFontSize,
          fontFamily: chartTheme.monoFamily,
          formatter: (value: number) => formatCompact(value),
        },
        splitLine: { lineStyle: { color: chartTheme.grid, type: 'solid', width: 1 } },
      },
      series: [
        {
          name: '日下载量',
          type: 'bar',
          // Platform-wide gap days stay null: no bar is drawn and no zero enters
          // the 7-day mean. Real zero days keep their numeric 0.
          data: points.map((point) => point.downloads),
          barMaxWidth: 14,
          barCategoryGap: '35%',
          itemStyle: {
            color: chartTheme.series.bar,
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: { focus: 'series', itemStyle: { color: chartTheme.series.barHover } },
          markArea:
            gapLabels.length > 0
              ? {
                  silent: true,
                  label: { show: false },
                  itemStyle: { color: chartTheme.gapArea },
                  data: gapLabels.map((label) => [{ xAxis: label }, { xAxis: label }]),
                }
              : undefined,
        },
        {
          name: '7 日均值',
          type: 'line',
          data: movingAverage(points, MOVING_AVERAGE_WINDOW),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: chartTheme.series.maintenance, width: 1.5 },
          itemStyle: { color: chartTheme.series.maintenance },
        },
      ],
    };
  }, [points, hasMissingDays, reducedMotion]);

  const chartRef = useEChart(option);
  return (
    <div className="w-full">
      <div style={{ height }} className="w-full">
        <div
          ref={chartRef}
          className="h-full w-full"
          role="img"
          aria-label={
            hasMissingDays
              ? 'npm 最近 30 天下载量趋势；灰色区域为数据缺失日，不按 0 计入均值'
              : 'npm 最近 30 天下载量趋势'
          }
        />
      </div>
      {hasMissingDays ? (
        <p className="flex items-start gap-1.5 px-3 pb-3 text-2xs leading-5 text-content-muted">
          <span
            className="mt-1 inline-block h-2 w-2 shrink-0 rounded-[2px] ring-1 ring-line-strong"
            style={{ backgroundColor: chartTheme.gapSwatch }}
            aria-hidden="true"
          />
          灰色/断点=疑似缺失，不按 0 计入均值
        </p>
      ) : null}
    </div>
  );
}
