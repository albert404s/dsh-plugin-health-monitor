import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpRight, Info, Scale } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import type { PluginRecord } from '../lib/types';
import {
  formatCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelative,
  formatScore,
  riskLabel,
} from '../lib/format';
import {
  ButtonLink,
  CategoryTag,
  DataCoverage,
  DataStatusBadge,
  EmptyState,
  ExternalTextLink,
  PluginMonogram,
  RiskBadge,
  ScoreBar,
  SectionHeading,
} from '../components/ui';
import { cn } from '../lib/cn';

interface CompareRow {
  label: string;
  hint: string;
  a: React.ReactNode;
  b: React.ReactNode;
  diff: React.ReactNode;
}

function unavailable(reason: string): JSX.Element {
  return <span className="text-[10px] leading-4 text-ink-500">{reason}</span>;
}

function scoreValue(plugin: PluginRecord, kind: 'popularity' | 'maintenance'): JSX.Element {
  const score = plugin.scores[kind];
  if (score.status !== 'scored' || score.score === null) {
    return unavailable('信息不足');
  }
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum font-mono text-lg font-medium text-ink-100">{formatScore(score.score)}</span>
        <span className="text-[9px] text-ink-500">/100</span>
      </div>
      <ScoreBar value={score.score} className="mt-1.5 w-24" />
      <p className="mt-1 text-[9px] text-ink-500">
        置信 {score.confidence} · 覆盖 {Math.round(score.coverage * 100)}%
      </p>
    </div>
  );
}

function scoreDiff(a: PluginRecord, b: PluginRecord, kind: 'popularity' | 'maintenance'): string {
  const left = a.scores[kind].score;
  const right = b.scores[kind].score;
  if (left === null || right === null) return '不可比';
  const difference = right - left;
  return `${difference > 0 ? '+' : ''}${difference.toFixed(1)}`;
}

