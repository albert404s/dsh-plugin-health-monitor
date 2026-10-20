import { useMemo, useState } from 'react';
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
import { formatCompact, formatRelative, formatScore, scoreLabel } from '../lib/format';
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
  { value: 'all', label: '维护状态：全部' },
  { value: 'active', label: '维护活跃' },
  { value: 'steady', label: '平稳' },
  { value: 'slow', label: '放缓' },
  { value: 'insufficient', label: '信息不足' },
];

const RISK_OPTIONS: Array<{ value: RiskFilter; label: string }> = [
  { value: 'all', label: '风险：全部' },
  { value: 'high', label: '高风险信号' },
  { value: 'medium', label: '需要关注' },
  { value: 'unknown', label: '信息不完整' },
  { value: 'low', label: '未见公开风险记录' },
];

const DATA_OPTIONS: Array<{ value: DataFilter; label: string }> = [
  { value: 'all', label: '数据覆盖：全部' },
  { value: 'high', label: '覆盖 ≥ 85%' },
  { value: 'medium', label: '覆盖 55–84%' },
  { value: 'low', label: '覆盖 < 55%' },
];

const DOWNLOAD_OPTIONS: Array<{ value: DownloadFilter; label: string }> = [
  { value: 'all', label: '下载数据：全部' },
  { value: 'available', label: '有可靠 npm 下载' },
  { value: 'missing', label: '无可靠下载数据' },
];

function SortButton({
  active,
  direction,
  children,
  onClick,
}: {
  active: boolean;
  direction: 'asc' | 'desc';
  children: React.ReactNode;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-2xs font-medium transition',
        active ? 'text-content-primary' : 'text-content-secondary hover:text-content-primary',
      )}
      aria-label={`按${String(children)}排序`}
    >
      {children}
      <ChevronDown
        size={11}
        className={cn('transition', active ? (direction === 'desc' ? '' : 'rotate-180') : 'opacity-0')}
      />
    </button>
  );
}

