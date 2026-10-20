import { useMemo } from 'react';
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
import {
  formatCompact,
  formatRelative,
  formatScore,
  riskTone,
  scoreLabel,
} from '../lib/format';
import { cn } from '../lib/cn';
import {
  CategoryTag,
  DataCoverage,
  DataStatusBadge,
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
        'inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] transition',
        active ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
      )}
      aria-label={`按${String(children)}排序`}
    >
      {children}
      <ChevronDown
        size={10}
        className={cn('transition', active ? (direction === 'desc' ? '' : 'rotate-180') : 'opacity-0')}
      />
    </button>
  );
}

export function PluginExplorer({ plugins }: { plugins: PluginRecord[] }): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
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

  function update(patch: Partial<typeof state>): void {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    setSearchParams(stateToSearchParams(next), { replace: true });
  }

  function reset(): void {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <section id="all-plugins" className="panel overflow-hidden" aria-labelledby="all-plugins-title">
      <div className="border-b border-ink-700/60 px-4 py-5 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Index</p>
            <h2 id="all-plugins-title" className="mt-1 text-xl font-semibold text-ink-100">
              全部插件
            </h2>
            <p className="mt-1.5 text-[11px] leading-5 text-ink-400">
              可以按项目名称、描述、维护状态、风险与数据完整程度检索。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="plugin-sort">
              排序方式
            </label>
            <div className="relative">
              <ArrowDownWideNarrow
                size={12}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <select
                id="plugin-sort"
                className="select-field appearance-none pl-7 pr-7"
                value={state.sort}
                onChange={(event) => update({ sort: event.target.value as SortKey })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">搜索插件</span>
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              value={state.query}
              onChange={(event) => update({ query: event.target.value })}
              placeholder="搜索名称、描述、仓库、语言、分类…"
              className="h-9 w-full rounded-md border border-ink-700 bg-ink-900 pl-9 pr-9 text-xs text-ink-100 placeholder:text-ink-500 outline-none transition hover:border-ink-500 focus:border-signal"
              type="search"
            />
            {state.query ? (
              <button
                type="button"
                onClick={() => update({ query: '' })}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                aria-label="清除搜索"
              >
                <X size={12} />
              </button>
            ) : null}
          </label>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-ink-400">
              <SlidersHorizontal size={11} />
              筛选
            </span>
            {active ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-ink-700 px-2.5 text-[10px] text-ink-300 transition hover:border-ink-500 hover:text-ink-100"
              >
                <X size={10} /> 清除 {activeCount} 项
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
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
          {active ? (
            <span className="inline-flex items-center gap-1.5 rounded border border-signal/20 bg-signal/5 px-2 text-[10px] text-signal-strong">
              <Filter size={10} /> 已筛选 {sorted.length} / {plugins.length}
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
              className="rounded-md border border-ink-700 px-3 py-2 text-xs text-ink-200 hover:border-ink-500"
            >
              清除全部筛选
            </button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-700/60 bg-ink-900/40">
                  <th scope="col" className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400 md:px-5">
                    插件项目
                  </th>
                  <th scope="col" className="px-2 py-2.5" aria-sort={state.sort === 'popularity' ? 'descending' : 'none'}>
                    <SortButton active={state.sort === 'popularity'} direction="desc" onClick={() => update({ sort: 'popularity' })}>
                      人气
                    </SortButton>
                  </th>
                  <th scope="col" className="px-2 py-2.5" aria-sort={state.sort === 'maintenance' ? 'descending' : 'none'}>
                    <SortButton active={state.sort === 'maintenance'} direction="desc" onClick={() => update({ sort: 'maintenance' })}>
                      维护健康度
                    </SortButton>
                  </th>
                  <th scope="col" className="px-2 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400">
                    风险
                  </th>
                  <th scope="col" className="px-2 py-2.5" aria-sort={state.sort === 'completeness' ? 'descending' : 'none'}>
                    <SortButton active={state.sort === 'completeness'} direction="desc" onClick={() => update({ sort: 'completeness' })}>
                      数据覆盖
                    </SortButton>
                  </th>
                  <th scope="col" className="px-2 py-2.5" aria-sort={state.sort === 'recent' ? 'descending' : 'none'}>
                    <SortButton active={state.sort === 'recent'} direction="desc" onClick={() => update({ sort: 'recent' })}>
                      最近提交
                    </SortButton>
                  </th>
                  <th scope="col" className="w-8 px-2 py-2.5">
                    <span className="sr-only">查看详情</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40">
                {page.items.map((plugin, index) => (
                  <tr key={plugin.id} className="group transition hover:bg-ink-800/30">
                    <td className="px-4 py-3 md:px-5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-5 shrink-0 font-mono text-[9px] text-ink-500">
                          {String((page.page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
                        </span>
                        <PluginMonogram plugin={plugin} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/plugins/${encodeURIComponent(plugin.id)}`}
                            className="block max-w-[330px] truncate text-xs font-medium text-ink-100 transition hover:text-signal-strong"
                            title={plugin.repository.description ?? plugin.name}
                          >
                            {plugin.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="max-w-[180px] truncate font-mono text-[9px] text-ink-500">
                              {plugin.repo}
                            </span>
                            <CategoryTag category={plugin.category} />
                            {plugin.repository.archived ? (
                              <span className="rounded border border-rose/20 px-1 py-0.5 text-[9px] text-rose">
                                已归档
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="tnum font-mono text-xs text-ink-100">
                            {formatScore(plugin.scores.popularity.score)}
                          </div>
                          <p className="mt-0.5 max-w-[130px] truncate text-[9px] text-ink-500">
                            {plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                              ? `${formatCompact(plugin.npm.downloads30d)} downloads`
                              : '无可靠下载'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-[82px]">
                          <div className="flex items-baseline justify-between">
                            <span className="tnum font-mono text-xs text-ink-100">
                              {formatScore(plugin.scores.maintenance.score)}
                            </span>
                            <span className="text-[9px] text-ink-500">{scoreLabel(plugin)}</span>
                          </div>
                          <ScoreBar value={plugin.scores.maintenance.score} className="mt-1" />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <RiskBadge level={plugin.scores.risk.level} compact />
                    </td>
                    <td className="px-2 py-3">
                      <DataCoverage completeness={plugin.scores.completeness} />
                      <p className="mt-1 text-[9px] text-ink-500">
                        {plugin.scores.completeness.score}% · {plugin.dataStatus === 'complete' ? '当前' : plugin.dataStatus === 'partial' ? '部分' : '回退'}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <span className="text-[10px] text-ink-300" title={plugin.github.lastCommitAt ?? undefined}>
                        {formatRelative(plugin.github.lastCommitAt)}
                      </span>
                      <p className="mt-0.5 text-[9px] text-ink-500">
                        {plugin.github.commits30d}
                        {plugin.github.commits30dTruncated ? '+' : ''} 次 / 30d
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        to={`/plugins/${encodeURIComponent(plugin.id)}`}
                        aria-label={`查看 ${plugin.name} 详情`}
                        className="flex h-7 w-7 items-center justify-center rounded text-ink-500 transition group-hover:bg-ink-700/50 group-hover:text-ink-200"
                      >
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-ink-700/50 md:hidden">
            {page.items.map((plugin) => {
              const tone = riskTone(plugin.scores.risk.level);
              return (
                <Link
                  key={plugin.id}
                  to={`/plugins/${encodeURIComponent(plugin.id)}`}
                  className="block px-4 py-4 transition active:bg-ink-800/50"
                >
                  <div className="flex items-start gap-2.5">
                    <PluginMonogram plugin={plugin} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-100">{plugin.name}</p>
                          <p className="mt-0.5 truncate font-mono text-[9px] text-ink-500">{plugin.repo}</p>
                        </div>
                        <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px]', tone.border, tone.bg, tone.text)}>
                          {plugin.scores.risk.label}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-ink-400">人气</span>
                            <span className="tnum font-mono text-ink-100">{formatScore(plugin.scores.popularity.score)}</span>
                          </div>
                          <ScoreBar value={plugin.scores.popularity.score} className="mt-1 h-1" />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-ink-400">维护</span>
                            <span className="tnum font-mono text-ink-100">{formatScore(plugin.scores.maintenance.score)}</span>
                          </div>
                          <ScoreBar value={plugin.scores.maintenance.score} className="mt-1 h-1" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[9px] text-ink-400">
                        <span className="inline-flex items-center gap-1">
                          {formatCompact(plugin.github.stars)} stars
                        </span>
                        <span>
                          {plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                            ? `${formatCompact(plugin.npm.downloads30d)} / 30d`
                            : '无可靠下载数据'}
                        </span>
                        <span>{formatRelative(plugin.github.lastCommitAt)}</span>
                        <span className="ml-auto inline-flex items-center gap-1">
                          <DataStatusBadge status={plugin.dataStatus} />
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
        <div className="border-t border-ink-700/60 px-4 py-3.5 md:px-5">
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            total={sorted.length}
            onPageChange={(nextPage) => update({ page: nextPage })}
          />
        </div>
      ) : null}
    </section>
  );
}
