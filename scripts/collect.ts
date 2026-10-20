import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  GithubMetrics,
  LatestData,
  NpmMetrics,
  PluginConfig,
  PluginConfigFile,
  PluginRecord,
  RepositoryInfo,
  SecurityMetrics,
  SourceSnapshot,
  StatusFile,
} from '../src/lib/types';
import {
  LATEST_SCHEMA_VERSION,
  SCORE_METHOD_VERSION,
  STATUS_SCHEMA_VERSION,
} from '../src/lib/types';
import { computeStats, scorePlugins } from '../src/lib/scoring';
import { cleanSeedRecords, applyNpmGapGuard } from './lib/clean';
import { normalizeGithubRepository } from '../src/lib/data-quality';
import { JsonClient, createGithubClient, createNpmClient } from './lib/http';
import { collectGithub } from './lib/github';
import { collectNpm } from './lib/npm';
import { collectOsv } from './lib/osv';
import {
  loadExisting,
  updateHistory,
  writeLatest,
  writeSnapshot,
  writeStatus,
} from './lib/store';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

interface Options {
  dataDir: string;
  configPath: string;
  allowGhCliToken: boolean;
}

function parseArgs(argv: string[]): Options {
  let dataDir = process.env.DATA_DIR || path.join(ROOT, 'public', 'data');
  let configPath = path.join(ROOT, 'config', 'plugins.json');
  let allowGhCliToken = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--data-dir' && argv[index + 1]) {
      dataDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === '--config' && argv[index + 1]) {
      configPath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === '--gh-cli-token') {
      allowGhCliToken = true;
    }
  }
  return { dataDir, configPath, allowGhCliToken };
}

function resolveGithubToken(allowGhCliToken: boolean): { token: string | null; note: string } {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return { token: fromEnv, note: 'using GITHUB_TOKEN/GH_TOKEN from environment' };
  if (!allowGhCliToken) {
    return {
      token: null,
      note: 'no GitHub token; unauthenticated rate limit is only 60 requests/hour. Use --gh-cli-token to explicitly reuse the local gh login.',
    };
  }
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (token) return { token, note: 'using local gh auth token (explicit --gh-cli-token)' };
  } catch {
    // Fall through to unauthenticated mode with an explicit warning.
  }
  return {
    token: null,
    note: 'explicit gh CLI token requested but unavailable; unauthenticated mode',
  };
}

async function loadConfig(configPath: string): Promise<PluginConfig[]> {
  const raw = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object') throw new Error('插件配置不是有效对象');
  const config = raw as PluginConfigFile;
  if (!Array.isArray(config.plugins)) throw new Error('插件配置缺少 plugins 数组');
  if (config.plugins.length < 10 || config.plugins.length > 30) {
    throw new Error(`插件数量应在 10–30 之间，当前为 ${config.plugins.length}`);
  }
  const ids = new Set<string>();
  const repos = new Set<string>();
  const packages = new Set<string>();
  for (const plugin of config.plugins) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(plugin.repo)) {
      throw new Error(`非法 GitHub 仓库地址：${plugin.repo}`);
    }
    if (!plugin.id || ids.has(plugin.id.toLowerCase())) throw new Error(`重复或缺失插件 id：${plugin.id}`);
    if (repos.has(plugin.repo.toLowerCase())) {
      throw new Error(`重复 GitHub 仓库：${plugin.repo}`);
    }
    if (plugin.npm !== null && typeof plugin.npm !== 'string') {
      throw new Error(`插件 ${plugin.id} 的 npm 字段必须为字符串或 null`);
    }
    if (!plugin.installCommand || !plugin.category) {
      throw new Error(`插件 ${plugin.id} 缺少安装命令或分类`);
    }
    if (plugin.npm) {
      if (packages.has(plugin.npm.toLowerCase())) throw new Error('重复 npm 映射：' + plugin.npm);
      packages.add(plugin.npm.toLowerCase());
    }
    ids.add(plugin.id.toLowerCase());
    repos.add(plugin.repo.toLowerCase());
  }
  return config.plugins;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fallbackNpm(
  previous: PluginRecord | undefined,
  expectedPackage: string | null,
  reason: string,
): NpmMetrics | null {
  if (!previous || previous.npm.status !== 'verified') return null;
  if (expectedPackage === null || previous.npm.packageName !== expectedPackage) return null;
  return {
    ...previous.npm,
    reason: `${reason} 已保留上次成功快照（${previous.npm.fetchedAt ?? '未知时间'}）。`,
  };
}

