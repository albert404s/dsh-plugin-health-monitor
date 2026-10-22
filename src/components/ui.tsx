import { QuietHint } from './quiet-hint';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
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
} from 'lucide-react';
import type { CompletenessResult, Confidence, PluginRecord, RiskLevel } from '../lib/types';
import { cn } from '../lib/cn';
import {
  dataStatusLabel,
  formatCompact,
  formatPercent,
  isExternalUrl,
  riskLabel,
  riskTone,
  scoreLabel,
} from '../lib/format';
import { categoryLabel } from '../lib/types';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function buttonClasses(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(
    'inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 max-sm:h-11',
    variant === 'primary'
      ? 'bg-brand text-content-inverse hover:bg-brand-strong active:bg-brand-active'
      : variant === 'secondary'
        ? 'border border-line-control bg-surface text-content-primary hover:border-content-primary hover:bg-surface-subtle active:bg-surface-sunken'
        : 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary active:bg-surface-sunken',
    className,
  );
}

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

export function DataBand({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return <div className={cn('data-band', className)}>{children}</div>;
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
        <h2 className="mt-1.5 text-2xl font-semibold leading-8 tracking-title text-content-primary lg:text-3xl lg:leading-9">
          {description ? <QuietHint text={description}>{title}</QuietHint> : title}
        </h2>
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
    return <span className={cn('text-content-muted', className)}>{emptyLabel}</span>;
  }
  return (
    <span className={cn('tnum', className)}>
      {value}
      {suffix ? <span className="ml-1 text-xs font-normal text-content-muted">{suffix}</span> : null}
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
    <div className={cn('h-1 w-full overflow-hidden rounded-chip bg-surface-sunken', className)}>
      <div
        className={cn(
          'h-full rounded-chip transition-[width] duration-200',
          muted || value === null ? 'bg-content-disabled' : 'bg-series-bar',
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
  const labels = { high: '依据较充分', medium: '依据一般', low: '依据较少' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-chip border border-line bg-surface-subtle px-1.5 py-0.5 text-2xs text-content-secondary',
        className,
      )}
    >
      {labels[confidence]}
    </span>
  );
}

const RISK_SHORT: Record<RiskLevel, string> = {
  high: '建议先了解',
  medium: '有选用提醒',
  low: '暂无额外提醒',
  unknown: '信息待补充',
};

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
    level === 'high'
      ? AlertTriangle
      : level === 'low'
        ? Check
        : CircleHelp;
  if (level === 'low') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1 text-2xs font-medium text-content-muted',
          className,
        )}
        title={riskLabel(level)}
      >
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
        {compact ? RISK_SHORT[level] : riskLabel(level)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 py-1 text-2xs font-medium',
        level === 'high' ? 'border-l-2 border-l-risk-high' : '',
        level === 'medium' ? 'border-l-2 border-l-risk-medium' : '',
        level === 'unknown' ? 'border-dashed' : '',
        tone.border,
        tone.bg,
        tone.text,
        className,
      )}
      title={riskLabel(level)}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {compact ? RISK_SHORT[level] : riskLabel(level)}
    </span>
  );
}

export function DataStatusBadge({
  status,
  className,
}: {
  status: PluginRecord['dataStatus'];
  className?: string;
}): JSX.Element | null {
  if (status === 'complete') return null;
  const stale = status === 'stale';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-chip border px-1.5 py-0.5 text-2xs',
        stale
          ? 'border-warning-line bg-warning-soft text-warning'
          : 'border-line bg-surface-subtle text-content-secondary',
        className,
      )}
    >
      <span
        className={cn('h-1 w-1 rounded-full', stale ? 'bg-warning' : 'bg-content-muted')}
        aria-hidden="true"
      />
      {stale ? '历史快照' : dataStatusLabel(status)}
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
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {showSegments ? (
        <div className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: completeness.total }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-2 w-1.5 rounded-[1px]',
                index < completeness.available ? 'bg-series-bar' : 'bg-surface-sunken',
              )}
            />
          ))}
        </div>
      ) : null}
      <span className="tnum font-mono text-2xs text-content-secondary">
        {completeness.available}/{completeness.total}
        <span className="ml-1 font-sans text-content-muted">域</span>
      </span>
    </div>
  );
}