export function PluginExplorer({ plugins }: { plugins: PluginRecord[] }): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const state = useMemo(() => stateFromSearchParams(searchParams), [searchParams]);
  const filtered = useMemo(() => filterPlugins(plugins, state), [plugins, state]);
  const sorted = useMemo(() => sortPlugins(filtered, state.sort), [filtered, state.sort]);
  const page = paginate(sorted, state.page);
  const active = hasActiveFilters(state);
  const activeCount = [
    state.query,
    state.category !== 'all',
    state.maintenance !== 'all',
    state.risk !== 'all',
    state.data !== 'all',
    state.downloads !== 'all',
  ].filter(Boolean).length;
  const advancedCount = [state.maintenance !== 'all', state.data !== 'all', state.downloads !== 'all'].filter(
    Boolean,
  ).length;

  function update(patch: Partial<typeof state>): void {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    setSearchParams(stateToSearchParams(next), { replace: true });
  }

  function reset(): void {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <section id="all-plugins" className="scroll-mt-24" aria-labelledby="all-plugins-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Index</p>
          <h2 id="all-plugins-title" className="mt-1.5 text-2xl font-semibold leading-8 tracking-display text-content-primary">
            全部插件
          </h2>
          <p className="mt-1.5 text-sm text-content-secondary">
            按名称、中文用途、仓库、维护状态、风险与数据覆盖检索；所有结果来自同一份真实快照。
          </p>
        </div>
        <p className="tnum text-sm text-content-secondary" aria-live="polite">
          共 {plugins.length} 个插件
          {active ? <span className="ml-2 text-content-muted">· 筛选后 {sorted.length} 个</span> : null}
        </p>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="border-b border-line px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-0 flex-1 basis-full sm:basis-auto">
              <span className="sr-only">搜索插件</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
              />
              <input
                value={state.query}
                onChange={(event) => update({ query: event.target.value })}
                placeholder="搜索名称、用途、仓库、语言、分类…"
                className="h-11 w-full rounded-control border border-line-strong bg-surface pl-10 pr-10 text-sm text-content-primary outline-none transition placeholder:text-content-muted hover:border-content-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
                type="search"
              />
              {state.query ? (
                <button
                  type="button"
                  onClick={() => update({ query: '' })}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-content-muted hover:bg-surface-subtle hover:text-content-primary"
                  aria-label="清除搜索"
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="plugin-sort">
                排序方式
              </label>
              <div className="relative">
                <ArrowDownWideNarrow
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
                />
                <select
                  id="plugin-sort"
                  className="select-field w-full appearance-none pl-8 pr-8 sm:w-auto"
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
                />
              </div>
              {active ? (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex h-10 items-center gap-1 rounded-control border border-line-strong px-3 text-xs text-content-secondary transition hover:border-content-muted hover:text-content-primary max-sm:h-11"
                >
                  <X size={12} /> 清除 {activeCount} 项
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-2xs text-content-muted">
              <SlidersHorizontal size={13} />
              筛选
            </span>
            <select
              className="select-field"
              value={state.category}
              onChange={(event) => update({ category: event.target.value })}
              aria-label="按分类筛选"
            >
              <option value="all">分类：全部</option>
              {categories(plugins).map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
            <select
              className="select-field"
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
              className={cn('flex flex-wrap items-center gap-2', moreOpen ? 'flex' : 'hidden', 'md:flex')}
            >
              <select
                className="select-field"
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
                className="select-field"
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
                className="select-field"
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
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-1 rounded-control border border-line-strong px-3 text-xs text-content-secondary transition hover:border-content-muted hover:text-content-primary max-sm:h-11 md:hidden"
              aria-expanded={moreOpen}
              aria-controls="advanced-filters"
            >
              <Filter size={12} /> 更多筛选
              {advancedCount > 0 ? (
                <span className="rounded-chip bg-accent-soft px-1.5 text-2xs text-accent-active">{advancedCount}</span>
              ) : null}
            </button>
            {active ? (
              <span className="inline-flex items-center gap-1.5 rounded-chip border border-accent-line bg-accent-soft px-2 py-1 text-2xs text-accent-active">
                <Filter size={12} /> 已筛选 {sorted.length} / {plugins.length}
              </span>
            ) : null}
          </div>
          <p className="sr-only" aria-live="polite">
            当前筛选结果 {sorted.length} 个插件。
          </p>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            description="尝试缩短搜索词，或清除分类、维护状态与数据覆盖筛选。"
            action={
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center rounded-control border border-line-strong px-4 text-sm text-content-primary transition hover:border-content-muted max-sm:h-11"
              >
                清除全部筛选
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[38%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[2%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-surface-subtle">
                    <th scope="col" className="px-4 py-2.5 text-2xs font-medium text-content-secondary md:px-5">
                      插件项目
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5 text-right"
                      aria-sort={state.sort === 'popularity' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'popularity'}
                        direction="desc"
                        onClick={() => update({ sort: 'popularity' })}
                      >
                        人气
                      </SortButton>
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5"
                      aria-sort={state.sort === 'maintenance' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'maintenance'}
                        direction="desc"
                        onClick={() => update({ sort: 'maintenance' })}
                      >
                        维护健康度
                      </SortButton>
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-2xs font-medium text-content-secondary">
                      风险
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5"
                      aria-sort={state.sort === 'completeness' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'completeness'}
                        direction="desc"
                        onClick={() => update({ sort: 'completeness' })}
                      >
                        数据覆盖
                      </SortButton>
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2.5"
                      aria-sort={state.sort === 'recent' ? 'descending' : 'none'}
                    >
                      <SortButton
                        active={state.sort === 'recent'}
                        direction="desc"
                        onClick={() => update({ sort: 'recent' })}
                      >
                        最近提交
                      </SortButton>
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      <span className="sr-only">查看详情</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-hairline">
                  {page.items.map((plugin, index) => (
                    <tr
                      key={plugin.id}
                      data-testid="plugin-row"
                      className="group transition hover:bg-surface-subtle"
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
                              className="block truncate text-sm font-medium text-content-primary transition hover:text-accent"
                              title={`${plugin.repo}${plugin.repository.description ? ` · ${plugin.repository.description}` : ''}`}
                            >
                              {plugin.name}
                            </Link>
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                              <span className="truncate text-xs text-content-secondary" title={plugin.curatorNote}>
                                {plugin.curatorNote}
                              </span>
                              <CategoryTag category={plugin.category} />
                              {plugin.repository.archived ? (
                                <span className="shrink-0 rounded-chip border border-danger-line px-1.5 py-0.5 text-2xs text-danger">
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
                        <div className="flex items-baseline justify-between gap-2">
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
                      <td className="px-2 py-3">
                        <Link
                          to={`/plugins/${encodeURIComponent(plugin.id)}`}
                          aria-label={`查看 ${plugin.name} 详情`}
                          className="flex h-10 w-10 items-center justify-center rounded-control text-content-muted transition group-hover:bg-accent-soft group-hover:text-accent"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line-hairline lg:hidden">
              {page.items.map((plugin) => {
                const lowCoverage = plugin.scores.completeness.score < 85;
                return (
                  <Link
                    key={plugin.id}
                    to={`/plugins/${encodeURIComponent(plugin.id)}`}
                    data-testid="plugin-card"
                    className="block px-4 py-4 transition active:bg-surface-subtle"
                  >
                    <div className="flex items-start gap-3">
                      <PluginMonogram plugin={plugin} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-base font-medium text-content-primary" title={plugin.name}>
                              {plugin.name}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-xs text-content-muted" title={plugin.repo}>
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
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <CategoryTag category={plugin.category} />
                          {lowCoverage ? (
                            <span className="rounded-chip border border-warning-line bg-warning-soft px-1.5 py-0.5 text-2xs text-warning">
                              数据覆盖 {plugin.scores.completeness.available}/{plugin.scores.completeness.total}
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
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-content-muted">人气</span>
                              <span className="tnum font-mono text-content-primary">
                                {formatScore(plugin.scores.popularity.score)}
                              </span>
                            </div>
                            <ScoreBar value={plugin.scores.popularity.score} className="mt-1" />
                          </div>
                          <div>
                            <div className="flex items-baseline justify-between text-xs">
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
                          <span className="ml-auto inline-flex items-center gap-1">
                            <DataCoverage completeness={plugin.scores.completeness} showSegments={false} />
                          </span>
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
            <Pagination
              page={page.page}
              totalPages={page.totalPages}
              total={sorted.length}
              onPageChange={(nextPage) => update({ page: nextPage })}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
