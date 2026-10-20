import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Loader2,
  SearchX,
  ServerOff,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import type { CompletenessResult, Confidence, PluginRecord, RiskLevel } from '../lib/types';
import { cn } from '../lib/cn';
import { categoryTone, dataStatusLabel, formatCompact, formatPercent, isExternalUrl, riskLabel, riskTone, scoreLabel, scoreTone } from '../lib/format';
import { categoryLabel } from '../lib/types';

export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}): JSX.Element {
  return <Tag className={cn('panel', className)}>{children}</Tag>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink-100 md:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricValue({
  value,
  suffix,
  emptyLabel = '暂无数据',
  className,
}: {
  value: string | number | null | undefined;
  suffix?: string;
  emptyLabel?: string;
  className?: string;
}): JSX.Element {
  if (value === null || value === undefined || value === '') {
    return <span className={cn('text-ink-400', className)}>{emptyLabel}</span>;
  }
  return (
    <span className={cn('tnum', className)}>
      {value}
      {suffix ? <span className="ml-1 text-xs font-normal text-ink-400">{suffix}</span> : null}
    </span>
  );
}

export function ScoreBar({
  value,
  className,
  muted = false,
}: {
  value: number | null;
  className?: string;
  muted?: boolean;
}): JSX.Element {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-700', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          muted
            ? 'bg-ink-500'
            : width >= 70
              ? 'bg-mint'
              : width >= 50
                ? 'bg-amber'
                : 'bg-rose',
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}): JSX.Element {
  const labels = { high: '高置信', medium: '中置信', low: '低置信' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        confidence === 'high'
          ? 'border-mint/20 bg-mint/5 text-mint'
          : confidence === 'medium'
            ? 'border-ink-600 bg-ink-700/30 text-ink-200'
            : 'border-amber/20 bg-amber/5 text-amber',
        className,
      )}
    >
      {labels[confidence]}
    </span>
  );
}

export function RiskBadge({
  level,
  compact = false,
  className,
}: {
  level: RiskLevel;
  compact?: boolean;
  className?: string;
}): JSX.Element {
  const tone = riskTone(level);
  const Icon =
    level === 'high' ? ShieldAlert : level === 'medium' ? AlertTriangle : level === 'low' ? ShieldCheck : ShieldQuestion;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium',
        tone.border,
        tone.bg,
        tone.text,
        className,
      )}
      title={riskLabel(level)}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {compact ? riskLabel(level).replace('信号', '') : riskLabel(level)}
    </span>
  );
}

export function DataStatusBadge({
  status,
  className,
}: {
  status: PluginRecord['dataStatus'];
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px]',
        status === 'complete'
          ? 'border-mint/20 bg-mint/5 text-mint'
          : status === 'partial'
            ? 'border-amber/20 bg-amber/5 text-amber'
            : 'border-rose/20 bg-rose/5 text-rose',
        className,
      )}
    >
      <span
        className={cn(
          'h-1 w-1 rounded-full',
          status === 'complete' ? 'bg-mint' : status === 'partial' ? 'bg-amber' : 'bg-rose',
        )}
      />
      {dataStatusLabel(status)}
    </span>
  );
}

export function DataCoverage({
  completeness,
  showSegments = true,
  className,
}: {
  completeness: CompletenessResult;
  showSegments?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showSegments ? (
        <div className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: completeness.total }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-2.5 w-1.5 rounded-[1px]',
                index < completeness.available ? 'bg-signal/70' : 'bg-ink-700',
              )}
            />
          ))}
        </div>
      ) : null}
      <span className="tnum font-mono text-[11px] text-ink-300">
        {completeness.available}/{completeness.total}
        <span className="ml-1 text-ink-400">域</span>
      </span>
    </div>
  );
}

export function PluginMonogram({
  plugin,
  size = 'md',
}: {
  plugin: PluginRecord;
  size?: 'sm' | 'md' | 'lg';
}): JSX.Element {
  const initials = (plugin.name.replace(/^dsh[-_]?/i, '').slice(0, 2) || plugin.name.slice(0, 2)).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border font-mono font-semibold tracking-tight',
        categoryTone(plugin.category),
        size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-[11px]',
      )}
    >
      {initials}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }): JSX.Element {
  return (
    <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px]', categoryTone(category))}>
      {categoryLabel(category)}
    </span>
  );
}

export function CopyButton({
  value,
  label = '复制安装命令',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  return (
    <div className={cn('flex items-stretch overflow-hidden rounded-md border border-ink-700 bg-ink-900/80', className)}>
      <code className="min-w-0 flex-1 truncate px-3 py-2 font-mono text-[11px] leading-5 text-ink-200" title={value}>
        {value}
      </code>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 border-l border-ink-700 px-2.5 text-[11px] text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setState('copied');
            window.setTimeout(() => setState('idle'), 1600);
          } catch {
            setState('error');
            window.setTimeout(() => setState('idle'), 2000);
          }
        }}
        aria-label={label}
      >
        {state === 'copied' ? (
          <>
            <Check size={13} /> 已复制
          </>
        ) : state === 'error' ? (
          <>复制失败</>
        ) : (
          <>
            <Copy size={13} /> {label}
          </>
        )}
      </button>
    </div>
  );
}

