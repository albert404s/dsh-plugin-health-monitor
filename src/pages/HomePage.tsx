import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { QuadrantChart, quadrantCounts } from '../components/charts/QuadrantChart';
import { StatsStrip } from '../components/StatsStrip';
import { RankList } from '../components/RankList';
import { AttentionPanel, ChangesPanel } from '../components/Insights';
import { PluginExplorer } from '../components/PluginExplorer';
import {
  ButtonAnchor,
  ButtonLink,
  InfoHint,
  SectionHeading,
} from '../components/ui';
import { formatDateTime, formatRelative, isDataStale } from '../lib/format';
import { hasQuadrantData } from '../lib/scoring';

function sourceHealth(status: string): 'ok' | 'warn' | 'off' {
  if (status === 'ok') return 'ok';
  if (status === 'partial' || status === 'skipped') return 'warn';
  return 'off';
}

const QUADRANT_KEYS = ['hot-healthy', 'niche-active', 'hot-watch', 'quiet'] as const;

const QUADRANT_DOT: Record<(typeof QUADRANT_KEYS)[number], string> = {
  'hot-healthy': 'bg-teal',
  'niche-active': 'bg-accent',
  'hot-watch': 'bg-warning',
  quiet: 'bg-content-muted',
};

const QUADRANT_SHORT: Record<(typeof QUADRANT_KEYS)[number], string> = {
  'hot-healthy': '热门且健康',
  'niche-active': '小众稳健',
  'hot-watch': '待维护',
  quiet: '低活跃',
};

