import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Activity, Github, Menu, RefreshCw, X } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { cn } from '../../lib/cn';
import { formatDateTime, formatRelative, isDataStale } from '../../lib/format';
import type { DataBundle } from '../../lib/types';

interface NavItem {
  to: string;
  label: string;
  matches: (pathname: string) => boolean;
  hashTarget?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '总览', matches: (pathname) => pathname === '/' },
  { to: '/quadrant', label: '四象限', matches: (pathname) => pathname === '/quadrant' },
  {
    to: '/#all-plugins',
    label: '插件索引',
    matches: () => false,
    hashTarget: 'all-plugins',
  },
  { to: '/compare', label: '对比', matches: (pathname) => pathname === '/compare' },
  { to: '/method', label: '方法', matches: (pathname) => pathname === '/method' },
];

function sourceStatusLabel(status: string): string {
  if (status === 'ok' || status === 'checked' || status === 'verified') return '正常';
  if (status === 'partial') return '部分';
  if (status === 'failed' || status === 'error') return '失败';
  if (status === 'skipped') return '跳过';
  if (status === 'unavailable') return '不可用';
  return status;
}

function sourceTone(status: string): 'ok' | 'warn' | 'off' {
  if (status === 'ok' || status === 'checked' || status === 'verified') return 'ok';
  if (status === 'failed' || status === 'error' || status === 'unavailable') return 'off';
  return 'warn';
}

function StatusLight({ tone }: { tone: 'ok' | 'warn' | 'off' | 'loading' }): JSX.Element {
  return (
    <span
      className={cn(
        'status-light',
        tone === 'ok'
          ? 'bg-success'
          : tone === 'warn'
            ? 'bg-warning'
            : tone === 'off'
              ? 'bg-danger'
              : 'bg-content-disabled animate-pulse',
      )}
      aria-hidden="true"
    />
  );
}

