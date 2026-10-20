import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { PluginRecord } from '../lib/types';
import { formatCompact, formatRelative, formatScore, scoreLabel } from '../lib/format';
import { categoryLabel } from '../lib/types';
import { PluginMonogram, ScoreBar } from './ui';

type Metric = 'popularity' | 'maintenance';

export function RankList({
  title,
  eyebrow,
  description,
  plugins,
  metric,
  limit = 6,
}: {
  title: string;
  eyebrow: string;
  description: string;
  plugins: PluginRecord[];
  metric: Metric;
  limit?: number;
}): JSX.Element {
  const ranked = plugins
    .filter((plugin) => plugin.scores[metric].status === 'scored')
    .sort((a, b) => (b.scores[metric].score ?? 0) - (a.scores[metric].score ?? 0))
    .slice(0, limit);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-end justify-between gap-4 border-b border-ink-700/60 px-4 py-4 md:px-5">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3 className="mt-1 text-base font-semibold text-ink-100">{title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-ink-400">{description}</p>
        </div>
        <Link
          to={`/?sort=${metric}`}
          className="inline-flex shrink-0 items-center gap-1 text-[10px] text-ink-400 transition hover:text-ink-100"
        >
          完整榜单 <ArrowUpRight size={11} />
        </Link>
      </div>
      <ol className="divide-y divide-ink-700/50">
        {ranked.map((plugin, index) => {
          const score = plugin.scores[metric].score;
          return (
            <li key={plugin.id}>
              <Link
                to={`/plugins/${encodeURIComponent(plugin.id)}`}
                className="group grid grid-cols-[24px_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-ink-800/40 md:px-5"
              >
                <span className="tnum font-mono text-[10px] text-ink-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <PluginMonogram plugin={plugin} size="sm" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-medium text-ink-100 group-hover:text-white">
                        {plugin.name}
                      </span>
                      <span className="hidden shrink-0 text-[9px] text-ink-500 sm:inline">
                        {categoryLabel(plugin.category)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-ink-400">
                      {metric === 'popularity'
                        ? `${formatCompact(plugin.github.stars)} stars · ${
                            plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                              ? `${formatCompact(plugin.npm.downloads30d)} downloads / 30d`
                              : '暂无可靠下载数据'
                          }`
                        : `最近提交 ${formatRelative(plugin.github.lastCommitAt)} · ${plugin.github.commits30d} 次 / 30d`}
                    </p>
                  </div>
                </div>
                <div className="w-[92px] text-right">
                  <div className="tnum font-mono text-xs font-semibold text-ink-100">
                    {formatScore(score)}
                    <span className="ml-0.5 text-[9px] font-normal text-ink-500">/100</span>
                  </div>
                  <ScoreBar value={score} className="ml-auto mt-1.5 h-1 w-16" />
                  <p className="mt-1 text-[9px] text-ink-500">
                    {metric === 'maintenance' ? scoreLabel(plugin) : '相对人气'}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
