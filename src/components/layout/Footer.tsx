import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { formatDateTime } from '../../lib/format';
import { SCORE_METHOD_VERSION } from '../../lib/types';

export function Footer(): JSX.Element {
  const { data } = useData();
  return (
    <footer className="mt-16 border-t border-ink-700/60">
      <div className="mx-auto grid max-w-shell gap-8 px-4 py-10 md:grid-cols-[1fr_auto] md:px-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-ink-200">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            DSH Plugin Health Monitor
          </div>
          <p className="mt-2 max-w-2xl text-[11px] leading-5 text-ink-400">
            独立分析站，不是 DSH 宿主插件。指数为基于公开数据的相对评价，不构成软件质量、安全审计或兼容性背书。
          </p>
          <p className="mt-3 max-w-2xl text-[10px] leading-4 text-ink-500">
            数据来源：GitHub REST API · npm Download API · OSV API。页面不包含 GitHub Token；采集器只在本地或 GitHub
            Actions 中运行。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[11px] md:justify-items-end">
          <Link to="/method" className="text-ink-400 transition hover:text-ink-200">
            评分方法
          </Link>
          <a
            href="https://github.com/albert404s/dsh-plugin-health-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-ink-400 transition hover:text-ink-200"
          >
            <Github size={11} /> GitHub
          </a>
          <span className="text-ink-500">方法版本 {SCORE_METHOD_VERSION}</span>
          <span className="font-mono text-[10px] text-ink-500">
            {data ? formatDateTime(data.latest.lastSuccessAt) : 'NO SNAPSHOT'}
          </span>
        </div>
      </div>
    </footer>
  );
}
