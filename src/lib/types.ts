/**
 * 数据契约 v1。
 *
 * 这些类型同时被采集脚本、评分模块、测试和 React 前端使用。
 * 修改字段语义时必须提升 LATEST_SCHEMA_VERSION，并在 docs/SCORING.md 记录。
 */

export const LATEST_SCHEMA_VERSION = 1 as const;
export const HISTORY_SCHEMA_VERSION = 1 as const;
export const STATUS_SCHEMA_VERSION = 1 as const;
export const SCORE_METHOD_VERSION = '2.0.0';

export type SourceState = 'ok' | 'partial' | 'failed' | 'skipped';
export type DataStatus = 'complete' | 'partial' | 'stale';
export type ScoreStatus = 'scored' | 'insufficient';
export type Confidence = 'high' | 'medium' | 'low';
export type RiskLevel = 'high' | 'medium' | 'low' | 'unknown';
export type NpmStatus = 'verified' | 'unavailable' | 'unverified' | 'error';
export type SecurityStatus = 'checked' | 'unavailable' | 'error';

export interface SourceSnapshot {
  status: SourceState;
  fetchedAt: string | null;
  message?: string;
}

export interface RepositoryInfo {
  fullName: string;
  url: string;
  description: string | null;
  homepageUrl: string | null;
  topics: string[];
  language: string | null;
  license: string | null;
  createdAt: string | null;
  pushedAt: string | null;
  archived: boolean;
  defaultBranch: string;
}

export interface IssueWindow {
  /** 统计窗口固定为 90 天，created_at 落在窗口内的非 PR Issue。 */
  opened90d: number;
  /** 上述 Issue 中当前状态已关闭的数量。 */
  closed90d: number;
  closureRate: number | null;
  lowSample: boolean;
  truncated: boolean;
  /** 当前仍开放、创建时间早于 90 天前、且非 PR 的 Issue。 */
  longOpen: number;
  openNow: number;
  openTruncated: boolean;
  queryUrl: string;
}

export interface PullRequestWindow {
  /** GitHub Pull Requests 功能是否可用；404 时并不等于“零个 PR”。 */
  available: boolean;
  opened90d: number;
  merged90d: number;
  mergeRate: number | null;
  lowSample: boolean;
  truncated: boolean;
  queryUrl: string;
}

export interface ReleaseInfo {
  version: string | null;
  tagName: string;
  publishedAt: string | null;
  url: string;
}

export interface GithubMetrics {
  stars: number;
  forks: number;
  openIssues: number;
  openPullRequests: number;
  commits30d: number;
  commits30dTruncated: boolean;
  issues: IssueWindow;
  pullRequests: PullRequestWindow;
  latestRelease: ReleaseInfo | null;
  releases90d: number;
  lastCommitAt: string | null;
  lastCommitUrl: string | null;
  commitsUrl: string;
  issuesUrl: string;
  pullsUrl: string;
  releasesUrl: string;
}

export interface DailyDownload {
  date: string;
  downloads: number;
}

/** Optional provenance added compatibly to schema v1; raw observations remain evidence. */
export interface NpmQuality {
  rawDaily: unknown[];
  conflictDates: string[];
  invalidCount: number;
  notes: string[];
  windowStart: string | null;
  windowEnd: string | null;
}

export interface NpmMetrics {
  status: NpmStatus;
  packageName: string | null;
  latestVersion: string | null;
  publishedAt: string | null;
  downloads30d: number | null;
  downloads7d: number | null;
  previous7d: number | null;
  weeklyChangePct: number | null;
  daily: DailyDownload[];
  quality?: NpmQuality;
  repositoryUrl: string | null;
  registryUrl: string | null;
  mappingEvidence: string | null;
  enginesNode: string | null;
  dshPeerRange: string | null;
  fetchedAt: string | null;
  reason: string | null;
}

export interface Vulnerability {
  id: string;
  summary: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  aliases: string[];
  modified: string | null;
  url: string;
}

export interface SecurityMetrics {
  status: SecurityStatus;
  /** 仅当 lock 到精确 npm 包 + 版本并成功查询时为 true。 */
  exactMatch: boolean;
  packageName: string | null;
  version: string | null;
  vulnerabilities: Vulnerability[];
  checkedAt: string | null;
  reason: string | null;
  queryUrl: string | null;
}

export interface CompatibilityEvidence {
  nodeEngine: string | null;
  dshPeerRange: string | null;
  npmVersion: string | null;
  evidenceUrl: string | null;
  note: string;
}

