import { useEffect, useRef } from 'react';
import type { EChartsOption } from 'echarts';
import { echarts } from '../components/charts/echarts';

type ChartInstance = ReturnType<typeof echarts.init>;

export interface ChartEventHandlers {
  click?: (params: unknown, chart: ChartInstance) => void;
}

export function useEChart(
  option: EChartsOption,
  handlers: ChartEventHandlers = {},
): React.RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = echarts.init(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const handleClick = (params: unknown): void => {
      handlersRef.current.click?.(params, chart);
    };
    chart.on('click', handleClick);

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.off('click', handleClick);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true });
  }, [option]);

  return containerRef;
}
