import type { MaintenanceScore, PluginRecord } from './types';

type Comparison = { comparable: true; difference: number } | { comparable: false; reason: string };
export function compareScores(a: MaintenanceScore, b: MaintenanceScore): Comparison {
  if (a.status !== 'scored' || b.status !== 'scored' || a.score === null || b.score === null) return { comparable: false, reason: '信息不足，不计算分差' };
  if (a.methodVersion !== b.methodVersion) return { comparable: false, reason: '方法版本不同，不计算分差' };
  const left = a.components.filter((item) => item.included).sort((x, y) => x.key.localeCompare(y.key));
  const right = b.components.filter((item) => item.included).sort((x, y) => x.key.localeCompare(y.key));
  if (left.length !== right.length || left.some((item, index) => item.key !== right[index].key)) return { comparable: false, reason: '参与分项不同，不计算分差' };
  if (left.some((item, index) => Math.abs(item.effectiveWeight - right[index].effectiveWeight) > .0001)) return { comparable: false, reason: '有效权重不同，不计算分差' };
  return { comparable: true, difference: b.score - a.score };
}
export function comparisonText(a: PluginRecord, b: PluginRecord, kind: 'popularity' | 'maintenance'): string {
  if (a.dataStatus === 'stale' || b.dataStatus === 'stale' || Date.parse(a.lastUpdatedAt) !== Date.parse(b.lastUpdatedAt)) return '采集时间不同，不计算分差';
  const result = compareScores(a.scores[kind], b.scores[kind]);
  if (!result.comparable) return result.reason;
  if (Math.abs(result.difference) < .05) return '相同';
  return 'B ' + (result.difference > 0 ? '高 ' : '低 ') + Math.abs(result.difference).toFixed(1);
}
