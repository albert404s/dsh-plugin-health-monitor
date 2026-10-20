import { z } from 'zod';
import type { HistoryFile, LatestData, PluginRecord, StatusFile } from './types';
import { computeStats } from './scoring';
import { normalizeGithubRepository } from './data-quality';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const scoreNumber = z.number().min(0).max(100);
const ratio = z.number().min(0).max(1);
export const utcTimestamp = z.iso.datetime({ offset: true });
const optionalTime = utcTimestamp.nullable();
const text = z.string();
const nullableText = text.nullable();
const confidence = z.enum(['high', 'medium', 'low']);
const riskLevel = z.enum(['high', 'medium', 'low', 'unknown']);
const source = z.object({ status: z.enum(['ok', 'partial', 'failed', 'skipped']), fetchedAt: optionalTime, message: text.optional() });
const sources = z.object({ github: source, npm: source, osv: source });
const component = z.object({ key: text.min(1), label: text, rawLabel: text, rawValue: z.number().nullable(), normalized: scoreNumber.nullable(), weight: ratio, effectiveWeight: ratio, contribution: scoreNumber, included: z.boolean(), sampleSize: count.nullable(), explanation: text, evidenceUrl: nullableText });
export const scoreSchema = z.object({ score: scoreNumber.nullable(), status: z.enum(['scored', 'insufficient']), confidence, coverage: ratio, components: z.array(component), summary: text, missing: z.array(text), methodVersion: text.min(1) }).superRefine((score, ctx) => {
  if ((score.status === 'scored') !== (score.score !== null)) ctx.addIssue({code:'custom',message:'评分状态和数值不一致'});
  if (new Set(score.components.map((item) => item.key)).size !== score.components.length) ctx.addIssue({code:'custom',message:'评分分项重复'});
});
const issueWindow = z.object({ opened90d: count, closed90d: count, closureRate: ratio.nullable(), lowSample: z.boolean(), truncated: z.boolean(), longOpen: count, openNow: count, openTruncated: z.boolean(), queryUrl: text });
const prWindow = z.object({ available: z.boolean(), opened90d: count, merged90d: count, mergeRate: ratio.nullable(), lowSample: z.boolean(), truncated: z.boolean(), queryUrl: text });
const release = z.object({ version: nullableText, tagName: text, publishedAt: optionalTime, url: text });
export const dailyDownloadSchema = z.object({ date: z.iso.date(), downloads: count });
const pluginObjectSchema = z.object({
  id: text.min(1), repo: text.regex(/^[\w.-]+\/[\w.-]+$/), name: text.min(1), category: text.min(1), installCommand: text, curatorNote: text,
  repository: z.object({ fullName: text, url: z.url({protocol:/^https?$/}), description: nullableText, homepageUrl: nullableText, topics: z.array(text), language: nullableText, license: nullableText, createdAt: optionalTime, pushedAt: optionalTime, archived: z.boolean(), defaultBranch: text }),
  github: z.object({ stars: count, forks: count, openIssues: count, openPullRequests: count, commits30d: count, commits30dTruncated: z.boolean(), issues: issueWindow, pullRequests: prWindow, latestRelease: release.nullable(), releases90d: count, lastCommitAt: optionalTime, lastCommitUrl: nullableText, commitsUrl: text, issuesUrl: text, pullsUrl: text, releasesUrl: text }),
  npm: z.object({ status: z.enum(['verified','unavailable','unverified','error']), packageName: nullableText, latestVersion: nullableText, publishedAt: optionalTime, downloads30d: count.nullable(), downloads7d: count.nullable(), previous7d: count.nullable(), weeklyChangePct: z.number().nullable(), daily: z.array(dailyDownloadSchema).max(400), quality: z.object({rawDaily:z.array(z.unknown()).max(1000),conflictDates:z.array(z.iso.date()),invalidCount:count,notes:z.array(text),windowStart:z.iso.date().nullable(),windowEnd:z.iso.date().nullable()}).optional(), repositoryUrl: nullableText, registryUrl: nullableText, mappingEvidence: nullableText, enginesNode: nullableText, dshPeerRange: nullableText, fetchedAt: optionalTime, reason: nullableText }),
  security: z.object({ status: z.enum(['checked','unavailable','error']), exactMatch: z.boolean(), packageName: nullableText, version: nullableText, vulnerabilities: z.array(z.object({ id: text.min(1), summary: nullableText, severity: z.enum(['critical','high','medium','low','unknown']), aliases: z.array(text), modified: optionalTime, url: text })), checkedAt: optionalTime, reason: nullableText, queryUrl: nullableText }),
  compatibility: z.object({ nodeEngine: nullableText, dshPeerRange: nullableText, npmVersion: nullableText, evidenceUrl: nullableText, note: text }),
  scores: z.object({ popularity: scoreSchema, maintenance: scoreSchema, risk: z.object({ level: riskLevel, label: text, flags: z.array(z.object({ code: text, level: z.enum(['high','medium','info']), title: text, detail: text, evidenceUrl: nullableText })), limitations: z.array(text) }), completeness: z.object({ score: scoreNumber, available: count, total: count.positive(), level: confidence, missing: z.array(z.object({key:text,label:text,reason:text})) }) }),
  availability: z.object({ repository: z.boolean(), commits: z.boolean(), issues: z.boolean(), pullRequests: z.boolean(), releases: z.boolean(), npm: z.boolean(), security: z.boolean() }),
  dataStatus: z.enum(['complete','partial','stale']), warnings: z.array(text), lastUpdatedAt: utcTimestamp,
});
export const pluginSeedSchema = pluginObjectSchema.omit({ scores: true });
export const pluginSchema = pluginObjectSchema.superRefine((plugin, ctx) => {
  const issue = plugin.github.issues;
  if (issue.closed90d > issue.opened90d || plugin.github.pullRequests.merged90d > plugin.github.pullRequests.opened90d) ctx.addIssue({code:'custom',message:'关闭或合并数超过窗口样本数'});
  if (plugin.repository.fullName.toLowerCase() !== plugin.repo.toLowerCase()) ctx.addIssue({code:'custom',message:'仓库身份不一致'});
  if (plugin.npm.status === 'verified' && normalizeGithubRepository(plugin.npm.repositoryUrl) !== normalizeGithubRepository(plugin.repo)) ctx.addIssue({code:'custom',message:'npm 仓库身份不一致'});
  if (plugin.npm.status === 'verified' && (!plugin.npm.packageName || !plugin.npm.repositoryUrl)) ctx.addIssue({code:'custom',message:'npm 映射缺少身份依据'});
  if (plugin.security.status === 'checked' && (!plugin.security.exactMatch || plugin.security.packageName !== plugin.npm.packageName || plugin.security.version !== plugin.npm.latestVersion)) ctx.addIssue({code:'custom',message:'漏洞查询缺少精确版本匹配'});
  if (plugin.scores.completeness.available > plugin.scores.completeness.total) ctx.addIssue({code:'custom',message:'数据域计数不一致'});
});
const statsSchema = z.object({ pluginCount: count, totalStars: count, totalDownloads: count.nullable(), maintainedCount: count, highRiskCount: count, scoredCount: count, fullyScoredCount: count, completeDataCount: count });
export const latestSchema = z.object({ schemaVersion: z.literal(1), generatedAt: utcTimestamp, lastAttemptAt: utcTimestamp, lastSuccessAt: utcTimestamp, runId: text.min(1), sources, stats: statsSchema, plugins: z.array(pluginSchema) });
const latestEnvelope = latestSchema.omit({ plugins: true }).extend({ plugins: z.array(z.unknown()) });
export const historyPointSchema = z.object({ t: utcTimestamp, methodVersion: text.min(1), stars: count, downloads: count.nullable(), popularity: scoreNumber.nullable(), maintenance: scoreNumber.nullable(), riskLevel, commits30d: count, issuesOpened90d: count, issuesClosed90d: count, prsOpened90d: count, prsMerged90d: count, releaseAt: optionalTime, archived: z.boolean() });
export const historySchema = z.object({ schemaVersion: z.literal(1), updatedAt: utcTimestamp, retentionDays: count.positive(), plugins: z.record(text, z.array(historyPointSchema)) });
export const statusSchema = z.object({ schemaVersion: z.literal(1), runId: text.min(1), lastAttemptAt: utcTimestamp, lastSuccessAt: optionalTime, outcome: z.enum(['success','partial','failed']), sources, errorCount: count, messages: z.array(text), nextRunHint: text });

