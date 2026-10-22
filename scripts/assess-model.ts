import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseLatest } from '../src/lib/contracts';
import { compareScores } from '../src/lib/comparison';
import { maintenanceScore, riskAssessment, round, scorePlugins } from '../src/lib/scoring';
import { SCORE_METHOD_VERSION, type PluginRecord } from '../src/lib/types';

const source = path.resolve(process.argv[2] ?? 'public/data/latest.json');
const destination = path.resolve(process.argv[3] ?? 'docs/SCORING-V2.md');
if (path.basename(destination).toLowerCase() === 'scoring-review.md') {
  throw new Error('SCORING-REVIEW.md 是方法 1.1.0 的历史评估，请使用新的报告文件名。');
}
const raw = await readFile(source, 'utf8');
const parsed = parseLatest(JSON.parse(raw));
if (parsed.warnings.length) throw new Error('请先检查输入快照质量：' + parsed.warnings.join('; '));
const latest = parsed.data;
const baseline = latest.plugins;
if (baseline.length === 0 || baseline.some(plugin => plugin.scores.maintenance.methodVersion !== '1.1.0')) {
  throw new Error('旧/新对照必须使用保存了 1.1.0 分数的真实快照；不会用新代码伪造旧分数。请把旧快照路径作为第一个参数传入。');
}
const now = new Date(latest.generatedAt);
type Seed = Omit<PluginRecord, 'scores'>;
type Kind = 'popularity' | 'maintenance';
const seed = (plugin: PluginRecord): Seed => {
  const { scores: _scores, ...value } = structuredClone(plugin);
  return value;
};
const revised = scorePlugins(baseline.map(seed), now);
const scoreMap = (plugins: PluginRecord[], kind: Kind) =>
  new Map(plugins.map(plugin => [plugin.id, plugin.scores[kind].score]));
const order = (values: Map<string, number | null>) =>
  [...values].filter(([, value]) => value !== null)
    .sort(([a, x], [b, y]) => (y! - x!) || a.localeCompare(b)).map(([id]) => id);
