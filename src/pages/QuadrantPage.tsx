import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Crosshair, SlidersHorizontal } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { QuadrantChart, QUADRANTS, quadrantCounts } from '../components/charts/QuadrantChart';
import { categoryLabel } from '../lib/types';
import { categories } from '../lib/filters';
import { hasQuadrantData, quadrantOf } from '../lib/scoring';
import { formatCompact, formatScore, riskLabel, scoreLabel } from '../lib/format';
import { cn } from '../lib/cn';
import {
  CategoryTag,
  PluginMonogram,
  RiskBadge,
  ScoreBar,
  SectionHeading,
} from '../components/ui';

type QuadrantKey = keyof typeof QUADRANTS;
type Focus = 'all' | QuadrantKey;
type Sort = 'popularity' | 'maintenance' | 'completeness' | 'name';

const FOCUS_KEYS = ['hot-healthy', 'niche-active', 'hot-watch', 'quiet'] as const;

const QUADRANT_DOT: Record<QuadrantKey, string> = {
  'hot-healthy': 'bg-series-maintenance',
  'niche-active': 'bg-content-secondary',
  'hot-watch': 'bg-content-muted',
  quiet: 'bg-content-disabled',
};

const QUADRANT_CHART_HEIGHT = { mobile: 340, tablet: 420, desktop: 460, wide: 520 } as const;

