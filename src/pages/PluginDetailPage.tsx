import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CircleDot,
  GitCommitHorizontal,
  Github,
  Globe2,
  Package,
  ShieldAlert,
  ShieldQuestion,
  Star,
} from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import type { PluginRecord, ScoreComponent } from '../lib/types';
import {
  formatCompact,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  formatScore,
  isExternalUrl,
} from '../lib/format';
import { DownloadBars } from '../components/charts/DownloadBars';
import { ScoreTrendChart } from '../components/charts/ScoreTrendChart';
import { findPlatformGapDates } from '../lib/downloads';
import {
  ButtonLink,
  CategoryTag,
  ConfidenceBadge,
  CopyButton,
  CoverageChip,
  DataBand,
  DataCoverage,
  DataStatusBadge,
  EmptyState,
  ExternalTextLink,
  InfoHint,
  InlineNotice,
  PluginMonogram,
  RiskBadge,
  ScoreBar,
  SectionHeading,
} from '../components/ui';
import { cn } from '../lib/cn';

function scoreRank(
  plugin: PluginRecord,
  kind: 'popularity' | 'maintenance',
  plugins: PluginRecord[],
): { rank: number; total: number } | null {
  const ranked = plugins
    .filter((item) => item.scores[kind].status === 'scored')
    .sort((a, b) => (b.scores[kind].score ?? 0) - (a.scores[kind].score ?? 0));
  const index = ranked.findIndex((item) => item.id === plugin.id);
  return index < 0 ? null : { rank: index + 1, total: ranked.length };
}

