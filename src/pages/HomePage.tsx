import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { QuadrantChart, quadrantCounts } from '../components/charts/QuadrantChart';
import { StatsStrip } from '../components/StatsStrip';
import { RankList } from '../components/RankList';
import { AttentionPanel, ChangesPanel } from '../components/Insights';
import { PluginExplorer } from '../components/PluginExplorer';
import { HeroArt, ModuleMark } from '../components/HeroArt';
import { ButtonAnchor, InfoHint, SectionHeading } from '../components/ui';
import { hasQuadrantData } from '../lib/scoring';
import { cn } from '../lib/cn';

const QUADRANT_KEYS = ['hot-healthy', 'niche-active', 'hot-watch', 'quiet'] as const;

const QUADRANT_DOT: Record<(typeof QUADRANT_KEYS)[number], string> = {
  'hot-healthy': 'bg-series-maintenance',
  'niche-active': 'bg-content-secondary',
  'hot-watch': 'bg-content-muted',
  quiet: 'bg-content-disabled',
};

const QUADRANT_SHORT: Record<(typeof QUADRANT_KEYS)[number], string> = {
  'hot-healthy': '热门且健康',
  'niche-active': '小众稳健',
  'hot-watch': '待维护',
  quiet: '低活跃',
};

const HERO_CHART_HEIGHT = { mobile: 300, tablet: 380, desktop: 420, wide: 440 } as const;

