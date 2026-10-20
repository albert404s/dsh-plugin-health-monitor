import { Boxes, Database, Download, ShieldAlert, Star } from 'lucide-react';
import type { LatestData } from '../lib/types';
import { formatCompact } from '../lib/format';
import { DataBand, InfoHint, StatCell } from './ui';

export function StatsStrip({ data }: { data: LatestData }): JSX.Element {
  const stats = data.stats;
  return (
    <section aria-label="生态系统概览">
      <DataBand>
        <div className="grid grid-cols-2 divide-x divide-y divide-line-hairline md:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
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
          <StatCell
            label="总 Stars"
            value={formatCompact(stats.totalStars)}
            detail="GitHub REST API 当前值"
            icon={<Star size={13} />}
          />
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
            detail={
              <span className="inline-flex items-center gap-1">
                仅累计经 repository 核对的包
                <InfoHint
                  align="right"
                  text="只累计 npm registry 的 repository 字段与 GitHub 仓库一致、且下载 API 返回可用值的包。"
                />
              </span>
            }
            icon={<Download size={13} />}
          />
          <StatCell
            label="高风险"
            value={<span className="text-danger">{stats.highRiskCount}</span>}
            detail={
              <span className="inline-flex items-center gap-1">
                归档 / Issue 积压 / OSV 等组合规则
                <InfoHint
                  align="right"
                  text="高风险是公开信号，不等同于安全事件或质量结论。点击四象限页可按风险筛选。"
                />
              </span>
            }
            icon={<ShieldAlert size={13} />}
          />
          <StatCell
            className="col-span-2 md:col-span-2 lg:col-span-1"
            label="数据完整"
            value={
              <>
                {stats.completeDataCount}
                <span className="ml-1 text-xs font-medium text-content-muted">/ {stats.pluginCount}</span>
              </>
            }
            detail={
              <span className="inline-flex items-center gap-1">
                覆盖 ≥ 6/7 数据域
                <InfoHint
                  align="right"
                  text="数据域：仓库、提交、Issue、PR、Release、npm、OSV。缺失不代表真实零值。"
                />
              </span>
            }
            icon={<Database size={13} />}
          />
        </div>
      </DataBand>
      <p className="mt-2 text-right text-2xs text-content-muted">
        指数为当前榜单内相对评价 · 缺失值不记为 0
      </p>
    </section>
  );
}