function StatusPopover({
  data,
  loading,
  onRefresh,
  onClose,
}: {
  data: DataBundle | null;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}): JSX.Element {
  const sources = data
    ? [
        { name: 'GitHub', status: data.latest.sources.github.status },
        { name: 'npm', status: data.latest.sources.npm.status },
        { name: 'OSV', status: data.latest.sources.osv.status },
      ]
    : [];
  return (
    <div
      id="data-status-popover"
      role="dialog"
      aria-label="数据状态与来源"
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-line-strong bg-surface p-4 shadow-pop"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line-hairline pb-3">
        <div className="min-w-0">
          <p className="stamp">DATA / STATUS</p>
          <p className="mt-1 text-sm font-semibold text-content-primary">
            {data ? (
              <>
                快照{' '}
                <time className="font-mono text-xs" dateTime={data.latest.lastSuccessAt}>
                  {formatDateTime(data.latest.lastSuccessAt)}
                </time>
              </>
            ) : (
              '尚未取得快照'
            )}
          </p>
          <p className="mt-1 text-xs text-content-muted">
            {data ? `UTC+8 · ${formatRelative(data.latest.lastSuccessAt)}` : '正在读取本地数据快照'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-line-control text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content-primary"
          aria-label="关闭数据状态"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-1.5 border-b border-line-hairline py-3">
        {sources.length > 0 ? (
          sources.map((source) => (
            <div key={source.name} className="flex items-center gap-2 text-xs text-content-secondary">
              <StatusLight tone={sourceTone(source.status)} />
              <span className="min-w-0 flex-1">{source.name}</span>
              <span className="text-content-primary">{sourceStatusLabel(source.status)}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-content-muted">来源状态将在快照载入后显示。</p>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-content-muted">
        {data?.status.nextRunHint ?? '更新频率由采集工作流决定'} · 缺失项不会被记为 0。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-control px-3 text-xs text-content-primary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? '正在重新加载…' : '重新加载'}
        </button>
        <Link
          to="/method"
          onClick={onClose}
          className="text-xs text-content-secondary underline-offset-4 hover:text-brand-text hover:underline"
        >
          数据方法与更新机制
        </Link>
      </div>
    </div>
  );
}

export function Header(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const { data, loading, refresh } = useData();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const statusRef = useRef<HTMLDivElement>(null);
  const initialHashHandled = useRef(false);

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
        ? `${relative ?? '数据已过期'}`
        : partial
          ? relative ?? '部分数据'
          : relative ?? '暂无数据';
  const statusDetail = loading
    ? '正在读取数据快照'
    : failed
      ? '最近一次更新失败'
      : lastSuccessAt
        ? `最近成功更新：${formatDateTime(lastSuccessAt)}`
        : '暂无成功数据';
  const visibleStatusTone = statusTone === 'ok' ? 'ok' : statusTone === 'failed' ? 'off' : 'warn';

  useEffect(() => {
    setMobileOpen(false);
    setStatusOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!statusOpen) return;
    function onPointerDown(event: PointerEvent): void {
      if (!statusRef.current?.contains(event.target as Node)) setStatusOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setStatusOpen(false);
        statusRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [statusOpen]);

  useEffect(() => {
    if (initialHashHandled.current || hash !== '#all-plugins') return;
    initialHashHandled.current = true;
    if (navigationType === 'POP' || pathname !== '/') return;
    const target = document.getElementById('all-plugins');
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    });
  }, [hash, navigationType, pathname]);

  function focusPluginIndex(): void {
    const target = document.getElementById('all-plugins');
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    });
  }

  function handleIndexClick(event: React.MouseEvent<HTMLAnchorElement>): void {
    setMobileOpen(false);
    if (pathname !== '/') return;
    event.preventDefault();
    navigate('/#all-plugins');
    focusPluginIndex();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-shell items-center gap-2 px-4 md:h-16 md:gap-3 md:px-6">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2.5 max-sm:min-h-11"
          aria-label="DSH 插件健康度看板首页"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-metal-200 bg-metal-100 text-brand">
            <Activity size={17} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-title text-content-primary">
              <span className="lg:hidden">DSH 健康看板</span>
              <span className="hidden lg:inline">DSH 插件健康度看板</span>
            </span>
            <span className="hidden text-micro uppercase tracking-stamp text-content-muted lg:block">
              Plugin Health Monitor
            </span>
          </span>
        </Link>

        <nav className="ml-1 hidden h-full items-center gap-0.5 md:flex lg:ml-4 lg:gap-1" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const active = !item.hashTarget && item.matches(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={item.hashTarget ? handleIndexClick : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full items-center px-2.5 text-xs transition-colors lg:px-3 lg:text-sm',
                  active ? 'text-content-primary' : 'text-content-secondary hover:text-content-primary',
                )}
              >
                {item.label}
                {active ? (
                  <span
                    className="absolute bottom-0 left-2.5 right-2.5 h-0.5 bg-brand lg:left-3 lg:right-3"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <div className="relative" ref={statusRef}>
            <button
              type="button"
              onClick={() => setStatusOpen((open) => !open)}
              className="flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-surface-subtle px-2 py-1.5 text-left transition-colors hover:border-line-control hover:bg-surface max-sm:min-h-11"
              aria-expanded={statusOpen}
              aria-controls={statusOpen ? 'data-status-popover' : undefined}
              aria-label={`数据状态：${statusLabel}。${statusDetail}`}
              title={statusDetail}
            >
              <StatusLight tone={visibleStatusTone} />
              <span
                className={cn(
                  'max-w-[8.5rem] truncate text-2xs',
                  statusTone === 'failed'
                    ? 'text-danger'
                    : statusTone === 'stale' || statusTone === 'partial'
                      ? 'text-warning'
                      : 'text-content-secondary',
                )}
                aria-live="polite"
              >
                {statusLabel}
                {stale ? <span className="hidden lg:inline"> · 可能已过期</span> : null}
              </span>
            </button>
            {statusOpen ? (
              <StatusPopover
                data={data}
                loading={loading}
                onRefresh={() => {
                  refresh();
                }}
                onClose={() => setStatusOpen(false)}
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="hidden h-10 w-10 items-center justify-center rounded-control border border-line-control text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-45 md:flex"
            aria-label="重新加载数据快照"
            title={statusDetail}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <a
            href="https://github.com/albert404s/dsh-plugin-health-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden h-10 items-center gap-1.5 rounded-control border border-line-control px-3 text-xs text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary xl:flex"
            aria-label="打开项目 GitHub 仓库"
          >
            <Github size={14} /> GitHub
          </a>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-control border border-line-control text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content-primary md:hidden"
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
        <nav
          id="mobile-nav"
          className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line bg-surface px-4 py-3 md:hidden"
          aria-label="移动端导航"
        >
          <div className="grid gap-1">
            {NAV_ITEMS.map((item) => {
              const active = !item.hashTarget && item.matches(pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={(event) => {
                    setMobileOpen(false);
                    if (item.hashTarget) handleIndexClick(event);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center border-l-2 px-3 text-base transition-colors',
                    active
                      ? 'border-brand bg-brand-soft text-content-primary'
                      : 'border-transparent text-content-secondary hover:bg-surface-subtle hover:text-content-primary',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-hairline pt-3 text-xs text-content-secondary">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setStatusOpen(true);
              }}
              className="inline-flex min-h-11 items-center gap-1.5"
            >
              <StatusLight tone={visibleStatusTone} />
              查看数据状态
            </button>
            <a
              href="https://github.com/albert404s/dsh-plugin-health-monitor"
              target="_blank"
              rel="noreferrer noopener"
              className="ml-auto inline-flex min-h-11 items-center gap-1.5"
            >
              <Github size={14} /> GitHub
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
