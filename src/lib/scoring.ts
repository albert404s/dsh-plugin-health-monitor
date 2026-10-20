import type {
  CompletenessResult,
  Confidence,
  DashboardStats,
  GithubMetrics,
  MaintenanceScore,
  MissingDomain,
  NpmMetrics,
  PluginRecord,
  PopularityScore,
  RiskAssessment,
  RiskFlag,
  RiskLevel,
  ScoreComponent,
  SecurityMetrics,
  SourceAvailability,
} from './types';
import { SCORE_METHOD_VERSION } from './types';

type PluginSeed = Omit<PluginRecord, 'scores'>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return null;
  return Math.max(0, (now.getTime() - value) / DAY_MS);
}

export function pct(rate: number | null): number | null {
  return rate === null ? null : round(rate * 100, 1);
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}

function confidenceFromCoverage(coverage: number): Confidence {
  if (coverage >= 0.8) return 'high';
  if (coverage >= 0.55) return 'medium';
  return 'low';
}

function buildComponent(input: {
  key: string;
  label: string;
  rawLabel: string;
  rawValue: number | null;
  normalized: number | null;
  weight: number;
  included: boolean;
  sampleSize?: number | null;
  explanation: string;
  evidenceUrl: string | null;
}): ScoreComponent {
  return {
    key: input.key,
    label: input.label,
    rawLabel: input.rawLabel,
    rawValue: input.rawValue,
    normalized: input.normalized === null ? null : round(clamp(input.normalized), 1),
    weight: input.weight,
    effectiveWeight: 0,
    contribution: 0,
    included: input.included,
    sampleSize: input.sampleSize ?? null,
    explanation: input.explanation,
    evidenceUrl: input.evidenceUrl,
  };
}

/**
 * 对数值取 log10 后做 min-max 归一化。若全体值相同则返回 50（不制造虚假差异）。
 * 缺失值必须在调用前剔除，不能作为 0 参与归一化。
 */
export function logNormalize(value: number, population: number[]): number | null {
  const clean = population.filter((item) => Number.isFinite(item) && item >= 0);
  if (!Number.isFinite(value) || value < 0 || clean.length === 0) return null;
  const logs = clean.map((item) => Math.log10(1 + item));
  const valueLog = Math.log10(1 + value);
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  if (max - min < 1e-12) return 50;
  return clamp(((valueLog - min) / (max - min)) * 100);
}

export function popularityScore(
  plugin: PluginSeed,
  allPlugins: PluginSeed[],
  now: Date,
): PopularityScore {
  const stars = plugin.github.stars;
  const starPopulation = allPlugins.map((item) => item.github.stars);
  const starNormalized = logNormalize(stars, starPopulation);

  const downloadPopulation = allPlugins
    .filter((item) => item.npm.status === 'verified' && item.npm.downloads30d !== null)
    .map((item) => item.npm.downloads30d as number);
  const downloads =
    plugin.npm.status === 'verified' ? plugin.npm.downloads30d : null;
  const downloadNormalized =
    downloads === null ? null : logNormalize(downloads, downloadPopulation);

  const starWeight = 0.45;
  const downloadWeight = 0.55;
  const components: ScoreComponent[] = [
    buildComponent({
      key: 'stars',
      label: 'GitHub Stars',
      rawLabel: `${numberLabel(stars)} stars`,
      rawValue: stars,
      normalized: starNormalized,
      weight: starWeight,
      included: starNormalized !== null,
      explanation: '对 Star 数做 log10 变换后，在本榜单有效样本内做 min-max 归一化。',
      evidenceUrl: plugin.repository.url,
    }),
    buildComponent({
      key: 'downloads',
      label: 'npm 近 30 天下载',
      rawLabel: downloads === null ? '暂无可靠数据' : `${numberLabel(downloads)} 次`,
      rawValue: downloads,
      normalized: downloadNormalized,
      weight: downloadWeight,
      included: downloadNormalized !== null,
      explanation:
        downloads === null
          ? '没有通过 repository 字段核对的 npm 包，或下载 API 未返回有效值。该项不计 0 分，只从加权中剔除。'
          : '对近 30 天下载量做 log10 变换后，在本榜单有效样本内做 min-max 归一化。',
      evidenceUrl: plugin.npm.registryUrl,
    }),
  ];

  const available = components.filter((component) => component.included);
  const coverage = available.reduce((sum, component) => sum + component.weight, 0);
  const weightSum = coverage;
  if (weightSum > 0) {
    for (const component of available) {
      component.effectiveWeight = component.weight / weightSum;
      component.contribution = round((component.normalized ?? 0) * component.effectiveWeight, 1);
    }
  }
  const score =
    coverage > 0
      ? round(available.reduce((sum, component) => sum + component.contribution, 0), 1)
      : null;
  const missing =
    downloads === null ? ['缺少经 repository 字段核验的 npm 30 天下载量'] : [];
  const confidence: Confidence =
    downloadNormalized === null ? 'medium' : coverage >= 0.99 ? 'high' : 'medium';

  return {
    score,
    status: score === null ? 'insufficient' : 'scored',
    confidence,
    coverage: round(coverage, 2),
    components,
    summary:
      downloadNormalized === null
        ? '仅依据 Star 的相对位置计算；下载维度缺失，已调整权重并降低数据完整度，不把缺失当作 0。'
        : '综合 Star 与经核验 npm 下载量，均使用 log10 变换后的相对位置；这是本榜单内的相对指数，不是绝对流行度。',
    missing,
    methodVersion: SCORE_METHOD_VERSION,
  };
}

