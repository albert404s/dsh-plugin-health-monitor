import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Activity, Github, Menu, RefreshCw, X } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { cn } from '../../lib/cn';
import { formatDateTime, formatRelative, isDataStale } from '../../lib/format';

const NAV_ITEMS = [
  { to: '/', label: '排行榜', end: true },
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
  const statusLabel = loading
    ? 'LOADING'
    : failed
      ? 'UPDATE FAILED'
      : stale
        ? 'DATA STALE'
        : partial
          ? lastSuccessAt
            ? `${formatRelative(lastSuccessAt)} · PARTIAL`
            : 'PARTIAL'
          : lastSuccessAt
            ? `${formatRelative(lastSuccessAt)} · DATA`
            : 'NO DATA';

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-4 px-4 md:px-6">
        <Link to="/" className="group flex min-w-0 items-center gap-2.5" aria-label="DSH 插件生命体征首页">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-md border border-signal/25 bg-signal/10 text-signal-strong transition group-hover:border-signal/40">
            <Activity size={17} strokeWidth={2.2} aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-mint ring-2 ring-ink-950" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold tracking-tight text-ink-100">
              DSH 插件生命体征
            </span>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500 sm:block">
              Plugin Health Monitor
            </span>
          </span>
        </Link>

        <nav className="ml-5 hidden h-full items-center gap-0.5 md:flex" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full items-center px-3 text-[12px] transition',
                  isActive ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive ? (
                    <span className="absolute bottom-0 left-3 right-3 h-px bg-signal" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="hidden items-center gap-2 rounded-md border border-ink-700/70 bg-ink-900/50 px-2.5 py-1.5 lg:flex"
            title={lastSuccessAt ? `最近成功更新：${formatDateTime(lastSuccessAt)}` : '暂无成功数据'}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                statusTone === 'loading'
                  ? 'animate-pulse bg-ink-400'
                  : statusTone === 'ok'
                    ? 'bg-mint'
                    : statusTone === 'failed'
                      ? 'bg-rose'
                      : 'bg-amber',
              )}
            />
            <span
              className={cn(
                'font-mono text-[10px]',
                statusTone === 'failed'
                  ? 'text-rose'
                  : statusTone === 'stale' || statusTone === 'partial'
                    ? 'text-amber'
                    : 'text-ink-300',
              )}
            >
              {statusLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-ink-700 text-ink-400 transition hover:border-ink-500 hover:text-ink-100 sm:flex"
            aria-label="重新加载数据快照"
            title="重新加载数据快照"
          >
            <RefreshCw size={13} />
          </button>
          <a
            href="https://github.com/albert404s/dsh-plugin-health-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden h-8 items-center gap-1.5 rounded-md border border-ink-700 px-2.5 font-mono text-[10px] text-ink-300 transition hover:border-ink-500 hover:text-ink-100 sm:flex"
            aria-label="打开项目 GitHub 仓库"
          >
            <Github size={13} /> SOURCE
          </a>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-700 text-ink-300 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav id="mobile-nav" className="border-t border-ink-700/60 px-4 py-3 md:hidden" aria-label="移动端导航">
          <div className="grid gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2.5 text-sm transition',
                    isActive ? 'bg-signal/10 text-ink-100' : 'text-ink-300 hover:bg-ink-800/60',
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
              className="mt-1 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-ink-400 hover:bg-ink-800/60 hover:text-ink-200"
            >
              <Github size={14} /> GitHub 源码
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
