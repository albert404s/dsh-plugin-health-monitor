import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import { formatDateTime, formatRelative } from '../../lib/format';

export function DataNotices(): JSX.Element | null {
  const { data, stale, warnings, refresh } = useData();
  if (!data) return null;

  const failed = data.status.outcome === 'failed';
  const partial = data.status.outcome === 'partial';
  const sourceFailures = Object.entries(data.latest.sources)
    .filter(([, source]) => source.status === 'failed' || source.status === 'partial')
    .map(([name, source]) => `${name}: ${source.message ?? source.status}`);

  if (failed || stale) {
    return (
      <div className="border-b border-rose/20 bg-rose/5">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-[11px] text-rose/90 md:px-6">
          <WifiOff size={13} className="shrink-0" />
          <span className="font-medium">
            {failed ? '最近一次更新失败' : '数据可能已过期'}
          </span>
          <span className="text-ink-300">
            当前展示 {formatDateTime(data.latest.lastSuccessAt)} 的快照（{formatRelative(data.latest.lastSuccessAt)}）。
          </span>
          <Link to="/method" className="underline decoration-rose/30 underline-offset-4 hover:decoration-rose/70">
            查看更新机制
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex items-center gap-1 rounded border border-rose/25 px-2 py-1 text-[10px] text-rose/90 transition hover:bg-rose/10"
          >
            <RefreshCw size={10} /> 重新加载
          </button>
        </div>
      </div>
    );
  }

  if (partial || warnings.length > 0) {
    return (
      <div className="border-b border-amber/20 bg-amber/[0.035]">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[10px] text-amber/90 md:px-6">
          <AlertTriangle size={11} className="shrink-0" />
          <span>部分数据源已降级，缺失项不会被当作 0。</span>
          <span className="text-ink-400">
            {warnings[0] ?? sourceFailures.slice(0, 2).join(' · ')}
          </span>
          <Link to="/method" className="ml-auto text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline">
            数据状态
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