interface WeightedEvidence {
  component: ScoreComponent;
  designWeight: number;
  sampleScale: number;
}

function finalizeMaintenance(
  components: WeightedEvidence[],
  now: Date,
  plugin: PluginSeed,
): MaintenanceScore {
  const included = components.filter(
    (item) => item.component.included && item.component.normalized !== null,
  );
  const coverage = included.reduce(
    (sum, item) => sum + item.designWeight * item.sampleScale,
    0,
  );
  const scaleSum = included.reduce((sum, item) => sum + item.designWeight * item.sampleScale, 0);
  if (scaleSum > 0) {
    for (const { component, designWeight, sampleScale } of included) {
      const effective = (designWeight * sampleScale) / scaleSum;
      component.effectiveWeight = round(effective, 3);
      component.contribution = round((component.normalized ?? 0) * effective, 1);
    }
  }
  const score =
    coverage >= 0.45 && included.length > 0
      ? round(
          included.reduce((sum, item) => sum + (item.component.contribution ?? 0), 0),
          1,
        )
      : null;
  const missing = included.length === 0 ? ['缺少可用于判断维护状态的近期数据'] : [];
  const confidence = confidenceFromCoverage(coverage);
  return {
    score,
    status: score === null ? 'insufficient' : 'scored',
    confidence,
    coverage: round(coverage, 2),
    components: components.map((item) => item.component),
    summary:
      score === null
        ? '可用证据覆盖不足 45%，因此不输出维护分；请查看缺失项，而不是把信息不足理解为维护差。'
        : '衡量近期公开维护活动的相对强弱，不评价代码质量、架构或安全。稳定的小型插件可能长期低提交，因此分数必须结合解释与原始证据阅读。',
    missing,
    methodVersion: SCORE_METHOD_VERSION,
  };
}

