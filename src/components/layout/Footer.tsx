import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { formatDateTime } from '../../lib/format';
import { SCORE_METHOD_VERSION } from '../../lib/types';

export function Footer(): JSX.Element {
  const { data } = useData();
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-shell gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:px-6 md:py-12">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 bg-brand" aria-hidden="true" />
            <p className="text-sm font-semibold tracking-title text-content-primary">
              DSH Plugin Health Monitor
            </p>
          </div>
          <p className="mt-3 max-w-md text-sm leading-6 text-content-secondary">
            独立分析站，不构成质量、安全或兼容性背书。
          </p>
          <p className="mt-2 max-w-md text-2xs leading-5 text-content-muted">
            数据来源：GitHub REST API · npm Download API · OSV API；页面只读取静态 JSON，不含任何访问令牌。
          </p>
        </div>
        <nav className="flex flex-col items-start gap-1.5 text-sm" aria-label="页脚浏览">
          <p className="stamp mb-1">INDEX</p>
          <Link to="/" className="inline-flex min-h-8 items-center text-content-secondary transition-colors hover:text-brand-text">
            总览
          </Link>
          <Link
            to="/quadrant"
            className="inline-flex min-h-8 items-center text-content-secondary transition-colors hover:text-brand-text"
          >
            四象限
          </Link>
          <Link
            to="/#all-plugins"
            className="inline-flex min-h-8 items-center text-content-secondary transition-colors hover:text-brand-text"
          >
            插件索引
          </Link>
          <Link
            to="/compare"
            className="inline-flex min-h-8 items-center text-content-secondary transition-colors hover:text-brand-text"
          >
            插件对比
          </Link>
          <Link
            to="/method"
            className="inline-flex min-h-8 items-center text-content-secondary transition-colors hover:text-brand-text"
          >
            方法与局限
          </Link>
        </nav>
        <div className="flex flex-col items-start gap-2 text-xs text-content-muted">
          <p className="stamp mb-1">SNAPSHOT</p>
          <span>方法版本 {SCORE_METHOD_VERSION}</span>
          <time
            className="timestamp"
            dateTime={data?.latest.lastSuccessAt}
            title={data?.latest.lastSuccessAt ?? undefined}
          >
            {data ? formatDateTime(data.latest.lastSuccessAt) : 'NO SNAPSHOT'}
          </time>
          <span className="text-2xs">UTC+8</span>
          <a
            href="https://github.com/albert404s/dsh-plugin-health-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-content-secondary transition-colors hover:text-brand-text"
          >
            <Github size={13} aria-hidden="true" /> GitHub 源码
          </a>
        </div>
      </div>
      <div className="border-t border-line-hairline">
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-2 px-4 py-3 text-micro text-content-muted md:px-6">
          <span>DSH / PLUGIN OBSERVATORY</span>
          <span className="tnum">SNAPSHOT INDEX · LOCAL STATIC DATA</span>
        </div>
      </div>
    </footer>
  );
}
