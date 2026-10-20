import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpRight, Info, Scale } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import type { PluginRecord } from '../lib/types';
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatRelative,
  formatScore,
} from '../lib/format';
import {
  ButtonLink,
  CategoryTag,
  CoverageChip,
  DataCoverage,
  EmptyState,
  InlineNotice,
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
  return <span className="text-xs leading-5 text-content-muted">{reason}</span>;
}

function scoreValue(plugin: PluginRecord, kind: 'popularity' | 'maintenance'): JSX.Element {
  const score = plugin.scores[kind];
  if (score.status !== 'scored' || score.score === null) {
    return unavailable('信息不足');
  }
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum font-mono text-base font-medium text-content-primary">{formatScore(score.score)}</span>
        <span className="text-xs text-content-muted">/100</span>
      </div>
      <ScoreBar value={score.score} className="mt-1.5 w-24" />
      <p className="mt-1 text-2xs text-content-muted">
        {score.confidence === 'high' ? '依据较充分' : score.confidence === 'medium' ? '依据一般' : '依据较少'} · 覆盖{' '}
        {Math.round(score.coverage * 100)}%
      </p>
    </div>
  );
}

function scoreDiff(a: PluginRecord, b: PluginRecord, kind: 'popularity' | 'maintenance'): string {
  const left = a.scores[kind].score;
  const right = b.scores[kind].score;
  if (left === null || right === null) return '不可比';
  const difference = right - left;
  if (Math.abs(difference) < 0.05) return '相同';
  return `B ${difference > 0 ? '高' : '低'} ${Math.abs(difference).toFixed(1)}`;
}

function numericDiff(left: number | null, right: number | null, unit = ''): string {
  if (left === null || right === null) return '不可比';
  const difference = right - left;
  if (difference === 0) return '相同';
  return `B ${difference > 0 ? '高' : '低'} ${formatNumber(Math.abs(difference))}${unit}`;
}

function compareSideLabel(side: 'A' | 'B', plugin: PluginRecord): string {
  return `${side} · ${plugin.name}`;
}