export function maintenanceScore(plugin: PluginSeed, now: Date): MaintenanceScore {
  const { github, availability } = plugin;
  const recencyDays = daysSince(github.lastCommitAt, now);
  const commitRecency =
    recencyDays === null
      ? null
      : recencyDays <= 7
        ? 100
        : recencyDays <= 14
          ? 92
          : recencyDays <= 30
            ? 82
            : recencyDays <= 60
              ? 68
              : recencyDays <= 90
                ? 55
                : recencyDays <= 180
                  ? 38
                  : recencyDays <= 365
                    ? 20
                    : 6;

  const cadence =
    github.commits30d >= 12
      ? 100
      : github.commits30d >= 8
        ? 88
        : github.commits30d >= 4
          ? 72
          : github.commits30d >= 2
            ? 55
            : github.commits30d === 1
              ? 38
              : 12;
  const issueRate = pct(github.issues.closureRate);
  const prRate = pct(github.pullRequests.mergeRate);
  const releaseDays = daysSince(github.latestRelease?.publishedAt ?? null, now);
  const releaseScore =
    releaseDays === null
      ? null
      : releaseDays <= 30
        ? 100
        : releaseDays <= 60
          ? 92
          : releaseDays <= 90
            ? 80
            : releaseDays <= 180
              ? 62
              : releaseDays <= 365
                ? 40
                : 18;
  const backlogScore =
    github.issues.openNow > 0
      ? clamp(100 - (github.issues.longOpen / github.issues.openNow) * 100)
      : null;

  const issueSampleScale = Math.min(1, github.issues.opened90d / 5);
  const prSampleScale = Math.min(1, github.pullRequests.opened90d / 3);
  const backlogSampleScale = Math.min(1, github.issues.openNow / 5);

  const weighted: WeightedEvidence[] = [
    {
      designWeight: 0.3,
      sampleScale: 1,
      component: buildComponent({
        key: 'commitRecency',
        label: '最近代码提交',
        rawLabel:
          recencyDays === null ? '未取得' : `${Math.floor(recencyDays)} 天前`,
        rawValue: recencyDays,
        normalized: commitRecency,
        weight: 0.3,
        included: commitRecency !== null,
        explanation:
          '距最近一次非合并提交的天数。使用提交记录的实际 committed date，而不是仓库 pushed_at。',
        evidenceUrl: github.lastCommitUrl ?? github.commitsUrl,
      }),
    },
    {
      designWeight: 0.15,
      sampleScale: 1,
      component: buildComponent({
        key: 'commitCadence',
        label: '近 30 天提交频率',
        rawLabel: `${github.commits30d}${github.commits30dTruncated ? '+' : ''} 次`,
        rawValue: github.commits30d,
        normalized: cadence,
        weight: 0.15,
        included: availability.commits,
        explanation:
          '近 30 天提交次数的分档映射。提交多只说明活动频繁，不代表代码质量更高。',
        evidenceUrl: github.commitsUrl,
      }),
    },
    {
      designWeight: 0.2,
      sampleScale: issueSampleScale,
      component: buildComponent({
        key: 'issueHandling',
        label: '近期 Issue 关闭率',
        rawLabel:
          github.issues.opened90d === 0
            ? '近 90 天无新 Issue'
            : `${github.issues.closed90d}/${github.issues.opened90d} 已关闭 · ${issueRate ?? '—'}%`,
        rawValue: issueRate,
        normalized: issueRate,
        weight: 0.2,
        included:
          availability.issues &&
          !github.issues.truncated &&
          github.issues.opened90d > 0 &&
          issueRate !== null,
        sampleSize: github.issues.opened90d,
        explanation:
          '近 90 天创建的非 PR Issue 中，当前已关闭的比例。少于 5 条时降低该分项权重；0 条新 Issue 不扣分，也不代表处理能力强。',
        evidenceUrl: github.issues.queryUrl,
      }),
    },
    {
      designWeight: 0.1,
      sampleScale: backlogSampleScale,
      component: buildComponent({
        key: 'issueBacklog',
        label: '长期开放 Issue 占比',
        rawLabel:
          github.issues.openNow === 0
            ? '当前无开放 Issue'
            : `${github.issues.longOpen}/${github.issues.openNow} 条超过 90 天`,
        rawValue: backlogScore,
        normalized: backlogScore,
        weight: 0.1,
        included:
          availability.issues && !github.issues.openTruncated && backlogScore !== null,
        sampleSize: github.issues.openNow,
        explanation:
          '当前开放 Issue 中创建超过 90 天的比例越低越好。当前没有开放 Issue 时该项不参与计分。',
        evidenceUrl: github.issuesUrl,
      }),
    },
    {
      designWeight: 0.15,
      sampleScale: prSampleScale,
      component: buildComponent({
        key: 'pullRequests',
        label: '近期 PR 合并率',
        rawLabel: !github.pullRequests.available
          ? 'PR 功能不可用'
          : github.pullRequests.opened90d === 0
            ? '近 90 天无新 PR'
            : `${github.pullRequests.merged90d}/${github.pullRequests.opened90d} 已合并 · ${prRate ?? '—'}%`,
        rawValue: prRate,
        normalized: prRate,
        weight: 0.15,
        included:
          availability.pullRequests &&
          github.pullRequests.available &&
          !github.pullRequests.truncated &&
          github.pullRequests.opened90d > 0 &&
          prRate !== null,
        sampleSize: github.pullRequests.opened90d,
        explanation:
          '近 90 天创建 PR 中已合并的比例。只统计 PR，不把 Issue 混入；少于 3 条时降低权重。仓库禁用 PR 时该维度被排除，而不是记 0。',
        evidenceUrl: github.pullRequests.queryUrl,
      }),
    },
    {
      designWeight: 0.1,
      sampleScale: 1,
      component: buildComponent({
        key: 'release',
        label: '最近版本发布',
        rawLabel:
          github.latestRelease === null
            ? '未发布 Release'
            : releaseDays === null
              ? github.latestRelease.tagName
              : `${Math.floor(releaseDays)} 天前`,
        rawValue: releaseDays,
        normalized: releaseScore,
        weight: 0.1,
        included: availability.releases && releaseScore !== null,
        explanation:
          '最近一次 Release 的时间分档。没有 Release 不等于未维护，因此该项仅在存在 Release 时参与。',
        evidenceUrl: github.releasesUrl,
      }),
    },
  ];

  return finalizeMaintenance(weighted, now, plugin);
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 6,
  high: 5,
  medium: 4,
  low: 3,
  unknown: 1,
};

