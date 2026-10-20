import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleDot,
  Download,
  GitCommitHorizontal,
  Github,
  Radio,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import { QuadrantChart } from '../components/charts/QuadrantChart';
import { StatsStrip } from '../components/StatsStrip';
import { RankList } from '../components/RankList';
import { AttentionPanel, ChangesPanel } from '../components/Insights';
import { PluginExplorer } from '../components/PluginExplorer';
import { ButtonLink, InfoHint, SectionHeading } from '../components/ui';
import { formatCompact, formatDateTime, formatRelative, isDataStale } from '../lib/format';
import { hasQuadrantData } from '../lib/scoring';

function sourceHealth(status: string): 'ok' | 'warn' | 'off' {
  if (status === 'ok') return 'ok';
  if (status === 'partial' || status === 'skipped') return 'warn';
  return 'off';
}

export function HomePage(): JSX.Element {
  const { latest, history } = useLoadedData();
  const positioned = latest.plugins.filter(hasQuadrantData).length;
  const stale = isDataStale(latest.lastSuccessAt);
  const sourceRows: Array<{ label: string; status: string; message?: string; href: string }> = [
    { label: 'GitHub', status: latest.sources.github.status, message: latest.sources.github.message, href: 'https://docs.github.com/rest' },
    { label: 'npm', status: latest.sources.npm.status, message: latest.sources.npm.message, href: 'https://github.com/npm/registry/blob/main/docs/download-counts.md' },
    { label: 'OSV', status: latest.sources.osv.status, message: latest.sources.osv.message, href: 'https://osv.dev' },
  ];

  return (
    <div className="page-enter">
      <div className="mx-auto max-w-shell px-4 pb-12 pt-8 md:px-6 md:pt-12">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-stretch xl:gap-12">
          <div className="flex flex-col justify-center py-2 lg:py-8">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-signal/20 bg-signal/5 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-signal-strong">
                <Radio size={10} /> Ecosystem observatory
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
                v0.1.0 / DSH plugins
              </span>
            </div>
            <h1 className="mt-6 max-w-xl text-[2.65rem] font-semibold leading-[1.02] tracking-tightest text-ink-100 sm:text-[3.5rem] lg:text-[3.65rem]">
              看清 DSH 插件的
              <span className="mt-1 block text-ink-400">生命体征</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-ink-300">
              基于真实 GitHub、npm 与 OSV 数据，独立观察 DeepSeek Harness 插件的
              <span className="text-ink-200"> 人气、维护活动、公开风险与数据完整度</span>。
              不是单一质量分，也不把缺失当作 0。
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <ButtonLink to="/quadrant" className="h-9 px-4">
                探索四象限 <ArrowUpRight size={13} />
              </ButtonLink>
              <ButtonLink to="/compare" variant="secondary" className="h-9 px-4">
                对比两个插件
              </ButtonLink>
              <Link
                to="/method"
                className="inline-flex h-9 items-center gap-1.5 px-2 text-[11px] text-ink-400 transition hover:text-ink-100"
              >
                <BookOpen size={12} /> 评分方法
              </Link>
            </div>

            <div className="mt-8 border-t border-ink-700/60 pt-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {sourceRows.map((source) => {
                  const tone = sourceHealth(source.status);
                  return (
                    <span key={source.label} className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-400" title={source.message}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          tone === 'ok' ? 'bg-mint' : tone === 'warn' ? 'bg-amber' : 'bg-rose'
                        }`}
                      />
                      {source.label}
                      <span className="text-ink-600">/</span>
                      <span className={tone === 'ok' ? 'text-mint/75' : tone === 'warn' ? 'text-amber/80' : 'text-rose/80'}>
                        {source.status.toUpperCase()}
                      </span>
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-500">
                <span>上次成功更新 {formatDateTime(latest.lastSuccessAt)}</span>
                <span className="inline-flex items-center gap-1">
                  {formatRelative(latest.lastSuccessAt)}
                  {stale ? <span className="text-amber">· 已超过 8 小时</span> : null}
                </span>
                <span className="text-ink-600">·</span>
                <span>计划每 6 小时</span>
              </div>
            </div>
          </div>

          <section className="panel relative overflow-hidden" aria-labelledby="quadrant-title">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-700/60 px-4 py-4 md:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="eyebrow">Core view</p>
                  <span className="rounded border border-ink-700 px-1.5 py-0.5 font-mono text-[9px] text-ink-500">
                    RELATIVE / 0–100
                  </span>
                </div>
                <h2 id="quadrant-title" className="mt-1.5 text-lg font-semibold tracking-tight text-ink-100">
                  人气 × 维护健康度
                </h2>
                <p className="mt-1 text-[11px] leading-5 text-ink-400">
                  横轴为相对人气指数，纵轴为公开维护证据指数。
                </p>
              </div>
              <div className="text-right">
                <p className="tnum font-mono text-lg text-ink-100">
                  {positioned}
                  <span className="text-xs text-ink-500"> / {latest.plugins.length}</span>
                </p>
                <p className="text-[9px] uppercase tracking-[0.1em] text-ink-500">定位插件</p>
                <Link
                  to="/quadrant"
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-ink-300 transition hover:text-ink-100"
                >
                  完整视图 <ArrowUpRight size={10} />
                </Link>
              </div>
            </div>
            <div className="px-1 pb-3 pt-1 md:px-2">
              <QuadrantChart plugins={latest.plugins} height={402} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-700/60 px-4 py-2.5 text-[9px] text-ink-500 md:px-5">
              <span className="inline-flex items-center gap-1">
                阈值 X={50} / Y={60} <InfoHint text="相对阈值，用于组织视图，不是行业标准或质量及格线。" />
              </span>
              <span className="inline-flex items-center gap-1">
                气泡面积 ≈ Star 量级
              </span>
              <span className="ml-auto text-ink-600">点击气泡进入体检详情</span>
            </div>
          </section>
        </section>

        <StatsStrip data={latest} />

        <section className="mt-10" aria-labelledby="rankings-title">
          <SectionHeading
            eyebrow="Leaderboards"
            title={<span id="rankings-title">两条独立的榜单</span>}
            description="人气回答“有多少人在看”，维护健康度回答“最近有多少公开维护证据”。两者不互相替代。"
            action={
              <Link
                to="/quadrant"
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-300 transition hover:text-ink-100"
              >
                在分布中查看 <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RankList
              eyebrow="Popularity"
              title="人气排行榜"
              description="Stars 与 npm 30 天下载量的对数归一化合成。"
              plugins={latest.plugins}
              metric="popularity"
            />
            <RankList
              eyebrow="Maintenance"
              title="维护健康度排行榜"
              description="提交、Issue、PR 与版本发布的公开活动信号。"
              plugins={latest.plugins}
              metric="maintenance"
            />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="signals-title">
          <SectionHeading
            eyebrow="Signals"
            title={<span id="signals-title">生态信号</span>}
            description="把风险提示、数据缺口与真实变化分开呈现，避免用一个分数解释一切。"
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <AttentionPanel plugins={latest.plugins} />
            <ChangesPanel plugins={latest.plugins} history={history} />
          </div>
        </section>

        <section className="mt-10 grid gap-px overflow-hidden rounded-lg border border-ink-700/70 bg-ink-700/60 md:grid-cols-3">
          <div className="bg-ink-850/80 p-5 md:p-6">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <Github size={12} /> Star 不是全部
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-200">
              高 Star 可能来自一次传播；没有下载数据时，人气分只使用 Star 并降低完整度。
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-500">
              所有指数都是当前榜单内的相对评价，不是绝对流行度。
            </p>
          </div>
          <div className="bg-ink-850/80 p-5 md:p-6">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <GitCommitHorizontal size={12} /> 活跃不是质量
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-200">
              维护活动只能说明公开可见的变更频率。成熟稳定的小插件可能很少提交，也不应因此被判差。
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-500">
              Issue 样本小、无 Release、无新 Issue 都会调整权重或显示“信息不足”。
            </p>
          </div>
          <div className="bg-ink-850/80 p-5 md:p-6">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <ShieldAlert size={12} /> 风险不是审计
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-200">
              OSV 只覆盖已公开、能匹配到版本的漏洞；缺失时明确显示“未完成检查”，而不是“安全”。
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-500">
              本项目不安装、不执行被检测插件，也不把 README 当作运行结果。
            </p>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <SectionHeading
              eyebrow="Search & filter"
              title="检索全部插件"
              description="按名称、描述、维护状态、风险和数据完整程度筛选；所有结果来自同一份真实快照。"
            />
            <div className="flex items-center gap-4 text-[10px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Download size={11} /> {latest.stats.totalDownloads === null ? '—' : formatCompact(latest.stats.totalDownloads)} downloads
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CircleDot size={11} /> {latest.stats.pluginCount} repos
              </span>
            </div>
          </div>
          <PluginExplorer plugins={latest.plugins} />
        </section>

        <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/30 px-4 py-3 text-[10px] text-ink-400 md:px-5">
          <span className="inline-flex items-center gap-2">
            <Sparkles size={11} className="text-signal" />
            需要解释某个分数？详情页提供每项指标、权重、样本量与原始证据链接。
          </span>
          <Link to="/method" className="inline-flex items-center gap-1 text-ink-300 transition hover:text-ink-100">
            阅读方法与局限 <ArrowUpRight size={10} />
          </Link>
        </section>
      </div>
    </div>
  );
}