export function QuadrantPage(): JSX.Element {
  const { latest } = useLoadedData();
  const breakpoint = useBreakpoint();
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [focus, setFocus] = useState<Focus>('all');
  const [sort, setSort] = useState<Sort>('popularity');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const positioned = useMemo(() => latest.plugins.filter(hasQuadrantData), [latest.plugins]);
  const candidates = useMemo(
    () =>
      latest.plugins.filter((plugin) => {
        if (category !== 'all' && plugin.category !== category) return false;
        if (risk !== 'all' && plugin.scores.risk.level !== risk) return false;
        return true;
      }),
    [latest.plugins, category, risk],
  );
  const unpositionedCandidates = useMemo(
    () => candidates.filter((plugin) => !hasQuadrantData(plugin)),
    [candidates],
  );
  const filtered = useMemo(
    () =>
      candidates.filter((plugin) => {
        if (!hasQuadrantData(plugin)) return false;
        if (focus !== 'all') {
          const key = quadrantOf(
            plugin.scores.popularity.score ?? 0,
            plugin.scores.maintenance.score ?? 0,
          );
          if (key !== focus) return false;
        }
        return true;
      }),
    [candidates, focus],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      if (sort === 'completeness') return b.scores.completeness.score - a.scores.completeness.score;
      return (b.scores[sort].score ?? 0) - (a.scores[sort].score ?? 0);
    });
    return copy;
  }, [filtered, sort]);

  const counts = useMemo(() => quadrantCounts(latest.plugins), [latest.plugins]);
  const activeFilterCount =
    Number(category !== 'all') + Number(risk !== 'all') + Number(sort !== 'popularity');

  function clearFilters(): void {
    setCategory('all');
    setRisk('all');
    setFocus('all');
    setSort('popularity');
  }

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="stamp">DISTRIBUTION / 02</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-[1.15] tracking-tightest text-content-primary md:text-[2.5rem] lg:text-[2.5rem]">
            人气 × 维护四象限
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-content-secondary">
            每个点是一个插件；横轴为人气指数，纵轴为维护健康度，气泡面积近似 Star 量级。阈值只用于组织视图，不是质量及格线。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <p className="tnum font-mono text-2xl font-semibold text-content-primary">
              {positioned.length}
              <span className="text-sm text-content-muted"> / {latest.plugins.length}</span>
            </p>
            <p className="text-2xs text-content-muted">可定位</p>
          </div>
          <div>
            <p className="tnum font-mono text-2xl font-semibold text-content-primary">
              {latest.plugins.length - positioned.length}
            </p>
            <p className="text-2xs text-content-muted">未定位</p>
          </div>
          <p className="max-w-[14rem] text-xs leading-5 text-content-muted">
            缺少可靠下载或维护证据的插件不会被强行放入象限。
          </p>
        </div>
      </div>

      <div className="data-band mt-6 lg:sticky lg:top-[var(--header-h)] lg:z-20 lg:bg-canvas/95 lg:backdrop-blur-sm">
        <div className="flex flex-col gap-3 px-4 py-3 md:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="按象限筛选">
            <button
              type="button"
              onClick={() => setFocus('all')}
              aria-pressed={focus === 'all'}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center rounded-control border px-3 text-xs transition-colors max-sm:min-h-11',
                focus === 'all'
                  ? 'border-brand-line bg-brand-soft text-brand-text'
                  : 'border-transparent text-content-secondary hover:bg-surface-subtle hover:text-content-primary',
              )}
            >
              全部
              <span className="ml-1.5 font-mono text-content-muted">{positioned.length}</span>
            </button>
            {FOCUS_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFocus(focus === key ? 'all' : key)}
                aria-pressed={focus === key}
                className={cn(
                  'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control border px-3 text-xs transition-colors max-sm:min-h-11',
                  focus === key
                    ? 'border-brand-line bg-brand-soft text-brand-text'
                    : 'border-transparent text-content-secondary hover:bg-surface-subtle hover:text-content-primary',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-[1px]', QUADRANT_DOT[key])} aria-hidden="true" />
                {QUADRANTS[key].label}
                <span className="font-mono text-content-muted">{counts[key]}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-1.5 rounded-control border border-line-control px-3 text-xs text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary max-sm:h-11 md:hidden"
              aria-expanded={filtersOpen}
              aria-controls="quadrant-filters"
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              {filtersOpen ? '收起筛选' : '筛选'}
              {activeFilterCount > 0 ? (
                <span className="tnum rounded-chip bg-surface-subtle px-1.5 font-mono text-2xs">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <div
              id="quadrant-filters"
              className={cn(
                'flex-wrap items-center gap-2 border-t border-line-hairline pt-3 md:flex md:border-t-0 md:pt-0 xl:border-l xl:border-line-hairline xl:pl-4',
                filtersOpen ? 'flex w-full' : 'hidden',
              )}
            >
              <select
                className="select-field max-sm:w-full"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="按分类筛选"
              >
                <option value="all">全部分类</option>
                {categories(latest.plugins).map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item)}
                  </option>
                ))}
              </select>
              <select
                className="select-field max-sm:w-full"
                value={risk}
                onChange={(event) => setRisk(event.target.value)}
                aria-label="按风险筛选"
              >
                <option value="all">全部风险</option>
                <option value="high">高风险信号</option>
                <option value="medium">需要关注</option>
                <option value="low">未见公开风险</option>
                <option value="unknown">信息不完整</option>
              </select>
              <select
                className="select-field max-sm:w-full"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                aria-label="列表排序"
              >
                <option value="popularity">按人气</option>
                <option value="maintenance">按维护</option>
                <option value="completeness">按数据覆盖</option>
                <option value="name">按名称</option>
              </select>
              {category !== 'all' || risk !== 'all' || focus !== 'all' || sort !== 'popularity' ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-10 items-center rounded-control px-2 text-xs text-content-secondary underline-offset-4 hover:text-brand-text hover:underline max-sm:h-11"
                >
                  清除筛选
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <section className="panel mt-4 overflow-hidden" aria-label="四象限图与定位插件列表">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-5">
              <div className="flex min-w-0 items-center gap-2 text-xs text-content-secondary">
                <Crosshair size={14} className="text-content-muted" aria-hidden="true" />
                <span className="font-medium text-content-primary">
                  {focus === 'all' ? '全部可定位插件' : QUADRANTS[focus].label}
                </span>
                <span className="text-line-strong" aria-hidden="true">·</span>
                <span>{sorted.length} 个</span>
              </div>
              <span className="text-2xs text-content-muted">X 人气 0–100 · Y 维护 0–100</span>
            </div>
            <div className="min-w-0 px-1 pb-1 md:px-2">
              <QuadrantChart
                plugins={filtered}
                unpositionedPlugins={unpositionedCandidates}
                totalCount={latest.plugins.length}
                height={QUADRANT_CHART_HEIGHT[breakpoint]}
                ariaLabel="可筛选的 DSH 插件四象限散点图"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-2xs text-content-muted md:px-5">
              <span>悬停 / 点按查看概要 · 点按气泡进入详情</span>
              <span className="text-content-secondary">固定 0–100 轴，筛选不会重新缩放</span>
            </div>
          </div>

          <aside
            className="flex min-h-0 flex-col border-t border-line xl:border-l xl:border-t-0"
            aria-label="象限内插件列表"
          >
            <div className="border-b border-line px-4 py-3.5">
              <p className="stamp">CURRENT VIEW</p>
              <h2 className="mt-1 text-lg font-semibold tracking-title text-content-primary">当前视图 · 定位插件</h2>
              <p className="mt-1 text-2xs leading-5 text-content-secondary">
                无可靠下载或维护证据不足的插件不在此列表。
              </p>
            </div>
            {sorted.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <p className="text-sm leading-6 text-content-secondary">当前筛选下没有可定位插件。</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-10 items-center rounded-control border border-line-control px-3 text-xs text-content-primary transition-colors hover:bg-surface-subtle max-sm:h-11"
                  >
                    清除筛选
                  </button>
                  <a
                    href="#unpositioned-plugins"
                    className="text-xs text-content-secondary underline underline-offset-4 hover:text-brand-text"
                  >
                    查看未定位清单
                  </a>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 xl:max-h-[640px] xl:overflow-y-auto">
                <ul className="divide-y divide-line-hairline">
                  {sorted.map((plugin) => (
                    <li key={plugin.id}>
                      <Link
                        to={`/plugins/${encodeURIComponent(plugin.id)}`}
                        className="group block px-4 py-3 transition-colors hover:bg-surface-subtle"
                      >
                        <div className="flex items-center gap-2.5">
                          <PluginMonogram plugin={plugin} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-content-primary transition-colors group-hover:text-brand-text">
                              {plugin.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <CategoryTag category={plugin.category} />
                              <span className="text-2xs text-content-muted">{scoreLabel(plugin)}</span>
                            </div>
                          </div>
                          <ArrowUpRight
                            size={14}
                            className="text-content-muted transition-colors group-hover:text-brand-text"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex justify-between text-2xs">
                              <span className="text-content-muted">人气</span>
                              <span className="tnum font-mono text-content-primary">
                                {formatScore(plugin.scores.popularity.score)}
                              </span>
                            </div>
                            <ScoreBar value={plugin.scores.popularity.score} className="mt-1" />
                          </div>
                          <div>
                            <div className="flex justify-between text-2xs">
                              <span className="text-content-muted">维护</span>
                              <span className="tnum font-mono text-content-primary">
                                {formatScore(plugin.scores.maintenance.score)}
                              </span>
                            </div>
                            <ScoreBar value={plugin.scores.maintenance.score} className="mt-1" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-2xs text-content-muted">
                          <span>{formatCompact(plugin.github.stars)} stars</span>
                          <span className="flex items-center gap-1.5">
                            {plugin.scores.risk.level === 'low' ? (
                              <span>{riskLabel(plugin.scores.risk.level)}</span>
                            ) : (
                              <RiskBadge level={plugin.scores.risk.level} compact />
                            )}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="quadrant-reading-title">
        <SectionHeading
          eyebrow="HOW TO READ"
          title={<span id="quadrant-reading-title">如何读这张图</span>}
          description="象限只帮助组织观察，不替你做出“应该安装”的决定。"
        />
        <div className="data-band mt-4">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-hairline md:grid-cols-4 md:divide-y-0">
            {FOCUS_KEYS.map((key) => (
              <div key={key} className="min-w-0 px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-content-primary">
                    <span className={cn('h-1.5 w-1.5 rounded-[1px]', QUADRANT_DOT[key])} aria-hidden="true" />
                    {QUADRANTS[key].label}
                  </span>
                  <span className="tnum font-mono text-lg text-content-secondary">{counts[key]}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-content-secondary">{QUADRANTS[key].description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