export function riskAssessment(
  plugin: PluginSeed,
  now: Date,
): RiskAssessment {
  const flags: RiskFlag[] = [];
  const { github, security } = plugin;
  if (github.issues.longOpen >= 20) {
    flags.push({
      code: 'issue-backlog-high',
      level: 'high',
      title: '长期未关闭 Issue 积压',
      detail: `当前有 ${github.issues.longOpen} 条超过 90 天仍开放的 Issue。这是维护信号，不直接等同于代码质量差。`,
      evidenceUrl: `${github.issuesUrl}?q=is%3Aissue+is%3Aopen+created%3A%3C${new Date(now.getTime() - 90 * DAY_MS).toISOString().slice(0, 10)}`,
    });
  } else if (github.issues.longOpen >= 5) {
    flags.push({
      code: 'issue-backlog',
      level: 'medium',
      title: '存在长期未关闭 Issue',
      detail: `当前有 ${github.issues.longOpen} 条超过 90 天仍开放的 Issue。请结合问题内容与项目规模判断。`,
      evidenceUrl: github.issuesUrl,
    });
  } else if (github.issues.longOpen > 0) {
    flags.push({
      code: 'issue-backlog-low',
      level: 'info',
      title: '少量长期开放 Issue',
      detail: `当前有 ${github.issues.longOpen} 条超过 90 天仍开放的 Issue。`,
      evidenceUrl: github.issuesUrl,
    });
  }

  if (plugin.repository.archived) {
    flags.push({
      code: 'archived',
      level: 'high',
      title: '仓库已归档',
      detail: 'GitHub 仓库处于 archived 状态，通常表示只读且不再接受常规维护。',
      evidenceUrl: plugin.repository.url,
    });
  }

  for (const vulnerability of security.vulnerabilities) {
    flags.push({
      code: `osv-${vulnerability.id}`,
      level:
        vulnerability.severity === 'critical' || vulnerability.severity === 'high'
          ? 'high'
          : 'medium',
      title: `OSV 公开漏洞 ${vulnerability.id}`,
      detail: `${vulnerability.summary ?? 'OSV 收录的公开漏洞记录'}（严重度：${vulnerability.severity}）。请到 OSV 核对受影响版本与修复版本。`,
      evidenceUrl: vulnerability.url,
    });
  }

  if (security.status !== 'checked') {
    flags.push({
      code: 'osv-unchecked',
      level: 'info',
      title: '未完成漏洞检查',
      detail:
        security.reason ??
        '缺少可精确匹配的 npm 包名与版本，或 OSV 查询失败。没有结果显示为“未检查”，不显示为“安全”。',
      evidenceUrl: security.queryUrl,
    });
  }

  if (plugin.npm.status !== 'verified') {
    flags.push({
      code: 'npm-unverified',
      level: 'info',
      title: '没有可核验的 npm 下载数据',
      detail:
        plugin.npm.reason ??
        '该插件未通过 npm 发布，或 GitHub 仓库与 npm registry repository 字段无法对应。',
      evidenceUrl: plugin.npm.registryUrl,
    });
  }

  const lastUpdatedDays = daysSince(plugin.lastUpdatedAt, now);
  if (lastUpdatedDays !== null && lastUpdatedDays > 2) {
    flags.push({
      code: 'stale-data',
      level: 'info',
      title: '插件数据超过 2 天未更新',
      detail: '本次展示沿用了历史快照，部分字段可能已变化。',
      evidenceUrl: null,
    });
  }

  const worstSeverity = security.vulnerabilities.reduce(
    (worst, item) => Math.max(worst, SEVERITY_ORDER[item.severity] ?? 0),
    0,
  );
  const level: RiskLevel = flags.some((flag) => flag.level === 'high')
    ? 'high'
    : flags.some((flag) => flag.level === 'medium') || worstSeverity >= 4
      ? 'medium'
      : security.status === 'checked'
        ? 'low'
        : 'unknown';

  const label =
    level === 'high'
      ? '高风险信号'
      : level === 'medium'
        ? '需要关注'
        : level === 'low'
          ? '未见公开风险记录'
          : '风险信息不完整';

  return {
    level,
    label,
    flags,
    limitations: [
      '风险提示来自公开元数据与 OSV 记录，不构成安全审计，也不代表不存在未披露问题。',
      '未执行插件代码、安装或运行时兼容性验证；版本兼容性只展示项目声明。',
      'Issue 积压与归档是维护信号，不应单独推导出“质量差”结论。',
    ],
  };
}

