import type { PluginConfig } from '../../src/lib/types';
import { normalizeGithubRepository } from '../../src/lib/data-quality';
import { BudgetExhaustedError, HttpError, type JsonClient } from './http';

export type DiscoveryStopReason = 'target_reached' | 'no_more_verified_plugins' | 'deadline' | 'request_budget' | 'search_failed' | 'candidate_limit' | 'search_limit';
export interface DiscoveryReport {
  targetPlugins: number;
  previousPlugins: number;
  totalPlugins: number;
  addedPlugins: number;
  checkedCandidates: number;
  rejectedCandidates: number;
  searchRequests: number;
  exhausted: boolean;
  stopReason: DiscoveryStopReason;
  warnings: string[];
}
export interface DiscoveryOptions {
  npmClient?: JsonClient;
  /** Total search requests across all queries, not pages per query. */
  maxSearchPages?: number;
  maxCandidates?: number;
}
interface Candidate { full_name: string; private?: boolean; fork?: boolean; stargazers_count?: number }
interface SearchResult { total_count?: number; incomplete_results?: boolean; items?: Candidate[] }
type ObjectRecord = Record<string, unknown>;
const QUERIES = [
  'topic:dsh-plugin dsh in:name fork:false',
  '"dsh-plugin" in:name,description fork:false',
  '"deepseek harness" plugin in:name,description fork:false',
];
const MAX_FILE_BYTES = 512 * 1024;
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