export function CoverageChip({
  completeness,
  className,
}: {
  completeness: CompletenessResult;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface-subtle px-2 py-1 text-2xs text-content-secondary',
        className,
      )}
      title={`数据完整度 ${completeness.score}%：${completeness.available}/${completeness.total} 个数据域可用`}
    >
      <span className="tnum font-mono">
        {completeness.available}/{completeness.total}
      </span>
      数据域
    </span>
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
        'inline-flex shrink-0 items-center justify-center rounded-control border border-line bg-surface-subtle font-mono font-semibold text-content-secondary',
        size === 'sm' ? 'h-8 w-8 text-2xs' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-xs',
      )}
    >
      {initials}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }): JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border border-line bg-surface-subtle px-1.5 py-0.5 text-2xs text-content-secondary">
      <span className="h-1.5 w-1.5 rounded-[1px] bg-content-muted" aria-hidden="true" />
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
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-control border border-line-control bg-surface sm:flex-row sm:items-stretch',
        className,
      )}
    >
      <code className="min-w-0 flex-1 break-all px-3 py-2.5 font-mono text-xs leading-5 text-content-primary">
        {value}
      </code>
      <button
        type="button"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 border-t border-line px-3 text-2xs text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content-primary sm:h-auto sm:border-l sm:border-t-0"
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
            <Check size={14} /> 已复制
          </>
        ) : state === 'error' ? (
          <>复制失败</>
        ) : (
          <>
            <Copy size={14} /> {label}
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
    return <span className={cn('text-content-muted', className)}>{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'inline-flex items-center gap-1 text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline',
        className,
      )}
    >
      {children}
      {hideIcon ? null : <ExternalLink size={12} className="shrink-0 opacity-70" aria-hidden="true" />}
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
  variant?: ButtonVariant;
  className?: string;
}): JSX.Element {
  return (
    <Link to={to} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}

export function ButtonAnchor({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}): JSX.Element {
  return (
    <a href={href} className={buttonClasses(variant, className)}>
      {children}
    </a>
  );
}

export function InfoHint({
  text,
  align = 'center',
}: {
  text: string;
  align?: 'center' | 'right';
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-control text-content-muted transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-surface-subtle hover:text-content-primary"
        aria-label={`查看说明：${text}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          'absolute bottom-[calc(100%+6px)] z-30 w-60 max-w-[calc(100vw-2rem)] rounded-panel border border-line-strong bg-surface px-3 py-2.5 text-xs font-normal leading-5 text-content-secondary shadow-pop',
          align === 'right' ? 'right-0' : 'left-0',
          open ? 'block' : 'hidden',
        )}
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
  insideLink = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
  insideLink?: boolean;
}): JSX.Element {
  return (
    <div className={cn('min-w-0 px-4 py-4 md:px-5 md:py-5 xl:py-6', className)}>
      <div className="flex items-center gap-1.5 text-2xs font-medium text-content-secondary">
        <QuietHint text={detail ?? label} focusable={!insideLink} className="gap-1.5">{icon ? <span className="text-content-muted">{icon}</span> : null}{label}</QuietHint>
      </div>
      <div className="readout mt-2.5 text-[2.25rem] md:text-[2.5rem] xl:text-[2.75rem]">
        {value}
      </div>
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
      <p className="tnum font-mono text-2xs text-content-muted">
        第 {page} / {totalPages} 页 · 共 {total} 个结果
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-control border border-line-control px-2.5 text-xs text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-35 max-sm:h-11"
          aria-label="上一页"
        >
          <ChevronLeft size={14} /> 上一页
        </button>
        {list.map((value, index) => (
          <span key={value} className="flex items-center">
            {index > 0 && value - list[index - 1] > 1 ? (
              <span className="px-1 text-content-muted">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPageChange(value)}
              aria-current={value === page ? 'page' : undefined}
              className={cn(
                'h-10 min-w-10 rounded-control px-2 text-xs transition-colors max-sm:h-11 max-sm:min-w-11',
                value === page
                  ? 'bg-brand text-content-inverse hover:bg-brand-strong'
                  : 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary',
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
          className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-control border border-line-control px-2.5 text-xs text-content-secondary transition-colors hover:border-content-primary hover:bg-surface-subtle hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-35 max-sm:h-11"
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
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-chip border border-dashed border-line-strong bg-surface-subtle text-content-secondary">
        {icon ?? <SearchX size={20} strokeWidth={1.6} />}
      </div>
      <h3 className="mt-4 text-[0.9375rem] font-semibold text-content-primary">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-content-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = '正在读取本地数据快照' }: { label?: string }): JSX.Element {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <Loader2 size={22} className="animate-spin text-content-secondary" aria-hidden="true" />
      <p className="text-sm text-content-secondary">{label}</p>
      <div className="mt-2 grid w-full max-w-2xl grid-cols-2 gap-2 md:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 rounded-panel border border-line-hairline bg-surface-sunken" />
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
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-20" role="alert">
      <div className="panel p-6 md:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-control border border-danger-line bg-danger-soft text-danger">
            <ServerOff size={20} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-2xs font-medium text-danger">数据不可用</p>
            <h1 className="mt-1 text-2xl font-semibold text-content-primary">数据快照无法加载</h1>
          </div>
        </div>
        <p className="mt-5 text-base leading-6 text-content">{message}</p>
        {import.meta.env.DEV ? (
          <div className="mt-6 rounded-control border border-line bg-surface-subtle p-4">
            <p className="text-2xs font-medium text-content-secondary">本地开发</p>
            <pre className="mt-2 overflow-x-auto font-mono text-xs leading-6 text-content">
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
            <button type="button" onClick={onRetry} className={buttonClasses('secondary')}>
              <ArrowLeft size={14} className="rotate-180" /> 重新加载
            </button>
          ) : null}
          <Link to="/method" className="text-sm text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline">
            查看数据方法与更新机制
          </Link>
        </div>
      </div>
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
        'flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-xs leading-5',
        tone === 'amber'
          ? 'border-warning-line bg-warning-soft text-warning'
          : tone === 'rose'
            ? 'border-danger-line bg-danger-soft text-danger'
            : tone === 'mint'
              ? 'border-success-line bg-success-soft text-success'
              : 'border-line bg-surface-subtle text-content-secondary',
        className,
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {tone === 'rose' ? (
          <ShieldAlert size={14} />
        ) : tone === 'mint' ? (
          <ShieldCheck size={14} />
        ) : (
          <AlertTriangle size={14} />
        )}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DividerLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line-hairline" />
      <span className="text-2xs font-medium text-content-muted">{children}</span>
      <span className="h-px flex-1 bg-line-hairline" />
    </div>
  );
}

export function RelativeTime({ iso }: { iso: string | null | undefined }): JSX.Element {
  if (!iso) return <span className="text-content-muted">未知</span>;
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
