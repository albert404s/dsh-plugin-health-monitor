import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { formatDateTime } from '../../lib/format';
import { SCORE_METHOD_VERSION } from '../../lib/types';

export function Footer(): JSX.Element {
  const { data } = useData();
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-shell gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-content-primary">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            DSH Plugin Health Monitor
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-content-secondary">
            独立分析站，不是 DSH 宿主插件。指数为基于公开数据的相对评价，不构成软件质量、安全审计或兼容性背书。
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-content-muted">
            数据来源：GitHub REST API · npm Download API · OSV API。页面不包含 GitHub Token；采集器只在本地或 GitHub
            Actions 中运行。
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-2xs font-medium text-content-muted">浏览</p>
          <Link to="/" className="text-content-secondary transition hover:text-accent">
            总览
          </Link>
          <Link to="/quadrant" className="text-content-secondary transition hover:text-accent">
            四象限
          </Link>
          <Link to="/compare" className="text-content-secondary transition hover:text-accent">
            插件对比
          </Link>
          <Link to="/method" className="text-content-secondary transition hover:text-accent">
            方法与局限
          </Link>
        </div>
        <div className="flex flex-col items-start gap-2 text-xs text-content-muted">
          <p className="text-2xs font-medium text-content-muted">快照</p>
          <span>方法版本 {SCORE_METHOD_VERSION}</span>
          <span className="font-mono">{data ? formatDateTime(data.latest.lastSuccessAt) : 'NO SNAPSHOT'}</span>
          <a
            href="https://github.com/albert404s/dsh-plugin-health-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-content-secondary transition hover:text-accent"
          >
            <Github size={13} /> GitHub 源码
          </a>
        </div>
      </div>
    </footer>
  );
}
