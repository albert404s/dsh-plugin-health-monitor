import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
const titles: Record<string, string> = { '/': '概览', '/plugins': '插件库', '/ecosystem': '生态分布', '/compare': '插件对比', '/method': '数据与方法' };
export function ScrollToTop(): null {
  const { pathname, hash, key } = useLocation();
  const navigation = useNavigationType();
  const previous = useRef<string | null>(null);
  const positions = useRef(new Map<string, number>());
  useEffect(() => {
    document.title = (titles[pathname] ?? (pathname.startsWith('/plugins/') ? '插件详情' : '页面不存在')) + ' · ORBIT 插件观测站';
  }, [pathname]);
  useEffect(() => {
    const remember = (): void => { positions.current.set(key, window.scrollY); };
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [key]);
  useLayoutEffect(() => {
    const changed = previous.current !== pathname;
    const first = previous.current === null;
    previous.current = pathname;
    if (navigation === 'POP' && !first && positions.current.has(key)) {
      window.scrollTo({ top: positions.current.get(key) ?? 0, behavior: 'instant' });
      return;
    }
    if (hash) {
      let id: string;
      try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
      const focus = (): boolean => {
        const target = document.getElementById(id);
        if (!target) return false;
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        target.focus({ preventScroll: true });
        return true;
      };
      if (focus()) return;
      const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
      observer.observe(document.body, { subtree: true, childList: true });
      const timer = window.setTimeout(() => observer.disconnect(), 12000);
      return () => { observer.disconnect(); clearTimeout(timer); };
    }
    if (changed) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
  }, [pathname, hash, key, navigation]);
  return null;
}