export function completeness(
  availability: SourceAvailability,
  plugin: Pick<PluginSeed, 'npm' | 'security'>,
): CompletenessResult {
  const domains: Array<{ key: keyof SourceAvailability; label: string; reason: string }> = [
    { key: 'repository', label: '仓库基础信息', reason: 'GitHub 仓库基础信息未取得。' },
    { key: 'commits', label: '提交活动', reason: 'GitHub 提交列表未取得。' },
    { key: 'issues', label: 'Issue 处理', reason: 'GitHub Issue 数据未取得或分页不完整。' },
    { key: 'pullRequests', label: 'PR 处理', reason: 'GitHub PR 数据未取得或分页不完整。' },
    { key: 'releases', label: '版本发布', reason: 'GitHub Release 数据未取得。' },
    {
      key: 'npm',
      label: 'npm 下载',
      reason:
        plugin.npm.reason ??
        '没有经 repository 字段核验的 npm 包，不能展示下载数据。',
    },
    {
      key: 'security',
      label: 'OSV 漏洞检查',
      reason:
        plugin.security.reason ??
        '缺少可精确匹配的 npm 包与版本，未完成漏洞检查。',
    },
  ];
  const missing: MissingDomain[] = domains
    .filter((domain) => !availability[domain.key])
    .map((domain) => ({ key: domain.key, label: domain.label, reason: domain.reason }));
  const total = domains.length;
  const available = total - missing.length;
  const score = round((available / total) * 100);
  return {
    score,
    available,
    total,
    level: confidenceFromCoverage(score / 100),
    missing,
  };
}

