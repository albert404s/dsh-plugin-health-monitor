import type { PluginRecord, RiskLevel } from './types';

const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1000) return numberFormatter.format(value);
  return compactFormatter.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return dateTimeFormatter.format(date).replace(/\//g, '-');
}

export function formatRelative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return '刚刚';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

export function ageHours(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return (Date.now() - timestamp) / 3_600_000;
}

export function isDataStale(lastSuccessAt: string | null | undefined): boolean {
  const age = ageHours(lastSuccessAt);
  return age === null || age > 8;
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(1);
}

export function formatSigned(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

export function formatDownloadValue(plugin: PluginRecord): string {
  if (plugin.npm.status !== 'verified' || plugin.npm.downloads30d === null) {
    return '暂无可靠数据';
  }
  return `${formatCompact(plugin.npm.downloads30d)} / 30 天`;
}

export function scoreLabel(plugin: PluginRecord): string {
  if (plugin.scores.maintenance.status === 'insufficient') return '信息不足';
  const score = plugin.scores.maintenance.score ?? 0;
  if (score >= 75) return '维护活跃';
  if (score >= 55) return '平稳';
  if (score >= 35) return '放缓';
  return '低活跃';
}

export function scoreTone(score: number | null): string {
  if (score === null) return 'text-ink-400';
  if (score >= 70) return 'text-mint';
  if (score >= 50) return 'text-amber';
  return 'text-rose';
}

export function riskLabel(level: RiskLevel): string {
  if (level === 'high') return '高风险信号';
  if (level === 'medium') return '需要关注';
  if (level === 'low') return '未见公开风险';
  return '风险信息不完整';
}

export function riskTone(level: RiskLevel): {
  text: string;
  border: string;
  bg: string;
  dot: string;
} {
  if (level === 'high') {
    return {
      text: 'text-rose',
      border: 'border-rose/25',
      bg: 'bg-rose/10',
      dot: 'bg-rose',
    };
  }
  if (level === 'medium') {
    return {
      text: 'text-amber',
      border: 'border-amber/25',
      bg: 'bg-amber/10',
      dot: 'bg-amber',
    };
  }
  if (level === 'low') {
    return {
      text: 'text-mint',
      border: 'border-mint/20',
      bg: 'bg-mint/5',
      dot: 'bg-mint',
    };
  }
  return {
    text: 'text-ink-300',
    border: 'border-ink-600',
    bg: 'bg-ink-700/30',
    dot: 'bg-ink-400',
  };
}

export function dataStatusLabel(status: PluginRecord['dataStatus']): string {
  if (status === 'complete') return '数据完整';
  if (status === 'partial') return '部分数据';
  return '历史回退';
}

export function repoShortName(plugin: PluginRecord): string {
  return plugin.repo;
}

export function compactInstall(command: string, max = 64): string {
  if (command.length <= max) return command;
  return `${command.slice(0, max - 1)}…`;
}

export function categoryTone(category: string): string {
  const palette = [
    'border-signal/25 bg-signal/10 text-signal-strong',
    'border-mint/20 bg-mint/5 text-mint',
    'border-amber/20 bg-amber/5 text-amber',
    'border-ink-600 bg-ink-700/30 text-ink-200',
  ];
  let hash = 0;
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function clampPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function isExternalUrl(url: string | null | undefined): url is string {
  return Boolean(url && /^https?:\/\//.test(url));
}