export function ExternalTextLink({
  href,
  children,
  className,
  hideIcon = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  hideIcon?: boolean;
}): JSX.Element {
  if (!isExternalUrl(href)) {
    return <span className={cn('text-ink-400', className)}>{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'inline-flex items-center gap-1 text-ink-300 underline-offset-4 transition hover:text-ink-100 hover:underline',
        className,
      )}
    >
      {children}
      {hideIcon ? null : <ExternalLink size={11} className="shrink-0 opacity-70" aria-hidden="true" />}
    </a>
  );
}

export function ButtonLink({
  to,
  children,
  variant = 'primary',
  className,
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}): JSX.Element {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        variant === 'primary'
          ? 'bg-signal text-white hover:bg-signal-strong'
          : variant === 'secondary'
            ? 'border border-ink-600 bg-ink-800/60 text-ink-100 hover:border-ink-500 hover:bg-ink-800'
            : 'text-ink-300 hover:bg-ink-800/70 hover:text-ink-100',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function InfoHint({ text }: { text: string }): JSX.Element {
  return (
    <span className="group relative inline-flex align-middle">
      <CircleHelp
        size={13}
        className="text-ink-400 transition group-hover:text-ink-200"
        aria-hidden="true"
      />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-2 text-[11px] font-normal leading-4 text-ink-200 opacity-0 shadow-xl transition group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function StatCell({
  label,
  value,
  detail,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('group relative min-w-0 px-5 py-4 transition hover:bg-ink-800/30 md:px-6', className)}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.13em] text-ink-400">
        {icon ? <span className="text-ink-500">{icon}</span> : null}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink-100 tnum md:text-[28px]">
        {value}
      </div>
      {detail ? <div className="mt-1.5 text-[11px] leading-4 text-ink-400">{detail}</div> : null}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}): JSX.Element {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const list = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="插件列表分页">
      <p className="text-[11px] text-ink-400 tnum">
        第 {page} / {totalPages} 页 · 共 {total} 个结果
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-700 px-2.5 text-[11px] text-ink-300 transition hover:border-ink-500 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="上一页"
        >
          <ChevronLeft size={14} /> 上一页
        </button>
        {list.map((value, index) => (
          <span key={value} className="flex items-center">
            {index > 0 && value - list[index - 1] > 1 ? (
              <span className="px-1 text-ink-500">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPageChange(value)}
              aria-current={value === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-md px-2 text-[11px] transition',
                value === page
                  ? 'bg-signal text-white'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
              )}
            >
              {value}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-700 px-2.5 text-[11px] text-ink-300 transition hover:border-ink-500 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="下一页"
        >
          下一页 <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}

export function EmptyState({
  title = '没有匹配的插件',
  description = '尝试修改搜索词或清除筛选条件。',
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-ink-700 bg-ink-800/60 text-ink-300">
        {icon ?? <SearchX size={20} strokeWidth={1.6} />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink-100">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-ink-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = '正在读取本地数据快照' }: { label?: string }): JSX.Element {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <Loader2 size={22} className="animate-spin text-signal" />
      <p className="text-xs text-ink-400">{label}</p>
      <div className="mt-2 grid w-full max-w-2xl grid-cols-2 gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-md border border-ink-700/60 bg-ink-850/60"
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5 py-20" role="alert">
      <div className="panel p-7 md:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-rose/20 bg-rose/5 text-rose">
            <ServerOff size={20} strokeWidth={1.7} />
          </span>
          <div>
            <p className="eyebrow text-rose/80">Data unavailable</p>
            <h1 className="mt-1 text-lg font-semibold text-ink-100">数据快照无法加载</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-ink-300">
          {message}
        </p>
        {import.meta.env.DEV ? (
          <div className="mt-6 rounded-md border border-ink-700 bg-ink-900/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">本地开发</p>
            <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-6 text-ink-200">
{`npm run data:pull
# 或配置 GITHUB_TOKEN 后
npm run collect
npm run dev`}
            </pre>
          </div>
        ) : (
          <InlineNotice tone="neutral" className="mt-6">
            线上快照暂不可用。请稍后重试；维护者可以在 GitHub Actions 查看数据更新任务与最近成功快照。
          </InlineNotice>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-md bg-signal px-3.5 py-2 text-xs font-medium text-white transition hover:bg-signal-strong"
            >
              <ArrowLeft size={13} className="rotate-180" /> 重新加载
            </button>
          ) : null}
          <Link to="/method" className="text-xs text-ink-300 underline-offset-4 hover:text-ink-100 hover:underline">
            查看数据方法与更新机制
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ScoreHero({
  title,
  subtitle,
  score,
  statusLabel,
  confidence,
  coverageText,
  icon,
  tone = 'signal',
  children,
}: {
  title: string;
  subtitle: string;
  score: number | null;
  statusLabel: string;
  confidence?: Confidence;
  coverageText?: string;
  icon: ReactNode;
  tone?: 'signal' | 'mint' | 'amber';
  children?: ReactNode;
}): JSX.Element {
  const toneClass =
    tone === 'mint'
      ? 'text-mint border-mint/20 bg-mint/5'
      : tone === 'amber'
        ? 'text-amber border-amber/20 bg-amber/5'
        : 'text-signal-strong border-signal/20 bg-signal/5';
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-ink-700/70 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded border', toneClass)}>
            {icon}
          </span>
          <div>
            <p className="text-[11px] font-medium text-ink-200">{title}</p>
            <p className="mt-0.5 text-[10px] text-ink-400">{subtitle}</p>
          </div>
        </div>
        {confidence ? <ConfidenceBadge confidence={confidence} /> : null}
      </div>
      <div className="px-4 pb-4 pt-4">
        <div className="flex items-baseline gap-2">
          <span className={cn('tnum text-4xl font-semibold tracking-tight', scoreTone(score))}>
            {score === null ? '—' : score.toFixed(1)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-500">/ 100</span>
          <span className="ml-auto text-[11px] text-ink-300">{statusLabel}</span>
        </div>
        {score === null ? null : <ScoreBar value={score} className="mt-3" />}
        {coverageText ? <p className="mt-2 text-[10px] text-ink-400">{coverageText}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function MiniMetric({
  label,
  value,
  sub,
  link,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  link?: { href: string; label: string };
}): JSX.Element {
  return (
    <div className="min-w-0 border-t border-ink-700/60 px-0 py-4 first:border-t-0 md:border-l md:border-t-0 md:px-5 md:first:border-l-0">
      <p className="text-[10px] uppercase tracking-[0.1em] text-ink-400">{label}</p>
      <div className="mt-1.5 text-lg font-medium text-ink-100 tnum">{value}</div>
      {sub ? <div className="mt-1 text-[11px] leading-4 text-ink-400">{sub}</div> : null}
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-200"
        >
          {link.label} <ExternalLink size={9} />
        </a>
      ) : null}
    </div>
  );
}

export function InlineNotice({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'amber' | 'rose' | 'mint';
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[11px] leading-5',
        tone === 'amber'
          ? 'border-amber/20 bg-amber/5 text-amber/90'
          : tone === 'rose'
            ? 'border-rose/20 bg-rose/5 text-rose/90'
            : tone === 'mint'
              ? 'border-mint/20 bg-mint/5 text-mint/90'
              : 'border-ink-700 bg-ink-850/60 text-ink-300',
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">
        {tone === 'rose' ? <ShieldAlert size={13} /> : tone === 'mint' ? <ShieldCheck size={13} /> : <CircleHelp size={13} />}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DividerLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-ink-700/70" />
      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-500">{children}</span>
      <span className="h-px flex-1 bg-ink-700/70" />
    </div>
  );
}

export function RelativeTime({ iso }: { iso: string | null | undefined }): JSX.Element {
  if (!iso) return <span className="text-ink-500">未知</span>;
  return (
    <time dateTime={iso} title={iso}>
      {new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
        Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000),
        'day',
      )}
    </time>
  );
}

export function formatScore(score: number | null): string {
  return score === null ? '—' : score.toFixed(1);
}

export function formatClosure(plugin: PluginRecord): string {
  const { issues } = plugin.github;
  if (issues.opened90d === 0) return '近 90 天无新 Issue';
  const rate = issues.closureRate === null ? null : formatPercent(issues.closureRate * 100);
  return `${issues.closed90d}/${issues.opened90d} 已关闭${rate ? ` · ${rate}` : ''}`;
}

export function formatMerge(plugin: PluginRecord): string {
  const { pullRequests } = plugin.github;
  if (!pullRequests.available) return 'PR 功能不可用';
  if (pullRequests.opened90d === 0) return '近 90 天无新 PR';
  const rate = pullRequests.mergeRate === null ? null : formatPercent(pullRequests.mergeRate * 100);
  return `${pullRequests.merged90d}/${pullRequests.opened90d} 已合并${rate ? ` · ${rate}` : ''}`;
}

export function compactMaintenance(plugin: PluginRecord): string {
  if (plugin.scores.maintenance.status === 'insufficient') return '信息不足';
  return `${scoreLabel(plugin)} · ${formatCompact(plugin.github.commits30d)} 次提交/30天`;
}