export function compactHistoryPoint(
  plugin: PluginRecord,
  timestamp: string,
): import('./types').HistoryPoint {
  return {
    t: timestamp,
    methodVersion: plugin.scores.maintenance.methodVersion,
    stars: plugin.github.stars,
    downloads: plugin.npm.status === 'verified' ? plugin.npm.downloads30d : null,
    popularity: plugin.scores.popularity.score,
    maintenance: plugin.scores.maintenance.score,
    riskLevel: plugin.scores.risk.level,
    commits30d: plugin.github.commits30d,
    issuesOpened90d: plugin.github.issues.opened90d,
    issuesClosed90d: plugin.github.issues.closed90d,
    prsOpened90d: plugin.github.pullRequests.opened90d,
    prsMerged90d: plugin.github.pullRequests.merged90d,
    releaseAt: plugin.github.latestRelease?.publishedAt ?? null,
    archived: plugin.repository.archived,
  };
}

export function scorePlugins(plugins: PluginSeed[], now: Date): PluginRecord[] {
  return plugins.map((plugin) => {
    const popularity = popularityScore(plugin, plugins, now);
    const maintenance = maintenanceScore(plugin, now);
    const risk = riskAssessment(plugin, now);
    const completenessResult = completeness(plugin.availability, plugin);
    return {
      ...plugin,
      scores: { popularity, maintenance, risk, completeness: completenessResult },
    };
  });
}

export function computeStats(plugins: PluginRecord[]): DashboardStats {
  const totalDownloads = plugins
    .filter((plugin) => plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null)
    .reduce((sum, plugin) => sum + (plugin.npm.downloads30d ?? 0), 0);
  return {
    pluginCount: plugins.length,
    totalStars: plugins.reduce((sum, plugin) => sum + plugin.github.stars, 0),
    totalDownloads:
      plugins.some((plugin) => plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null)
        ? totalDownloads
        : null,
    maintainedCount: plugins.filter(
      (plugin) =>
        plugin.scores.maintenance.status === 'scored' &&
        (plugin.scores.maintenance.score ?? 0) >= 65,
    ).length,
    highRiskCount: plugins.filter((plugin) => plugin.scores.risk.level === 'high').length,
    scoredCount: plugins.filter((plugin) => plugin.scores.maintenance.status === 'scored')
      .length,
    fullyScoredCount: plugins.filter(
      (plugin) =>
        plugin.scores.maintenance.status === 'scored' &&
        plugin.scores.popularity.status === 'scored' &&
        plugin.npm.status === 'verified',
    ).length,
    completeDataCount: plugins.filter((plugin) => plugin.scores.completeness.score >= 85)
      .length,
  };
}

/** 供图表使用的固定轴范围：0–100，避免筛选后轴漂移造成误读。 */
export function hasQuadrantData(plugin: PluginRecord): boolean {
  return (
    plugin.scores.popularity.status === 'scored' &&
    plugin.scores.maintenance.status === 'scored' &&
    plugin.scores.popularity.score !== null &&
    plugin.scores.maintenance.score !== null &&
    plugin.npm.status === 'verified' &&
    plugin.scores.maintenance.coverage >= 0.45
  );
}

export function quadrantOf(
  popularity: number,
  maintenance: number,
): 'hot-healthy' | 'hot-watch' | 'niche-active' | 'quiet' {
  if (popularity >= 50 && maintenance >= 60) return 'hot-healthy';
  if (popularity >= 50) return 'hot-watch';
  if (maintenance >= 60) return 'niche-active';
  return 'quiet';
}

export function worstSeverity(security: SecurityMetrics): string | null {
  if (security.vulnerabilities.length === 0) return null;
  return security.vulnerabilities.reduce((worst, item) =>
    (SEVERITY_ORDER[item.severity] ?? 0) > (SEVERITY_ORDER[worst.severity] ?? 0) ? item : worst,
  ).severity;
}

export function isNpmAvailable(npm: NpmMetrics): boolean {
  return npm.status === 'verified' && npm.downloads30d !== null;
}

export function lastGithubActivity(github: GithubMetrics): string | null {
  return github.lastCommitAt;
}
