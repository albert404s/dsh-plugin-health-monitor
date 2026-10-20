import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus, Radar } from 'lucide-react';
import type { HistoryFile, PluginRecord } from '../lib/types';
import { attentionPlugins, recentChanges } from '../lib/insights';
import { formatRelative, riskLabel } from '../lib/format';
import { categoryLabel } from '../lib/types';
import { CategoryTag, InfoHint, RiskBadge } from './ui';

export function AttentionPanel({ plugins }: { plugins: PluginRecord[] }): JSX.Element {
  const items = attentionPlugins(plugins, 4);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Radar size={16} className="text-content-secondary" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-content-primary">值得关注</h3>
        <InfoHint text="这里汇总风险信号与数据缺口，不等同于质量差或安全结论。" />
        <Link
          to="/?risk=high#all-plugins"
          className="ml-auto text-xs text-content-secondary underline-offset-4 hover:text-accent hover:underline"
        >
          查看高风险插件
        </Link>
      </div>
      <p className="mt-1 text-xs leading-5 text-content-secondary">
        风险信号、归档状态与数据缺口，按可解释规则排序。
      </p>
      {items.length === 0 ? (
        <p className="mt-4 border-t border-line-hairline py-6 text-sm leading-6 text-content-secondary">
          当前没有触发关注规则。这不代表所有插件都健康或安全，只说明没有命中归档、积压、漏洞或数据缺口规则。
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line-hairline">
          {items.map(({ plugin, reasons }) => (
            <li key={plugin.id}>
              <Link
                to={`/plugins/${encodeURIComponent(plugin.id)}`}
                className="group block py-3 transition hover:bg-surface-subtle"
              >
                <div className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content-primary transition group-hover:text-accent">
                      {plugin.name}
                    </p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {categoryLabel(plugin.category)} · {riskLabel(plugin.scores.risk.level)}
                    </p>
                  </div>
                  {plugin.scores.risk.level === 'low' ? (
                    <span className="text-2xs text-content-muted">未见风险</span>
                  ) : (
                    <RiskBadge level={plugin.scores.risk.level} compact />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-chip border border-line bg-surface-subtle px-1.5 py-0.5 text-2xs text-content-secondary"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function historySpanHours(history: HistoryFile): number {
  const points = Object.values(history.plugins).flat();
  if (points.length === 0) return 0;
  const times = points
    .map((point) => new Date(point.t).getTime())
    .filter((time) => Number.isFinite(time));
  if (times.length < 2) return 0;
  return (Math.max(...times) - Math.min(...times)) / 3_600_000;
}

export function ChangesPanel({
  plugins,
  history,
}: {
  plugins: PluginRecord[];
  history: HistoryFile;
}): JSX.Element {
  const changes = recentChanges(plugins, history, 4);
  const span = historySpanHours(history);
  const insufficient = span < 6;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-content-primary">最近变化</h3>
        <InfoHint text="变化来自两次真实快照，或 npm 最近 7 天与前 7 天下载量对比。首次采集不会编造趋势。" />
      </div>
      <p className="mt-1 text-xs leading-5 text-content-secondary">
        仅展示超过阈值的真实变化，不把采集噪声包装成趋势。
      </p>
      {insufficient ? (
        <p className="mt-3 rounded-control border border-warning-line bg-warning-soft px-3 py-2 text-xs leading-5 text-warning">
          历史不足：当前快照记录仅覆盖 {Math.max(1, Math.round(span > 0 ? span : 0))} 小时。
          {changes.length > 0
            ? '以下只比较最近两次成功快照，不足以判断长期趋势。'
            : '下一次或后续定时采集后才会形成可比较的变化。'}
        </p>
      ) : null}
      {changes.length === 0 ? (
        <p className="mt-4 border-t border-line-hairline py-6 text-sm leading-6 text-content-secondary">
          暂未发现超过阈值的变化。趋势从每次更新开始累积，不补造历史点。
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line-hairline">
          {changes.map((item) => {
            const Icon = item.tone === 'up' ? ArrowUpRight : item.tone === 'down' ? ArrowDownRight : Minus;
            return (
              <li key={`${item.plugin.id}-${item.title}`}>
                <Link
                  to={`/plugins/${encodeURIComponent(item.plugin.id)}`}
                  className="group block py-3 transition hover:bg-surface-subtle"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line bg-surface-subtle text-content-secondary">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-content-primary transition group-hover:text-accent">
                          {item.plugin.name}
                        </p>
                        <CategoryTag category={item.plugin.category} />
                      </div>
                      <p className="mt-1 text-xs text-content-secondary">
                        {item.title} · <span className="tnum">{item.detail}</span>
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-2xs text-content-muted sm:block">
                      {formatRelative(item.since)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