export function HomePage(): JSX.Element {
  const { latest, history } = useLoadedData();
  const breakpoint = useBreakpoint();
  const [methodOpen, setMethodOpen] = useState(false);
  const positioned = latest.plugins.filter(hasQuadrantData).length;
  const counts = quadrantCounts(latest.plugins);

  return (
    <div className="page-enter">
      <div className="mx-auto max-w-shell px-4 md:px-6">
        <section
          className="grid gap-4 pb-8 pt-6 sm:gap-8 lg:grid-cols-12 lg:items-start lg:gap-8 lg:pb-12 lg:pt-10"
          aria-labelledby="home-title"
        >
          <div className="min-w-0 lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="stamp">01 / OVERVIEW</span>
                  <span className="text-2xs font-medium text-content-muted">独立观察</span>
                </p>
                <p
                  className="dot-matrix mt-3 hidden text-[2rem] leading-none sm:block md:text-[2.25rem]"
                  aria-hidden="true"
                >
                  PLUGIN HEALTH
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end lg:hidden">
                <ModuleMark />
                <p className="mt-1.5 hidden max-w-[6.5rem] text-right text-2xs leading-4 text-content-muted sm:block">
                  FIG.01 · 装饰示意，不表示数据
                </p>
              </div>
            </div>

            <h1
              id="home-title"
              className="mt-4 text-[2rem] font-semibold leading-[1.12] tracking-tightest text-content-primary md:text-[2.5rem] lg:text-[2.75rem] xl:text-5xl xl:leading-[1.08]"
            >
              DSH 插件健康度看板
            </h1>
            <p className="mt-3 max-w-[26em] text-base leading-7 text-content-secondary">
              用 GitHub、npm 与 OSV 的公开数据，比较 {latest.plugins.length} 个 DSH 插件的人气、维护与公开风险。
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <ButtonAnchor
                href="#all-plugins"
                className="w-full justify-center sm:w-auto"
              >
                浏览全部插件 <ArrowRight size={15} aria-hidden="true" />
              </ButtonAnchor>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <Link
                  to="/quadrant"
                  className="inline-flex min-h-9 items-center text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline"
                >
                  四象限完整视图 →
                </Link>
                <Link
                  to="/method#popularity"
                  className="inline-flex min-h-9 items-center text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline"
                >
                  评分方法
                </Link>
                <span className="text-2xs leading-4 text-content-muted sm:hidden">装饰示意，不表示数据</span>
              </div>
            </div>

            <div className="mt-6">
              <HeroArt />
            </div>
          </div>

          <section
            className="panel min-w-0 overflow-hidden lg:col-span-7"
            aria-labelledby="home-quadrant-title"
          >
            <span
              className="absolute left-4 top-0 h-0.5 w-16 bg-content-primary"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 md:px-5 md:py-4">
              <div className="min-w-0 flex-1">
                <h2
                  id="home-quadrant-title"
                  className="text-xl font-semibold tracking-title text-content-primary"
                >
                  人气 × 维护健康度
                </h2>
                <p className="mt-1 hidden text-2xs leading-5 text-content-secondary sm:block">
                  越靠右关注度越高，越靠上公开维护活动越充分。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="tnum font-mono text-xl font-semibold text-content-primary">
                    {positioned}
                    <span className="text-sm text-content-muted"> / {latest.plugins.length}</span>
                  </p>
                  <p className="text-2xs text-content-muted">已定位插件</p>
                </div>
                <Link
                  to="/quadrant"
                  className="hidden min-h-9 items-center gap-1 text-xs text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline sm:inline-flex"
                >
                  完整视图 <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line-hairline px-4 py-2.5 text-2xs text-content-secondary md:flex md:flex-wrap md:items-center md:px-5">
              {QUADRANT_KEYS.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span
                    className={cn('h-1.5 w-1.5 rounded-[1px]', QUADRANT_DOT[key])}
                    aria-hidden="true"
                  />
                  {QUADRANT_SHORT[key]}
                  <span className="tnum font-mono text-content-primary">{counts[key]}</span>
                </span>
              ))}
            </div>

            <div className="min-w-0 px-1 pb-1 pt-1 md:px-2">
              <QuadrantChart
                plugins={latest.plugins}
                height={HERO_CHART_HEIGHT[breakpoint]}
                showLabels={false}
                showLegend={false}
                showUnpositioned={false}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 text-2xs text-content-muted md:px-5">
              <span className="inline-flex items-center gap-1">
                阈值 X=50 / Y=60
                <InfoHint text="相对阈值，用于组织视图，不是行业标准或质量及格线。" />
              </span>
              <span className="ml-auto hidden sm:inline">悬停 / 点击气泡查看详情</span>
              <Link
                to="/quadrant"
                className="ml-auto inline-flex min-h-8 items-center gap-1 text-content-secondary underline-offset-4 hover:text-brand-text hover:underline sm:hidden"
              >
                完整视图 <ArrowRight size={11} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </section>

        <StatsStrip data={latest} />

        <section className="mt-12 lg:mt-16" aria-labelledby="rankings-title">
          <SectionHeading
            eyebrow="02 / RANKINGS"
            title={<span id="rankings-title">榜单与关注</span>}
          />
          <div className="mt-5 grid gap-8 xl:grid-cols-12 xl:gap-8">
            <div className="grid min-w-0 gap-8 md:gap-10 lg:grid-cols-2 xl:col-span-8">
              <RankList
                eyebrow="按关注度"
                title="人气榜"
                description="Stars 与 30 天下载的对数归一化"
                plugins={latest.plugins}
                metric="popularity"
              />
              <RankList
                eyebrow="按维护证据"
                title="维护榜"
                description="提交、Issue、PR 与 Release 信号"
                plugins={latest.plugins}
                metric="maintenance"
              />
            </div>
            <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-10 xl:col-span-4 xl:grid-cols-1 xl:border-l xl:border-line xl:pl-8">
              <AttentionPanel plugins={latest.plugins} />
              <ChangesPanel plugins={latest.plugins} history={history} />
            </div>
          </div>
        </section>

        <div className="mt-12 lg:mt-16">
          <PluginExplorer plugins={latest.plugins} lastSuccessAt={latest.lastSuccessAt} />
        </div>

        <section className="mt-12 border-t border-line py-6 lg:mt-16" aria-labelledby="method-note-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[60ch]">
              <p className="stamp">04 / METHOD</p>
              <h2
                id="method-note-title"
                className="mt-2 text-xl font-semibold tracking-title text-content-primary"
              >
                这些指数是榜单内的相对评价
              </h2>
              <p className="mt-2 text-sm leading-6 text-content-secondary">
                不是质量或安全审计。缺失不记为 0，历史不足不补造趋势。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setMethodOpen((open) => !open)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line-control px-3 text-content-primary transition-colors hover:bg-surface-subtle"
                aria-expanded={methodOpen}
                aria-controls="home-method-detail"
              >
                {methodOpen ? '收拢口径' : '展开口径'}
                <span aria-hidden="true" className="font-mono text-content-muted">
                  {methodOpen ? '−' : '+'}
                </span>
              </button>
              <Link
                to="/method"
                className="inline-flex min-h-10 items-center gap-1 text-sm text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline"
              >
                完整方法 <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>
          {methodOpen ? (
            <div
              id="home-method-detail"
              className="mt-5 grid gap-4 border-t border-line-hairline pt-4 md:grid-cols-3"
            >
              {[
                {
                  title: '人气指数',
                  text: 'Stars 与经核验 npm 下载量的对数归一化；缺下载时调整权重，不记 0。',
                  href: '/method#popularity',
                },
                {
                  title: '维护健康度',
                  text: '提交、Issue、PR 与 Release 的公开活动；证据覆盖 <45% 不输出分数。',
                  href: '/method#maintenance',
                },
                {
                  title: '风险与缺失',
                  text: '归档、积压、OSV 与数据缺口；未检查写“未检查”，不写“安全”。',
                  href: '/method#risk',
                },
              ].map((item) => (
                <div key={item.title} className="min-w-0">
                  <h3 className="text-sm font-semibold text-content-primary">{item.title}</h3>
                  <p className="mt-1 text-2xs leading-5 text-content-secondary">{item.text}</p>
                  <Link
                    to={item.href}
                    className="mt-2 inline-flex min-h-8 items-center text-xs text-content-secondary underline-offset-4 hover:text-brand-text hover:underline"
                  >
                    查看计算 →
                  </Link>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