function fallbackSecurity(
  previous: PluginRecord | undefined,
  npm: NpmMetrics,
): SecurityMetrics | null {
  const old = previous?.security;
  if (!old || old.status !== 'checked') return null;
  if (old.packageName !== npm.packageName || old.version !== npm.latestVersion) return null;
  return {
    ...old,
    reason: `本次 OSV 请求失败，保留 ${old.checkedAt ?? '上次'} 的已匹配结果。`,
  };
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const options = parseArgs(process.argv.slice(2));
  const pluginsConfig = await loadConfig(options.configPath);
  const previous = await loadExisting(options.dataDir);
  const previousById = new Map((previous.latest?.plugins ?? []).map((plugin) => [plugin.id, plugin]));
  const { token, note } = resolveGithubToken(options.allowGhCliToken);
  console.log(`[collect] ${pluginsConfig.length} plugins; GitHub ${note}`);
  const deadline = startedAt.getTime() + 20 * 60 * 1000;

  const githubClient: JsonClient = createGithubClient(token ?? undefined);
  const npmClient = createNpmClient();
  const osvClient = createNpmClient();

  const records: Array<Omit<PluginRecord, 'scores'>> = [];
  const errors: string[] = [];
  let githubSuccess = 0;
  let githubFailed = 0;
  let npmChecked = 0;
  let npmVerified = 0;
  let npmErrors = 0;
  let npmUnverified = 0;
  let npmUnavailable = 0;
  let npmWithoutDownloads = 0;
  let osvChecked = 0;
  let osvErrors = 0;
  let usedFallback = 0;

  for (const config of pluginsConfig) {
    const candidate = previousById.get(config.id);
    const previousPlugin = candidate && normalizeGithubRepository(candidate.repo) === normalizeGithubRepository(config.repo) ? candidate : undefined;
    if (Date.now() > deadline) {
      const message = `全局采集时间预算（20 分钟）已耗尽，${config.id} 沿用上次快照。`;
      errors.push(message);
      githubFailed += 1;
      if (previousPlugin) {
        const { scores: _previousScores, ...previousSeed } = previousPlugin;
        records.push({
          ...previousSeed,
          id: config.id,
          category: config.category,
          installCommand: config.installCommand,
          curatorNote: config.note,
          dataStatus: 'stale',
          warnings: [...previousSeed.warnings, message],
        });
        usedFallback += 1;
      }
      continue;
    }

    let repository: RepositoryInfo;
    let github: GithubMetrics;
    let availabilityBase: {
      repository: boolean;
      commits: boolean;
      issues: boolean;
      pullRequests: boolean;
      releases: boolean;
    };
    let warnings: string[] = [];
    let lastUpdatedAt = startedAt.toISOString();
    let usedPreviousGithub = false;
    let usedFallbackForPlugin = false;

    try {
      const result = await collectGithub(config.repo, githubClient, startedAt);
      repository = result.repository;
      github = result.github;
      availabilityBase = result.availability;
      warnings = [...result.warnings];
      githubSuccess += 1;
    } catch (error) {
      githubFailed += 1;
      errors.push(`GitHub ${config.repo}: ${errorMessage(error)}`);
      if (!previousPlugin) {
        console.warn(`[collect] skip ${config.id}: GitHub failed and no previous snapshot`);
        continue;
      }
      repository = previousPlugin.repository;
      github = previousPlugin.github;
      availabilityBase = {
        repository: previousPlugin.availability.repository,
        commits: previousPlugin.availability.commits,
        issues: previousPlugin.availability.issues,
        pullRequests: previousPlugin.availability.pullRequests,
        releases: previousPlugin.availability.releases,
      };
      warnings = [`GitHub 采集失败，保留上次快照：${errorMessage(error)}`];
      lastUpdatedAt = previousPlugin.lastUpdatedAt;
      usedPreviousGithub = true;
      usedFallbackForPlugin = true;
      usedFallback += 1;
    }

    let npm: NpmMetrics;
    try {
      npm = await collectNpm(config.npm, repository.fullName, npmClient, startedAt);
    } catch (error) {
      npm = {
        status: 'error',
        packageName: config.npm,
        latestVersion: null,
        publishedAt: null,
        downloads30d: null,
        downloads7d: null,
        previous7d: null,
        weeklyChangePct: null,
        daily: [],
        repositoryUrl: null,
        registryUrl: config.npm ? `https://www.npmjs.com/package/${config.npm}` : null,
        mappingEvidence: null,
        enginesNode: null,
        dshPeerRange: null,
        fetchedAt: null,
        reason: errorMessage(error),
      };
    }
    if (config.npm) npmChecked += 1;
    if (npm.status === 'verified') npmVerified += 1;
    if (npm.status === 'unverified') npmUnverified += 1;
    if (config.npm && npm.status === 'unavailable') npmUnavailable += 1;
    if (config.npm && npm.status === 'verified' && npm.downloads30d === null) {
      npmWithoutDownloads += 1;
    }

    if (npm.status === 'error') {
      npmErrors += 1;
      const fallback = fallbackNpm(
        previousPlugin,
        config.npm,
        `npm 采集失败：${npm.reason ?? '未知错误'}。`,
      );
      if (fallback) {
        npm = fallback;
        warnings.push('npm 数据沿用上次成功快照。');
        usedFallbackForPlugin = true;
        usedFallback += 1;
      } else {
        warnings.push(npm.reason ?? 'npm 采集失败。');
      }
    }
    if (npm.status === 'verified' && npm.downloads30d === null) {
      warnings.push(npm.reason ?? 'npm 下载数据暂缺。');
    }

    let security: SecurityMetrics;
    if (npm.status === 'verified' && npm.latestVersion) {
      security = await collectOsv(npm.packageName, npm.latestVersion, osvClient, startedAt);
      if (security.status === 'checked') osvChecked += 1;
      if (security.status === 'error') {
        osvErrors += 1;
        const fallback = fallbackSecurity(previousPlugin, npm);
        if (fallback) {
          security = fallback;
          warnings.push('OSV 数据沿用上次已匹配结果。');
          usedFallbackForPlugin = true;
          usedFallback += 1;
        } else {
          warnings.push(security.reason ?? 'OSV 漏洞检查失败。');
        }
      }
    } else {
      security = {
        status: 'unavailable',
        exactMatch: false,
        packageName: npm.packageName,
        version: null,
        vulnerabilities: [],
        checkedAt: null,
        reason:
          npm.reason ??
          '缺少经核验的 npm 包名与版本，无法执行精确的 OSV 版本查询。',
        queryUrl: npm.packageName
          ? `https://osv.dev/list?ecosystem=npm&q=${encodeURIComponent(npm.packageName)}`
          : null,
      };
    }

    const availability: PluginRecord['availability'] = {
      ...availabilityBase,
      npm: npm.status === 'verified' && npm.downloads30d !== null,
      security: security.status === 'checked',
    };
    const availableDomains = Object.values(availability).filter(Boolean).length;
    const dataStatus: PluginRecord['dataStatus'] = usedFallbackForPlugin
      ? 'stale'
      : warnings.length > 0 || availableDomains < 7
        ? 'partial'
        : 'complete';

    const compatibilityEvidenceUrl =
      npm.status === 'verified' && npm.packageName && npm.latestVersion
        ? `https://www.npmjs.com/package/${npm.packageName}/v/${npm.latestVersion}`
        : `${repository.url}/blob/${repository.defaultBranch}/package.json`;

    records.push({
      id: config.id,
      repo: repository.fullName,
      name: repository.fullName.split('/')[1] ?? config.repo.split('/')[1],
      category: config.category,
      installCommand: config.installCommand,
      curatorNote: config.note,
      repository,
      github,
      npm,
      security,
      compatibility: {
        nodeEngine: npm.enginesNode,
        dshPeerRange: npm.dshPeerRange,
        npmVersion: npm.latestVersion,
        evidenceUrl: compatibilityEvidenceUrl,
        note: '仅展示包声明与公开元数据；本项目未安装、执行或运行时验证被检测插件，因此不构成兼容性保证。',
      },
      availability,
      dataStatus,
      warnings,
      lastUpdatedAt,
    });

    console.log(
      `[collect] ${config.id} GitHub=${usedPreviousGithub ? 'stale' : 'fresh'} npm=${npm.status} security=${security.status}`,
    );
  }

  const cleaned = cleanSeedRecords(records, previous.latest?.plugins ?? [], startedAt);
  errors.push(...cleaned.messages);
  const gapAffected = applyNpmGapGuard(cleaned.records);
  if (gapAffected > 0) {
    console.warn(
      `[collect] suppressed weekly npm change for ${gapAffected} package(s) whose 7-day window contains platform-wide zero days`,
    );
  }

  const scored = scorePlugins(cleaned.records, startedAt);
  const stats = computeStats(scored);
  const githubSource: SourceSnapshot = {
    status:
      githubFailed === 0 ? 'ok' : githubSuccess > 0 ? 'partial' : 'failed',
    fetchedAt: startedAt.toISOString(),
    message: `${githubSuccess} 成功 / ${githubFailed} 失败`,
  };
  const npmSource: SourceSnapshot = {
    status:
      npmChecked === 0
        ? 'skipped'
        : npmVerified === 0
          ? 'failed'
          : npmErrors > 0 ||
              npmUnverified > 0 ||
              npmUnavailable > 0 ||
              npmWithoutDownloads > 0
            ? 'partial'
            : 'ok',
    fetchedAt: startedAt.toISOString(),
    message: `${npmVerified}/${npmChecked} 个包映射通过，${npmUnverified} 个无法映射，${npmUnavailable} 个不可用，${npmWithoutDownloads} 个缺少下载数据，${npmErrors} 个请求失败`,
  };
  const osvSource: SourceSnapshot = {
    status:
      osvChecked === 0 && osvErrors === 0
        ? 'skipped'
        : osvErrors > 0 && osvChecked > 0
          ? 'partial'
          : osvErrors > 0
            ? 'failed'
            : 'ok',
    fetchedAt: startedAt.toISOString(),
    message: `${osvChecked} 个精确版本检查完成，${osvErrors} 个失败`,
  };
  const sources = { github: githubSource, npm: npmSource, osv: osvSource };

  const runId = `${startedAt.toISOString()}-${randomUUID().slice(0, 8)}`;
  // GitHub is the identity and activity backbone. If every repository request
  // fails, keep the last successful latest.json/history untouched even though we
  // still have stale records in memory. Partial success is allowed to publish.
  const hardFailure = githubSuccess === 0 || scored.length === 0 || cleaned.fallbackCount === scored.length;

  if (hardFailure) {
    const status: StatusFile = {
      schemaVersion: STATUS_SCHEMA_VERSION,
      runId,
      lastAttemptAt: startedAt.toISOString(),
      lastSuccessAt: previous.latest?.lastSuccessAt ?? null,
      outcome: 'failed',
      sources,
      errorCount: errors.length + npmErrors + osvErrors,
      messages: [
        ...errors.slice(0, 20),
        ...(npmErrors > 0 ? [`npm 请求失败 ${npmErrors} 个`] : []),
        ...(osvErrors > 0 ? [`OSV 请求失败 ${osvErrors} 个`] : []),
      ],
      nextRunHint: 'GitHub Actions 计划每 6 小时运行；失败时保留上一次成功快照。',
    };
    await writeStatus(options.dataDir, status);
    console.error('[collect] GitHub collection failed for every repository; latest snapshot left untouched');
    if (!previous.latest) process.exitCode = 1;
    return;
  }

  const outcome: StatusFile['outcome'] =
    githubFailed > 0 ||
    npmErrors > 0 ||
    npmUnverified > 0 ||
    npmUnavailable > 0 ||
    npmWithoutDownloads > 0 ||
    osvErrors > 0 ||
    usedFallback > 0 ||
    cleaned.messages.length > 0 ||
    gapAffected > 0
      ? 'partial'
      : 'success';

  const latest: LatestData = {
    schemaVersion: LATEST_SCHEMA_VERSION,
    generatedAt: startedAt.toISOString(),
    lastAttemptAt: startedAt.toISOString(),
    lastSuccessAt: startedAt.toISOString(),
    runId,
    sources,
    stats,
    plugins: scored,
  };

  // History is written before latest.json: a failed history write must not point
  // the site at a snapshot with no usable trend data.
  await updateHistory(options.dataDir, latest, previous.history, startedAt);
  await writeLatest(options.dataDir, latest);
  await writeSnapshot(options.dataDir, latest);
  const status: StatusFile = {
    schemaVersion: STATUS_SCHEMA_VERSION,
    runId,
    lastAttemptAt: startedAt.toISOString(),
    lastSuccessAt: latest.lastSuccessAt,
    outcome,
    sources,
    errorCount: errors.length + npmErrors + osvErrors,
    messages: [
      ...errors.slice(0, 15),
      ...(npmErrors > 0 ? [`npm 请求失败 ${npmErrors} 个`] : []),
      ...(osvErrors > 0 ? [`OSV 请求失败 ${osvErrors} 个`] : []),
      `评分方法版本 ${SCORE_METHOD_VERSION}`,
    ],
    nextRunHint: 'GitHub Actions 计划每 6 小时运行；npm 与 OSV 随同刷新。',
  };
  await writeStatus(options.dataDir, status);

  console.log(
    `[collect] wrote ${scored.length} plugins; stars=${stats.totalStars}; maintained=${stats.maintainedCount}; downloads=${stats.totalDownloads ?? 'n/a'}; outcome=${outcome}`,
  );
  console.log(`[collect] data dir: ${options.dataDir}`);
}

main().catch((error) => {
  console.error('[collect] fatal:', error);
  process.exitCode = 1;
});
