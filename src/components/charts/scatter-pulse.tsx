import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { PluginRecord } from '../../lib/types';
import { echarts } from './echarts';
import { riskColor } from './chartTheme';

interface Halo { id: string; x: number; y: number; radius: number; color: string; delay: number }
interface Plot { halos: Halo[]; x: number; y: number; width: number; height: number }
/** Decorative halos only: coordinates, core bubbles and values never animate. */
export function ScatterPulse({ container, plugins, enabled }: {
  container: RefObject<HTMLDivElement>; plugins: PluginRecord[]; enabled: boolean;
}): JSX.Element | null {
  const clipId = 'scatter-' + useId().replace(/:/g, '');
  const [plot, setPlot] = useState<Plot | null>(null);
  const [paused, setPaused] = useState(false);
  const reasons = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !container.current) return;
    const element = container.current;
    let resizeFrame = 0, pointerFrame = 0;
    let pointer: { x: number; y: number } | null = null;
    const pause = (reason: string, active: boolean): void => {
      if (active) reasons.current.add(reason); else reasons.current.delete(reason);
      setPaused(reasons.current.size > 0);
    };
    const position = (): void => {
      const chart = echarts.getInstanceByDom(element);
      if (!chart || chart.isDisposed()) return;
      const x0 = chart.convertToPixel({xAxisIndex:0},0) as number;
      const x1 = chart.convertToPixel({xAxisIndex:0},100) as number;
      const y0 = chart.convertToPixel({yAxisIndex:0},100) as number;
      const y1 = chart.convertToPixel({yAxisIndex:0},0) as number;
      if (![x0,x1,y0,y1].every(Number.isFinite)) return;
      const max = Math.max(1,...plugins.map(plugin=>plugin.github.stars));
      const halos = plugins.flatMap((plugin,index) => {
        const xy = chart.convertToPixel({seriesIndex:1},[plugin.scores.popularity.score!,plugin.scores.maintenance.score!]) as number[];
        return xy?.every(Number.isFinite) ? [{id:plugin.id,x:xy[0],y:xy[1],radius:10+Math.log10(plugin.github.stars+1)/Math.log10(max+1)*6,color:riskColor(plugin.scores.risk.level),delay:-index*.29}] : [];
      });
      setPlot({halos,x:x0,y:y0,width:x1-x0,height:y1-y0});
    };
    const proximity = (): void => {
      pointerFrame = 0;
      if (!pointer) return;
      const rect = element.getBoundingClientRect();
      const distanceX = Math.max(rect.left-pointer.x,0,pointer.x-rect.right);
      const distanceY = Math.max(rect.top-pointer.y,0,pointer.y-rect.bottom);
      pause('pointer', Math.hypot(distanceX,distanceY) <= 56);
    };
    const move = (event: PointerEvent): void => {
      pointer = {x:event.clientX,y:event.clientY};
      if (!pointerFrame) pointerFrame = requestAnimationFrame(proximity);
    };
    const exit = (): void => { pointer=null; pause('pointer',false); };
    const focus = (): void => { pause('focus',Boolean(element.closest('section')?.contains(document.activeElement))); };
    const visibility = (): void => pause('background',document.hidden);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => { position(); proximity(); });
    });
    observer.observe(element);
    const intersection = new IntersectionObserver(([entry])=>pause('offscreen',!entry.isIntersecting));
    intersection.observe(element);
    document.addEventListener('pointermove',move,{passive:true});
    document.addEventListener('pointerleave',exit);
    document.addEventListener('focusin',focus);
    document.addEventListener('focusout',focus);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('scroll',proximity,{passive:true});
    visibility(); focus();
    resizeFrame=requestAnimationFrame(position);
    return () => {
      observer.disconnect(); intersection.disconnect();
      cancelAnimationFrame(resizeFrame);cancelAnimationFrame(pointerFrame);
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',exit);
      document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus);
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('scroll',proximity);
      reasons.current.clear();
    };
  }, [container, plugins, enabled]);
  if (!enabled || !plot) return null;
  return <svg className="orbit-scatter-pulse" data-state={paused ? 'paused' : 'running'} aria-hidden="true">
    <defs><clipPath id={clipId}><rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} /></clipPath></defs>
    <g clipPath={'url(#'+clipId+')'}>{plot.halos.map(halo=><circle key={halo.id} cx={halo.x} cy={halo.y} r={halo.radius} stroke={halo.color} fill="none" strokeWidth="1.2" style={{animationDelay:halo.delay+'s'}} />)}</g>
  </svg>;
}
