import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { PluginRecord } from '../lib/types';
import { categoryLabel } from '../lib/types';
import {
  categories,
  filterPlugins,
  hasActiveFilters,
  paginate,
  PAGE_SIZE,
  sortPlugins,
  stateFromSearchParams,
  stateToSearchParams,
  type DataFilter,
  type DownloadFilter,
  type MaintenanceFilter,
  type RiskFilter,
  type SortKey,
} from '../lib/filters';
import { formatCompact, formatDateTime, formatRelative, formatScore, scoreLabel } from '../lib/format';
import { cn } from '../lib/cn';
import {
  CategoryTag,
  DataCoverage,
  EmptyState,
  Pagination,
  PluginMonogram,
  RiskBadge,
  ScoreBar,
} from './ui';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'popularity', label: '人气指数' },
  { value: 'maintenance', label: '维护健康度' },
  { value: 'completeness', label: '数据完整度' },
  { value: 'stars', label: 'GitHub Stars' },
  { value: 'downloads', label: 'npm 下载量' },
  { value: 'commits', label: '30 天提交数' },
  { value: 'recent', label: '最近提交时间' },
  { value: 'name', label: '名称 A–Z' },
];

const MAINTENANCE_OPTIONS: Array<{ value: MaintenanceFilter; label: string }> = [
  { value: 'all', label: '全部维护' },
  { value: 'active', label: '维护活跃' },
  { value: 'steady', label: '平稳' },
  { value: 'slow', label: '放缓' },
  { value: 'insufficient', label: '信息不足' },
];

const RISK_OPTIONS: Array<{ value: RiskFilter; label: string }> = [
  { value: 'all', label: '全部风险' },
  { value: 'high', label: '高风险信号' },
  { value: 'medium', label: '需要关注' },
  { value: 'unknown', label: '信息不完整' },
  { value: 'low', label: '未见公开风险' },
];

const DATA_OPTIONS: Array<{ value: DataFilter; label: string }> = [
  { value: 'all', label: '全部覆盖' },
  { value: 'high', label: '覆盖 ≥85%' },
  { value: 'medium', label: '覆盖 55–84%' },
  { value: 'low', label: '覆盖 <55%' },
];

const DOWNLOAD_OPTIONS: Array<{ value: DownloadFilter; label: string }> = [
  { value: 'all', label: '全部下载' },
  { value: 'available', label: '有可靠下载' },
  { value: 'missing', label: '无可靠下载' },
];

function SortButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center gap-1 text-2xs font-medium transition-colors',
        active ? 'text-content-primary' : 'text-content-secondary hover:text-content-primary',
      )}
      aria-label={`按${String(children)}排序`}
    >
      {children}
      <ChevronDown
        size={11}
        aria-hidden="true"
        className={cn('transition-transform', active ? '' : 'opacity-0')}
      />
    </button>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="relative inline-flex min-h-7 items-center gap-1 rounded-chip border border-line bg-surface-subtle px-2 text-2xs text-content-secondary transition-colors after:absolute after:-inset-2 after:content-[''] hover:border-line-control hover:text-content-primary"
      aria-label={`移除筛选：${label}`}
    >
      {label}
      <X size={11} aria-hidden="true" />
    </button>
  );
}

