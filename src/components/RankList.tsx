import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { PluginRecord } from '../lib/types';
import { formatCompact, formatRelative, formatScore, scoreLabel } from '../lib/format';
import { cn } from '../lib/cn';
import { QuietHint } from './quiet-hint';
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
    <section
      className={cn(
        'min-w-0 border-t-2 pt-4',
        metric === 'popularity' ? 'border-series-popularity' : 'border-series-maintenance',
      )}
      aria-labelledby={`rank-${metric}-title`}
    >
      <div className="flex items-start justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h3
            id={`rank-${metric}-title`}
            className="mt-1.5 text-xl font-semibold tracking-title text-content-primary"
          >
            <QuietHint text={description}>{title}</QuietHint>
          </h3>
        </div>
        <Link
          to={`/plugins?sort=${metric}`}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 text-xs text-content-secondary underline-offset-4 transition-colors hover:text-brand-text hover:underline"
        >
          完整榜单 <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>

      <ol className="mt-3 divide-y divide-line-hairline">
        {ranked.map((plugin, index) => {
          const score = plugin.scores[metric].score;
          return (
            <li
              key={plugin.id}
              className={cn(index >= 5 ? 'hidden xl:block' : index >= 4 ? 'hidden lg:block' : 'block')}
            >
              <Link
                to={`/plugins/${encodeURIComponent(plugin.id)}`}
                className={cn(
                  'group grid min-h-[60px] grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 pl-2 pr-1 transition-colors hover:bg-surface-subtle lg:min-h-16',
                  index === 0 ? 'border-l-2 border-content-primary' : 'border-l-2 border-transparent',
                )}
              >
                <span className="tnum self-start pt-0.5 font-mono text-xs text-content-muted">
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="sr-only">第 {index + 1} 名</span>
                </span>
                <div className="flex min-w-0 items-start gap-2.5">
                  <PluginMonogram plugin={plugin} size="sm" />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'truncate text-sm text-content-primary transition-colors group-hover:text-brand-text',
                        index === 0 ? 'font-semibold' : 'font-medium',
                      )}
                      title={plugin.name}
                    >
                      {plugin.name}
                    </p>
                    <p className="mt-0.5 truncate text-2xs text-content-muted" title={plugin.curatorNote}>
                      {metric === 'popularity'
                        ? `${formatCompact(plugin.github.stars)} stars · ${
                            plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null
                              ? `${formatCompact(plugin.npm.downloads30d)} 次/30d`
                              : '暂无可靠下载数据'
                          }`
                        : `最近提交 ${formatRelative(plugin.github.lastCommitAt)} · ${plugin.github.commits30d}${plugin.github.commits30dTruncated ? '+' : ''} 次/30d`}
                    </p>
                  </div>
                </div>
                <div className="min-w-[84px] text-right">
                  <div className="tnum font-mono text-lg font-semibold leading-6 text-content-primary">
                    {formatScore(score)}
                    <span className="ml-0.5 font-sans text-2xs font-normal text-content-muted">/100</span>
                  </div>
                  <ScoreBar value={score} className="ml-auto mt-1.5 h-1 w-16" />
                  {metric === 'maintenance' ? (
                    <p className="mt-1 text-2xs text-content-muted">{scoreLabel(plugin)}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
