import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Download,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitPullRequest,
  Github,
  Globe2,
  Package,
  ShieldAlert,
  ShieldQuestion,
  Star,
} from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import type { PluginRecord, ScoreComponent } from '../lib/types';
import { categoryLabel } from '../lib/types';
import {
  dataStatusLabel,
  formatCompact,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  formatScore,
  isExternalUrl,
  riskTone,
} from '../lib/format';
import { DownloadBars } from '../components/charts/DownloadBars';
import { ScoreTrendChart } from '../components/charts/ScoreTrendChart';
import {
  ButtonLink,
  CategoryTag,
  ConfidenceBadge,
  CopyButton,
  DataCoverage,
  DataStatusBadge,
  EmptyState,
  ExternalTextLink,
  InfoHint,
  InlineNotice,
  MiniMetric,
  PluginMonogram,
  RiskBadge,
  ScoreBar,
  ScoreHero,
  SectionHeading,
} from '../components/ui';
import { cn } from '../lib/cn';

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
    <div className="overflow-hidden rounded-md border border-ink-700/70 bg-ink-900/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-ink-800/40"
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-medium text-ink-100">{title}</p>
          <p className="mt-1 max-w-2xl text-[10px] leading-4 text-ink-400">
            {score.summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBadge confidence={score.confidence} />
          <span className="font-mono text-[10px] text-ink-400">
            {open ? '收起' : '展开'}
          </span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-ink-700/60 px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-400">
            <span>
              证据覆盖{" "}
              <b className="font-mono text-ink-200">{Math.round(score.coverage * 100)}%</b>
            </span>
            <span>方法版本 {score.methodVersion}</span>
            <span>
              分数为 <b className="text-ink-200">本榜单内相对位置</b>，不是绝对标准
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-ink-700/60">
                  <th className="py-2 pr-3 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">指标</th>
                  <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">原始值</th>
                  <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">归一化</th>
                  <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">权重</th>
                  <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">贡献</th>
                  <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">证据</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40">
                {score.components.map((component: ScoreComponent) => (
                  <tr key={component.key} className={component.included ? '' : 'opacity-55'}>
                    <td className="py-2.5 pr-3">
                      <div className="text-[11px] text-ink-200">{component.label}</div>
                      <div className="mt-1 max-w-[280px] text-[9px] leading-4 text-ink-500">
                        {component.explanation}
                        {component.sampleSize !== null ? ` · n=${component.sampleSize}` : ''}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[10px] text-ink-200">
                      {component.rawLabel}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[10px] text-ink-200">
                      {component.normalized === null ? '—' : formatScore(component.normalized)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[10px] text-ink-300">
                      {component.included
                        ? `${Math.round((component.effectiveWeight || 0) * 100)}%`
                        : '未计入'}
                      {component.included && component.effectiveWeight !== component.weight ? (
                        <span className="ml-1 text-[9px] text-amber">
                          <InfoHint text={`设计权重 ${Math.round(component.weight * 100)}%，因样本量或缺失被折减/重新归一。`} />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[10px] text-ink-100">
                      {component.included ? component.contribution.toFixed(1) : '—'}
                    </td>
                    <td className="px-2 py-2.5">
                      {component.evidenceUrl ? (
                        <ExternalTextLink href={component.evidenceUrl} className="text-[9px]">
                          查看
                        </ExternalTextLink>
                      ) : (
                        <span className="text-[9px] text-ink-500">无</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {score.missing.length > 0 ? (
            <p className="mt-3 text-[10px] text-amber/90">缺失：{score.missing.join('；')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SecurityPanel({ plugin }: { plugin: PluginRecord }): JSX.Element {
  const security = plugin.security;
  return (
    <section className="panel overflow-hidden" aria-labelledby="security-title">
      <div className="flex items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className={security.status === 'checked' ? 'text-amber' : 'text-ink-400'} />
          <h2 id="security-title" className="text-sm font-semibold text-ink-100">
            安全与兼容性证据
          </h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
          {security.status === 'checked' ? 'OSV MATCHED' : 'NOT CHECKED'}
        </span>
      </div>
      <div className="px-4 py-4">
        {security.status === 'checked' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-300">
              <span className="inline-flex items-center gap-1.5 rounded border border-ink-600 px-2 py-1 font-mono text-[10px]">
                <Package size={11} /> {security.packageName}@{security.version}
              </span>
              <span className="text-ink-500">精确版本查询 · {security.checkedAt ? formatDateTime(security.checkedAt) : '—'}</span>
            </div>
            {security.vulnerabilities.length === 0 ? (
              <div className="mt-3">
                <InlineNotice tone="neutral">
                  OSV 未返回公开漏洞记录。这不等于“安全”或“零风险”；未披露漏洞、供应链与运行时问题仍需另行审计。
                </InlineNotice>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {security.vulnerabilities.map((vulnerability) => (
                  <li key={vulnerability.id} className="rounded border border-rose/20 bg-rose/5 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-rose">{vulnerability.id}</span>
                      <span className="rounded border border-rose/20 px-1.5 py-0.5 text-[9px] text-rose/90">
                        {vulnerability.severity}
                      </span>
                      <ExternalTextLink href={vulnerability.url} className="ml-auto text-[10px]">
                        OSV 详情
                      </ExternalTextLink>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-ink-300">
                      {vulnerability.summary ?? 'OSV 公开记录'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <InlineNotice tone="amber">
            <span className="font-medium">未完成漏洞检查。</span>{' '}
            {security.reason ?? '缺少可精确匹配的 npm 包与版本，或 OSV 请求失败。'}
          </InlineNotice>
        )}

        <div className="mt-5 border-t border-ink-700/60 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">兼容性声明</p>
            <span className="text-[9px] text-ink-500">未执行安装验证</span>
          </div>
          <dl className="mt-3 space-y-2.5 text-[11px]">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-400">Node.js engines</dt>
              <dd className="max-w-[65%] break-words text-right font-mono text-[10px] text-ink-200">
                {plugin.compatibility.nodeEngine ?? '未声明'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-400">DSH peer range</dt>
              <dd className="max-w-[65%] break-words text-right font-mono text-[10px] text-ink-200">
                {plugin.compatibility.dshPeerRange ?? '未声明 / 未精确匹配'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-400">npm 版本</dt>
              <dd className="text-right font-mono text-[10px] text-ink-200">
                {plugin.compatibility.npmVersion ?? '无可靠 npm 包'}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] leading-5 text-ink-500">{plugin.compatibility.note}</p>
          {plugin.compatibility.evidenceUrl ? (
            <ExternalTextLink href={plugin.compatibility.evidenceUrl} className="mt-2 text-[10px]">
              查看包声明
            </ExternalTextLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function IssueAndPrPanel({ plugin }: { plugin: PluginRecord }): JSX.Element {
  const issues = plugin.github.issues;
  const pulls = plugin.github.pullRequests;
  const issueRate = issues.closureRate === null ? null : issues.closureRate * 100;
  const prRate = pulls.mergeRate === null ? null : pulls.mergeRate * 100;
  return (
    <section className="panel overflow-hidden" aria-labelledby="activity-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <CircleDot size={14} className="text-signal" />
          <h2 id="activity-title" className="text-sm font-semibold text-ink-100">
            Issue 与 PR 处理
          </h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-500">
          WINDOW 90D / EXCLUDES PR IN ISSUES
        </span>
      </div>
      <div className="grid divide-y divide-ink-700/50 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-300">Issue 关闭情况</p>
            <ExternalTextLink href={issues.queryUrl} className="text-[9px]">
              GitHub 证据
            </ExternalTextLink>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tnum text-2xl font-semibold text-ink-100">
              {issues.opened90d === 0 ? '—' : formatPercent(issueRate, 1)}
            </span>
            <span className="text-[10px] text-ink-400">
              {issues.opened90d === 0
                ? '近 90 天无新 Issue'
                : `${issues.closed90d} / ${issues.opened90d} 条已关闭`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded border border-ink-700/60 bg-ink-900/40 px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.08em] text-ink-500">长期开放</p>
              <p className="mt-1 tnum font-mono text-sm text-ink-200">
                {issues.longOpen}
                <span className="ml-1 text-[9px] text-ink-500">条 &gt; 90 天</span>
              </p>
            </div>
            <div className="rounded border border-ink-700/60 bg-ink-900/40 px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.08em] text-ink-500">当前开放</p>
              <p className="mt-1 tnum font-mono text-sm text-ink-200">
                {issues.openNow}
                {issues.openTruncated ? <span className="ml-1 text-[9px] text-amber">下限</span> : null}
              </p>
            </div>
          </div>
          {issues.lowSample && issues.opened90d > 0 ? (
            <p className="mt-3 text-[10px] leading-4 text-amber/90">
              样本仅 {issues.opened90d} 条，关闭率只作为参考，评分中已降低权重。
            </p>
          ) : null}
          {issues.opened90d === 0 ? (
            <p className="mt-3 text-[10px] leading-4 text-ink-500">
              没有新 Issue 不代表 Issue 处理能力差，因此该维度不参与维护评分。
            </p>
          ) : null}
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-300">PR 合并情况</p>
            {pulls.available ? (
              <ExternalTextLink href={pulls.queryUrl} className="text-[9px]">
                GitHub 证据
              </ExternalTextLink>
            ) : null}
          </div>
          {!pulls.available ? (
            <div className="mt-3">
              <InlineNotice tone="neutral">
                GitHub 未启用 Pull Requests 或 API 不提供该数据。PR 维度不参与评分，也不记为 0。
              </InlineNotice>
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="tnum text-2xl font-semibold text-ink-100">
                  {pulls.opened90d === 0 ? '—' : formatPercent(prRate, 1)}
                </span>
                <span className="text-[10px] text-ink-400">
                  {pulls.opened90d === 0
                    ? '近 90 天无新 PR'
                    : `${pulls.merged90d} / ${pulls.opened90d} 条已合并`}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded border border-ink-700/60 bg-ink-900/40 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-ink-500">当前开放 PR</p>
                  <p className="mt-1 tnum font-mono text-sm text-ink-200">{plugin.github.openPullRequests}</p>
                </div>
                <div className="rounded border border-ink-700/60 bg-ink-900/40 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-ink-500">样本</p>
                  <p className="mt-1 tnum font-mono text-sm text-ink-200">
                    {pulls.opened90d}
                    <span className="ml-1 text-[9px] text-ink-500">条</span>
                  </p>
                </div>
              </div>
              {pulls.lowSample && pulls.opened90d > 0 ? (
                <p className="mt-3 text-[10px] leading-4 text-amber/90">
                  样本少于 3 条，合并率不作强判断。
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DataSourcesPanel({ plugin }: { plugin: PluginRecord }): JSX.Element {
  const latest = useLoadedData();
  const sources = [
    {
      name: 'GitHub REST API',
      status: latest.latest.sources.github.status,
      time: latest.latest.sources.github.fetchedAt,
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-ink-400" />
          <h2 id="sources-title" className="text-sm font-semibold text-ink-100">
            数据来源与采集时间
          </h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
          SNAPSHOT {latest.latest.runId.slice(-8)}
        </span>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="border-b border-ink-700/60">
              <th className="py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">来源</th>
              <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">状态</th>
              <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">本次采集</th>
              <th className="px-2 py-2 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">证据</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/40">
            {sources.map((source) => (
              <tr key={source.name}>
                <td className="py-2.5">
                  <div className="text-[11px] text-ink-200">{source.name}</div>
                  <div className="mt-0.5 max-w-[280px] truncate text-[9px] text-ink-500">{source.detail}</div>
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase',
                      source.status === 'ok' || source.status === 'verified' || source.status === 'checked'
                        ? 'border-mint/20 bg-mint/5 text-mint'
                        : source.status === 'error' || source.status === 'failed'
                          ? 'border-rose/20 bg-rose/5 text-rose'
                          : 'border-amber/20 bg-amber/5 text-amber',
                    )}
                  >
                    {source.status}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-[10px] text-ink-300">
                  {source.time ? formatDateTime(source.time) : '—'}
                </td>
                <td className="px-2 py-2.5">
                  {source.link ? (
                    <ExternalTextLink href={source.link} className="text-[9px]">
                      打开来源
                    </ExternalTextLink>
                  ) : (
                    <span className="text-[9px] text-ink-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-700/60 px-4 py-2.5 text-[9px] text-ink-500">
        <span>
          页面快照 {formatDateTime(latest.latest.lastSuccessAt)} · {formatRelative(latest.latest.lastSuccessAt)}
        </span>
        <a
          href={`${import.meta.env.BASE_URL}data/latest.json`}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-auto inline-flex items-center gap-1 text-ink-400 hover:text-ink-200"
        >
          查看原始 JSON <ArrowUpRight size={9} />
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
  const historyPoints = plugin ? data.history.plugins[plugin.id] ?? [] : [];
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
          description="它可能已从配置中移除，或本次采集无法取得该仓库。请回到排行榜重新选择。"
          action={<ButtonLink to="/">返回排行榜</ButtonLink>}
        />
      </div>
    );
  }

  const risk = plugin.scores.risk;
  const riskStyle = riskTone(risk.level);
  const issueRate =
    plugin.github.issues.closureRate === null ? null : plugin.github.issues.closureRate * 100;
  const prRate =
    plugin.github.pullRequests.mergeRate === null
      ? null
      : plugin.github.pullRequests.mergeRate * 100;

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-12 pt-6 md:px-6 md:pt-8">
      <nav className="flex items-center gap-1.5 text-[10px] text-ink-500" aria-label="面包屑">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-ink-200">
          <ArrowLeft size={11} /> 排行榜
        </Link>
        <span className="text-ink-700">/</span>
        <span className="truncate text-ink-400">{plugin.repo}</span>
      </nav>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <PluginMonogram plugin={plugin} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-100 md:text-3xl">
                {plugin.name}
              </h1>
              <CategoryTag category={plugin.category} />
              {plugin.repository.archived ? (
                <span className="rounded border border-rose/25 bg-rose/5 px-1.5 py-0.5 text-[10px] text-rose">
                  已归档
                </span>
              ) : null}
              <DataStatusBadge status={plugin.dataStatus} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
              <a
                href={plugin.repository.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-mono text-ink-300 hover:text-ink-100"
              >
                <Github size={11} /> {plugin.repo}
              </a>
              {isExternalUrl(plugin.repository.homepageUrl) ? (
                <a
                  href={plugin.repository.homepageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 hover:text-ink-200"
                >
                  <Globe2 size={11} /> 项目主页
                </a>
              ) : null}
              {plugin.npm.registryUrl ? (
                <a
                  href={plugin.npm.registryUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 hover:text-ink-200"
                >
                  <Package size={11} /> {plugin.npm.packageName}
                </a>
              ) : null}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">
              {plugin.repository.description ?? '该仓库没有提供简介。'}
            </p>
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
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800/60 px-3.5 py-2 text-xs text-ink-100 transition hover:border-ink-500"
          >
            <Github size={13} /> GitHub <ArrowUpRight size={11} />
          </a>
        </div>
      </header>

      <div className="mt-5 max-w-2xl">
        <CopyButton value={plugin.installCommand} />
        <p className="mt-2 text-[10px] leading-5 text-ink-500">
          安装命令转录自项目公开 README / Release，本项目未执行验证。安装前请核对版本、来源与项目自身的安装说明。
        </p>
      </div>

      {plugin.scores.completeness.missing.length > 0 ? (
        <div className="mt-4 max-w-3xl">
          <InlineNotice tone={plugin.dataStatus === 'stale' ? 'rose' : 'amber'}>
            <span className="font-medium">数据缺口：</span>
            {plugin.scores.completeness.missing.map((item) => item.label).join('、')}。
            缺失项不会被当作真实零值，详见每项说明与来源。
          </InlineNotice>
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="评分摘要">
        <ScoreHero
          title="人气指数"
          subtitle="Star 与经核验下载量"
          score={plugin.scores.popularity.score}
          statusLabel={plugin.scores.popularity.status === 'scored' ? '相对人气' : '信息不足'}
          confidence={plugin.scores.popularity.confidence}
          coverageText={`证据覆盖 ${Math.round(plugin.scores.popularity.coverage * 100)}% · 相对本榜单`}
          icon={<Star size={13} />}
        >
          <a
            href="#explain-popularity"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-100"
          >
            为什么是这个分？ <ArrowUpRight size={10} />
          </a>
        </ScoreHero>
        <ScoreHero
          title="维护健康度"
          subtitle="提交 / Issue / PR / Release"
          score={plugin.scores.maintenance.score}
          statusLabel={
            plugin.scores.maintenance.status === 'insufficient'
              ? '信息不足'
              : plugin.scores.maintenance.score !== null && plugin.scores.maintenance.score >= 75
                ? '维护活跃'
                : plugin.scores.maintenance.score !== null && plugin.scores.maintenance.score >= 55
                  ? '平稳'
                  : '需要更多证据'
          }
          confidence={plugin.scores.maintenance.confidence}
          coverageText={`证据覆盖 ${Math.round(plugin.scores.maintenance.coverage * 100)}% · 不代表代码质量`}
          icon={<GitCommitHorizontal size={13} />}
          tone="mint"
        >
          <a
            href="#explain-maintenance"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-100"
          >
            为什么是这个分？ <ArrowUpRight size={10} />
          </a>
        </ScoreHero>

        <div className="panel overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-ink-700/70 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded border', riskStyle.border, riskStyle.bg, riskStyle.text)}>
                <ShieldAlert size={13} />
              </span>
              <div>
                <p className="text-[11px] font-medium text-ink-200">风险提示</p>
                <p className="mt-0.5 text-[10px] text-ink-400">公开信号，不是审计</p>
              </div>
            </div>
            <RiskBadge level={risk.level} compact />
          </div>
          <div className="px-4 pb-4 pt-3">
            <p className="text-[11px] leading-5 text-ink-300">
              {risk.flags.length > 0
                ? `${risk.flags.length} 条公开信号需要阅读；不代表存在安全事件。`
                : '未命中归档、公开漏洞或长期积压规则。'}
            </p>
            <ul className="mt-2 space-y-1.5">
              {risk.flags.slice(0, 3).map((flag) => (
                <li key={flag.code} className="flex items-start gap-1.5 text-[10px] leading-4 text-ink-400">
                  <span
                    className={cn(
                      'mt-1 h-1 w-1 shrink-0 rounded-full',
                      flag.level === 'high' ? 'bg-rose' : flag.level === 'medium' ? 'bg-amber' : 'bg-ink-500',
                    )}
                  />
                  {flag.title}
                </li>
              ))}
            </ul>
            <a href="#risk-evidence" className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-100">
              查看风险证据 <ArrowUpRight size={10} />
            </a>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-ink-700/70 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded border border-signal/20 bg-signal/5 text-signal-strong">
                <CircleDot size={13} />
              </span>
              <div>
                <p className="text-[11px] font-medium text-ink-200">数据完整度</p>
                <p className="mt-0.5 text-[10px] text-ink-400">7 个数据域</p>
              </div>
            </div>
            <span className="tnum font-mono text-lg text-ink-100">
              {plugin.scores.completeness.score}
              <span className="text-[9px] text-ink-500">%</span>
            </span>
          </div>
          <div className="px-4 pb-4 pt-3">
            <DataCoverage completeness={plugin.scores.completeness} />
            <p className="mt-2 text-[10px] leading-5 text-ink-400">
              {plugin.scores.completeness.available}/{plugin.scores.completeness.total} 个数据域可用。
              缺失不参与评分，也不记为 0。
            </p>
            <Link to="/method#completeness" className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-100">
              数据域说明 <ArrowUpRight size={10} />
            </Link>
          </div>
        </div>
      </section>

      <section className="panel mt-4 overflow-hidden" aria-label="原始指标">
        <div className="grid grid-cols-2 divide-x divide-y divide-ink-700/50 md:grid-cols-4 md:divide-y-0">
          <MiniMetric label="Stars" value={formatNumber(plugin.github.stars)} link={{ href: plugin.repository.url, label: 'GitHub' }} />
          <MiniMetric label="Forks" value={formatNumber(plugin.github.forks)} link={{ href: `${plugin.repository.url}/forks`, label: 'Forks' }} />
          <MiniMetric
            label="npm · 30 天下载"
            value={plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null ? formatNumber(plugin.npm.downloads30d) : '—'}
            sub={plugin.npm.status === 'verified' ? `包 ${plugin.npm.packageName}` : '暂无可靠下载数据'}
            link={plugin.npm.registryUrl ? { href: plugin.npm.registryUrl, label: 'npm registry' } : undefined}
          />
          <MiniMetric
            label="最近代码提交"
            value={formatRelative(plugin.github.lastCommitAt)}
            sub={plugin.github.lastCommitAt ? formatDate(plugin.github.lastCommitAt) : '未取得'}
            link={plugin.github.lastCommitUrl ? { href: plugin.github.lastCommitUrl, label: '提交记录' } : undefined}
          />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-ink-700/50 border-t border-ink-700/50 md:grid-cols-4 md:divide-y-0">
          <MiniMetric
            label="Issue 关闭率 · 90d"
            value={issueRate === null ? '—' : formatPercent(issueRate, 1)}
            sub={plugin.github.issues.opened90d === 0 ? '近 90 天无新 Issue' : `${plugin.github.issues.closed90d}/${plugin.github.issues.opened90d} 条`}
            link={{ href: plugin.github.issues.queryUrl, label: 'Issue 证据' }}
          />
          <MiniMetric
            label="PR 合并率 · 90d"
            value={prRate === null ? '—' : formatPercent(prRate, 1)}
            sub={!plugin.github.pullRequests.available ? 'PR 功能不可用' : `${plugin.github.pullRequests.merged90d}/${plugin.github.pullRequests.opened90d} 条`}
            link={plugin.github.pullRequests.available ? { href: plugin.github.pullRequests.queryUrl, label: 'PR 证据' } : undefined}
          />
          <MiniMetric
            label="长期开放 Issue"
            value={formatNumber(plugin.github.issues.longOpen)}
            sub={`当前开放 ${plugin.github.issues.openNow} 条`}
            link={{ href: plugin.github.issuesUrl, label: '当前 Issue' }}
          />
          <MiniMetric
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
      </section>

      <section className="mt-8" aria-labelledby="trend-title">
        <SectionHeading
          eyebrow="Longitudinal"
          title={<span id="trend-title">趋势与下载</span>}
          description="指数趋势来自 data 分支的历史快照；下载趋势来自 npm 最近 30 天日数据。"
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium text-ink-200">指数趋势</p>
                <p className="mt-0.5 text-[9px] text-ink-500">固定 0–100 · 维护与关注的相对变化</p>
              </div>
              <span className="font-mono text-[9px] text-ink-500">{historyPoints.length} snapshots</span>
            </div>
            {historyPoints.length >= 2 ? (
              <>
                <div className="px-1 pb-1">
                  <ScoreTrendChart points={historyPoints} height={276} />
                </div>
                {historySpanHours < 6 ? (
                  <p className="border-t border-ink-700/50 px-4 py-2 text-[9px] leading-4 text-amber/80">
                    当前历史跨度仅 {Math.max(1, Math.round(historySpanHours * 60))} 分钟，仅供验证数据链路；真正的维护趋势需要跨多个定时采集周期。
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-[276px] items-center justify-center px-6 text-center">
                <div>
                  <CalendarClock size={20} className="mx-auto text-ink-500" />
                  <p className="mt-3 text-xs text-ink-300">历史快照正在累积</p>
                  <p className="mt-1 max-w-xs text-[10px] leading-5 text-ink-500">
                    当前只有 {historyPoints.length} 个真实快照。下一次定时更新后会形成可比较的时间序列，不补造历史点。
                  </p>
                  <p className="mt-2 font-mono text-[9px] text-ink-500">
                    当前 维护 {formatScore(plugin.scores.maintenance.score)} / 人气 {formatScore(plugin.scores.popularity.score)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium text-ink-200">npm 下载</p>
                <p className="mt-0.5 text-[9px] text-ink-500">最近 30 天 · 日下载量 + 7 日移动平均</p>
              </div>
              {plugin.npm.status === 'verified' ? (
                <span className="font-mono text-[9px] text-ink-500">
                  {plugin.npm.downloads30d === null ? 'NO POINT DATA' : `${formatCompact(plugin.npm.downloads30d)} / 30d`}
                </span>
              ) : null}
            </div>
            {plugin.npm.status === 'verified' && plugin.npm.daily.length > 0 ? (
              <div className="px-1 pb-1">
                <DownloadBars daily={plugin.npm.daily} height={276} />
              </div>
            ) : (
              <div className="flex min-h-[276px] items-center justify-center px-6 text-center">
                <div>
                  <Package size={20} className="mx-auto text-ink-500" />
                  <p className="mt-3 text-xs text-ink-300">暂无可靠 npm 下载数据</p>
                  <p className="mt-1 max-w-xs text-[10px] leading-5 text-ink-500">
                    {plugin.npm.reason ??
                      '该插件没有可核验的 npm 包，或下载 API 暂未返回可用数据。Star、Release 下载量不会被冒充为 npm 下载量。'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="explain-title">
        <SectionHeading
          eyebrow="Explainability"
          title={<span id="explain-title">为什么得到这个评分</span>}
          description="展开查看每一项的原始值、归一化、权重、贡献与证据链接。缺失项明确标记为未计入。"
        />
        <div className="mt-4 space-y-3" id="explain-popularity">
          <ScoreExplainer plugin={plugin} kind="popularity" />
          <div id="explain-maintenance">
            <ScoreExplainer plugin={plugin} kind="maintenance" />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <IssueAndPrPanel plugin={plugin} />
        <SecurityPanel plugin={plugin} />
      </section>

      <section id="risk-evidence" className="mt-8">
        <SectionHeading
          eyebrow="Risk evidence"
          title="风险提示逐条说明"
          description="风险提示来自归档状态、长期未关闭 Issue、OSV 记录与数据新鲜度。它们不能替代安全审计或兼容性测试。"
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-ink-700/50">
              {risk.flags.length === 0 ? (
                <li className="px-4 py-5 text-[11px] leading-5 text-ink-300">
                  当前没有命中高风险或中等风险规则。请注意，这仍然不是“安全”或“零风险”的结论。
                </li>
              ) : (
                risk.flags.map((flag) => (
                  <li key={flag.code} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            flag.level === 'high' ? 'bg-rose' : flag.level === 'medium' ? 'bg-amber' : 'bg-ink-500',
                          )}
                        />
                        <p className="text-[11px] font-medium text-ink-200">{flag.title}</p>
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-500">
                        {flag.level}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-3.5 text-[10px] leading-5 text-ink-400">{flag.detail}</p>
                    {flag.evidenceUrl ? (
                      <div className="mt-1 pl-3.5">
                        <ExternalTextLink href={flag.evidenceUrl} className="text-[9px]">
                          查看原始证据
                        </ExternalTextLink>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="panel px-4 py-4">
            <div className="flex items-center gap-2">
              <ShieldQuestion size={14} className="text-ink-400" />
              <p className="text-[11px] font-medium text-ink-200">边界说明</p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {risk.limitations.map((limitation) => (
                <li key={limitation} className="flex items-start gap-2 text-[10px] leading-5 text-ink-400">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-600" />
                  {limitation}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-ink-700/60 pt-3">
              <p className="text-[9px] uppercase tracking-[0.12em] text-ink-500">当前结论</p>
              <p className="mt-1 text-xs text-ink-200">{risk.label}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <DataSourcesPanel plugin={plugin} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/30 px-4 py-3">
        <p className="text-[10px] leading-5 text-ink-400">
          想和其他插件并排看？对比页只展示指标差异，不会用单一指标断言谁“更好”。
        </p>
        <ButtonLink to={`/compare?a=${encodeURIComponent(plugin.id)}`} variant="secondary">
          选择对比插件 <ArrowUpRight size={11} />
        </ButtonLink>
      </div>
    </div>
  );
}
