import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Crosshair, Info, SlidersHorizontal } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import { QuadrantChart, QUADRANTS } from '../components/charts/QuadrantChart';
import { categoryLabel, type PluginRecord } from '../lib/types';
import { categories } from '../lib/filters';
import { hasQuadrantData, quadrantOf } from '../lib/scoring';
import {
  formatCompact,
  formatScore,
  riskLabel,
  scoreLabel,
} from '../lib/format';
import { cn } from '../lib/cn';
import {
  CategoryTag,
  DataCoverage,
  PluginMonogram,
  RiskBadge,
  ScoreBar,
  SectionHeading,
} from '../components/ui';

type QuadrantKey = keyof typeof QUADRANTS;
type Focus = 'all' | QuadrantKey;
type Sort = 'popularity' | 'maintenance' | 'completeness' | 'name';

export function QuadrantPage(): JSX.Element {
  const { latest } = useLoadedData();
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [focus, setFocus] = useState<Focus>('all');
  const [sort, setSort] = useState<Sort>('popularity');

  const positioned = useMemo(() => latest.plugins.filter(hasQuadrantData), [latest.plugins]);
  const filtered = useMemo(
    () =>
      positioned.filter((plugin) => {
        if (category !== 'all' && plugin.category !== category) return false;
        if (risk !== 'all' && plugin.scores.risk.level !== risk) return false;
        if (focus !== 'all') {
          const key = quadrantOf(
            plugin.scores.popularity.score ?? 0,
            plugin.scores.maintenance.score ?? 0,
          );
          if (key !== focus) return false;
        }
        return true;
      }),
    [positioned, category, risk, focus],
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

  const counts = useMemo(() => {
    const result: Record<QuadrantKey, number> = {
      'hot-healthy': 0,
      'hot-watch': 0,
      'niche-active': 0,
      quiet: 0,
    };
    for (const plugin of positioned) {
      result[
        quadrantOf(plugin.scores.popularity.score ?? 0, plugin.scores.maintenance.score ?? 0)
      ] += 1;
    }
    return result;
  }, [positioned]);

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-12 pt-8 md:px-6 md:pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Distribution</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-100 md:text-4xl">
            人气与健康度
            <span className="text-ink-400">四象限</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">
            每个点是一个插件。横轴为人气指数，纵轴为维护健康度，气泡面积近似 Star 量级。
            分界是组织视图的相对阈值，不是行业标准，也不代表质量及格线。
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-md border border-ink-700/70 bg-ink-900/40 px-4 py-3">
          <div>
            <p className="tnum font-mono text-xl text-ink-100">
              {positioned.length}
              <span className="text-xs text-ink-500"> / {latest.plugins.length}</span>
            </p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-ink-500">可定位</p>
          </div>
          <div className="h-8 w-px bg-ink-700" />
          <div>
            <p className="tnum font-mono text-xl text-amber">{latest.plugins.length - positioned.length}</p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-ink-500">数据不足</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-2 rounded-lg border border-ink-700/60 bg-ink-900/40 p-2 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFocus('all')}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-[10px] transition',
              focus === 'all'
                ? 'border-signal/40 bg-signal/10 text-ink-100'
                : 'border-transparent text-ink-400 hover:bg-ink-800/60 hover:text-ink-200',
            )}
          >
            全部 {positioned.length}
          </button>
          {(Object.keys(QUADRANTS) as QuadrantKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFocus(focus === key ? 'all' : key)}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-[10px] transition',
                focus === key
                  ? 'border-signal/40 bg-signal/10 text-ink-100'
                  : 'border-transparent text-ink-400 hover:bg-ink-800/60 hover:text-ink-200',
              )}
            >
              {QUADRANTS[key].label}
              <span className="ml-1.5 font-mono text-ink-500">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-2 md:border-l md:border-t-0 md:pl-2 md:pt-0">
          <SlidersHorizontal size={11} className="text-ink-500" />
          <select
            className="select-field h-8"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="按分类筛选"
          >
            <option value="all">分类：全部</option>
            {categories(latest.plugins).map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item)}
              </option>
            ))}
          </select>
          <select
            className="select-field h-8"
            value={risk}
            onChange={(event) => setRisk(event.target.value)}
            aria-label="按风险筛选"
          >
            <option value="all">风险：全部</option>
            <option value="high">高风险信号</option>
            <option value="medium">需要关注</option>
            <option value="low">未见公开风险记录</option>
            <option value="unknown">信息不完整</option>
          </select>
          <select
            className="select-field h-8"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label="列表排序"
          >
            <option value="popularity">按人气</option>
            <option value="maintenance">按维护</option>
            <option value="completeness">按数据覆盖</option>
            <option value="name">按名称</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3 md:px-5">
            <div className="flex items-center gap-2 text-[11px] text-ink-300">
              <Crosshair size={13} className="text-signal" />
              {focus === 'all' ? '全部可定位插件' : QUADRANTS[focus].label}
              <span className="text-ink-500">·</span>
              <span className="text-ink-400">{sorted.length} 个</span>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
              X: popularity / Y: maintenance
            </span>
          </div>
          <div className="px-1 pb-2 md:px-2">
            <QuadrantChart
              plugins={filtered}
              height={560}
              ariaLabel="可筛选的 DSH 插件四象限散点图"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-700/60 px-4 py-2.5 text-[9px] text-ink-500 md:px-5">
            <span>悬停查看概要 · 点击进入详情</span>
            <span>固定 0–100 轴，筛选不会重新缩放</span>
            <span className="ml-auto max-w-md text-right">
              象限：{focus === 'all' ? '全部分区' : QUADRANTS[focus].description}
            </span>
          </div>
        </section>

        <section className="panel flex max-h-[760px] min-h-[420px] flex-col overflow-hidden" aria-label="象限内插件列表">
          <div className="border-b border-ink-700/60 px-4 py-3.5">
            <p className="eyebrow">Inside the view</p>
            <h2 className="mt-1 text-sm font-semibold text-ink-100">定位插件</h2>
            <p className="mt-1 text-[10px] leading-4 text-ink-400">
              按所选指标排序；无可靠下载或维护证据不足的插件不在此列表。
            </p>
          </div>
          {sorted.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <p className="text-xs leading-5 text-ink-400">
                当前筛选下没有可定位插件。清除筛选或查看下方未定位清单。
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="divide-y divide-ink-700/50">
                {sorted.map((plugin) => (
                  <li key={plugin.id}>
                    <Link
                      to={`/plugins/${encodeURIComponent(plugin.id)}`}
                      className="group block px-4 py-3 transition hover:bg-ink-800/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <PluginMonogram plugin={plugin} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink-100 group-hover:text-white">
                            {plugin.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <CategoryTag category={plugin.category} />
                            <span className="text-[9px] text-ink-500">{scoreLabel(plugin)}</span>
                          </div>
                        </div>
                        <ArrowUpRight size={12} className="text-ink-600 transition group-hover:text-ink-200" />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[9px]">
                            <span className="text-ink-500">人气</span>
                            <span className="tnum font-mono text-ink-200">
                              {formatScore(plugin.scores.popularity.score)}
                            </span>
                          </div>
                          <ScoreBar value={plugin.scores.popularity.score} className="mt-1 h-1" />
                        </div>
                        <div>
                          <div className="flex justify-between text-[9px]">
                            <span className="text-ink-500">维护</span>
                            <span className="tnum font-mono text-ink-200">
                              {formatScore(plugin.scores.maintenance.score)}
                            </span>
                          </div>
                          <ScoreBar value={plugin.scores.maintenance.score} className="mt-1 h-1" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] text-ink-500">
                        <span>{formatCompact(plugin.github.stars)} stars</span>
                        <span>{riskLabel(plugin.scores.risk.level)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="mt-8">
        <SectionHeading
          eyebrow="Reading the map"
          title="如何读这张图"
          description="象限只帮助组织观察，不替你做出“应该安装”的决定。"
        />
        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-ink-700/70 bg-ink-700/60 md:grid-cols-4">
          {(Object.keys(QUADRANTS) as QuadrantKey[]).map((key) => (
            <div key={key} className="bg-ink-850/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-100">{QUADRANTS[key].label}</span>
                <span className="tnum font-mono text-sm text-ink-400">{counts[key]}</span>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-ink-400">{QUADRANTS[key].description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-start gap-2 rounded-md border border-ink-700/60 bg-ink-900/30 px-3 py-2.5 text-[10px] leading-5 text-ink-400">
        <Info size={12} className="mt-0.5 shrink-0 text-ink-500" />
        <span>
          “高人气”不等于高质量，“低活跃”也不等于废弃。数据不足的插件不会被强制放到原点或任意象限；
          它们保留在详情页中，并明确展示缺失原因。
        </span>
      </div>
    </div>
  );
}
