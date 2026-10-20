import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function titleFor(pathname: string): string {
  if (pathname === '/') return '总览 · DSH 插件健康度看板';
  if (pathname === '/quadrant') return '四象限 · DSH 插件健康度看板';
  if (pathname === '/compare') return '插件对比 · DSH 插件健康度看板';
  if (pathname === '/method') return '方法与局限 · DSH 插件健康度看板';
  if (pathname.startsWith('/plugins/')) return '插件详情 · DSH 插件健康度看板';
  return '页面不存在 · DSH 插件健康度看板';
}

/**
 * The router owns title, focus and scrolling. Hash links focus their real target
 * so the plugin index is reachable from the header without creating a new page.
 */
export function ScrollToTop(): null {
  const { pathname, hash } = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    document.title = titleFor(pathname);
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (hash) {
        const id = decodeURIComponent(hash.slice(1));
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ block: 'start' });
          if (typeof target.focus === 'function') target.focus({ preventScroll: true });
          previousPath.current = pathname;
          return;
        }
      }

      window.scrollTo({ top: 0, behavior: 'instant' });
      if (previousPath.current !== pathname) {
        document.getElementById('main-content')?.focus({ preventScroll: true });
      }
      previousPath.current = pathname;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}
