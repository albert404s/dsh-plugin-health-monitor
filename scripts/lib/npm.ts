import type { DailyDownload, NpmMetrics } from '../../src/lib/types';
import type { JsonClient } from './http';
import { HttpError } from './http';

interface NpmRegistryVersion {
  version?: string;
  repository?: string | { url?: string } | null;
  engines?: { node?: string };
  peerDependencies?: Record<string, string>;
  dsh?: unknown;
}

interface NpmRegistryDocument {
  name?: string;
  'dist-tags'?: { latest?: string };
  time?: Record<string, string>;
  repository?: string | { url?: string } | null;
  versions?: Record<string, NpmRegistryVersion>;
  readme?: string;
}

interface DownloadPoint {
  downloads?: number;
  start?: string;
  end?: string;
}

interface DownloadRange {
  downloads?: Array<{ day?: string; downloads?: number }>;
}

export function normalizeRepositoryUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  value = value.replace(/^git\+/, '');
  value = value.replace(/^git@github\.com:/, 'github.com/');
  value = value.replace(/^ssh:\/\/git@github\.com\//, 'github.com/');
  value = value.replace(/^https?:\/\/(www\.)?github\.com\//, 'github.com/');
  value = value.replace(/^git:\/\/github\.com\//, 'github.com/');
  value = value.replace(/\.git$/, '');
  value = value.replace(/\/+$/, '');
  value = value.replace(/#.*$/, '');
  return value;
}

export function packageRepository(value: string | { url?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.url ?? null;
}

function emptyNpm(reason: string, status: NpmMetrics['status'] = 'unavailable'): NpmMetrics {
  return {
    status,
    packageName: null,
    latestVersion: null,
    publishedAt: null,
    downloads30d: null,
    downloads7d: null,
    previous7d: null,
    weeklyChangePct: null,
    daily: [],
    repositoryUrl: null,
    registryUrl: null,
    mappingEvidence: null,
    enginesNode: null,
    dshPeerRange: null,
    fetchedAt: null,
    reason,
  };
}

function sumLastRange(daily: DailyDownload[], start: number, end: number): number {
  return daily.slice(start, end).reduce((sum, item) => sum + item.downloads, 0);
}

/**
 * 只有当 registry 的 repository 字段指向同一个 GitHub 仓库时，下载量才可采信。
 * 无法核验时返回 unavailable / unverified，而不是回退到 Star 或 Release 下载量。
 */
export async function collectNpm(
  packageName: string | null,
  githubRepo: string,
  client: JsonClient,
  now: Date,
): Promise<NpmMetrics> {
  if (!packageName) {
    return emptyNpm('该插件未配置可核验的 npm 包，暂无可靠下载数据。');
  }

  const encoded = encodeURIComponent(packageName);
  const registryUrl = `https://www.npmjs.com/package/${packageName}`;
  let registry: NpmRegistryDocument;
  try {
    const response = await client.get<NpmRegistryDocument>(`https://registry.npmjs.org/${encoded}`, {
      timeoutMs: 25_000,
      retries: 3,
    });
    registry = response.data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return emptyNpm(`npm registry 未找到包 ${packageName}，不展示下载或漏洞匹配结果。`, 'unavailable');
    }
    return emptyNpm(
      `npm registry 请求失败：${error instanceof Error ? error.message : String(error)}`,
      'error',
    );
  }

  const latestVersion = registry['dist-tags']?.latest ?? null;
  if (!latestVersion) {
    return emptyNpm('npm registry 响应缺少 dist-tags.latest。', 'unverified');
  }
  const versionMeta = registry.versions?.[latestVersion] ?? {};
  const repositoryUrl = packageRepository(versionMeta.repository) ?? packageRepository(registry.repository);
  const normalizedRepo = normalizeRepositoryUrl(repositoryUrl);
  const normalizedGithub = normalizeRepositoryUrl(`https://github.com/${githubRepo}`);
  const repoMatches = Boolean(normalizedRepo && normalizedGithub && normalizedRepo === normalizedGithub);

  if (!repoMatches) {
    return {
      ...emptyNpm(
        `npm 包 ${packageName} 的 repository 字段（${repositoryUrl ?? '缺失'}）与 GitHub 仓库 ${githubRepo} 不一致，下载映射未通过核验。`,
        'unverified',
      ),
      packageName,
      latestVersion,
      repositoryUrl,
      registryUrl,
    };
  }

  let downloads30d: number | null = null;
  let downloads7d: number | null = null;
  let previous7d: number | null = null;
  let weeklyChangePct: number | null = null;
  let daily: DailyDownload[] = [];
  let downloadReason: string | null = null;

  try {
    const [pointResponse, rangeResponse] = await Promise.all([
      client.get<DownloadPoint>(
        `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`,
        { timeoutMs: 20_000, retries: 3 },
      ),
      client.get<DownloadRange>(
        `https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(packageName)}`,
        { timeoutMs: 20_000, retries: 3 },
      ),
    ]);
    const downloads = pointResponse.data.downloads;
    downloads30d = typeof downloads === 'number' && Number.isFinite(downloads) ? downloads : null;
    daily = (Array.isArray(rangeResponse.data.downloads) ? rangeResponse.data.downloads : [])
      .filter(
        (item): item is { day: string; downloads: number } =>
          typeof item.day === 'string' &&
          typeof item.downloads === 'number' &&
          Number.isFinite(item.downloads),
      )
      .map((item) => ({ date: item.day, downloads: item.downloads }));
    if (daily.length >= 14) {
      downloads7d = sumLastRange(daily, daily.length - 7, daily.length);
      previous7d = sumLastRange(daily, daily.length - 14, daily.length - 7);
      weeklyChangePct =
        previous7d > 0
          ? ((downloads7d - previous7d) / previous7d) * 100
          : downloads7d === 0
            ? 0
            : null;
    }
    if (downloads30d === null) {
      downloadReason = 'npm 下载 API 未返回 downloads 字段。';
    }
  } catch (error) {
    downloadReason = `npm 下载 API 请求失败，保留包信息但不展示下载量：${
      error instanceof Error ? error.message : String(error)
    }`;
  }

  const peer = versionMeta.peerDependencies ?? {};
  const dshPeerRange =
    peer['@deepseek-ai/dsh'] ??
    peer['@deepseek-ai/dsh-web-app'] ??
    null;

  return {
    status: 'verified',
    packageName,
    latestVersion,
    publishedAt: registry.time?.[latestVersion] ?? null,
    downloads30d,
    downloads7d,
    previous7d,
    weeklyChangePct,
    daily,
    repositoryUrl,
    registryUrl,
    mappingEvidence: `npm registry repository=${repositoryUrl} ↔ GitHub ${githubRepo}`,
    enginesNode: versionMeta.engines?.node ?? null,
    dshPeerRange,
    fetchedAt: now.toISOString(),
    reason: downloadReason,
  };
}