export function PluginExplorer({
  plugins,
  lastSuccessAt,
}: {
  plugins: PluginRecord[];
  lastSuccessAt?: string | null;
}): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const composing = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const state = useMemo(() => stateFromSearchParams(searchParams), [searchParams]);
  const filtered = useMemo(() => filterPlugins(plugins, state), [plugins, state]);
  const sorted = useMemo(() => sortPlugins(filtered, state.sort), [filtered, state.sort]);
  const page = paginate(sorted, state.page);
  const active = hasActiveFilters(state);
  const activeCount = [
    state.query.trim(),
    state.category !== 'all',
    state.maintenance !== 'all',
    state.risk !== 'all',
    state.data !== 'all',
    state.downloads !== 'all',
  ].filter(Boolean).length;

  useEffect(() => {
    setQueryInput(state.query);
  }, [state.query]);

  function update(patch: Partial<typeof state>): void {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    setSearchParams(stateToSearchParams(next), { replace: true });
  }

  function reset(): void {
    setSearchParams(new URLSearchParams(), { replace: true });
    setQueryInput('');
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }

  function handlePageChange(nextPage: number): void {
    update({ page: nextPage });
    window.requestAnimationFrame(() => {
      document.getElementById('all-plugins-title')?.scrollIntoView({ block: 'start' });
    });
  }

  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (state.category !== 'all') {
    chips.push({
      key: 'category',
      label: `分类：${categoryLabel(state.category)}`,
      remove: () => update({ category: 'all' }),
    });
  }
  if (state.risk !== 'all') {
    chips.push({
      key: 'risk',
      label: `风险：${RISK_OPTIONS.find((item) => item.value === state.risk)?.label ?? state.risk}`,
      remove: () => update({ risk: 'all' }),
    });
  }
  if (state.maintenance !== 'all') {
    chips.push({
      key: 'maintenance',
      label: `维护：${
        MAINTENANCE_OPTIONS.find((item) => item.value === state.maintenance)?.label ?? state.maintenance
      }`,
      remove: () => update({ maintenance: 'all' }),
    });
  }
  if (state.data !== 'all') {
    chips.push({
      key: 'data',
      label: `覆盖：${DATA_OPTIONS.find((item) => item.value === state.data)?.label ?? state.data}`,
      remove: () => update({ data: 'all' }),
    });
  }
  if (state.downloads !== 'all') {
    chips.push({
      key: 'downloads',
      label: `下载：${
        DOWNLOAD_OPTIONS.find((item) => item.value === state.downloads)?.label ?? state.downloads
      }`,
      remove: () => update({ downloads: 'all' }),
    });
  }

  const emptyDescription = state.query.trim()
    ? `没有匹配“${state.query.trim().slice(0, 24)}${state.query.trim().length > 24 ? '…' : ''}”的结果。尝试缩短关键词，或清除分类、风险与覆盖筛选。`
    : '当前筛选下没有结果。尝试清除筛选，或更换排序与搜索词。';

  return (
    <section
      id="all-plugins"
      tabIndex={-1}
      className="scroll-mt-24 outline-none"
      aria-labelledby="all-plugins-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="stamp">03 / INDEX</span>
            <span className="text-2xs font-medium text-content-muted">全部插件</span>
          </p>
          <h2
            id="all-plugins-title"
            tabIndex={-1}
            className="mt-1.5 scroll-mt-24 text-2xl font-semibold leading-8 tracking-title text-content-primary lg:text-3xl lg:leading-9"
          >
            插件索引
          </h2>
        </div>
        <p className="tnum text-xs text-content-secondary" aria-live="polite">
          共 {plugins.length} 个插件
          {active ? <span className="ml-2 text-content-muted">· 筛选后 {sorted.length} 个</span> : null}
        </p>
      </div>

      <div className="panel mt-4">
        <div className="border-b border-line px-4 py-3.5 md:px-5 lg:sticky lg:top-[var(--header-h)] lg:z-20 lg:bg-surface">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-0 flex-1 basis-full lg:basis-auto">
              <span className="sr-only">搜索插件</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                value={queryInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setQueryInput(value);
                  if (!composing.current) update({ query: value });
                }}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={(event) => {
                  composing.current = false;
                  update({ query: event.currentTarget.value });
                }}
                placeholder="搜索插件、用途或仓库"
                className="h-11 w-full rounded-control border border-line-control bg-surface pl-10 pr-11 text-sm text-content-primary transition-colors placeholder:text-content-muted hover:border-content-muted focus:border-content-primary"
                type="search"
                maxLength={64}
              />
              {queryInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput('');
                    update({ query: '' });
                    searchRef.current?.focus();
                  }}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-content-muted transition-colors hover:bg-surface-subtle hover:text-content-primary max-sm:h-11 max-sm:w-11"
                  aria-label="清除搜索"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <label className="sr-only" htmlFor="plugin-sort">
                排序方式
              </label>
              <div className="relative min-w-0 flex-1 sm:w-[200px] sm:flex-none">
                <ArrowDownWideNarrow
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
                  aria-hidden="true"
                />
                <select
                  id="plugin-sort"
                  className="select-field w-full appearance-none pl-8 pr-8"
                  value={state.sort}
                  onChange={(event) => update({ sort: event.target.value as SortKey })}
                  aria-label="排序方式"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted"
                  aria-hidden="true"
                />
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-control border border-line-control px-3 text-xs text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary max-sm:h-11 lg:hidden"
                aria-expanded={moreOpen}
                aria-controls="plugin-filters"
              >
                <Filter size={12} aria-hidden="true" />
                {moreOpen ? '收起筛选' : '筛选'}
                {activeCount > 0 ? (
                  <span className="tnum rounded-chip bg-surface-subtle px-1.5 font-mono text-2xs text-content-primary">
                    {activeCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <div
            id="plugin-filters"
            className={cn(
              'mt-3 flex-wrap items-center gap-2 md:flex',
              moreOpen ? 'flex' : 'hidden',
            )}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && moreOpen) {
                setMoreOpen(false);
                (event.currentTarget.previousElementSibling?.querySelector('button') as HTMLElement | null)?.focus();
              }
            }}
          >
            <span className="hidden items-center gap-1.5 text-2xs text-content-muted md:inline-flex">
              <SlidersHorizontal size={13} aria-hidden="true" />
              筛选
            </span>
            <select
              className="select-field max-md:w-full"
              value={state.category}
              onChange={(event) => update({ category: event.target.value })}
              aria-label="按分类筛选"
            >
              <option value="all">全部分类</option>
              {categories(plugins).map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
            <select
              className="select-field max-md:w-full"
              value={state.risk}
              onChange={(event) => update({ risk: event.target.value as RiskFilter })}
              aria-label="按风险等级筛选"
            >
              {RISK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div
              id="advanced-filters"
              className={cn(
                'flex-wrap items-center gap-2 lg:flex',
                moreOpen ? 'flex w-full flex-col md:w-auto md:flex-row' : 'hidden',
              )}
            >
              <select
                className="select-field max-md:w-full"
                value={state.maintenance}
                onChange={(event) => update({ maintenance: event.target.value as MaintenanceFilter })}
                aria-label="按维护状态筛选"
              >
                {MAINTENANCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field max-md:w-full"
                value={state.data}
                onChange={(event) => update({ data: event.target.value as DataFilter })}
                aria-label="按数据完整度筛选"
              >
                {DATA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field max-md:w-full"
                value={state.downloads}
                onChange={(event) => update({ downloads: event.target.value as DownloadFilter })}
                aria-label="按下载数据可用性筛选"
              >
                {DOWNLOAD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {active ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-hairline pt-3">
              <span className="text-2xs text-content-muted">已筛选 {sorted.length} / {plugins.length}</span>
              {chips.map((chip) => (
                <FilterChip key={chip.key} label={chip.label} onRemove={chip.remove} />
              ))}
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center gap-1 rounded-control border border-line-control px-3 text-xs text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary max-sm:h-11"
              >
                <X size={12} aria-hidden="true" /> 清除 {activeCount} 项
              </button>
            </div>
          ) : null}

          <p className="sr-only" aria-live="polite">
            当前筛选结果 {sorted.length} 个插件。
          </p>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            description={emptyDescription}
            action={
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center rounded-control border border-line-control px-4 text-sm text-content-primary transition-colors hover:border-content-primary hover:bg-surface-subtle max-sm:h-11"
              >
                清除全部筛选
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">插件索引，共 {sorted.length} 个结果</caption>
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[11%]" />
                  <col className="w-[14%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-12" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong bg-surface-subtle">
                    <th scope="col" className="h-10 px-4 py-2 text-2xs font-medium text-content-secondary md:px-5">
                      插件项目
                    </th>
                    <th
                      scope="col"
                      className="h-10 px-2 py-2 text-right"
                      aria-sort={state.sort === 'popularity' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'popularity'}
                        onClick={() => update({ sort: 'popularity' })}
                      >
                        人气
                      </SortButton>
                    </th>
                    <th
                      scope="col"
                      className="h-10 px-2 py-2"
                      aria-sort={state.sort === 'maintenance' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'maintenance'}
                        onClick={() => update({ sort: 'maintenance' })}
                      >
                        维护健康度
                      </SortButton>
                    </th>
                    <th scope="col" className="h-10 px-2 py-2 text-2xs font-medium text-content-secondary">
                      风险
                    </th>
                    <th
                      scope="col"
                      className="h-10 px-2 py-2"
                      aria-sort={state.sort === 'completeness' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'completeness'}
                        onClick={() => update({ sort: 'completeness' })}
                      >
                        数据覆盖
                      </SortButton>
                    </th>
                    <th
                      scope="col"
                      className="h-10 px-2 py-2"
                      aria-sort={state.sort === 'recent' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'recent'}
                        onClick={() => update({ sort: 'recent' })}
                      >
                        最近提交
                      </SortButton>
                    </th>
                    <th scope="col" className="h-10 w-12 px-1 py-2">
                      <span className="sr-only">查看详情</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-hairline">
                  {page.items.map((plugin, index) => (
                    <tr
                      key={plugin.id}
                      data-testid="plugin-row"
                      className="group transition-colors hover:bg-surface-subtle focus-within:bg-surface-subtle"
                    >
                      <td className="px-4 py-3 md:px-5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="w-5 shrink-0 font-mono text-2xs text-content-muted">
                            {String((page.page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
                          </span>
                          <PluginMonogram plugin={plugin} size="sm" />
                          <div className="min-w-0">
                            <Link
                              to={`/plugins/${encodeURIComponent(plugin.id)}`}
                              className="block truncate text-sm font-medium text-content-primary transition-colors hover:text-brand-text"
                              title={`${plugin.name} · ${plugin.repo}`}
                            >
                              {plugin.name}
                            </Link>
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-2xs text-content-secondary" title={plugin.curatorNote}>
                                {plugin.curatorNote}
                              </span>
                              <CategoryTag category={plugin.category} />
                              {plugin.repository.archived ? (
                                <span className="shrink-0 whitespace-nowrap rounded-chip border border-line px-1.5 py-0.5 text-2xs text-content-muted">
                                  已归档
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="tnum font-mono text-sm text-content-primary">
                          {formatScore(plugin.scores.popularity.score)}
                        </div>
                        <p className="mt-0.5 truncate text-2xs text-content-muted">
                          {plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                            ? `${formatCompact(plugin.npm.downloads30d)} 次/30d`
                            : '无可靠下载'}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-baseline justify-between gap-1.5">
                          <span className="tnum font-mono text-sm text-content-primary">
                            {formatScore(plugin.scores.maintenance.score)}
                          </span>
                          <span className="text-2xs text-content-muted">{scoreLabel(plugin)}</span>
                        </div>
                        <ScoreBar value={plugin.scores.maintenance.score} className="mt-1.5" />
                      </td>
                      <td className="px-2 py-3">
                        {plugin.scores.risk.level === 'low' ? (
                          <span className="text-2xs text-content-muted">未见风险</span>
                        ) : (
                          <RiskBadge level={plugin.scores.risk.level} compact />
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <DataCoverage completeness={plugin.scores.completeness} />
                        <p className="mt-1 text-2xs text-content-muted">
                          {plugin.scores.completeness.score}%
                          {plugin.dataStatus === 'stale' ? ' · 历史快照' : ''}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <span className="text-xs text-content-secondary" title={plugin.github.lastCommitAt ?? undefined}>
                          {formatRelative(plugin.github.lastCommitAt)}
                        </span>
                        <p className="mt-0.5 text-2xs text-content-muted">
                          {plugin.github.commits30d}
                          {plugin.github.commits30dTruncated ? '+' : ''} 次 / 30d
                        </p>
                      </td>
                      <td className="w-12 px-1 py-3">
                        <Link
                          to={`/plugins/${encodeURIComponent(plugin.id)}`}
                          aria-label={`查看 ${plugin.name} 详情`}
                          className="flex h-10 w-10 items-center justify-center rounded-control text-content-muted transition-colors hover:bg-surface-subtle hover:text-brand-text"
                        >
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-px bg-line md:grid-cols-2 lg:hidden">
              {page.items.map((plugin) => {
                const lowCoverage = plugin.scores.completeness.score < 85;
                return (
                  <Link
                    key={plugin.id}
                    to={`/plugins/${encodeURIComponent(plugin.id)}`}
                    data-testid="plugin-card"
                    className="block min-w-0 bg-surface px-4 py-4 transition-colors hover:bg-surface-subtle active:bg-surface-subtle"
                  >
                    <div className="flex items-start gap-3">
                      <PluginMonogram plugin={plugin} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className="line-clamp-2 break-words text-[0.9375rem] font-medium leading-[1.45] text-content-primary"
                              title={plugin.name}
                            >
                              {plugin.name}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-2xs text-content-muted" title={plugin.repo}>
                              {plugin.repo}
                            </p>
                          </div>
                          {plugin.scores.risk.level === 'low' ? (
                            <span className="shrink-0 text-2xs text-content-muted">未见风险</span>
                          ) : (
                            <RiskBadge level={plugin.scores.risk.level} compact className="shrink-0" />
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-content-secondary">{plugin.curatorNote}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <CategoryTag category={plugin.category} />
                          <span className="rounded-chip border border-line bg-surface-subtle px-1.5 py-0.5 text-2xs text-content-secondary">
                            覆盖 {plugin.scores.completeness.available}/{plugin.scores.completeness.total}
                          </span>
                          {lowCoverage ? (
                            <span className="rounded-chip border border-warning-line bg-warning-soft px-1.5 py-0.5 text-2xs text-warning">
                              覆盖偏低
                            </span>
                          ) : null}
                          {plugin.dataStatus === 'stale' ? (
                            <span className="rounded-chip border border-warning-line bg-warning-soft px-1.5 py-0.5 text-2xs text-warning">
                              历史快照
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-baseline justify-between text-2xs">
                              <span className="text-content-muted">人气</span>
                              <span className="tnum font-mono text-content-primary">
                                {formatScore(plugin.scores.popularity.score)}
                              </span>
                            </div>
                            <ScoreBar value={plugin.scores.popularity.score} className="mt-1" />
                          </div>
                          <div>
                            <div className="flex items-baseline justify-between text-2xs">
                              <span className="text-content-muted">维护</span>
                              <span className="tnum font-mono text-content-primary">
                                {formatScore(plugin.scores.maintenance.score)}
                              </span>
                            </div>
                            <ScoreBar value={plugin.scores.maintenance.score} className="mt-1" />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-content-muted">
                          <span className="inline-flex items-center gap-1">
                            {formatCompact(plugin.github.stars)} stars
                          </span>
                          <span>
                            {plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                              ? `${formatCompact(plugin.npm.downloads30d)} / 30d`
                              : '无可靠下载数据'}
                          </span>
                          <span>{formatRelative(plugin.github.lastCommitAt)}更新</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {sorted.length > 0 ? (
          <div className="border-t border-line px-4 py-3.5 md:px-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-2xs text-content-muted">
              <time className="timestamp" dateTime={lastSuccessAt ?? undefined}>
                {lastSuccessAt ? `快照 ${formatDateTime(lastSuccessAt)} · UTC+8` : '快照时间不可用'}
              </time>
              <span>所有结果来自同一份真实快照</span>
            </div>
            <Pagination
              page={page.page}
              totalPages={page.totalPages}
              total={sorted.length}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