export function HomePage(): JSX.Element {
  const { latest, history } = useLoadedData();
  const isMobile = useMediaQuery('(max-width: 639px)');
  const positioned = latest.plugins.filter(hasQuadrantData).length;
  const stale = isDataStale(latest.lastSuccessAt);
  const sourceRows: Array<{ label: string; status: string; message?: string; href: string }> = [
    { label: 'GitHub', status: latest.sources.github.status, message: latest.sources.github.message, href: 'https://docs.github.com/rest' },
    { label: 'npm', status: latest.sources.npm.status, message: latest.sources.npm.message, href: 'https://github.com/npm/registry/blob/main/docs/download-counts.md' },
    { label: 'OSV', status: latest.sources.osv.status, message: latest.sources.osv.message, href: 'https://osv.dev' },
  ];
  const unhealthySources = sourceRows.filter((source) => sourceHealth(source.status) !== 'ok').length;
  const counts = quadrantCounts(latest.plugins);
  const highRisk = latest.stats.highRiskCount;

  return (
    <div className="page-enter">
      <div className="mx-auto max-w-shell px-4 md:px-6">
        <section className="grid gap-6 pb-6 pt-6 sm:gap-8 sm:pb-8 sm:pt-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-10 lg:pb-6 lg:pt-8">
          <div className="min-w-0">
            <p className="eyebrow">独立观察 · 公开数据 · v0.1.0</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.15] tracking-display text-content-primary sm:mt-4 sm:text-5xl sm:leading-[1.08] lg:text-5xl">
              DSH 插件健康度看板
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-content-secondary sm:mt-4">
              用 GitHub、npm 与 OSV 的公开数据，比较 {latest.plugins.length} 个 DSH 插件的人气、维护与公开风险。
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:mt-6">
              <ButtonAnchor href="#all-plugins">
                浏览 {latest.plugins.length} 个插件 <ArrowRight size={15} />
              </ButtonAnchor>
              <ButtonLink to="/quadrant" variant="secondary">
                四象限视图
              </ButtonLink>
              <Link
                to="/method"
                className="inline-flex h-10 items-center gap-1.5 px-1 text-sm text-content-secondary underline-offset-4 transition hover:text-accent hover:underline max-sm:h-11"
              >
                <BookOpen size={14} /> 评分方法
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-hairline pt-3 text-xs text-content-secondary sm:mt-6 sm:pt-4">
              <span title={formatDateTime(latest.lastSuccessAt)}>
                数据更新于 {formatRelative(latest.lastSuccessAt)}
                {stale ? <span className="ml-1 text-warning">· 可能已过期</span> : null}
              </span>
              <span className="text-line-strong" aria-hidden="true">/</span>
              <span>{latest.plugins.length} 个插件</span>
              <span className="text-line-strong" aria-hidden="true">/</span>
              <span className={highRisk > 0 ? 'text-danger' : 'text-content-secondary'}>
                {highRisk} 个高风险
              </span>
              <span className="text-line-strong" aria-hidden="true">/</span>
              <span className={unhealthySources > 0 ? 'text-warning' : ''}>
                {unhealthySources > 0 ? `${unhealthySources} 个来源降级` : `${sourceRows.length} 个来源正常`}
              </span>
            </div>
          </div>

          <section className="panel min-w-0 overflow-hidden" aria-labelledby="home-quadrant-title">
            <div className="flex flex-nowrap items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5 md:py-4">
              <div className="min-w-0 flex-1">
                <h2 id="home-quadrant-title" className="text-lg font-semibold text-content-primary">
                  人气 × 维护健康度
                </h2>
                <p className="mt-1 hidden text-xs leading-5 text-content-secondary sm:block">
                  越靠右关注度越高，越靠上公开维护活动越充分。
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tnum font-mono text-xl font-semibold text-content-primary">
                  {positioned}
                  <span className="text-sm text-content-muted"> / {latest.plugins.length}</span>
                </p>
                <p className="text-2xs text-content-muted">已定位插件</p>
                <Link
                  to="/quadrant"
                  className="mt-1 hidden items-center gap-1 text-xs text-content-secondary transition hover:text-accent sm:inline-flex"
                >
                  完整视图 <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-hairline px-4 py-2 text-2xs text-content-secondary md:px-5 md:py-2.5">
              {QUADRANT_KEYS.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${QUADRANT_DOT[key]}`} aria-hidden="true" />
                  {QUADRANT_SHORT[key]}
                  <span className="tnum font-mono text-content-primary">{counts[key]}</span>
                </span>
              ))}
            </div>

            <div className="px-1 pb-1 pt-1 md:px-2">
              <QuadrantChart
                plugins={latest.plugins}
                height={isMobile ? 280 : 360}
                showLabels={false}
                showUnpositioned={false}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-2xs text-content-muted md:px-5">
              <span className="inline-flex items-center gap-1">
                阈值 X={50} / Y={60}
                <InfoHint text="相对阈值，用于组织视图，不是行业标准或质量及格线。" />
              </span>
              <span className="ml-auto">点按 / 点击气泡查看详情</span>
            </div>
          </section>
        </section>

        <StatsStrip data={latest} />

        <div className="mt-10 lg:mt-12">
          <PluginExplorer plugins={latest.plugins} />
        </div>

        <section className="mt-10 lg:mt-12" aria-labelledby="rankings-title">
          <SectionHeading
            eyebrow="榜单"
            title={<span id="rankings-title">人气榜 / 维护榜</span>}
            description="人气回答“有多少人在关注”，维护健康度回答“最近有多少公开维护证据”；两者不互相替代。"
          />
          <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-10">
            <RankList
              eyebrow="按关注度"
              title="人气榜"
              description="Stars 与 npm 30 天下载量的对数归一化合成。"
              plugins={latest.plugins}
              metric="popularity"
            />
            <RankList
              eyebrow="按维护证据"
              title="维护榜"
              description="提交、Issue、PR 与版本发布的公开活动信号。"
              plugins={latest.plugins}
              metric="maintenance"
            />
          </div>
        </section>

        <section className="mt-10 lg:mt-12" aria-labelledby="signals-title">
          <SectionHeading
            eyebrow="信号"
            title={<span id="signals-title">生态信号</span>}
            description="把风险提示、数据缺口与真实变化分开呈现，避免用一个分数解释一切。"
          />
          <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-0">
            <div className="min-w-0 lg:pr-8">
              <AttentionPanel plugins={latest.plugins} />
            </div>
            <div className="min-w-0 border-t border-line pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <ChangesPanel plugins={latest.plugins} history={history} />
            </div>
          </div>
        </section>

        <section className="mt-10 border-t border-line py-5 lg:mt-12" aria-label="方法与局限">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs leading-5 text-content-secondary">
              指数是当前榜单内的相对评价，不是软件质量或安全审计。缺失值不记为 0，历史不足时不补造趋势。
            </p>
            <Link
              to="/method"
              className="inline-flex items-center gap-1 text-sm text-content-secondary underline-offset-4 transition hover:text-accent hover:underline"
            >
              阅读方法与局限 <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
