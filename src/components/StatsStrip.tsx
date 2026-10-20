import { Boxes, Database, Download, Star, Wrench } from 'lucide-react';
import type { LatestData } from '../lib/types';
import { formatCompact, formatNumber } from '../lib/format';
import { InfoHint, StatCell } from './ui';

export function StatsStrip({ data }: { data: LatestData }): JSX.Element {
  const stats = data.stats;
  return (
    <section className="panel mt-5 overflow-hidden" aria-label="生态系统概览">
      <div className="grid grid-cols-2 divide-x divide-y divide-ink-700/50 md:grid-cols-5 md:divide-y-0">
        <StatCell
          label="已核验插件"
          value={<>{stats.pluginCount}<span className="ml-1 text-xs font-normal text-ink-500">个</span></>}
          detail="人工核验的公开 GitHub 仓库"
          icon={<Boxes size={12} />}
        />
        <StatCell
          label="总 Stars"
          value={formatCompact(stats.totalStars)}
          detail="GitHub REST API 当前值"
          icon={<Star size={12} />}
        />
        <StatCell
          label="npm 30 天下载"
          value={stats.totalDownloads === null ? '—' : formatCompact(stats.totalDownloads)}
          detail="仅累计通过 repository 核对的包"
          icon={<Download size={12} />}
        />
        <StatCell
          label="维护活跃"
          value={
            <>
              {stats.maintainedCount}
              <span className="ml-1 text-xs font-normal text-ink-500">/ {stats.pluginCount}</span>
            </>
          }
          detail={
            <span className="inline-flex items-center gap-1">
              维护分 ≥ 65 <InfoHint text="这是公开维护活动的相对指标，不代表代码质量。成熟稳定的小插件可能活动较少。" />
            </span>
          }
          icon={<Wrench size={12} />}
        />
        <StatCell
          className="col-span-2 md:col-span-1"
          label="完整数据覆盖"
          value={
            <>
              {stats.completeDataCount}
              <span className="ml-1 text-xs font-normal text-ink-500">/ {stats.pluginCount}</span>
            </>
          }
          detail={
            <span className="inline-flex items-center gap-1">
              覆盖 ≥ 6/7 数据域 <InfoHint text="数据域：仓库、提交、Issue、PR、Release、npm、OSV。缺失不代表真实零值。" />
            </span>
          }
          icon={<Database size={12} />}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-ink-700/50 bg-ink-900/30 px-4 py-2 text-[9px] font-mono uppercase tracking-[0.08em] text-ink-500 md:px-5">
        <span>{formatNumber(stats.scoredCount)} plugins with maintenance evidence</span>
        <span>{stats.fullyScoredCount} fully scored</span>
        <span>{stats.completeDataCount} broad coverage</span>
        <span className="ml-auto normal-case tracking-normal text-ink-500">
          指数为榜单内相对评价
        </span>
      </div>
    </section>
  );
}