export interface ScoreComponent {
  key: string;
  label: string;
  rawLabel: string;
  rawValue: number | null;
  normalized: number | null;
  /** 设计权重。 */
  weight: number;
  /** 经过缺失/小样本折减后的实际权重。 */
  effectiveWeight: number;
  /** 0-100，已经应用实际权重并重新归一化。 */
  contribution: number;
  included: boolean;
  sampleSize: number | null;
  explanation: string;
  evidenceUrl: string | null;
}

export interface PopularityScore {
  score: number | null;
  status: ScoreStatus;
  confidence: Confidence;
  coverage: number;
  components: ScoreComponent[];
  summary: string;
  missing: string[];
  methodVersion: string;
}

export interface MaintenanceScore {
  score: number | null;
  status: ScoreStatus;
  confidence: Confidence;
  coverage: number;
  components: ScoreComponent[];
  summary: string;
  missing: string[];
  methodVersion: string;
}

export interface RiskFlag {
  code: string;
  level: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
  evidenceUrl: string | null;
}

export interface RiskAssessment {
  level: RiskLevel;
  label: string;
  flags: RiskFlag[];
  limitations: string[];
}

export interface MissingDomain {
  key: string;
  label: string;
  reason: string;
}

export interface CompletenessResult {
  score: number;
  available: number;
  total: number;
  level: Confidence;
  missing: MissingDomain[];
}

export interface SourceAvailability {
  repository: boolean;
  commits: boolean;
  issues: boolean;
  pullRequests: boolean;
  releases: boolean;
  npm: boolean;
  security: boolean;
}

export interface PluginScores {
  popularity: PopularityScore;
  maintenance: MaintenanceScore;
  risk: RiskAssessment;
  completeness: CompletenessResult;
}

export interface PluginRecord {
  id: string;
  repo: string;
  /** 页面展示名，通常等于仓库名。 */
  name: string;
  category: string;
  installCommand: string;
  curatorNote: string;
  repository: RepositoryInfo;
  github: GithubMetrics;
  npm: NpmMetrics;
  security: SecurityMetrics;
  compatibility: CompatibilityEvidence;
  scores: PluginScores;
  availability: SourceAvailability;
  dataStatus: DataStatus;
  warnings: string[];
  lastUpdatedAt: string;
}

export interface DashboardStats {
  pluginCount: number;
  totalStars: number;
  totalDownloads: number | null;
  maintainedCount: number;
  highRiskCount: number;
  scoredCount: number;
  fullyScoredCount: number;
  completeDataCount: number;
}

export interface LatestData {
  schemaVersion: typeof LATEST_SCHEMA_VERSION;
  generatedAt: string;
  lastAttemptAt: string;
  lastSuccessAt: string;
  runId: string;
  sources: {
    github: SourceSnapshot;
    npm: SourceSnapshot;
    osv: SourceSnapshot;
  };
  stats: DashboardStats;
  plugins: PluginRecord[];
}

export interface HistoryPoint {
  t: string;
  methodVersion: string;
  stars: number;
  downloads: number | null;
  popularity: number | null;
  maintenance: number | null;
  riskLevel: RiskLevel;
  commits30d: number;
  issuesOpened90d: number;
  issuesClosed90d: number;
  prsOpened90d: number;
  prsMerged90d: number;
  releaseAt: string | null;
  archived: boolean;
}

export interface HistoryFile {
  schemaVersion: typeof HISTORY_SCHEMA_VERSION;
  updatedAt: string;
  retentionDays: number;
  plugins: Record<string, HistoryPoint[]>;
}

export interface StatusFile {
  schemaVersion: typeof STATUS_SCHEMA_VERSION;
  runId: string;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  outcome: 'success' | 'partial' | 'failed';
  sources: LatestData['sources'];
  errorCount: number;
  messages: string[];
  nextRunHint: string;
}

export interface DataBundle {
  latest: LatestData;
  history: HistoryFile;
  status: StatusFile;
}

export interface PluginConfig {
  id: string;
  repo: string;
  npm: string | null;
  category: string;
  installCommand: string;
  note: string;
}

export interface PluginConfigFile {
  schemaVersion: number;
  description?: string;
  verifiedAt: string;
  plugins: PluginConfig[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  agents: '多智能体',
  interface: '界面增强',
  skills: '技能管理',
  sessions: '会话管理',
  connectivity: '连接与集成',
  automation: '自动化',
  workflow: '工作流',
  context: '上下文',
  discovery: '插件发现',
  vision: '视觉能力',
  monitoring: '用量监控',
  operations: '底层运维',
  remote: '远程访问',
  office: '办公文档',
  other: '其他插件',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