export function ComparePage(): JSX.Element {
  const { latest } = useLoadedData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resetNotice, setResetNotice] = useState(false);
  const plugins = latest.plugins;
  const fallbackA = plugins[0];
  const fallbackB = plugins[1] ?? plugins[0];
  const rawA = searchParams.get('a');
  const rawB = searchParams.get('b');
  const aInvalid = Boolean(rawA && !plugins.some((plugin) => plugin.id === rawA));
  const bInvalid = Boolean(rawB && !plugins.some((plugin) => plugin.id === rawB));
  const sameSelection = Boolean(rawA && rawB && rawA === rawB);

  let left = (rawA ? plugins.find((plugin) => plugin.id === rawA) : fallbackA) ?? fallbackA;
  let right = (rawB ? plugins.find((plugin) => plugin.id === rawB) : fallbackB) ?? fallbackB;
  if (left && right && left.id === right.id) {
    right = plugins.find((plugin) => plugin.id !== left.id) ?? right;
  }

  useEffect(() => {
    if (!left || !right || !(aInvalid || bInvalid || sameSelection)) return;
    setResetNotice(true);
    const next = new URLSearchParams(searchParams);
    next.set('a', left.id);
    next.set('b', right.id);
    setSearchParams(next, { replace: true });
  }, [aInvalid, bInvalid, sameSelection, left, right, searchParams, setSearchParams]);

  function select(side: 'a' | 'b', value: string): void {
    setResetNotice(false);
    const next = new URLSearchParams(searchParams);
    next.set(side, value);
    setSearchParams(next, { replace: true });
  }

  function swap(): void {
    if (!left || !right) return;
    setResetNotice(false);
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
        label: '关注度',
        hint: 'Star 与 npm 下载的对数归一化合成',
        a: scoreValue(left, 'popularity'),
        b: scoreValue(right, 'popularity'),
        diff: scoreDiff(left, right, 'popularity'),
      },
      {
        label: '维护活跃度',
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
        diff: numericDiff(left.github.stars, right.github.stars),
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
        diff: numericDiff(
          left.npm.status === 'verified' ? left.npm.downloads30d : null,
          right.npm.status === 'verified' ? right.npm.downloads30d : null,
        ),
      },
      {
        label: '开发活跃度',
        hint: '近 30 天提交次数',
        a: `${formatNumber(left.github.commits30d)}${left.github.commits30dTruncated ? '+' : ''} 次`,
        b: `${formatNumber(right.github.commits30d)}${right.github.commits30dTruncated ? '+' : ''} 次`,
        diff: numericDiff(left.github.commits30d, right.github.commits30d, ' 次'),
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
            : `${(bIssueRate - aIssueRate > 0 ? 'B 高 ' : bIssueRate - aIssueRate < 0 ? 'B 低 ' : '')}${
                bIssueRate === aIssueRate ? '相同' : `${Math.abs(bIssueRate - aIssueRate).toFixed(1)} pp`
              }`,
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
            : `${(bPrRate - aPrRate > 0 ? 'B 高 ' : bPrRate - aPrRate < 0 ? 'B 低 ' : '')}${
                bPrRate === aPrRate ? '相同' : `${Math.abs(bPrRate - aPrRate).toFixed(1)} pp`
              }`,
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
            <span className="tnum font-mono text-sm text-content-primary">{left.scores.completeness.score}%</span>
            <DataCoverage completeness={left.scores.completeness} className="mt-1" />
          </div>
        ),
        b: (
          <div>
            <span className="tnum font-mono text-sm text-content-primary">{right.scores.completeness.score}%</span>
            <DataCoverage completeness={right.scores.completeness} className="mt-1" />
          </div>
        ),
        diff: numericDiff(left.scores.completeness.score, right.scores.completeness.score, ' pp'),
      },
      {
        label: '公开风险',
        hint: '归档、长期 Issue、OSV 与数据缺口',
        a: <RiskBadge level={left.scores.risk.level} compact />,
        b: <RiskBadge level={right.scores.risk.level} compact />,
        diff: `A ${left.scores.risk.flags.length} · B ${right.scores.risk.flags.length} 条信号`,
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

  if (plugins.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState title="至少需要两个插件才能比较" description="当前快照中的插件数量不足。" />
      </div>
    );
  }

  if (!left || !right) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState title="请选择两个不同插件" description="当前选择可能相同或不在快照中。" />
      </div>
    );
  }

  const summary = [
    { label: '人气', value: scoreDiff(left, right, 'popularity') },
    { label: '维护', value: scoreDiff(left, right, 'maintenance') },
    { label: '覆盖', value: numericDiff(left.scores.completeness.score, right.scores.completeness.score, ' pp') },
  ];

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-12 pt-8 md:px-6 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stamp">COMPARE / 03</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-[1.15] tracking-tightest text-content-primary md:text-4xl lg:text-[2.5rem]">
            并排比较两个插件
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-content-secondary">
            对齐同一采集窗口，展示可核对的差异；不会基于单一指标评判谁“更好”。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-content-muted">
          <Scale size={14} aria-hidden="true" /> {plugins.length} 个可比较对象
        </div>
      </div>

      <div className="data-band mt-6">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]">
          {[
            { plugin: left, side: 'a' as const, label: 'A' as const },
            { plugin: right, side: 'b' as const, label: 'B' as const },
          ].map(({ plugin, side, label }, index) => (
            <div
              key={side}
              className={cn(
                'min-w-0',
                index === 1 ? 'border-t border-line lg:order-3 lg:border-t-0' : 'lg:order-1',
              )}
            >
              {index === 1 ? (
                <div className="flex items-center justify-center border-t border-line px-4 py-2 lg:hidden">
                  <button
                    type="button"
                    onClick={swap}
                    className="inline-flex h-11 items-center gap-1.5 rounded-control border border-line-control bg-surface px-4 text-sm text-content-secondary transition hover:border-content-muted hover:text-content-primary"
                    aria-label="交换两侧插件"
                  >
                    <ArrowLeftRight size={15} /> 交换 A / B
                  </button>
                </div>
              ) : null}
              <div className={cn('px-4 py-4 md:px-5', index === 1 ? 'lg:pl-0' : 'lg:pr-0')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-content-secondary">
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-chip bg-brand-soft font-mono text-2xs text-brand-text">
                      {label}
                    </span>
                    {compareSideLabel(label, plugin)}
                  </span>
                  <Link
                    to={`/plugins/${encodeURIComponent(plugin.id)}`}
                    className="inline-flex items-center gap-1 text-xs text-content-secondary hover:text-brand-text"
                  >
                    详情 <ArrowUpRight size={11} />
                  </Link>
                </div>
                <label className="sr-only" htmlFor={`compare-${side}`}>
                  选择插件 {label}
                </label>
                <select
                  id={`compare-${side}`}
                  value={plugin.id}
                  onChange={(event) => select(side, event.target.value)}
                  className="select-field mt-3 w-full"
                >
                  {plugins.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      disabled={side === 'a' ? option.id === right.id : option.id === left.id}
                    >
                      {option.name} · {formatCompact(option.github.stars)} stars
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex items-start gap-3">
                  <PluginMonogram plugin={plugin} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        to={`/plugins/${encodeURIComponent(plugin.id)}`}
                        className="break-words text-lg font-semibold text-content-primary hover:text-brand-text"
                      >
                        {plugin.name}
                      </Link>
                      <CategoryTag category={plugin.category} />
                      <CoverageChip completeness={plugin.scores.completeness} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-content-secondary">{plugin.curatorNote}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-content-muted">
                      <span>{formatNumber(plugin.github.stars)} stars</span>
                      <span>{formatRelative(plugin.github.lastCommitAt)}更新</span>
                      <span>
                        {plugin.npm.downloads30d === null
                          ? '暂无可靠下载'
                          : `${formatCompact(plugin.npm.downloads30d)} / 30d`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="hidden items-center justify-center border-x border-line lg:order-2 lg:flex">
            <button
              type="button"
              onClick={swap}
              className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line-control bg-surface text-content-secondary transition hover:border-content-muted hover:text-content-primary"
              aria-label="交换两侧插件"
            >
              <ArrowLeftRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {resetNotice ? (
        <InlineNotice tone="amber" className="mt-4">
          URL 中的插件不在当前快照，或两侧选择了同一个插件，已重置为可比较的示例；地址栏已同步。
        </InlineNotice>
      ) : rawA || rawB ? null : (
        <p className="mt-3 text-xs text-content-muted">
          当前显示示例对比（前两个插件）。可在上方更换，或从插件详情页加入对比。
        </p>
      )}

      <div
        className={cn(
          'mt-4 flex items-start gap-2.5 border px-3 py-2.5 text-xs leading-5',
          left.scores.completeness.score === right.scores.completeness.score
            ? 'border-line bg-surface-subtle text-content-secondary'
            : 'border-warning-line bg-warning-soft text-warning',
        )}
      >
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {left.scores.completeness.score === right.scores.completeness.score
            ? `两侧数据完整度相同（${left.scores.completeness.score}% / ${right.scores.completeness.score}%）。缺失项显示“不可比”，不会被补 0。`
            : `两侧数据完整度不同：${left.name} ${left.scores.completeness.score}% / ${right.name} ${right.scores.completeness.score}%。差异可能来自数据覆盖，而不是真实行为差异；缺失项显示“不可比”，不会被补 0。`}
        </span>
      </div>

      <section className="mt-6" aria-labelledby="compare-matrix-title">
        <SectionHeading
          eyebrow="04 / METRIC MATRIX"
          title={<span id="compare-matrix-title">指标对照</span>}
        />

        <div className="data-band mt-4">
          <div className="grid grid-cols-1 divide-y divide-line-hairline md:grid-cols-3 md:divide-x md:divide-y-0">
            {summary.map((item) => (
              <div key={item.label} className="min-w-0 px-4 py-3 md:px-5">
                <p className="text-2xs font-medium text-content-muted">{item.label}</p>
                <p className="mt-1.5 break-words font-mono text-sm text-content-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel mt-4 overflow-clip">
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[27%]" />
                <col className="w-[27%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line-control bg-surface-subtle">
                  <th className="sticky top-[var(--header-h)] z-20 border-b border-line-control bg-surface-subtle px-4 py-3 text-2xs font-medium text-content-secondary md:px-5">
                    指标
                  </th>
                  <th className="sticky top-[var(--header-h)] z-20 border-b border-line-control bg-surface-subtle px-3 py-3 text-2xs font-medium text-content-secondary">
                    {compareSideLabel('A', left)}
                  </th>
                  <th className="sticky top-[var(--header-h)] z-20 border-b border-line-control bg-surface-subtle px-3 py-3 text-2xs font-medium text-content-secondary">
                    {compareSideLabel('B', right)}
                  </th>
                  <th className="sticky top-[var(--header-h)] z-20 border-b border-line-control bg-surface-subtle px-3 py-3 text-2xs font-medium text-content-secondary">
                    差异 B − A
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-hairline">
                {rows.map((row) => (
                  <tr key={row.label} className="align-top transition hover:bg-surface-subtle">
                    <th scope="row" className="px-4 py-3.5 md:px-5">
                      <p className="text-sm font-semibold text-content-primary">{row.label}</p>
                      <p className="mt-1 text-2xs leading-4 text-content-muted">{row.hint}</p>
                    </th>
                    <td className="px-3 py-3.5 text-sm text-content-primary">{row.a}</td>
                    <td className="px-3 py-3.5 text-sm text-content-primary">{row.b}</td>
                    <td className="px-3 py-3.5 text-xs text-content-secondary">{row.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden">
            {/* Short A/B labels only; the full names stay available to screen readers. */}
            <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-subtle px-4 py-2.5 text-2xs text-content-secondary">
              <span className="font-mono font-medium text-content-primary">
                A<span className="sr-only"> · {left.name}</span>
              </span>
              <span className="text-right font-mono font-medium text-content-primary">
                B<span className="sr-only"> · {right.name}</span>
              </span>
            </div>
            <div className="divide-y divide-line-hairline">
              {rows.map((row) => (
                <div key={row.label} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-content-primary">{row.label}</p>
                      <p className="mt-0.5 text-2xs leading-4 text-content-muted">{row.hint}</p>
                    </div>
                    <span className="max-w-[55%] break-words text-right text-xs text-content-secondary">{row.diff}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-line-hairline pt-2.5">
                    <div className="min-w-0">
                      <p className="mb-1 text-2xs font-medium text-content-muted">A</p>
                      <div className="text-sm leading-5 text-content-primary">{row.a}</div>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-2xs font-medium text-content-muted">B</p>
                      <div className="text-sm leading-5 text-content-primary">{row.b}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
        <p className="max-w-2xl text-xs leading-5 text-content-secondary">
          对比只呈现指标。一个插件可能因样本小、无 Release 或没有 npm 包而看起来不同；请结合详情页的样本量、口径和原始链接阅读。
          也不会用单一指标断言谁“更好”。
        </p>
        <ButtonLink to="/method" variant="ghost">
          阅读口径
        </ButtonLink>
      </div>
    </div>
  );
}
