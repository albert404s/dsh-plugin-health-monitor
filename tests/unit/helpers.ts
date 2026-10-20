import type { PluginRecord, Vulnerability } from '../../src/lib/types';
import { scorePlugins } from '../../src/lib/scoring';

export const NOW = new Date('2026-10-20T02:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

export type PluginSeed = Omit<PluginRecord, 'scores'>;

export interface SeedOptions {
  id?: string;
  name?: string;
  category?: string;
  description?: string;
  stars?: number;
  forks?: number;
  commits30d?: number;
  lastCommitDaysAgo?: number;
  issuesOpened90d?: number;
  issuesClosed90d?: number;
  longOpen?: number;
  openIssues?: number;
  prsOpened90d?: number;
  prsMerged90d?: number;
  prsAvailable?: boolean;
  releaseDaysAgo?: number | null;
  archived?: boolean;
  downloads30d?: number | null;
  npmStatus?: PluginRecord['npm']['status'];
  securityStatus?: PluginRecord['security']['status'];
  securityVulns?: Vulnerability[];
  missingAvailability?: Array<keyof PluginRecord['availability']>;
  dataStatus?: PluginRecord['dataStatus'];
  lastUpdatedAt?: string;
  warnings?: string[];
}

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

export function makeSeed(options: SeedOptions = {}): PluginSeed {
  const id = options.id ?? 'owner-plugin';
  const repo = `owner/${id}`;
  const name = options.name ?? id;
  const downloads = options.downloads30d === undefined ? 12000 : options.downloads30d;
  const issuesOpened = options.issuesOpened90d ?? 10;
  const issuesClosed = options.issuesClosed90d ?? 8;
  const prsOpened = options.prsOpened90d ?? 6;
  const prsMerged = options.prsMerged90d ?? 4;
  const availability: PluginRecord['availability'] = {
    repository: true,
    commits: true,
    issues: true,
    pullRequests: true,
    releases: true,
    npm: downloads !== null,
    security: true,
  };
  for (const key of options.missingAvailability ?? []) availability[key] = false;

  const releaseDaysAgo = options.releaseDaysAgo === undefined ? 40 : options.releaseDaysAgo;
  const latestRelease =
    releaseDaysAgo === null
      ? null
      : {
          version: 'v1.0.0',
          tagName: 'v1.0.0',
          publishedAt: isoDaysAgo(releaseDaysAgo),
          url: `https://github.com/${repo}/releases/tag/v1.0.0`,
        };

  return {
    id,
    repo,
    name,
    category: options.category ?? 'interface',
    installCommand: 'dsh plugin --profile web add example',
    curatorNote: '测试用插件记录',
    repository: {
      fullName: repo,
      url: `https://github.com/${repo}`,
      description: options.description ?? 'A test plugin for DSH',
      homepageUrl: null,
      topics: ['dsh-plugin'],
      language: 'TypeScript',
      license: 'MIT',
      createdAt: isoDaysAgo(120),
      pushedAt: isoDaysAgo(options.lastCommitDaysAgo ?? 10),
      archived: options.archived ?? false,
      defaultBranch: 'main',
    },
    github: {
      stars: options.stars ?? 100,
      forks: options.forks ?? 10,
      openIssues: options.openIssues ?? options.longOpen ?? 0,
      openPullRequests: 2,
      commits30d: options.commits30d ?? 8,
      commits30dTruncated: false,
      issues: {
        opened90d: issuesOpened,
        closed90d: issuesClosed,
        closureRate: issuesOpened === 0 ? null : issuesClosed / issuesOpened,
        lowSample: issuesOpened > 0 && issuesOpened < 5,
        truncated: false,
        longOpen: options.longOpen ?? 0,
        openNow: options.openIssues ?? 1,
        openTruncated: false,
        queryUrl: `https://github.com/${repo}/issues`,
      },
      pullRequests: {
        available: options.prsAvailable ?? true,
        opened90d: prsOpened,
        merged90d: prsMerged,
        mergeRate: prsOpened === 0 ? null : prsMerged / prsOpened,
        lowSample: prsOpened > 0 && prsOpened < 3,
        truncated: false,
        queryUrl: `https://github.com/${repo}/pulls`,
      },
      latestRelease,
      releases90d: latestRelease ? 2 : 0,
      lastCommitAt: isoDaysAgo(options.lastCommitDaysAgo ?? 10),
      lastCommitUrl: `https://github.com/${repo}/commit/abc`,
      commitsUrl: `https://github.com/${repo}/commits/main`,
      issuesUrl: `https://github.com/${repo}/issues`,
      pullsUrl: `https://github.com/${repo}/pulls`,
      releasesUrl: `https://github.com/${repo}/releases`,
    },
    npm: {
      status: options.npmStatus ?? (downloads === null ? 'unavailable' : 'verified'),
      packageName: downloads === null ? null : `@owner/${id}`,
      latestVersion: downloads === null ? null : '1.0.0',
      publishedAt: downloads === null ? null : isoDaysAgo(20),
      downloads30d: downloads,
      downloads7d: downloads === null ? null : Math.round(downloads * 0.3),
      previous7d: downloads === null ? null : Math.round(downloads * 0.25),
      weeklyChangePct: downloads === null ? null : 20,
      daily: [],
      repositoryUrl: downloads === null ? null : `https://github.com/${repo}`,
      registryUrl: downloads === null ? null : 'https://www.npmjs.com/package/example',
      mappingEvidence: downloads === null ? null : 'repository match',
      enginesNode: '>=22.19',
      dshPeerRange: '0.2.x',
      fetchedAt: NOW.toISOString(),
      reason: downloads === null ? '没有可核验的 npm 包。' : null,
    },
    security: {
      status: options.securityStatus ?? 'checked',
      exactMatch: (options.securityStatus ?? 'checked') === 'checked',
      packageName: downloads === null ? null : `@owner/${id}`,
      version: downloads === null ? null : '1.0.0',
      vulnerabilities: options.securityVulns ?? [],
      checkedAt: NOW.toISOString(),
      reason:
        (options.securityStatus ?? 'checked') === 'checked'
          ? null
          : '未完成精确匹配或查询失败。',
      queryUrl: 'https://osv.dev/list?ecosystem=npm',
    },
    compatibility: {
      nodeEngine: '>=22.19',
      dshPeerRange: '0.2.x',
      npmVersion: downloads === null ? null : '1.0.0',
      evidenceUrl: null,
      note: '仅展示声明。',
    },
    availability,
    dataStatus: options.dataStatus ?? 'complete',
    warnings: options.warnings ?? [],
    lastUpdatedAt: options.lastUpdatedAt ?? NOW.toISOString(),
  };
}

export function makeScored(options: SeedOptions = {}): PluginRecord {
  return scorePlugins([makeSeed(options)], NOW)[0];
}

export function vulnerability(severity: Vulnerability['severity'] = 'high'): Vulnerability {
  return {
    id: 'OSV-TEST-1',
    summary: 'Test vulnerability',
    severity,
    aliases: [],
    modified: NOW.toISOString(),
    url: 'https://osv.dev/vulnerability/OSV-TEST-1',
  };
}
