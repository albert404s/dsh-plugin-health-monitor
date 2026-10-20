import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import { formatDateTime, formatRelative } from '../../lib/format';

export function DataNotices(): JSX.Element | null {
  const { data, stale, warnings, refresh, error } = useData();
  if (!data) return null;

  const failed = data.status.outcome === 'failed';
  const partial = data.status.outcome === 'partial';
  const sourceFailures = Object.entries(data.latest.sources)
    .filter(([, source]) => source.status === 'failed' || source.status === 'partial')
    .map(([name, source]) => `${name}: ${source.message ?? source.status}`);

  if (failed || stale) {
    return (
      <div className="border-b border-danger-line bg-danger-soft">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs text-danger md:px-6">
          <WifiOff size={14} className="shrink-0" />
          <span className="font-medium">{failed ? '最近一次更新失败' : '数据可能已过期'}</span>
          <span className="text-content-secondary">
            当前展示 {formatDateTime(data.latest.lastSuccessAt)} 的快照（{formatRelative(data.latest.lastSuccessAt)}）。
          </span>
          <Link to="/method" className="underline decoration-danger/30 underline-offset-4 hover:decoration-danger/70">
            查看更新机制
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex h-11 items-center gap-1 rounded-control border border-danger-line px-3 text-xs text-danger transition hover:bg-danger-soft"
          >
            <RefreshCw size={12} /> 重新加载
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-warning-line bg-warning-soft">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs text-warning md:px-6">
          <AlertTriangle size={14} className="shrink-0" />
          <span>刷新失败，继续展示上次成功加载的快照。</span>
          <span className="text-content-secondary">{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex h-11 items-center gap-1 rounded-control border border-warning-line px-3 text-xs text-warning transition hover:bg-warning-soft"
          >
            <RefreshCw size={12} /> 重试
          </button>
        </div>
      </div>
    );
  }

  if (partial || warnings.length > 0) {
    return (
      <div className="border-b border-warning-line bg-warning-soft">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs text-warning md:px-6">
          <AlertTriangle size={14} className="shrink-0" />
          <span>部分数据源已降级，缺失项不会被当作 0。</span>
          <span className="text-content-secondary">
            {warnings.slice(0, 2).join(' · ') || sourceFailures.slice(0, 2).join(' · ')}
          </span>
          <Link
            to="/method"
            className="ml-auto text-content-secondary underline-offset-4 hover:text-accent hover:underline"
          >
            数据状态
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