function rankStats(base: Map<string, number | null>, next: Map<string, number | null>) {
  const baseOrder = order(base), nextOrder = order(next);
  const common = baseOrder.filter(id => nextOrder.includes(id));
  const a = baseOrder.filter(id => common.includes(id));
  const b = nextOrder.filter(id => common.includes(id));
  const shifts = a.map((id, index) => Math.abs(index - b.indexOf(id)));
  const squared = shifts.reduce((sum, shift) => sum + shift * shift, 0);
  const maxDelta = Math.max(0, ...common.map(id => Math.abs(base.get(id)! - next.get(id)!)));
  return {
    overlap: baseOrder.slice(0, 5).filter(id => nextOrder.slice(0, 5).includes(id)).length,
    rho: common.length > 1 ? 1 - 6 * squared / (common.length * (common.length ** 2 - 1)) : 1,
    maxShift: Math.max(0, ...shifts), maxDelta,
    dropped: baseOrder.filter(id => !nextOrder.includes(id)).length,
  };
}
function reweight(plugin: PluginRecord, kind: Kind, factors: Record<string, number>) {
  const components = plugin.scores[kind].components;
  const designTotal = components.reduce((sum, component) => sum + component.weight * (factors[component.key] ?? 1), 0);
  const values = components.filter(component => component.included && component.normalized !== null)
    .map(component => {
      const scale = kind === 'popularity' ? 1
        : component.key === 'issueHandling' ? Math.min(1, plugin.github.issues.opened90d / 5)
          : component.key === 'pullRequests' ? Math.min(1, plugin.github.pullRequests.opened90d / 3) : 1;
      return {
        normalized: component.normalized!,
        weight: component.weight * (factors[component.key] ?? 1) * scale / designTotal,
      };
    });
  const coverage = values.reduce((sum, component) => sum + component.weight, 0);
  if (coverage <= 0 || (kind === 'maintenance' && coverage + 1e-9 < 0.45)) return null;
  return round(values.reduce((sum, component) => sum + round(component.normalized * component.weight / coverage, 1), 0), 1);
}
function sensitivity(kind: Kind) {
  const keys = revised[0].scores[kind].components.map(component => component.key);
  const scenarios: Record<string, number>[] = [];
  for (const key of keys) for (const factor of [0.8, 1.2]) scenarios.push({ [key]: factor });
  for (let mask = 0; mask < 2 ** keys.length; mask++) {
    scenarios.push(Object.fromEntries(keys.map((key, index) => [key, mask & (1 << index) ? 1.2 : 0.8])));
  }
  const base = scoreMap(revised, kind);
  const results = scenarios.map(factors =>
    rankStats(base, new Map(revised.map(plugin => [plugin.id, reweight(plugin, kind, factors)]))));
  return {
    scenarios: results.length,
    minTop5: Math.min(...results.map(result => result.overlap)),
    minRho: Math.min(...results.map(result => result.rho)),
    maxShift: Math.max(...results.map(result => result.maxShift)),
    maxDelta: Math.max(...results.map(result => result.maxDelta)),
    maxDropped: Math.max(...results.map(result => result.dropped)),
  };
}
const oldPairs = baseline.map(plugin => [
  plugin.scores.maintenance.components.find(component => component.key === 'issueHandling'),
  plugin.scores.maintenance.components.find(component => component.key === 'issueBacklog'),
]).filter(pair => pair.every(component => component?.included && component.normalized !== null));
const duplicated = oldPairs.filter(([a, b]) => Math.abs(a!.normalized! - b!.normalized!) < 0.1).length;
const sampleSource = baseline.find(plugin => plugin.security.status === 'checked' && plugin.security.vulnerabilities.length === 0) ?? baseline[0];
function boundary(opened: number, open = opened, truncated = false, openTruncated = false, longOpen = 0) {
  const value = seed(sampleSource);
  value.repository.archived = false;
  value.github.issues = {
    ...value.github.issues, opened90d: opened, closed90d: 0,
    closureRate: opened ? 0 : null, openNow: open, lowSample: opened > 0 && opened < 5,
    truncated, openTruncated, longOpen,
  };
  value.availability.issues = true;
  value.security.vulnerabilities = [];
  const maintenance = maintenanceScore(value, now);
  const risk = riskAssessment(value, now);
  const issue = maintenance.components.find(component => component.key === 'issueHandling')!;
  return {
    opened, open, truncated, openTruncated, longOpen,
    included: issue.included, effectiveWeight: issue.effectiveWeight,
    coverage: maintenance.coverage, flags: risk.flags.map(flag => flag.code),
  };
}
const cases = [boundary(1), boundary(4), boundary(5), boundary(20), boundary(0, 100), boundary(4, 100), boundary(20, 4), boundary(20, 20, true), boundary(20, 20, false, true), boundary(1, 21, true, false, 20)];
const oldNew = rankStats(scoreMap(baseline, 'maintenance'), scoreMap(revised, 'maintenance'));
const popularity = sensitivity('popularity'), maintenance = sensitivity('maintenance');
const newComponents = revised[0].scores.maintenance.components.map(component => {
  const items = revised.flatMap(plugin => plugin.scores.maintenance.components
    .filter(item => item.key === component.key && item.included && item.normalized !== null));
  return { label: component.label, weight: component.weight, samples: items.length, full: items.filter(item => item.normalized === 100).length };
});
let comparable = 0;
for (let i = 0; i < revised.length; i++) for (let j = i + 1; j < revised.length; j++) {
  if (compareScores(revised[i].scores.maintenance, revised[j].scores.maintenance).comparable) comparable++;
}
const popChanged = revised.filter((plugin, index) => plugin.scores.popularity.score !== baseline[index].scores.popularity.score).length;
const removals = revised.map(removed => {
  const remaining = revised.filter(plugin => plugin.id !== removed.id);
  return rankStats(scoreMap(remaining, 'popularity'), scoreMap(scorePlugins(remaining.map(seed), now), 'popularity'));
});
const extreme = seed(revised[0]);
extreme.id = 'assessment-extreme'; extreme.repo = 'assessment/extreme'; extreme.repository.fullName = extreme.repo;
extreme.github.stars = 1_000_000; extreme.npm.status = 'verified'; extreme.npm.downloads30d = 50_000_000;
const added = rankStats(scoreMap(revised, 'popularity'), scoreMap(scorePlugins([...revised.map(seed), extreme], now).filter(plugin => plugin.id !== extreme.id), 'popularity'));
const lines = [
  '# 方法 2.0.0：去重复计分与小样本保护',
  '',
  '## 数据与复现',
  '',
  '- 快照时间：' + latest.generatedAt + '；真实插件 ' + baseline.length + ' 个。',
  '- 输入 SHA-256：' + createHash('sha256').update(raw).digest('hex'),
  '- 执行：npm run assess:model -- <保存了 1.1.0 分数的 latest.json> docs/SCORING-V2.md',
  '- 旧分数直接读取真实快照中保存的 1.1.0 结果；新分数使用同一批原始指标与同一快照时间计算。没有使用新公式重算并冒充旧版结果，也没有真实调用 API。',
  '- 评估不写入 public/data，不覆盖旧 SCORING-REVIEW.md，不补造或重算旧历史。',
  '',
  '## 最小修订',
  '',
  '移除维护分里的“开放 Issue / 90 天新开 Issue”分项，开放数、长期未关闭数仍保留在原始指标与选用提醒。旧快照中两个分项同时参与的 ' + oldPairs.length + ' 个插件，有 ' + duplicated + ' 个的分项得分近似相同（差 < 0.1），因此先消除这项重复。',
  '',
  '| 保留分项 | 原设计比例 | 新设计权重 | 当前有效样本 | 满分样本 |',
  '|---|---:|---:|---:|---:|',
  ...newComponents.map((component, index) => '| ' + component.label + ' | ' + [30, 15, 20, 15, 10][index] + ' | ' + (component.weight * 100).toFixed(2) + '% | ' + component.samples + ' | ' + component.full + ' |'),
  '',
  '剩余 30:15:20:15:10 按总量 90 归一。提交、Release 的分档不改；Issue 少于 5 条、PR 少于 3 条仍降低有效权重。可用证据覆盖不足 45% 不输出维护分，缺失不记零。此修订没有为拉开名次而新增指标。',
  '',
  '开放 Issue 的比例提醒要求：近 90 天新 Issue ≥5、当前开放 Issue ≥5、Issue 数据可用且两类分页统计完整。样本少、分母为零或截断时仍显示原始数，但不凭比例升为高/中等级。长期开放 ≥20 条、归档和确证公开漏洞仍保留独立提醒。',
  '',
  '## 同快照旧 / 新维护分',
  '',
  '| 插件 | 1.1.0 保存分 | ' + SCORE_METHOD_VERSION + ' 重算分 | 新覆盖 | 新提醒等级 |',
  '|---|---:|---:|---:|---|',
  ...revised.map((plugin, index) => '| ' + plugin.repo + ' | ' + (baseline[index].scores.maintenance.score ?? '未评分') + ' | ' + (plugin.scores.maintenance.score ?? '未评分') + ' | ' + Math.round(plugin.scores.maintenance.coverage * 100) + '% | ' + plugin.scores.risk.label + ' |'),
  '',
  '旧 / 新维护榜 Top 5 重合 ' + oldNew.overlap + '/5，最大分数变化 ' + oldNew.maxDelta.toFixed(1) + '，共同可评分插件最大名次移动 ' + oldNew.maxShift + '；退出可评分集合 ' + oldNew.dropped + ' 个。变化来自公式修订，不能当成插件表现变化。关注度数值变化 ' + popChanged + ' 个（公式未改；统一方法标签升级）。',
  '',
  '## 边界复测',
  '',
  '以下是从一个真实插件复制后，仅修改 Issue 字段的合成案例，不冒充真实插件状态。其它独立提醒照常保留。归档、确证严重公开漏洞与小样本组合另由单元测试验证。',
  '',
  '| 90 天新开 / 当前开放 | 截断（新开 / 开放） | 长期开放 | 关闭率参与 | 有效权重 | 提醒代码 |',
  '|---|---|---:|---|---:|---|',
  ...cases.map(item => '| ' + item.opened + ' / ' + item.open + ' | ' + item.truncated + ' / ' + item.openTruncated + ' | ' + item.longOpen + ' | ' + item.included + ' | ' + (item.effectiveWeight * 100).toFixed(1) + '% | ' + (item.flags.filter(flag => !['stale-data', 'npm-unverified', 'osv-unchecked'].includes(flag)).join(', ') || '无维护比例提醒') + ' |'),
  '',
  '## 权重 ±20% 与榜单稳定性',
  '',
  '逐项乘 0.8 / 1.2，并枚举所有分项端点组合；每次先归一设计权重，再应用原来的样本折减、缺失与 45% 门槛。同分按插件 ID 排序。Spearman rho 和名次移动只比较两侧都可评分的项目；退出数量另外列出，Top 5 重合按原完整榜计算。',
  '',
  '| 维度 | 场景 | 最差 Top 5 重合 | 最低 rho | 最大名次移动 | 最大分数变化 | 最多退出评分 |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...([['关注度', popularity], ['维护活跃度', maintenance]] as const).map(([label, item]) => '| ' + label + ' | ' + item.scenarios + ' | ' + item.minTop5 + '/5 | ' + item.minRho.toFixed(3) + ' | ' + item.maxShift + ' | ' + item.maxDelta.toFixed(1) + ' | ' + item.maxDropped + ' |'),
  '',
  '逐个移除一个收录插件，保留插件关注度最大变化 ' + Math.max(...removals.map(item => item.maxDelta)).toFixed(1) + '；最差 Top 5 重合 ' + Math.min(...removals.map(item => item.overlap)) + '/5。额外加入合成极端样本（100 万 Stars / 5000 万下载）后，原插件最大变化 ' + added.maxDelta.toFixed(1) + '，Top 5 重合 ' + added.overlap + '/5。关注度仍依赖收录样本，跨集合分差应谨慎解释。',
  '',
  '## 历史与仍然存在的限制',
  '',
  '- 新评分记录标记 2.0.0；旧 1.1.0 快照和历史保持原样。趋势按连续方法段绘线，A → B → A 也不跨中间版本连线；悬停显示该点的方法版本。',
  '- 本快照 ' + (revised.length * (revised.length - 1) / 2) + ' 对插件中，维护分满足同方法、同参与分项、同有效权重的只有 ' + comparable + ' 对；前端继续阻止其它组合直接算分差。',
  '- 提交频率封顶现象仍保留，原始次数继续展示。本次只消除已证实的重复和小样本提醒，不把维护活动解释成软件质量。',
  '- 稳定性检查仅对应上述快照，并非统计置信度或未来保证。',
  '',
];
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, lines.join('\n'), 'utf8');
console.log(JSON.stringify({
  report: destination, snapshot: latest.generatedAt, methodVersion: SCORE_METHOD_VERSION,
  baselineSource: 'stored 1.1.0 scores', plugins: revised.length, duplicated, oldPairs: oldPairs.length,
  oldNew, popularitySensitivity: popularity, maintenanceSensitivity: maintenance,
  comparableMaintenancePairs: comparable, unchangedPopularityScores: baseline.length - popChanged,
}, null, 2));