export function ComparePage(): JSX.Element {
  const { latest } = useLoadedData();
  const [searchParams, setSearchParams] = useSearchParams();
  const fallbackB = latest.plugins[1]?.id ?? '';
  const leftId = searchParams.get('a') || latest.plugins[0]?.id || '';
  const rightId = searchParams.get('b') || fallbackB;
  const left = latest.plugins.find((plugin) => plugin.id === leftId) ?? latest.plugins[0];
  const right = latest.plugins.find((plugin) => plugin.id === rightId && plugin.id !== left?.id) ?? latest.plugins.find((plugin) => plugin.id !== left?.id);

  function select(side: 'a' | 'b', value: string): void {
    const next = new URLSearchParams(searchParams);
    if (side === 'a') next.set('a', value);
    else next.set('b', value);
    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function swap(): void {
    if (!left || !right) return;
    const next = new URLSearchParams(searchParams);
    next.set('a', right.id);
    next.set('b', left.id);
    setSearchParams(next, { replace: true });
  }

  const rows = useMemo<CompareRow[]>(() => {
    if (!left || !right) return [];
    const aIssues = left.github.issues;
    const bIssues = right.github.issues;
    const aPulls = left.github.pullRequests;
    const bPulls = right.github.pullRequests;
    const aIssueRate = aIssues.closureRate === null ? null : aIssues.closureRate * 100;
    const bIssueRate = bIssues.closureRate === null ? null : bIssues.closureRate * 100;
    const aPrRate = aPulls.mergeRate === null ? null : aPulls.mergeRate * 100;
    const bPrRate = bPulls.mergeRate === null ? null : bPulls.mergeRate * 100;
    const releaseDiff = (() => {
      if (!left.github.latestRelease || !right.github.latestRelease) return '不可比';
      const leftTime = new Date(left.github.latestRelease.publishedAt ?? 0).getTime();
      const rightTime = new Date(right.github.latestRelease.publishedAt ?? 0).getTime();
      if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return '不可比';
      const days = Math.round(Math.abs(rightTime - leftTime) / 86_400_000);
      if (days === 0) return '同日发布';
      return `B 比 A ${rightTime > leftTime ? '晚' : '早'} ${days} 天`;
    })();

    return [
      {
        label: '人气指数',
        hint: 'Star 与 npm 下载的对数归一化合成',
        a: scoreValue(left, 'popularity'),
        b: scoreValue(right, 'popularity'),
        diff: scoreDiff(left, right, 'popularity'),
      },
      {
        label: '维护健康度',
        hint: '提交、Issue、PR 与 Release 的相对信号',
        a: scoreValue(left, 'maintenance'),
        b: scoreValue(right, 'maintenance'),
        diff: scoreDiff(left, right, 'maintenance'),
      },
      {
        label: 'Stars',
        hint: 'GitHub 当前值，不衡量用户质量',
        a: formatNumber(left.github.stars),
        b: formatNumber(right.github.stars),
        diff: `${right.github.stars - left.github.stars > 0 ? '+' : ''}${formatNumber(right.github.stars - left.github.stars)}`,
      },
      {
        label: 'npm 30 天下载',
        hint: '只有 repository 字段核验通过的包',
        a:
          left.npm.status === 'verified' && left.npm.downloads30d !== null
            ? formatNumber(left.npm.downloads30d)
            : unavailable('暂无可靠下载数据'),
        b:
          right.npm.status === 'verified' && right.npm.downloads30d !== null
            ? formatNumber(right.npm.downloads30d)
            : unavailable('暂无可靠下载数据'),
        diff:
          left.npm.status === 'verified' &&
          right.npm.status === 'verified' &&
          left.npm.downloads30d !== null &&
          right.npm.downloads30d !== null
            ? formatNumber(right.npm.downloads30d - left.npm.downloads30d)
            : '不可比',
      },
      {
        label: '开发活跃度',
        hint: '近 30 天提交次数',
        a: `${formatNumber(left.github.commits30d)}${left.github.commits30dTruncated ? '+' : ''} 次`,
        b: `${formatNumber(right.github.commits30d)}${right.github.commits30dTruncated ? '+' : ''} 次`,
        diff: `${right.github.commits30d - left.github.commits30d > 0 ? '+' : ''}${right.github.commits30d - left.github.commits30d}`,
      },
      {
        label: 'Issue 处理',
        hint: '近 90 天创建的非 PR Issue 当前关闭比例',
        a:
          aIssues.opened90d === 0
            ? unavailable('近 90 天无新 Issue')
            : `${aIssues.closed90d}/${aIssues.opened90d} · ${formatPercent(aIssueRate, 1)}`,
        b:
          bIssues.opened90d === 0
            ? unavailable('近 90 天无新 Issue')
            : `${bIssues.closed90d}/${bIssues.opened90d} · ${formatPercent(bIssueRate, 1)}`,
        diff:
          aIssueRate === null || bIssueRate === null
            ? '不可比'
            : `${(bIssueRate - aIssueRate > 0 ? '+' : '')}${(bIssueRate - aIssueRate).toFixed(1)} pp`,
      },
      {
        label: 'PR 处理',
        hint: '近 90 天创建的 PR 合并比例',
        a: !aPulls.available
          ? unavailable('PR 功能不可用')
          : aPulls.opened90d === 0
            ? unavailable('近 90 天无新 PR')
            : `${aPulls.merged90d}/${aPulls.opened90d} · ${formatPercent(aPrRate, 1)}`,
        b: !bPulls.available
          ? unavailable('PR 功能不可用')
          : bPulls.opened90d === 0
            ? unavailable('近 90 天无新 PR')
            : `${bPulls.merged90d}/${bPulls.opened90d} · ${formatPercent(bPrRate, 1)}`,
        diff:
          !aPulls.available || !bPulls.available || aPrRate === null || bPrRate === null
            ? '不可比'
            : `${(bPrRate - aPrRate > 0 ? '+' : '')}${(bPrRate - aPrRate).toFixed(1)} pp`,
      },
      {
        label: '版本更新',
        hint: '最近一次 Release 与近 90 天发布次数',
        a: left.github.latestRelease
          ? `${left.github.latestRelease.version} · ${formatRelative(left.github.latestRelease.publishedAt)}`
          : unavailable('没有 Release'),
        b: right.github.latestRelease
          ? `${right.github.latestRelease.version} · ${formatRelative(right.github.latestRelease.publishedAt)}`
          : unavailable('没有 Release'),
        diff: releaseDiff,
      },
      {
        label: '数据完整程度',
        hint: '7 个数据域中可用项；不是插件质量',
        a: (
          <div>
            <span className="tnum font-mono text-sm text-ink-100">{left.scores.completeness.score}%</span>
            <DataCoverage completeness={left.scores.completeness} className="mt-1" />
          </div>
        ),
        b: (
          <div>
            <span className="tnum font-mono text-sm text-ink-100">{right.scores.completeness.score}%</span>
            <DataCoverage completeness={right.scores.completeness} className="mt-1" />
          </div>
        ),
        diff: `${right.scores.completeness.score - left.scores.completeness.score > 0 ? '+' : ''}${right.scores.completeness.score - left.scores.completeness.score} pp`,
      },
      {
        label: '公开风险',
        hint: '归档、长期 Issue、OSV 与数据缺口',
        a: <RiskBadge level={left.scores.risk.level} compact />,
        b: <RiskBadge level={right.scores.risk.level} compact />,
        diff: `A ${left.scores.risk.flags.length} 条信号 · B ${right.scores.risk.flags.length} 条信号`,
      },
      {
        label: 'OSV 漏洞检查',
        hint: '精确匹配 npm 包与版本',
        a:
          left.security.status === 'checked'
            ? `${left.security.vulnerabilities.length} 条公开记录`
            : unavailable('未完成检查'),
        b:
          right.security.status === 'checked'
            ? `${right.security.vulnerabilities.length} 条公开记录`
            : unavailable('未完成检查'),
        diff:
          left.security.status === 'checked' && right.security.status === 'checked'
            ? `A ${left.security.vulnerabilities.length} 条 · B ${right.security.vulnerabilities.length} 条`
            : '不可比',
      },
    ];
  }, [left, right]);

  if (latest.plugins.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState title="至少需要两个插件才能比较" description="当前快照中的插件数量不足。" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-12 pt-8 md:px-6 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Side-by-side</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-100 md:text-4xl">
            并排比较
            <span className="text-ink-400">两个插件</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">
            对齐相同的统计窗口和数据来源，展示可核对的差异。比较结果不是质量排名，也不会基于单一指标替你选“更好”的插件。
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-ink-500">
          <Scale size={13} /> {latest.plugins.length} 个可比较对象
        </div>
      </div>

      {!left || !right ? (
        <div className="mt-8">
          <EmptyState title="请选择两个不同插件" description="当前选择可能相同或不在快照中。" />
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch" aria-label="选择对比插件">
            {[
              { plugin: left, side: 'a' as const, label: 'A' },
              { plugin: right, side: 'b' as const, label: 'B' },
            ].map(({ plugin, side, label }, index) => (
              <div key={side} className={cn('contents', index === 1 && 'lg:contents')}>
                {index === 1 ? (
                  <div className="flex items-center justify-center lg:px-1">
                    <button
                      type="button"
                      onClick={swap}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2.5 text-[10px] text-ink-300 transition hover:border-ink-500 hover:text-ink-100"
                      aria-label="交换两侧插件"
                    >
                      <ArrowLeftRight size={12} /> 交换
                    </button>
                  </div>
                ) : null}
                <div className="panel overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-signal/25 bg-signal/10 font-mono text-[10px] text-signal-strong">
                        {label}
                      </span>
                      <span className="text-[10px] text-ink-400">选择插件</span>
                    </div>
                    <Link
                      to={`/plugins/${encodeURIComponent(plugin.id)}`}
                      className="inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-100"
                    >
                      详情 <ArrowUpRight size={10} />
                    </Link>
                  </div>
                  <div className="px-4 pb-4 pt-3">
                    <label className="sr-only" htmlFor={`compare-${side}`}>
                      选择插件 {label}
                    </label>
                    <select
                      id={`compare-${side}`}
                      value={plugin.id}
                      onChange={(event) => select(side, event.target.value)}
                      className="select-field w-full"
                    >
                      {latest.plugins.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={
                            (side === 'a' ? option.id === right.id : option.id === left.id) || false
                          }
                        >
                          {option.name} · {formatCompact(option.github.stars)} stars
                        </option>
                      ))}
                    </select>
                    <div className="mt-4 flex items-start gap-3">
                      <PluginMonogram plugin={plugin} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link to={`/plugins/${encodeURIComponent(plugin.id)}`} className="text-lg font-semibold text-ink-100 hover:text-signal-strong">
                            {plugin.name}
                          </Link>
                          <CategoryTag category={plugin.category} />
                          <DataStatusBadge status={plugin.dataStatus} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-400">
                          {plugin.repository.description ?? '无简介'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-400">
                          <span>{formatNumber(plugin.github.stars)} stars</span>
                          <span>{formatRelative(plugin.github.lastCommitAt)}提交</span>
                          <span>{plugin.npm.downloads30d === null ? '暂无可靠下载' : `${formatCompact(plugin.npm.downloads30d)} / 30d`}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-amber/20 bg-amber/5 px-3 py-2.5 text-[10px] leading-5 text-amber/90">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              两侧数据完整度不同：{left.name} {left.scores.completeness.score}% / {right.name}{' '}
              {right.scores.completeness.score}%。差异可能来自数据覆盖，而不是真实行为差异；缺失项显示“不可比”，不会被补 0。
            </span>
          </div>

          <section className="panel mt-4 overflow-hidden" aria-labelledby="compare-matrix-title">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3.5">
              <div>
                <p className="eyebrow">Metric matrix</p>
                <h2 id="compare-matrix-title" className="mt-1 text-sm font-semibold text-ink-100">
                  指标对照
                </h2>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-500">
                同一采集窗口 · 相对数值不是绝对标准
              </span>
            </div>
            <div className="divide-y divide-ink-700/40 md:hidden">
              {rows.map((row) => (
                <div key={row.label} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-ink-200">{row.label}</p>
                      <p className="mt-0.5 text-[9px] leading-4 text-ink-500">{row.hint}</p>
                    </div>
                    <span className="shrink-0 text-right text-[9px] leading-4 text-ink-300">{row.diff}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-ink-700/40 pt-2.5">
                    <div className="min-w-0">
                      <p className="mb-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-ink-500">A · {left.name}</p>
                      <div className="text-[11px] leading-5 text-ink-200">{row.a}</div>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-ink-500">B · {right.name}</p>
                      <div className="text-[11px] leading-5 text-ink-200">{row.b}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-ink-700/60 bg-ink-900/30">
                    <th className="w-[180px] px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">指标</th>
                    <th className="w-[31%] px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">
                      A · {left.name}
                    </th>
                    <th className="w-[31%] px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">
                      B · {right.name}
                    </th>
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">差异 B − A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40">
                  {rows.map((row) => (
                    <tr key={row.label} className="align-top transition hover:bg-ink-800/25">
                      <th scope="row" className="px-4 py-3.5">
                        <p className="text-[11px] font-medium text-ink-200">{row.label}</p>
                        <p className="mt-1 max-w-[150px] text-[9px] leading-4 text-ink-500">{row.hint}</p>
                      </th>
                      <td className="px-4 py-3.5 text-[11px] text-ink-200">{row.a}</td>
                      <td className="px-4 py-3.5 text-[11px] text-ink-200">{row.b}</td>
                      <td className="px-4 py-3.5 text-[10px] text-ink-300">
                        {row.diff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[left, right].map((plugin) => (
              <section key={plugin.id} className="panel overflow-hidden" aria-label={`${plugin.name} 风险摘要`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PluginMonogram plugin={plugin} size="sm" />
                    <span className="text-xs font-medium text-ink-100">{plugin.name}</span>
                  </div>
                  <RiskBadge level={plugin.scores.risk.level} compact />
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] leading-5 text-ink-400">
                    风险：{riskLabel(plugin.scores.risk.level)}。数据覆盖{' '}
                    {plugin.scores.completeness.available}/{plugin.scores.completeness.total} 个域。
                  </p>
                  {plugin.scores.risk.flags.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {plugin.scores.risk.flags.slice(0, 3).map((flag) => (
                        <li key={flag.code} className="text-[10px] leading-5 text-ink-300">
                          · {flag.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[10px] leading-5 text-ink-500">
                      未命中公开风险规则；这不等于安全或零风险。
                    </p>
                  )}
                  <Link to={`/plugins/${encodeURIComponent(plugin.id)}`} className="mt-3 inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-100">
                    查看完整证据 <ArrowUpRight size={10} />
                  </Link>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/30 px-4 py-3 text-[10px] leading-5 text-ink-400">
            <span className="max-w-2xl">
              对比只呈现指标。一个插件可能因样本小、无 Release 或没有 npm 包而看起来不同；请结合详情页的样本量、口径和原始链接阅读。
            </span>
            <ButtonLink to="/method" variant="ghost">
              阅读口径
            </ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
