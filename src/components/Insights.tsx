import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus, Radar } from 'lucide-react';
import type { HistoryFile, PluginRecord } from '../lib/types';
import { attentionPlugins, recentChanges } from '../lib/insights';
import { formatRelative } from '../lib/format';
import { categoryLabel } from '../lib/types';
import { CategoryTag, EmptyState, InfoHint, Panel, PluginMonogram, SectionHeading } from './ui';

export function AttentionPanel({ plugins }: { plugins: PluginRecord[] }): JSX.Element {
  const items = attentionPlugins(plugins, 4);
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-ink-700/60 px-4 py-4 md:px-5">
        <div className="flex items-center gap-2">
          <Radar size={14} className="text-amber" />
          <h3 className="text-base font-semibold text-ink-100">值得关注</h3>
          <InfoHint text="这里汇总风险信号与数据缺口，不等同于质量差或安全结论。" />
        </div>
        <p className="mt-1 text-[11px] leading-4 text-ink-400">
          风险信号、归档状态与数据缺口，按可解释规则排序。
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="当前没有触发关注规则"
          description="这不代表所有插件都健康或安全，只说明没有命中归档、积压、漏洞或数据缺口规则。"
        />
      ) : (
        <ul className="divide-y divide-ink-700/50">
          {items.map(({ plugin, reasons }) => (
            <li key={plugin.id}>
              <Link
                to={`/plugins/${encodeURIComponent(plugin.id)}`}
                className="group block px-4 py-3.5 transition hover:bg-ink-800/40 md:px-5"
              >
                <div className="flex items-center gap-2.5">
                  <PluginMonogram plugin={plugin} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink-100 group-hover:text-white">
                      {plugin.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-ink-400">{categoryLabel(plugin.category)}</p>
                  </div>
                  <span className="text-[9px] text-ink-500">
                    风险 {plugin.scores.risk.label}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded border border-ink-700 bg-ink-900/70 px-1.5 py-0.5 text-[9px] text-ink-300"
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
    </Panel>
  );
}

export function ChangesPanel({
  plugins,
  history,
}: {
  plugins: PluginRecord[];
  history: HistoryFile;
}): JSX.Element {
  const changes = recentChanges(plugins, history, 4);
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-ink-700/60 px-4 py-4 md:px-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute h-2 w-2 rounded-full bg-signal/30 animate-pulseSoft" />
            <span className="h-1 w-1 rounded-full bg-signal" />
          </span>
          <h3 className="text-base font-semibold text-ink-100">最近变化</h3>
          <InfoHint text="变化来自两次真实快照，或 npm 最近 7 天与前 7 天下载量对比。首次采集不会编造趋势。" />
        </div>
        <p className="mt-1 text-[11px] leading-4 text-ink-400">
          仅展示超过阈值的真实变化，不把采集噪声包装成趋势。
        </p>
      </div>
      {changes.length === 0 ? (
        <EmptyState
          title="暂未发现超过阈值的变化"
          description="趋势从每次更新开始累积；npm 周下载变化会随首次采集立即可用。"
        />
      ) : (
        <ul className="divide-y divide-ink-700/50">
          {changes.map((item) => {
            const Icon = item.tone === 'up' ? ArrowUpRight : item.tone === 'down' ? ArrowDownRight : Minus;
            return (
              <li key={`${item.plugin.id}-${item.title}`}>
                <Link
                  to={`/plugins/${encodeURIComponent(item.plugin.id)}`}
                  className="group block px-4 py-3.5 transition hover:bg-ink-800/40 md:px-5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${
                        item.tone === 'up'
                          ? 'border-mint/20 bg-mint/5 text-mint'
                          : item.tone === 'down'
                            ? 'border-rose/20 bg-rose/5 text-rose'
                            : 'border-ink-600 bg-ink-700/30 text-ink-300'
                      }`}
                    >
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-medium text-ink-100 group-hover:text-white">
                          {item.plugin.name}
                        </p>
                        <CategoryTag category={item.plugin.category} />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-300">
                        {item.title} · <span className="tnum">{item.detail}</span>
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-[9px] text-ink-500 sm:block">
                      {formatRelative(item.since)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function HomeInsightHeading(): JSX.Element {
  return (
    <SectionHeading
      eyebrow="Signals"
      title="生态信号"
      description="把维护风险、数据缺口与真实变化分开呈现，避免用一个分数解释一切。"
    />
  );
}
