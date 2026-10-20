import { Activity, Database, ShieldAlert } from 'lucide-react';
import type { PluginRecord, RiskFlag } from '../lib/types';
import { ExternalTextLink } from './ui';
const missingCodes = new Set(['osv-unchecked', 'npm-unverified', 'stale-data']);
export function AttentionSummary({ plugin, compact = false }: { plugin: PluginRecord; compact?: boolean }): JSX.Element {
  const flags = plugin.scores.risk.flags;
  const maintenance = flags.filter((flag) => !flag.code.startsWith('osv-') && !missingCodes.has(flag.code));
  const security = flags.filter((flag) => flag.code.startsWith('osv-') && flag.code !== 'osv-unchecked');
  const gaps = flags.filter((flag) => missingCodes.has(flag.code));
  const groups = [
    { title: '维护提醒', icon: Activity, flags: maintenance, empty: '未命中维护提醒规则。仍建议查看提交与 Issue 记录。' },
    { title: '公开漏洞', icon: ShieldAlert, flags: security, empty: plugin.security.status === 'checked' && plugin.security.exactMatch ? '精确版本查询未返回公开漏洞记录；这不等于安全保证。' : '未完成漏洞检查，尚不能判断公开漏洞情况。' },
    { title: '数据缺口', icon: Database, flags: gaps, empty: plugin.scores.completeness.missing.length ? '缺少：' + plugin.scores.completeness.missing.map((item) => item.label).join('、') : '当前七个数据域均有覆盖，仍受来源和统计窗口限制。' },
  ];
  function flagRow(flag: RiskFlag): JSX.Element {
    return <li key={flag.code} className="mt-3 border-t border-line-hairline pt-3"><p className="text-sm font-medium text-content-primary">{flag.title}</p>{!compact && <p className="mt-1 text-xs leading-6 text-content-secondary">{flag.detail}</p>}{!compact && flag.evidenceUrl && <ExternalTextLink href={flag.evidenceUrl} className="mt-1 text-xs">查看原始证据</ExternalTextLink>}</li>;
  }
  return <div className={'orbit-attention-grid' + (compact ? ' is-compact' : '')}>{groups.map(({ title, icon: Icon, flags: items, empty }) => <section key={title} className="panel p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-content-primary"><Icon size={15} className="text-brand-text" aria-hidden="true" />{title}<span className="ml-auto font-mono text-xs text-content-muted">{items.length || '—'}</span></h3>{items.length > 0 ? <ul>{items.map(flagRow)}</ul> : <p className="mt-3 text-xs leading-6 text-content-secondary">{empty}</p>}</section>)}</div>;
}
