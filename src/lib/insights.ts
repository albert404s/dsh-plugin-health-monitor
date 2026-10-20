import type { HistoryFile, HistoryPoint, PluginRecord } from './types';
import { formatCompact, formatSigned } from './format';

export interface AttentionItem {
  plugin: PluginRecord;
  reasons: string[];
  severity: number;
}

export interface ChangeItem {
  plugin: PluginRecord;
  title: string;
  detail: string;
  tone: 'up' | 'down' | 'neutral';
  magnitude: number;
  since: string | null;
}

function watchReasons(plugin: PluginRecord): { reasons: string[]; severity: number } {
  const reasons: string[] = [];
  let severity = 0;
  const highFlags = plugin.scores.risk.flags.filter((flag) => flag.level === 'high');
  const mediumFlags = plugin.scores.risk.flags.filter((flag) => flag.level === 'medium');
  if (highFlags.length > 0) {
    reasons.push(highFlags[0].title);
    severity += 35;
  }
  if (mediumFlags.length > 0) {
    reasons.push(mediumFlags[0].title);
    severity += 20;
  }
  if (plugin.repository.archived) {
    reasons.push('仓库已归档');
    severity += 30;
  }
  if (plugin.dataStatus === 'stale') {
    reasons.push('本次沿用历史快照');
    severity += 10;
  }
  if (plugin.scores.completeness.score < 70) {
    reasons.push(`数据覆盖 ${plugin.scores.completeness.available}/${plugin.scores.completeness.total}`);
    severity += 8;
  }
  if (plugin.security.status !== 'checked') {
    reasons.push('漏洞检查未完成');
    severity += 6;
  }
  if (plugin.scores.maintenance.status === 'scored' && (plugin.scores.maintenance.score ?? 100) < 45) {
    reasons.push('维护活动明显放缓');
    severity += 12;
  }
  if (plugin.github.issues.lowSample && plugin.github.issues.opened90d > 0) {
    reasons.push(`Issue 样本仅 ${plugin.github.issues.opened90d} 条`);
    severity += 3;
  }
  return { reasons: [...new Set(reasons)].slice(0, 3), severity };
}

export function attentionPlugins(plugins: PluginRecord[], limit = 4): AttentionItem[] {
  return plugins
    .map((plugin) => ({ plugin, ...watchReasons(plugin) }))
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.severity - a.severity || (a.plugin.scores.completeness.score - b.plugin.scores.completeness.score))
    .slice(0, limit);
}

function historyPair(history: HistoryFile, id: string): [HistoryPoint, HistoryPoint] | null {
  const points = history.plugins[id];
  if (!points || points.length < 2) return null;
  return [points[points.length - 2], points[points.length - 1]];
}

export function recentChanges(
  plugins: PluginRecord[],
  history: HistoryFile,
  limit = 4,
): ChangeItem[] {
  const items: ChangeItem[] = [];
  for (const plugin of plugins) {
    const pair = historyPair(history, plugin.id);
    if (pair) {
      const [previous, latest] = pair;
      if (previous.methodVersion !== latest.methodVersion) continue;
      if (previous.riskLevel !== latest.riskLevel) {
        const unknown =
          latest.riskLevel === 'unknown' || previous.riskLevel === 'unknown';
        const worsened =
          !unknown &&
          ((latest.riskLevel === 'high' && previous.riskLevel !== 'high') ||
            (latest.riskLevel === 'medium' && previous.riskLevel === 'low'));
        items.push({
          plugin,
          title: unknown ? '风险信息发生变化' : '风险信号发生变化',
          detail: `${previous.riskLevel} → ${latest.riskLevel}`,
          tone: unknown ? 'neutral' : worsened ? 'down' : 'up',
          magnitude: unknown ? 8 : worsened ? 40 : 12,
          since: latest.t,
        });
      }
      if (
        previous.maintenance !== null &&
        latest.maintenance !== null &&
        Math.abs(latest.maintenance - previous.maintenance) >= 4
      ) {
        const delta = latest.maintenance - previous.maintenance;
        items.push({
          plugin,
          title: '维护指数变化',
          detail: `${formatSigned(delta, 1)} 分（${previous.maintenance.toFixed(1)} → ${latest.maintenance.toFixed(1)}）`,
          tone: delta >= 0 ? 'up' : 'down',
          magnitude: Math.abs(delta),
          since: latest.t,
        });
      }
      if (
        previous.popularity !== null &&
        latest.popularity !== null &&
        Math.abs(latest.popularity - previous.popularity) >= 3
      ) {
        const delta = latest.popularity - previous.popularity;
        items.push({
          plugin,
          title: '人气指数变化',
          detail: `${formatSigned(delta, 1)} 分（${previous.popularity.toFixed(1)} → ${latest.popularity.toFixed(1)}）`,
          tone: delta >= 0 ? 'up' : 'down',
          magnitude: Math.abs(delta),
          since: latest.t,
        });
      }
      if (previous.stars > 0) {
        const starDelta = latest.stars - previous.stars;
        const starPct = (starDelta / previous.stars) * 100;
        if (Math.abs(starPct) >= 5) {
          items.push({
            plugin,
            title: 'Star 数变化',
            detail: `${formatSigned(starDelta, 0)}（${formatSigned(starPct, 1)}%）`,
            tone: starDelta >= 0 ? 'up' : 'down',
            magnitude: Math.abs(starPct),
            since: latest.t,
          });
        }
      }
    }

    if (
      plugin.npm.status === 'verified' &&
      plugin.npm.weeklyChangePct !== null &&
      Math.abs(plugin.npm.weeklyChangePct) >= 8
    ) {
      const positive = plugin.npm.weeklyChangePct >= 0;
      items.push({
        plugin,
        title: 'npm 周下载量变化',
        detail: `${formatSigned(plugin.npm.weeklyChangePct, 1)}% · 近 7 天 ${formatCompact(plugin.npm.downloads7d)} 次`,
        tone: positive ? 'up' : 'down',
        magnitude: Math.min(30, Math.abs(plugin.npm.weeklyChangePct)),
        since: plugin.npm.fetchedAt,
      });
    }
  }

  const deduped = new Map<string, ChangeItem>();
  for (const item of items.sort((a, b) => b.magnitude - a.magnitude)) {
    if (!deduped.has(item.plugin.id)) deduped.set(item.plugin.id, item);
  }
  return [...deduped.values()].slice(0, limit);
}

export function hasMeaningfulHistory(history: HistoryFile): boolean {
  return Object.values(history.plugins).some((points) => points.length >= 2);
}
