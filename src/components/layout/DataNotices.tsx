import { useLayoutEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import { formatDateTime, formatRelative } from '../../lib/format';

export function DataNotices(): JSX.Element | null {
  const { data, stale, warnings, refresh, error } = useData();
  const bannerRef = useRef<HTMLDivElement>(null);

  const failed = data?.status.outcome === 'failed';
  const partial = data?.status.outcome === 'partial';
  const sourceFailures = data
    ? Object.entries(data.latest.sources)
        .filter(([, source]) => source.status === 'failed' || source.status === 'partial')
        .map(([name, source]) => `${name}: ${source.message ?? source.status}`)
    : [];

  useLayoutEffect(() => {
    const element = bannerRef.current;
    const syncHeight = (): void => {
      document.documentElement.style.setProperty('--notice-h', `${element?.offsetHeight ?? 0}px`);
    };
    syncHeight();
    if (!element) return undefined;
    const observer = new ResizeObserver(syncHeight);
    observer.observe(element);
    window.addEventListener('resize', syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
      document.documentElement.style.setProperty('--notice-h', '0px');
    };
  }, [data, failed, partial, stale, error, warnings]);

  if (!data) return null;

  // A failed refresh keeps the last successful snapshot; this is the most local
  // message and takes precedence over a global stale notice.
  if (error) {
    return (
      <div
        ref={bannerRef}
        className="border-b border-warning-line bg-warning-soft"
        role="status"
      >
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs text-warning md:px-6">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          <span className="font-medium">刷新失败，继续展示上次成功加载的快照。</span>
          <span className="min-w-0 text-content-secondary">{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-control border border-warning-line px-3 text-xs text-warning transition-colors hover:bg-surface/60"
          >
            <RefreshCw size={12} /> 重试
          </button>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div ref={bannerRef} className="border-b border-danger-line bg-danger-soft" role="alert">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs text-danger md:px-6">
          <WifiOff size={14} className="shrink-0" aria-hidden="true" />
          <span className="font-medium">最近一次更新失败，继续展示上次成功快照。</span>
          <span className="text-content-secondary">
            {formatDateTime(data.latest.lastSuccessAt)}（{formatRelative(data.latest.lastSuccessAt)}）
            {sourceFailures.length > 0 ? ` · ${sourceFailures.slice(0, 2).join(' · ')}` : ''}
          </span>
          <Link
            to="/method"
            className="underline decoration-danger/30 underline-offset-4 hover:decoration-danger/70"
          >
            查看更新机制
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-control border border-danger-line px-3 text-xs text-danger transition-colors hover:bg-surface/60"
          >
            <RefreshCw size={12} /> 重新加载
          </button>
        </div>
      </div>
    );
  }

  if (stale && !partial && warnings.length === 0) {
    return (
      <div ref={bannerRef} className="border-b border-warning-line bg-warning-soft" role="status">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs text-warning md:px-6">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          <span className="font-medium">快照较早，选用前可核对原仓库。</span>
          <span className="text-content-secondary">
            当前展示 {formatDateTime(data.latest.lastSuccessAt)} 的快照（{formatRelative(data.latest.lastSuccessAt)}）。
          </span>
          <Link
            to="/method"
            className="underline decoration-warning/30 underline-offset-4 hover:decoration-warning/70"
          >
            查看更新机制
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-control border border-warning-line px-3 text-xs text-warning transition-colors hover:bg-surface/60"
          >
            <RefreshCw size={12} /> 重新加载
          </button>
        </div>
      </div>
    );
  }

  if (partial || warnings.length > 0) {
    return (
      <div ref={bannerRef} className="border-b border-warning-line bg-warning-soft" role="status">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs text-warning md:px-6">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          <span className="font-medium">部分数据暂不可用，已有结果仍可查看。</span>
          <span className="text-content-secondary">
            {warnings[0]?.split('：')[0] || sourceFailures.slice(0, 2).join(' · ')}
          </span>
          {stale ? <span className="text-content-secondary">采集于 {formatDateTime(data.latest.lastSuccessAt)}</span> : null}
          {warnings.length > 0 ? <details className="w-full text-content-secondary"><summary className="min-h-9 cursor-pointer py-2 text-xs">{warnings.length} 条数据说明</summary><ul className="space-y-2 pb-2">{warnings.map((warning, index) => <li key={index} className="break-words text-xs leading-6">{warning}</li>)}</ul></details> : null}
          <Link
            to="/method"
            className="ml-auto text-content-secondary underline-offset-4 hover:text-brand-text hover:underline"
          >
            数据状态
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