function record(value: unknown): ObjectRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectRecord : null;
}
function limit(value: number | undefined, fallback: number, maximum: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) throw new Error('插件发现数量必须为范围内的正整数');
  return result;
}
function repositoryField(value: unknown): string | null {
  const url = typeof value === 'string' ? value : record(value)?.url;
  return typeof url === 'string' ? normalizeGithubRepository(url)?.toLowerCase() ?? null : null;
}
function fileText(value: unknown): string | null {
  const file = record(value);
  if (!file || file.encoding !== 'base64' || typeof file.content !== 'string' ||
      !Number.isSafeInteger(file.size) || Number(file.size) < 0 || Number(file.size) > MAX_FILE_BYTES ||
      file.content.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + MAX_FILE_BYTES / 40) return null;
  // Buffer's permissive decoder must not turn an invalid response into plausible metadata.
  const encoded = file.content.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return null;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== file.size || bytes.length > MAX_FILE_BYTES) return null;
  return bytes.toString('utf8');
}
function bundleManifest(pkg: ObjectRecord): boolean {
  const dsh = record(pkg.dsh), bundle = record(dsh?.bundle);
  const patches = Array.isArray(bundle?.patch) ? bundle.patch : [bundle?.patch];
  // Read manifests only. Never resolve a remote patch or execute package scripts.
  return patches.length > 0 && patches.every(value => typeof value === 'string' &&
    value.length > 0 && value.length < 256 && !value.includes('..') && !/[:\\\u0000]/.test(value) && !value.startsWith('/'));
}
function npmName(value: string): string | null {
  const match = value.match(/^((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)(?:@[^\s]+)?$/);
  return match && PACKAGE.test(match[1]) ? match[1] : null;
}
/** Extract one safe package token; never reuse README text as a shell command. */
function installationTargets(readme: string): string[] {
  const found: string[] = [];
  const command = /(?:\bdsh|@deepseek-ai\/dsh(?:@[^\s`]+)?)\s+plugin\s+(?:(?:--profile\s+[\w-]+)\s+)?add\s+(?:(?:--[\w-]+)\s+)*["']?([^\s`"'<>;|&$()]+)/g;
  for (const match of readme.replace(/\\\r?\n/g, ' ').matchAll(command)) found.push(match[1]);
  return found;
}
function githubTarget(target: string): string | null {
  // Local '.' and URL values from untrusted README files are never fetched.
  if (!/^(?:github:|git\+https:\/\/github\.com\/|https:\/\/github\.com\/)/i.test(target)) return null;
  return normalizeGithubRepository(target.replace(/#.*$/, ''))?.toLowerCase() ?? null;
}
function pluginId(repo: string, ids: Set<string>): string {
  const base = repo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let result = base, suffix = 2;
  while (ids.has(result)) result = `${base}-${suffix++}`;
  return result;
}

/**
 * Discover only public standalone DSH bundles with a repository-matched install
 * instruction. Stars order the bounded candidate search; they do not prove a
 * repository is a plugin. Existing verified records and their IDs always win.
 */
export async function discoverPlugins(
  client: JsonClient,
  existing: PluginConfig[],
  targetPlugins: number,
  deadlineMs: number,
  options: DiscoveryOptions = {},
): Promise<{ plugins: PluginConfig[]; report: DiscoveryReport }> {
  limit(targetPlugins, 0, 1000);
  if (!Number.isFinite(deadlineMs)) throw new Error('插件发现需要有效截止时间');
  const maxPages = limit(options.maxSearchPages, 6, 10);
  const maxCandidates = limit(options.maxCandidates, Math.min(300, Math.max(100, (targetPlugins - existing.length) * 4)), 1000);
  const plugins: PluginConfig[] = [];
  const repos = new Set<string>(), packages = new Set<string>(), ids = new Set<string>();
  for (const plugin of existing) {
    const repo = plugin.repo.toLowerCase(), pkg = plugin.npm?.toLowerCase();
    if (repos.has(repo) || ids.has(plugin.id) || (pkg && packages.has(pkg))) continue;
    plugins.push(plugin); repos.add(repo); ids.add(plugin.id); if (pkg) packages.add(pkg);
  }
  const report: DiscoveryReport = {
    targetPlugins, previousPlugins: plugins.length, totalPlugins: plugins.length, addedPlugins: 0,
    checkedCandidates: 0, rejectedCandidates: 0, searchRequests: 0, exhausted: false,
    stopReason: 'no_more_verified_plugins', warnings: [],
  };
  const seen = new Set(repos);
  function stopped(): DiscoveryStopReason | null {
    if (plugins.length >= targetPlugins) return 'target_reached';
    if (Date.now() >= deadlineMs) return 'deadline';
    if (client.budget.isStopped || options.npmClient?.budget.isStopped) return 'request_budget';
    if (report.checkedCandidates >= maxCandidates) return 'candidate_limit';
    return null;
  }
  async function get<T>(url: string, selected = client): Promise<T> {
    if (Date.now() >= deadlineMs) throw new Error('discovery_deadline');
    return (await selected.get<T>(url, { timeoutMs: Math.max(1, Math.min(12_000, deadlineMs - Date.now())), retries: 0 })).data;
  }
  async function verify(candidate: Candidate): Promise<PluginConfig | null> {
    const repo = candidate.full_name, normalized = repo.toLowerCase();
    const base = `https://api.github.com/repos/${repo}`;
    const metadata = record(await get(base));
    if (!metadata || metadata.private !== false || metadata.fork !== false ||
        typeof metadata.full_name !== 'string' || metadata.full_name.toLowerCase() !== normalized ||
        normalized === 'deepseek-ai/deepseek-harness') return null;
    // Inspect the cheap manifest first; most polluted search hits are rejected here.
    const packageText = fileText(await get(`${base}/contents/package.json`));
    if (!packageText) return null;
    let pkg: ObjectRecord | null;
    try { pkg = record(JSON.parse(packageText)); } catch { return null; }
    if (!pkg || !bundleManifest(pkg)) return null;
    const readme = fileText(await get(`${base}/readme`));
    if (!readme) return null;
    const targets = installationTargets(readme);
    const githubInstall = targets.some(target => githubTarget(target) === normalized);
    const packageName = typeof pkg.name === 'string' && PACKAGE.test(pkg.name) ? pkg.name : null;
    let npmInstall = packageName && pkg.private !== true && repositoryField(pkg.repository) === normalized &&
      targets.some(target => npmName(target) === packageName) ? packageName : null;
    if (npmInstall && options.npmClient) {
      try {
        const registry = record(await get(`https://registry.npmjs.org/${encodeURIComponent(npmInstall)}/latest`, options.npmClient));
        if (!registry || registry.name !== npmInstall || repositoryField(registry.repository) !== normalized || !bundleManifest(registry)) npmInstall = null;
      } catch (error) {
        if (error instanceof BudgetExhaustedError || Date.now() >= deadlineMs) throw error;
        npmInstall = null;
      }
    }
    if (!githubInstall && !npmInstall) return null;
    // A copied npm identity cannot turn a second repository into another plugin.
    if (npmInstall && packages.has(npmInstall.toLowerCase())) return null;
    const id = pluginId(repo, ids);
    return {
      id, repo, npm: npmInstall, category: 'other',
      installCommand: `dsh plugin --profile web add ${npmInstall ?? `github:${repo}`}`,
      note: '已核对公开仓库的 DSH bundle 声明和对应安装说明。',
    };
  }
  let lastReason: DiscoveryStopReason = 'no_more_verified_plugins';
  let searchFailed = false, searchLimited = false;
  const exhaustedQueries = new Set<string>();
  outer: for (let page = 1; page <= 10; page += 1) {
    for (const query of QUERIES) {
      if (exhaustedQueries.has(query)) continue;
      const stop = stopped(); if (stop) { lastReason = stop; break outer; }
      if (report.searchRequests >= maxPages || searchLimited) { lastReason = 'search_limit'; break outer; }
      const url = new URL('https://api.github.com/search/repositories');
      url.searchParams.set('q', query); url.searchParams.set('sort', 'stars');
      url.searchParams.set('order', 'desc'); url.searchParams.set('per_page', '100'); url.searchParams.set('page', String(page));
      let result: SearchResult;
      try {
        report.searchRequests += 1;
        const response = await client.get<SearchResult>(url.toString(), {
          timeoutMs: Math.max(1, Math.min(12_000, deadlineMs - Date.now())), retries: 0,
        });
        result = response.data;
        // Search has its own much smaller rate pool; zero means no more searches,
        // not no more repository requests in the independent core pool.
        const remaining = response.headers.get('x-ratelimit-remaining');
        searchLimited = remaining !== null && /^\d+$/.test(remaining) && Number(remaining) <= 1;
        if (!result || !Array.isArray(result.items)) throw new Error('Invalid GitHub search response');
        if (result.items.length < 100 || (Number.isFinite(result.total_count) && page * 100 >= result.total_count!)) exhaustedQueries.add(query);
        if (result.incomplete_results && report.warnings.length < 5) report.warnings.push('GitHub 搜索返回了部分结果，当前数量不代表完整生态。');
      } catch (error) {
        lastReason = stopped() ?? (error instanceof BudgetExhaustedError ? 'request_budget' : 'search_failed');
        if (lastReason === 'deadline' || lastReason === 'request_budget') break outer;
        if (report.warnings.length < 5) report.warnings.push('部分 GitHub 搜索暂不可用，本轮发现范围不完整。');
        searchFailed = true; continue;
      }
      const candidates = result.items.filter(candidate => candidate && typeof candidate.full_name === 'string' &&
        REPOSITORY.test(candidate.full_name) && candidate.private === false && candidate.fork === false)
        .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0));
      for (const candidate of candidates) {
        const stop = stopped(); if (stop) { lastReason = stop; break outer; }
        const normalized = candidate.full_name.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized); report.checkedCandidates += 1;
        try {
          const plugin = await verify(candidate);
          if (!plugin) { report.rejectedCandidates += 1; continue; }
          plugins.push(plugin); repos.add(normalized); ids.add(plugin.id);
          if (plugin.npm) packages.add(plugin.npm.toLowerCase());
        } catch (error) {
          const stop = stopped();
          if (stop || error instanceof BudgetExhaustedError) { lastReason = stop ?? 'request_budget'; break outer; }
          report.rejectedCandidates += 1;
          if (!(error instanceof HttpError && error.status === 404) && report.warnings.length < 5) {
            report.warnings.push(`${candidate.full_name} 暂无法核验，已跳过。`);
          }
        }
      }
    }
    if (exhaustedQueries.size === QUERIES.length) break;
  }
  lastReason = stopped() ?? (searchFailed && report.checkedCandidates === 0 ? 'search_failed' : lastReason);
  report.totalPlugins = plugins.length;
  report.addedPlugins = plugins.length - report.previousPlugins;
  report.stopReason = lastReason;
  report.exhausted = lastReason === 'no_more_verified_plugins';
  report.warnings = [...new Set(report.warnings)].slice(0, 5);
  if (plugins.length < targetPlugins) {
    report.warnings.push(`目标 ${targetPlugins} 个，本轮已核验目录 ${plugins.length} 个；只收录真实插件，不补造记录。`);
  }
  return { plugins, report };
}
