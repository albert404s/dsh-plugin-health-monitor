import { useMediaQuery } from './useMediaQuery';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

/**
 * Single breakpoint map for layout and chart heights. Keeping this in one place
 * prevents each ECharts panel from guessing its own inline height.
 */
export function useBreakpoint(): Breakpoint {
  const wide = useMediaQuery('(min-width: 1280px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const tablet = useMediaQuery('(min-width: 768px)');

  if (wide) return 'wide';
  if (desktop) return 'desktop';
  if (tablet) return 'tablet';
  return 'mobile';
}
