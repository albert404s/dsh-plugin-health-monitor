import { Boxes, Database, Download, ShieldAlert, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LatestData } from '../lib/types';
import { formatCompact, formatDateTime, formatRelative, isDataStale } from '../lib/format';
import { DataBand, StatCell } from './ui';

function sourceLabel(status: string): string {
  if (status === 'ok' || status === 'checked' || status === 'verified') return '正常';
  if (status === 'partial') return '部分';
  if (status === 'failed' || status === 'error') return '失败';
  return '降级';
}

export function StatsStrip({ data }: { data: LatestData }): JSX.Element {
  const stats = data.stats;
  const stale = isDataStale(data.lastSuccessAt);
  const sources = [
    { name: 'GitHub', status: data.sources.github.status },
    { name: 'npm', status: data.sources.npm.status },
    { name: 'OSV', status: data.sources.osv.status },
  ];
  const degraded = sources.filter((source) => sourceLabel(source.status) !== '正常').length;

  return (
    <section aria-label="生态系统概览">
      <DataBand>
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-6 lg:grid-cols-5">
          <div className="col-span-1 min-h-[96px] bg-surface md:col-span-2 md:min-h-[112px] lg:col-span-1 lg:min-h-[128px]">
            <StatCell
              label="已核验插件"
              value={
                <>
                  {stats.pluginCount}
                  <span className="ml-1 text-xs font-medium text-content-muted">个</span>
                </>
              }
              detail="人工核验的公开 GitHub 仓库"
              icon={<Boxes size={13} />}
            />
          </div>
          <div className="col-span-1 min-h-[96px] bg-surface md:col-span-2 md:min-h-[112px] lg:col-span-1 lg:min-h-[128px]">
            <StatCell
              label="总 Stars"
              value={<span title={`${stats.totalStars} stars`}>{formatCompact(stats.totalStars)}</span>}
              detail="GitHub REST API 当前值"
              icon={<Star size={13} />}
            />
          </div>
          <div className="col-span-1 min-h-[96px] bg-surface md:col-span-2 md:min-h-[112px] lg:col-span-1 lg:min-h-[128px]">
            <StatCell
              label="npm 30 天下载"
              value={
                <>
                  {stats.totalDownloads === null ? '—' : formatCompact(stats.totalDownloads)}
                  {stats.totalDownloads === null ? null : (
                    <span className="ml-1 text-xs font-medium text-content-muted">次</span>
                  )}
                </>
              }
              detail="只累计 npm repository 与 GitHub 仓库一致、且下载 API 可用的包。"
              icon={<Download size={13} />}
            />
          </div>
          <Link
            to="/plugins?risk=high"
            className="group col-span-1 min-h-[96px] bg-surface transition-colors hover:bg-surface-subtle md:col-span-3 md:min-h-[112px] lg:col-span-1 lg:min-h-[128px]"
            aria-label={`查看 ${stats.highRiskCount} 个建议先了解关注事项的插件`}
          >
            <StatCell
              label="建议先了解"
              insideLink
              value={
                <span className={stats.highRiskCount > 0 ? 'text-risk-high' : 'text-content-primary'}>
                  {stats.highRiskCount}
                </span>
              }
              detail={
                stats.highRiskCount > 0 ? '选用前先查看维护提醒与公开漏洞记录' : '暂无需要先了解的额外事项'
              }
              icon={<ShieldAlert size={13} />}
            />
          </Link>
          <div className="col-span-2 min-h-[96px] bg-surface md:col-span-3 md:min-h-[112px] lg:col-span-1 lg:min-h-[128px]">
            <StatCell
              label="数据完整"
              value={
                <>
                  {stats.completeDataCount}
                  <span className="ml-1 text-xs font-medium text-content-muted">/ {stats.pluginCount}</span>
                </>
              }
              detail="仓库、提交、Issue、PR、Release、npm、OSV，共七个数据域。缺失不等于零。"
              icon={<Database size={13} />}
            />
          </div>
        </div>

        <div className="flex min-h-8 flex-col gap-1 border-t border-line px-4 py-2 text-2xs text-content-muted sm:flex-row sm:items-center sm:justify-between md:px-5">
          <p className="timestamp">
            快照 {formatDateTime(data.lastSuccessAt)} · {formatRelative(data.lastSuccessAt)}
            {stale ? ' · 可能已过期' : ''} · UTC+8
          </p>
          <p aria-label="数据来源状态">
            {degraded > 0
              ? `${degraded} 个来源降级`
              : sources.map((source) => `${source.name} ${sourceLabel(source.status)}`).join(' · ')}
          </p>
        </div>
      </DataBand>
    </section>
  );
}
