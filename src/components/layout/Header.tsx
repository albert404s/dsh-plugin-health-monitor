import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Activity, Github, Menu, RefreshCw, X } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { cn } from '../../lib/cn';
import { formatDateTime, formatRelative, isDataStale } from '../../lib/format';

const NAV_ITEMS = [
  { to: '/', label: '总览', end: true },
  { to: '/quadrant', label: '四象限' },
  { to: '/compare', label: '插件对比' },
  { to: '/method', label: '方法' },
];

export function Header(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data, loading, refresh } = useData();
  const lastSuccessAt = data?.latest.lastSuccessAt ?? null;
  const stale = Boolean(data) && isDataStale(lastSuccessAt);
  const failed = data?.status.outcome === 'failed';
  const partial = data?.status.outcome === 'partial';
  const statusTone = loading
    ? 'loading'
    : failed
      ? 'failed'
      : stale
        ? 'stale'
        : partial
          ? 'partial'
          : 'ok';
  const relative = lastSuccessAt ? formatRelative(lastSuccessAt) : null;
  const statusLabel = loading
    ? '加载中'
    : failed
      ? '更新失败'
      : stale
        ? '数据已过期'
        : partial
          ? relative ?? '部分数据'
          : relative ?? '暂无数据';
  const statusDetail = loading
    ? '正在读取数据快照'
    : failed
      ? '最近一次更新失败'
      : lastSuccessAt
        ? `数据更新于 ${relative}`
        : '暂无成功数据';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-3 px-4 md:px-6">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2.5 max-sm:min-h-11"
          aria-label="DSH 插件健康度看板首页"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-accent-line bg-accent-soft text-accent">
            <Activity size={17} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-display text-content-primary">
              <span className="sm:hidden">DSH 健康看板</span>
              <span className="hidden sm:inline">DSH 插件健康度看板</span>
            </span>
            <span className="hidden text-2xs text-content-muted sm:block">Plugin Health Monitor</span>
          </span>
        </Link>

        <nav className="ml-4 hidden h-full items-center gap-1 md:flex" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full items-center px-3 text-sm transition',
                  isActive ? 'text-content-primary' : 'text-content-secondary hover:text-content-primary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive ? (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-control border border-line bg-surface-subtle px-2 py-1.5"
            title={lastSuccessAt ? `最近成功更新：${formatDateTime(lastSuccessAt)}` : '暂无成功数据'}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                statusTone === 'loading'
                  ? 'bg-content-disabled'
                  : statusTone === 'ok'
                    ? 'bg-success'
                    : statusTone === 'failed'
                      ? 'bg-danger'
                      : 'bg-warning',
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'text-2xs',
                statusTone === 'failed'
                  ? 'text-danger'
                  : statusTone === 'stale' || statusTone === 'partial'
                    ? 'text-warning'
                    : 'text-content-secondary',
                statusTone === 'loading' ? 'animate-pulse' : '',
              )}
            >
              {statusLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="flex h-10 w-10 items-center justify-center rounded-control border border-line-strong text-content-secondary transition hover:border-content-muted hover:text-content-primary max-sm:h-11 max-sm:w-11"
            aria-label="重新加载数据快照"
            title={statusDetail}
          >
            <RefreshCw size={15} />
          </button>
          <a
            href="https://github.com/albert404s/dsh-plugin-health-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden h-10 items-center gap-1.5 rounded-control border border-line-strong px-3 text-xs text-content-secondary transition hover:border-content-muted hover:text-content-primary lg:flex"
            aria-label="打开项目 GitHub 仓库"
          >
            <Github size={14} /> GitHub
          </a>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-control border border-line-strong text-content-secondary transition hover:border-content-muted hover:text-content-primary max-sm:h-11 max-sm:w-11 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav id="mobile-nav" className="border-t border-line bg-surface px-4 py-4 md:hidden" aria-label="移动端导航">
          <div className="grid gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-12 items-center rounded-control px-3 text-base transition',
                    isActive
                      ? 'bg-accent-soft text-accent-active'
                      : 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <a
              href="https://github.com/albert404s/dsh-plugin-health-monitor"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 flex min-h-12 items-center gap-2 rounded-control px-3 text-base text-content-secondary hover:bg-surface-subtle hover:text-content-primary"
            >
              <Github size={16} /> GitHub 源码
            </a>
          </div>
          <p className="mt-3 border-t border-line-hairline pt-3 text-xs leading-5 text-content-muted">
            {statusDetail}
            {lastSuccessAt ? ` · ${formatDateTime(lastSuccessAt)}` : ''}
            <span className="block">来源：GitHub REST API · npm Download API · OSV API</span>
          </p>
        </nav>
      ) : null}
    </header>
  );
}