function ScoreExplainer({
  plugin,
  kind,
}: {
  plugin: PluginRecord;
  kind: 'popularity' | 'maintenance';
}): JSX.Element {
  const score = plugin.scores[kind];
  const title = kind === 'popularity' ? '为什么是这个人气指数？' : '为什么是这个维护健康度？';
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-surface-subtle md:px-5"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content-primary">{title}</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-content-secondary">{score.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBadge confidence={score.confidence} />
          <span className="text-xs text-content-muted">{open ? '收起' : '展开'}</span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-line-hairline px-4 pb-4 pt-3 md:px-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-secondary">
            <span>
              证据覆盖 <b className="font-mono text-content-primary">{Math.round(score.coverage * 100)}%</b>
            </span>
            <span>方法版本 {score.methodVersion}</span>
            <span className="text-content-muted">分数为本榜单内相对位置，不是绝对标准</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-subtle">
                  <th className="sticky left-0 bg-surface-subtle px-3 py-2 text-2xs font-medium text-content-secondary">
                    指标
                  </th>
                  <th className="px-3 py-2 text-2xs font-medium text-content-secondary">原始值</th>
                  <th className="px-3 py-2 text-2xs font-medium text-content-secondary">归一化</th>
                  <th className="px-3 py-2 text-2xs font-medium text-content-secondary">权重</th>
                  <th className="px-3 py-2 text-2xs font-medium text-content-secondary">贡献</th>
                  <th className="px-3 py-2 text-2xs font-medium text-content-secondary">证据</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-hairline">
                {score.components.map((component: ScoreComponent) => (
                  <tr key={component.key} className={component.included ? '' : 'text-content-muted'}>
                    <td className="sticky left-0 bg-surface px-3 py-3 align-top">
                      <div className="text-xs font-medium text-content-primary">{component.label}</div>
                      <div className="mt-1 max-w-[280px] text-2xs leading-4 text-content-muted">
                        {component.explanation}
                        {component.sampleSize !== null ? ` · n=${component.sampleSize}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-xs text-content-primary">
                      {component.rawLabel}
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-xs text-content-secondary">
                      {component.normalized === null ? '—' : formatScore(component.normalized)}
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-xs text-content-secondary">
                      {component.included
                        ? `${Math.round((component.effectiveWeight || 0) * 100)}%`
                        : '未计入'}
                      {component.included && component.effectiveWeight !== component.weight ? (
                        <span className="ml-1 inline-flex">
                          <InfoHint
                            align="right"
                            text={`设计权重 ${Math.round(component.weight * 100)}%，因样本量或缺失被折减/重新归一。`}
                          />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-xs text-content-primary">
                      {component.included ? component.contribution.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {component.evidenceUrl ? (
                        <ExternalTextLink href={component.evidenceUrl} className="text-2xs">
                          查看
                        </ExternalTextLink>
                      ) : (
                        <span className="text-2xs text-content-muted">无</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {score.missing.length > 0 ? (
            <p className="mt-3 text-xs leading-5 text-warning">缺失：{score.missing.join('；')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RawMetric({
  label,
  value,
  sub,
  link,
}: {
  label: string;
  value: string;
  sub: string;
  link?: { href: string; label: string };
}): JSX.Element {
  return (
    <div className="min-w-0 px-4 py-4 md:px-5">
      <p className="text-2xs font-medium text-content-secondary">{label}</p>
      <p className="mt-1.5 break-words font-mono text-lg font-semibold leading-6 text-content-primary">{value}</p>
      <p className="mt-1 text-2xs leading-4 text-content-muted">{sub}</p>
      {link ? (
        <ExternalTextLink href={link.href} className="mt-1.5 text-2xs">
          {link.label}
        </ExternalTextLink>
      ) : null}
    </div>
  );
}

function DataSourcesPanel({ plugin }: { plugin: PluginRecord }): JSX.Element {
  const latest = useLoadedData();
  const statusLabel = (status: string): string => {
    if (status === 'ok') return '正常';
    if (status === 'checked') return '已完成';
    if (status === 'verified') return '已核验';
    if (status === 'unavailable') return '不可用';
    if (status === 'error' || status === 'failed') return '失败';
    if (status === 'partial') return '部分';
    return status;
  };
  const statusTone = (status: string): string => {
    if (status === 'ok' || status === 'checked' || status === 'verified') {
      return 'border-line bg-surface-subtle text-content-secondary';
    }
    if (status === 'error' || status === 'failed') {
      return 'border-danger-line bg-danger-soft text-danger';
    }
    return 'border-warning-line bg-warning-soft text-warning';
  };
  const sources = [
    {
      name: 'GitHub REST API',
      status: latest.latest.sources.github.status,
      time: plugin.lastUpdatedAt,
      link: plugin.repository.url,
      detail: '仓库、提交、Issue、PR、Release',
    },
    {
      name: 'npm Download API',
      status: plugin.npm.status,
      time: plugin.npm.fetchedAt,
      link: plugin.npm.registryUrl,
      detail: plugin.npm.packageName ?? '没有可核验的 npm 包',
    },
    {
      name: 'OSV API',
      status: plugin.security.status,
      time: plugin.security.checkedAt,
      link: plugin.security.queryUrl,
      detail: plugin.security.exactMatch
        ? `${plugin.security.packageName}@${plugin.security.version}`
        : '未完成精确匹配',
    },
  ];

  return (
    <section className="panel overflow-hidden" aria-labelledby="sources-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 md:px-5">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-content-muted" aria-hidden="true" />
          <h2 id="sources-title" className="text-lg font-semibold text-content-primary">
            数据来源与采集时间
          </h2>
        </div>
        <span className="font-mono text-2xs text-content-muted">快照 {latest.latest.runId.slice(-8)}</span>
      </div>

      <div className="divide-y divide-line-hairline md:hidden">
        {sources.map((source) => (
          <div key={source.name} className="px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-content-primary">{source.name}</p>
              <span className={cn('inline-flex rounded-chip border px-1.5 py-0.5 text-2xs', statusTone(source.status))}>
                {statusLabel(source.status)}
              </span>
            </div>
            <p className="mt-1 break-words text-xs text-content-secondary">{source.detail}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-2xs text-content-muted">
              <span>{source.time ? formatDateTime(source.time) : '—'}</span>
              {source.link ? (
                <ExternalTextLink href={source.link} className="text-2xs">
                  打开来源
                </ExternalTextLink>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-line bg-surface-subtle">
              <th className="w-[38%] px-4 py-2.5 text-2xs font-medium text-content-secondary md:px-5">来源</th>
              <th className="w-[16%] px-2 py-2.5 text-2xs font-medium text-content-secondary">状态</th>
              <th className="w-[24%] px-2 py-2.5 text-2xs font-medium text-content-secondary">本次采集</th>
              <th className="px-2 py-2.5 text-2xs font-medium text-content-secondary">证据</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-hairline">
            {sources.map((source) => (
              <tr key={source.name}>
                <td className="px-4 py-3.5 md:px-5">
                  <div className="text-sm text-content-primary">{source.name}</div>
                  <div className="mt-0.5 break-words text-2xs leading-4 text-content-muted">{source.detail}</div>
                </td>
                <td className="px-2 py-3.5">
                  <span
                    className={cn('inline-flex rounded-chip border px-1.5 py-0.5 text-2xs', statusTone(source.status))}
                  >
                    {statusLabel(source.status)}
                  </span>
                </td>
                <td className="px-2 py-3.5 text-xs text-content-secondary">
                  {source.time ? formatDateTime(source.time) : '—'}
                </td>
                <td className="px-2 py-3.5">
                  {source.link ? (
                    <ExternalTextLink href={source.link} className="text-xs">
                      打开来源
                    </ExternalTextLink>
                  ) : (
                    <span className="text-xs text-content-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-2xs text-content-muted md:px-5">
        <span>
          页面快照 {formatDateTime(latest.latest.lastSuccessAt)} · {formatRelative(latest.latest.lastSuccessAt)}
        </span>
        <a
          href={`${import.meta.env.BASE_URL}data/latest.json`}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-auto inline-flex items-center gap-1 text-content-secondary hover:text-accent"
        >
          查看原始 JSON <ArrowUpRight size={11} />
        </a>
      </div>
    </section>
  );
}

export function PluginDetailPage(): JSX.Element {
  const { pluginId } = useParams();
  const data = useLoadedData();
  const plugin = useMemo(
    () => data.latest.plugins.find((item) => item.id === pluginId),
    [data.latest.plugins, pluginId],
  );
  // Platform gap days are a snapshot-level property, computed from all plugins
  // so one package's outage cannot be mistaken for a real zero.
  const gapDates = useMemo(
    () => findPlatformGapDates(data.latest.plugins.map((item) => item.npm)),
    [data.latest.plugins],
  );
  const historyPoints = plugin
    ? (data.history.plugins[plugin.id] ?? []).filter(
        (point) => point.methodVersion === plugin.scores.maintenance.methodVersion,
      )
    : [];
  const historySpanHours =
    historyPoints.length >= 2
      ? (new Date(historyPoints[historyPoints.length - 1].t).getTime() -
          new Date(historyPoints[0].t).getTime()) /
        3_600_000
      : 0;

  if (!plugin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          title="当前快照中没有这个插件"
          description="它可能已从配置中移除，或本次采集无法取得该仓库。请回到总览重新选择。"
          action={<ButtonLink to="/">返回总览</ButtonLink>}
        />
      </div>
    );
  }

  const risk = plugin.scores.risk;
  const issueRate =
    plugin.github.issues.closureRate === null ? null : plugin.github.issues.closureRate * 100;
  const prRate =
    plugin.github.pullRequests.mergeRate === null
      ? null
      : plugin.github.pullRequests.mergeRate * 100;
  const popularityRank = scoreRank(plugin, 'popularity', data.latest.plugins);
  const maintenanceRank = scoreRank(plugin, 'maintenance', data.latest.plugins);
  const weeklyWarnings = plugin.warnings.filter(
    (warning) => warning.includes('周下载') || warning.includes('周变化'),
  );
  const otherWarnings = plugin.warnings.filter((warning) => !weeklyWarnings.includes(warning));
  const trendReady = historyPoints.length >= 3 && historySpanHours >= 6;
  const completeness = plugin.scores.completeness;

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-12 pt-6 md:px-6 md:pt-8">
      <nav className="flex items-center gap-1.5 text-xs text-content-muted" aria-label="面包屑">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-accent">
          <ArrowLeft size={13} /> 总览
        </Link>
        <span className="text-line-strong" aria-hidden="true">/</span>
        <span className="truncate text-content-secondary">{plugin.repo}</span>
      </nav>

      <header className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <PluginMonogram plugin={plugin} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-[2rem] font-semibold leading-10 tracking-display text-content-primary">
                  {plugin.name}
                </h1>
                <CategoryTag category={plugin.category} />
                <RiskBadge level={risk.level} />
                <CoverageChip completeness={completeness} />
                {plugin.repository.archived ? (
                  <span className="rounded-chip border border-danger-line bg-danger-soft px-1.5 py-0.5 text-2xs text-danger">
                    已归档
                  </span>
                ) : null}
                {plugin.dataStatus === 'stale' ? <DataStatusBadge status="stale" /> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
                <a
                  href={plugin.repository.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex max-w-full items-center gap-1 break-all font-mono text-content-secondary hover:text-accent"
                >
                  <Github size={13} /> {plugin.repo}
                </a>
                {isExternalUrl(plugin.repository.homepageUrl) ? (
                  <a
                    href={plugin.repository.homepageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 hover:text-accent"
                  >
                    <Globe2 size={13} /> 项目主页
                  </a>
                ) : null}
                {plugin.npm.registryUrl ? (
                  <a
                    href={plugin.npm.registryUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 hover:text-accent"
                  >
                    <Package size={13} /> {plugin.npm.packageName}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink to={`/compare?a=${encodeURIComponent(plugin.id)}`} variant="secondary">
              加入对比
            </ButtonLink>
            <a
              href={plugin.repository.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-4 text-sm text-content-primary transition hover:border-content-muted hover:bg-surface-subtle max-sm:h-11"
            >
              <Github size={14} /> GitHub <ArrowUpRight size={12} />
            </a>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-base leading-6 text-content">{plugin.curatorNote}</p>
        {plugin.repository.description ? (
          <details className="mt-2 max-w-3xl">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs text-content-muted hover:text-accent sm:min-h-0">
              <span aria-hidden="true">▸</span> 项目原始简介
            </summary>
            <p className="mt-2 text-sm leading-6 text-content-secondary">{plugin.repository.description}</p>
          </details>
        ) : null}

        <div className="mt-4 max-w-3xl">
          <CopyButton value={plugin.installCommand} />
          <p className="mt-2 text-2xs leading-5 text-content-muted">
            安装命令转录自项目公开 README / Release，本项目未执行验证。安装前请核对版本、来源与项目自身的安装说明。
          </p>
        </div>

        {completeness.missing.length > 0 ? (
          <InlineNotice tone="amber" className="mt-4 max-w-3xl">
            <span className="font-medium">数据缺口：</span>
            {completeness.missing.map((item) => item.label).join('、')}。缺失项不会被当作真实零值，详见每项说明与来源。
          </InlineNotice>
        ) : null}
        {otherWarnings.length > 0 ? (
          <InlineNotice tone="amber" className="mt-3 max-w-3xl">
            <span className="font-medium">采集提示：</span>
            {otherWarnings.slice(0, 4).join('；')}
            {otherWarnings.length > 4 ? `；另有 ${otherWarnings.length - 4} 条提示。` : ''}
          </InlineNotice>
        ) : null}
      </header>

      <DataBand className="mt-6">
        <div
          className="grid grid-cols-2 divide-x divide-y divide-line-hairline lg:grid-cols-4 lg:divide-y-0"
          aria-label="评分摘要"
        >
          <div className="min-w-0 px-4 py-5 md:px-5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-content-secondary">
              <Star size={13} /> 人气指数
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <span className="tnum font-mono text-[2rem] font-semibold leading-none text-content-primary sm:text-4xl">
                {formatScore(plugin.scores.popularity.score)}
              </span>
              <span className="text-xs text-content-muted">/ 100</span>
            </div>
            <ScoreBar value={plugin.scores.popularity.score} className="mt-3 w-32" />
            <p className="mt-2 text-xs leading-5 text-content-muted">
              {popularityRank ? `本榜第 ${popularityRank.rank} / ${popularityRank.total} · ` : ''}
              {plugin.scores.popularity.confidence === 'high'
                ? '高置信'
                : plugin.scores.popularity.confidence === 'medium'
                  ? '中置信'
                  : '低置信'}{' '}
              · 覆盖 {Math.round(plugin.scores.popularity.coverage * 100)}%
            </p>
            <a href="#explain-popularity" className="mt-2 inline-flex items-center gap-1 text-xs text-content-secondary hover:text-accent">
              为什么是这个分？ <ArrowUpRight size={11} />
            </a>
          </div>

          <div className="min-w-0 px-4 py-5 md:px-5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-content-secondary">
              <GitCommitHorizontal size={13} /> 维护健康度
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <span className="tnum font-mono text-[2rem] font-semibold leading-none text-content-primary sm:text-4xl">
                {formatScore(plugin.scores.maintenance.score)}
              </span>
              <span className="text-xs text-content-muted">/ 100</span>
            </div>
            <ScoreBar value={plugin.scores.maintenance.score} className="mt-3 w-32" />
            <p className="mt-2 text-xs leading-5 text-content-muted">
              {maintenanceRank ? `本榜第 ${maintenanceRank.rank} / ${maintenanceRank.total} · ` : ''}
              {plugin.scores.maintenance.confidence === 'high'
                ? '高置信'
                : plugin.scores.maintenance.confidence === 'medium'
                  ? '中置信'
                  : '低置信'}{' '}
              · 覆盖 {Math.round(plugin.scores.maintenance.coverage * 100)}%
            </p>
            <a href="#explain-maintenance" className="mt-2 inline-flex items-center gap-1 text-xs text-content-secondary hover:text-accent">
              为什么是这个分？ <ArrowUpRight size={11} />
            </a>
          </div>

          <div className="min-w-0 px-4 py-5 md:px-5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-content-secondary">
              <ShieldAlert size={13} /> 风险提示
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <span
                className={cn(
                  'tnum font-mono text-[2rem] font-semibold leading-none sm:text-4xl',
                  risk.level === 'high'
                    ? 'text-danger'
                    : risk.level === 'medium'
                      ? 'text-warning'
                      : 'text-content-primary',
                )}
              >
                {risk.flags.length}
              </span>
              <span className="text-xs text-content-muted">条公开信号</span>
            </div>
            <div className="mt-3">
              <RiskBadge level={risk.level} />
            </div>
            <p className="mt-2 text-xs leading-5 text-content-muted">
              {risk.flags.length > 0
                ? `${risk.flags.length} 条信号需要阅读；不代表存在安全事件。`
                : '未命中归档、积压或公开漏洞规则；仍不等于安全审计。'}
            </p>
            <a href="#risk-evidence" className="mt-2 inline-flex items-center gap-1 text-xs text-content-secondary hover:text-accent">
              查看风险证据 <ArrowUpRight size={11} />
            </a>
          </div>

          <div className="min-w-0 px-4 py-5 md:px-5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-content-secondary">
              <CircleDot size={13} /> 数据完整度
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <span className="tnum font-mono text-[2rem] font-semibold leading-none text-content-primary sm:text-4xl">
                {completeness.available}
              </span>
              <span className="text-xs text-content-muted">/ {completeness.total} 域</span>
            </div>
            <div className="mt-3">
              <DataCoverage completeness={completeness} />
            </div>
            <p className="mt-2 text-xs leading-5 text-content-muted">
              完整度 {completeness.score}% · 缺失不参与评分，也不记为 0。
            </p>
            <Link to="/method#completeness" className="mt-2 inline-flex items-center gap-1 text-xs text-content-secondary hover:text-accent">
              数据域说明 <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </DataBand>

      <DataBand className="mt-4">
        <div className="grid grid-cols-2 divide-x divide-y divide-line-hairline md:grid-cols-4 md:divide-y-0">
          <RawMetric
            label="Stars"
            value={formatNumber(plugin.github.stars)}
            sub="GitHub 当前值"
            link={{ href: plugin.repository.url, label: 'GitHub' }}
          />
          <RawMetric
            label="Forks"
            value={formatNumber(plugin.github.forks)}
            sub="GitHub 当前值"
            link={{ href: `${plugin.repository.url}/forks`, label: 'Forks' }}
          />
          <RawMetric
            label="npm · 30 天下载"
            value={
              plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                ? formatNumber(plugin.npm.downloads30d)
                : '—'
            }
            sub={plugin.npm.status === 'verified' ? `包 ${plugin.npm.packageName}` : '暂无可靠下载数据'}
            link={plugin.npm.registryUrl ? { href: plugin.npm.registryUrl, label: 'npm registry' } : undefined}
          />
          <RawMetric
            label="最近代码提交"
            value={formatRelative(plugin.github.lastCommitAt)}
            sub={plugin.github.lastCommitAt ? formatDate(plugin.github.lastCommitAt) : '未取得'}
            link={plugin.github.lastCommitUrl ? { href: plugin.github.lastCommitUrl, label: '提交记录' } : undefined}
          />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-line-hairline border-t border-line md:grid-cols-4 md:divide-y-0">
          <RawMetric
            label="Issue 关闭率 · 90d"
            value={issueRate === null ? '—' : formatPercent(issueRate, 1)}
            sub={
              plugin.github.issues.opened90d === 0
                ? '近 90 天无新 Issue'
                : `${plugin.github.issues.closed90d}/${plugin.github.issues.opened90d} 条`
            }
            link={{ href: plugin.github.issues.queryUrl, label: 'Issue 证据' }}
          />
          <RawMetric
            label="PR 合并率 · 90d"
            value={prRate === null ? '—' : formatPercent(prRate, 1)}
            sub={
              !plugin.github.pullRequests.available
                ? 'PR 功能不可用'
                : `${plugin.github.pullRequests.merged90d}/${plugin.github.pullRequests.opened90d} 条`
            }
            link={
              plugin.github.pullRequests.available
                ? { href: plugin.github.pullRequests.queryUrl, label: 'PR 证据' }
                : undefined
            }
          />
          <RawMetric
            label="长期开放 Issue"
            value={formatNumber(plugin.github.issues.longOpen)}
            sub={`当前开放 ${plugin.github.issues.openNow} 条`}
            link={{ href: plugin.github.issuesUrl, label: '当前 Issue' }}
          />
          <RawMetric
            label="最近 Release"
            value={plugin.github.latestRelease?.version ?? '无 Release'}
            sub={
              plugin.github.latestRelease
                ? `${formatDate(plugin.github.latestRelease.publishedAt)} · 90 天内 ${plugin.github.releases90d} 次`
                : '没有 Release 不等于未维护'
            }
            link={{ href: plugin.github.releasesUrl, label: 'Releases' }}
          />
        </div>
      </DataBand>

      <section className="mt-10 border-t border-line pt-6" aria-labelledby="trend-title">
        <SectionHeading
          eyebrow="时间序列"
          title={<span id="trend-title">趋势与下载</span>}
          description="指数趋势来自 data 分支的历史快照；下载趋势来自 npm 最近 30 天日数据。历史不足时不画趋势线。"
        />
        <div className="panel mt-4 overflow-hidden">
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-line">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-content-primary">指数趋势</p>
                  <p className="mt-0.5 text-2xs text-content-muted">固定 0–100 · 维护与关注的相对变化</p>
                </div>
                <span className="text-2xs text-content-muted">{historyPoints.length} 个真实快照</span>
              </div>
              {trendReady ? (
                <div className="px-1 pb-1">
                  <ScoreTrendChart points={historyPoints} height={260} />
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center px-6 py-8 text-center">
                  <div>
                    <CalendarClock size={22} className="mx-auto text-content-muted" />
                    <p className="mt-3 text-sm font-medium text-content-primary">历史数据积累中</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-content-secondary">
                      当前 {historyPoints.length} 个真实快照
                      {historyPoints.length > 0 ? `，跨度约 ${Math.max(1, Math.round(historySpanHours))} 小时` : ''}。
                      跨多个定时采集周期后才展示趋势，不补造历史点。
                    </p>
                    <p className="mt-2 font-mono text-xs text-content-secondary">
                      当前 维护 {formatScore(plugin.scores.maintenance.score)} / 人气{' '}
                      {formatScore(plugin.scores.popularity.score)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 border-t border-line lg:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-content-primary">npm 下载</p>
                  <p className="mt-0.5 text-2xs text-content-muted">最近 30 天 · 日下载量 + 7 日移动平均</p>
                </div>
                {plugin.npm.status === 'verified' ? (
                  <span className="font-mono text-2xs text-content-muted">
                    {plugin.npm.downloads30d === null ? '无数据点' : `${formatCompact(plugin.npm.downloads30d)} / 30d`}
                  </span>
                ) : null}
              </div>
              {plugin.npm.status === 'verified' && plugin.npm.daily.length > 0 ? (
                <div className="px-1 pb-1">
                  <DownloadBars daily={plugin.npm.daily} gapDates={gapDates} height={260} />
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center px-6 py-8 text-center">
                  <div>
                    <Package size={22} className="mx-auto text-content-muted" />
                    <p className="mt-3 text-sm font-medium text-content-primary">暂无可靠 npm 下载数据</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-content-secondary">
                      {plugin.npm.reason ??
                        '该插件没有可核验的 npm 包，或下载 API 暂未返回可用数据。Star、Release 下载量不会被冒充为 npm 下载量。'}
                    </p>
                  </div>
                </div>
              )}
              {weeklyWarnings.length > 0 ? (
                <p className="border-t border-line-hairline px-4 py-2 text-2xs leading-5 text-content-muted">
                  {weeklyWarnings[0]}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-6" aria-labelledby="explain-title">
        <SectionHeading
          eyebrow="可解释性"
          title={<span id="explain-title">为什么得到这个评分</span>}
          description="展开查看每一项的原始值、归一化、权重、贡献与证据链接。缺失项明确标记为未计入。"
        />
        <div className="panel mt-4 divide-y divide-line-hairline overflow-hidden">
          <div id="explain-popularity" className="scroll-mt-24">
            <ScoreExplainer plugin={plugin} kind="popularity" />
          </div>
          <div id="explain-maintenance" className="scroll-mt-24">
            <ScoreExplainer plugin={plugin} kind="maintenance" />
          </div>
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-6" aria-labelledby="evidence-title">
        <SectionHeading
          eyebrow="证据"
          title={<span id="evidence-title">处理与安全证据</span>}
          description="Issue、PR、OSV 与兼容性声明来自公开数据；本项目不安装、不执行被检测插件。"
        />
        <div className="panel mt-4 overflow-hidden lg:grid lg:grid-cols-2 lg:divide-x lg:divide-line">
          <div className="min-w-0 px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CircleDot size={16} className="text-accent" aria-hidden="true" />
                <h3 className="text-base font-semibold text-content-primary">Issue 与 PR 处理</h3>
              </div>
              <span className="text-2xs text-content-muted">窗口 90 天 · 不含 PR 计入 Issue</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-secondary">Issue 关闭情况</p>
                  <ExternalTextLink href={plugin.github.issues.queryUrl} className="text-2xs">
                    GitHub 证据
                  </ExternalTextLink>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="tnum font-mono text-2xl font-semibold text-content-primary">
                    {plugin.github.issues.opened90d === 0 ? '—' : formatPercent(issueRate, 1)}
                  </span>
                  <span className="text-xs text-content-muted">
                    {plugin.github.issues.opened90d === 0
                      ? '近 90 天无新 Issue'
                      : `${plugin.github.issues.closed90d} / ${plugin.github.issues.opened90d} 条已关闭`}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 divide-x divide-line border-y border-line-hairline">
                  <div className="px-2 py-2">
                    <dt className="text-2xs text-content-muted">长期开放</dt>
                    <dd className="mt-0.5 tnum font-mono text-base text-content-primary">
                      {plugin.github.issues.longOpen}
                    </dd>
                  </div>
                  <div className="px-2 py-2">
                    <dt className="text-2xs text-content-muted">当前开放</dt>
                    <dd className="mt-0.5 tnum font-mono text-base text-content-primary">
                      {plugin.github.issues.openNow}
                    </dd>
                  </div>
                </dl>
                {plugin.github.issues.lowSample && plugin.github.issues.opened90d > 0 ? (
                  <p className="mt-2 text-2xs leading-5 text-warning">
                    样本仅 {plugin.github.issues.opened90d} 条，关闭率只作为参考，评分中已降低权重。
                  </p>
                ) : null}
                {plugin.github.issues.truncated ? (
                  <p className="mt-2 text-2xs leading-5 text-warning">
                    分页达到上限，以上为下限样本；截断时关闭率不参与评分。
                  </p>
                ) : null}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-secondary">PR 合并情况</p>
                  {plugin.github.pullRequests.available ? (
                    <ExternalTextLink href={plugin.github.pullRequests.queryUrl} className="text-2xs">
                      GitHub 证据
                    </ExternalTextLink>
                  ) : null}
                </div>
                {!plugin.github.pullRequests.available ? (
                  <InlineNotice tone="neutral" className="mt-2">
                    GitHub 未启用 Pull Requests 或 API 不提供该数据。PR 维度不参与评分，也不记为 0。
                  </InlineNotice>
                ) : (
                  <>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="tnum font-mono text-2xl font-semibold text-content-primary">
                        {plugin.github.pullRequests.opened90d === 0 ? '—' : formatPercent(prRate, 1)}
                      </span>
                      <span className="text-xs text-content-muted">
                        {plugin.github.pullRequests.opened90d === 0
                          ? '近 90 天无新 PR'
                          : `${plugin.github.pullRequests.merged90d} / ${plugin.github.pullRequests.opened90d} 条已合并`}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 divide-x divide-line border-y border-line-hairline">
                      <div className="px-2 py-2">
                        <dt className="text-2xs text-content-muted">当前开放 PR</dt>
                        <dd className="mt-0.5 tnum font-mono text-base text-content-primary">
                          {plugin.github.openPullRequests}
                        </dd>
                      </div>
                      <div className="px-2 py-2">
                        <dt className="text-2xs text-content-muted">样本</dt>
                        <dd className="mt-0.5 tnum font-mono text-base text-content-primary">
                          {plugin.github.pullRequests.opened90d}
                        </dd>
                      </div>
                    </dl>
                    {plugin.github.pullRequests.lowSample && plugin.github.pullRequests.opened90d > 0 ? (
                      <p className="mt-2 text-2xs leading-5 text-warning">样本少于 3 条，合并率不作强判断。</p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 border-t border-line px-4 py-4 md:px-5 lg:border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-content-secondary" aria-hidden="true" />
                <h3 className="text-base font-semibold text-content-primary">安全与兼容性证据</h3>
              </div>
              <span className="text-2xs text-content-muted">
                {plugin.security.status === 'checked' ? 'OSV 已完成精确查询' : '未完成检查'}
              </span>
            </div>
            {plugin.security.status === 'checked' ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                  <span className="inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface-subtle px-2 py-1 font-mono text-2xs">
                    <Package size={12} /> {plugin.security.packageName}@{plugin.security.version}
                  </span>
                  <span className="text-content-muted">
                    精确版本查询 · {plugin.security.checkedAt ? formatDateTime(plugin.security.checkedAt) : '—'}
                  </span>
                </div>
                {plugin.security.vulnerabilities.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-content-secondary">
                    OSV 未返回公开漏洞记录。这不等于“安全”或“零风险”；未披露漏洞、供应链与运行时问题仍需另行审计。
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {plugin.security.vulnerabilities.map((vulnerability) => (
                      <li
                        key={vulnerability.id}
                        className="rounded-control border border-danger-line bg-danger-soft px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-2xs text-danger">{vulnerability.id}</span>
                          <span className="rounded-chip border border-danger-line px-1.5 py-0.5 text-2xs text-danger">
                            {vulnerability.severity}
                          </span>
                          <ExternalTextLink href={vulnerability.url} className="ml-auto text-2xs">
                            OSV 详情
                          </ExternalTextLink>
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-content-secondary">
                          {vulnerability.summary ?? 'OSV 公开记录'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <InlineNotice tone="amber" className="mt-3">
                <span className="font-medium">未完成漏洞检查。</span>{' '}
                {plugin.security.reason ?? '缺少可精确匹配的 npm 包与版本，或 OSV 请求失败。'}
              </InlineNotice>
            )}

            <div className="mt-4 border-t border-line-hairline pt-3">
              <div className="flex items-center justify-between">
                <p className="text-2xs font-medium text-content-secondary">兼容性声明</p>
                <span className="text-2xs text-content-muted">未执行安装验证</span>
              </div>
              <dl className="mt-2 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-content-muted">Node.js engines</dt>
                  <dd className="max-w-[65%] break-words text-right font-mono text-2xs text-content-primary">
                    {plugin.compatibility.nodeEngine ?? '未声明'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-content-muted">DSH peer range</dt>
                  <dd className="max-w-[65%] break-words text-right font-mono text-2xs text-content-primary">
                    {plugin.compatibility.dshPeerRange ?? '未声明 / 未精确匹配'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-content-muted">npm 版本</dt>
                  <dd className="text-right font-mono text-2xs text-content-primary">
                    {plugin.compatibility.npmVersion ?? '无可靠 npm 包'}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-2xs leading-5 text-content-muted">{plugin.compatibility.note}</p>
              {plugin.compatibility.evidenceUrl ? (
                <ExternalTextLink href={plugin.compatibility.evidenceUrl} className="mt-1.5 text-2xs">
                  查看包声明
                </ExternalTextLink>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section id="risk-evidence" className="mt-10 scroll-mt-24 border-t border-line pt-6">
        <SectionHeading
          eyebrow="风险"
          title="风险提示逐条说明"
          description="风险提示来自归档状态、长期未关闭 Issue、OSV 记录与数据新鲜度。它们不能替代安全审计或兼容性测试。"
          action={<RiskBadge level={risk.level} />}
        />
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 border-t border-line">
            {risk.flags.length === 0 ? (
              <p className="py-5 text-sm leading-6 text-content-secondary">
                当前没有命中高风险或中等风险规则。请注意，这仍然不是“安全”或“零风险”的结论。
              </p>
            ) : (
              <ul className="divide-y divide-line-hairline">
                {risk.flags.map((flag) => (
                  <li key={flag.code} className="py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            flag.level === 'high'
                              ? 'bg-danger'
                              : flag.level === 'medium'
                                ? 'bg-warning'
                                : 'bg-content-muted',
                          )}
                          aria-hidden="true"
                        />
                        <p className="text-sm font-medium text-content-primary">{flag.title}</p>
                      </div>
                      <span className="shrink-0 text-2xs text-content-muted">
                        {flag.level === 'high' ? '高' : flag.level === 'medium' ? '需关注' : '信息'}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-3.5 text-xs leading-5 text-content-secondary">{flag.detail}</p>
                    {flag.evidenceUrl ? (
                      <div className="mt-1 pl-3.5">
                        <ExternalTextLink href={flag.evidenceUrl} className="text-2xs">
                          查看原始证据
                        </ExternalTextLink>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-l-2 border-accent bg-surface-subtle px-4 py-4">
            <div className="flex items-center gap-2">
              <ShieldQuestion size={16} className="text-content-muted" aria-hidden="true" />
              <p className="text-sm font-semibold text-content-primary">边界说明</p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {risk.limitations.map((limitation) => (
                <li key={limitation} className="flex items-start gap-2 text-xs leading-5 text-content-secondary">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-content-muted" aria-hidden="true" />
                  {limitation}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-2xs font-medium text-content-muted">当前结论</p>
              <p className="mt-1 text-sm text-content-primary">{risk.label}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <DataSourcesPanel plugin={plugin} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
        <p className="max-w-2xl text-xs leading-5 text-content-secondary">
          对比页只展示指标差异，不会基于单一指标断言谁“更好”。请结合样本量、口径与原始链接阅读。
        </p>
        <ButtonLink to={`/compare?a=${encodeURIComponent(plugin.id)}`} variant="secondary">
          选择对比插件 <ArrowUpRight size={12} />
        </ButtonLink>
      </div>
    </div>
  );
}