function issueMessage(error: z.ZodError): string {
  return error.issues.slice(0, 3).map((issue) => issue.path.join('.') + ': ' + issue.message).join('；');
}
export function parseLatest(value: unknown, previous?: LatestData): { data: LatestData; warnings: string[] } {
  const parsed = latestEnvelope.safeParse(value);
  if (!parsed.success) throw new Error('latest.json 核心数据不兼容：' + issueMessage(parsed.error));
  const warnings: string[] = [];
  const plugins: PluginRecord[] = [];
  const ids = new Set<string>(); const repos = new Set<string>();
  for (const [index, raw] of parsed.data.plugins.entries()) {
    const result = pluginSchema.safeParse(raw);
    let plugin: PluginRecord | undefined = result.success ? result.data : undefined;
    if (!plugin) {
      const id = raw && typeof raw === 'object' && 'id' in raw ? raw.id : undefined;
      const old = previous?.plugins.find((item) => item.id === id);
      if (old) plugin = { ...old, dataStatus: 'stale', warnings: [...old.warnings, '本次记录校验失败，沿用上次有效记录。'] };
      warnings.push('第 ' + (index + 1) + ' 条插件记录校验失败，' + (old ? '沿用上次有效记录。' : '已隔离。') + (!result.success ? issueMessage(result.error) : ''));
    }
    if (!plugin) continue;
    if (ids.has(plugin.id.toLowerCase()) || repos.has(plugin.repo.toLowerCase())) { warnings.push('重复插件记录已隔离：' + plugin.id); continue; }
    ids.add(plugin.id.toLowerCase()); repos.add(plugin.repo.toLowerCase()); plugins.push(plugin);
  }
  if (!plugins.length && parsed.data.plugins.length) throw new Error('没有可用的插件记录；请检查快照文件。');
  const stats = computeStats(plugins);
  if (JSON.stringify(stats) !== JSON.stringify(parsed.data.stats)) {
    if (Object.keys(stats).some((key) => stats[key as keyof typeof stats] !== parsed.data.stats[key as keyof typeof stats])) warnings.push('汇总与有效插件记录不一致，已按可用记录重新汇总。');
  }
  if (Date.parse(parsed.data.lastSuccessAt) > Date.parse(parsed.data.generatedAt)) warnings.push('快照时间顺序异常，请核对来源。');
  return { data: { ...parsed.data, plugins, stats }, warnings };
}
export function parseHistory(value: unknown): { data: HistoryFile; warnings: string[] } {
  const envelope = historySchema.omit({plugins:true}).extend({plugins:z.record(text,z.unknown())}).safeParse(value);
  if (!envelope.success) throw new Error('history.json 数据结构不兼容');
  const warnings: string[] = []; const plugins: HistoryFile['plugins'] = {};
  for (const [id, raw] of Object.entries(envelope.data.plugins)) {
    if (!Array.isArray(raw)) { warnings.push(id + ' 的历史记录已隔离。'); continue; }
    const byTime = new Map<string, z.infer<typeof historyPointSchema>>();
    const conflicts = new Set<string>();
    let bad = 0;
    for (const entry of raw) {
      const result = historyPointSchema.safeParse(entry);
      if (!result.success) { bad++; continue; }
      const point = {...result.data,t:new Date(result.data.t).toISOString()};
      if(Date.parse(point.t) > Date.parse(envelope.data.updatedAt)) { bad++; continue; }
      const key = new Date(point.t).toISOString() + ':' + point.methodVersion;
      if (byTime.has(key) && JSON.stringify(byTime.get(key)) !== JSON.stringify(point)) { conflicts.add(key); bad++; }
      else byTime.set(key, point);
    }
    plugins[id] = [...byTime.entries()].filter(([key]) => !conflicts.has(key)).map(([,point]) => point).sort((a,b) => Date.parse(a.t) - Date.parse(b.t));
    if (bad) warnings.push(id + ' 的 ' + bad + ' 条异常历史已隔离，其余趋势保留。');
  }
  return { data: {...envelope.data, plugins}, warnings };
}
export function parseStatus(value: unknown): StatusFile {
  const result = statusSchema.safeParse(value);
  if (!result.success) throw new Error('status.json 数据结构不兼容');
  return result.data;
}
