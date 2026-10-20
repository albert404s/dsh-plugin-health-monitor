import type {
  GithubMetrics,
  IssueWindow,
  PullRequestWindow,
  ReleaseInfo,
  RepositoryInfo,
} from '../../src/lib/types';
import type { JsonClient } from './http';
import { HttpError } from './http';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

interface GithubRepoResponse {
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  topics?: string[];
  language: string | null;
  license: { spdx_id: string | null } | null;
  created_at: string;
  pushed_at: string | null;
  archived: boolean;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
}

interface GithubCommitResponse {
  html_url: string;
  commit: {
    committer: { date: string | null } | null;
    author: { date: string | null } | null;
  };
  parents: Array<{ sha: string }>;
}

interface GithubIssueResponse {
  number: number;
  state: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

interface GithubPullResponse {
  number: number;
  created_at: string;
  merged_at: string | null;
}

interface GithubReleaseResponse {
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastPage(headers: Headers): number {
  const link = headers.get('link');
  if (!link) return 1;
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (!match) return 1;
  const page = Number(match[1]);
  return Number.isFinite(page) ? page : 1;
}

async function countOpenPullRequests(
  client: JsonClient,
  repo: string,
): Promise<{ count: number; ok: boolean }> {
  try {
    const response = await client.get<GithubPullResponse[]>(
      `https://api.github.com/repos/${repo}/pulls?state=open&per_page=1`,
    );
    return { count: lastPage(response.headers), ok: true };
  } catch {
    return { count: 0, ok: false };
  }
}

async function collectIssues90d(
  client: JsonClient,
  repo: string,
  now: Date,
): Promise<IssueWindow> {
  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  let page = 1;
  let opened90d = 0;
  let closed90d = 0;
  let truncated = false;
  let shouldStop = false;

  while (page <= 5 && !shouldStop) {
    const response = await client.get<GithubIssueResponse[]>(
      `https://api.github.com/repos/${repo}/issues?state=all&sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
    );
    const items = Array.isArray(response.data) ? response.data : [];
    if (items.length === 0) break;
    for (const issue of items) {
      if (issue.pull_request) continue;
      const created = new Date(issue.created_at).getTime();
      if (created < cutoff.getTime()) {
        shouldStop = true;
        continue;
      }
      opened90d += 1;
      if (issue.state === 'closed') closed90d += 1;
    }
    if (items.length < PAGE_SIZE) shouldStop = true;
    if (page === 5 && items.length === PAGE_SIZE) truncated = true;
    page += 1;
  }

  const queryUrl = `https://github.com/${repo}/issues?q=${encodeURIComponent(
    `is:issue created:>=${isoDate(cutoff)}`,
  )}`;

  return {
    opened90d,
    closed90d,
    closureRate: opened90d > 0 ? closed90d / opened90d : null,
    lowSample: opened90d < 5,
    truncated,
    longOpen: 0,
    openNow: 0,
    openTruncated: false,
    queryUrl,
  };
}

async function countLongOpen(
  client: JsonClient,
  repo: string,
  now: Date,
): Promise<{ longOpen: number; truncated: boolean; ok: boolean }> {
  const cutoff = now.getTime() - 90 * DAY_MS;
  let page = 1;
  let longOpen = 0;
  let truncated = false;
  let ok = true;

  while (page <= 3) {
    try {
      const response = await client.get<GithubIssueResponse[]>(
        `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=asc&per_page=${PAGE_SIZE}&page=${page}`,
      );
      const items = Array.isArray(response.data) ? response.data : [];
      for (const issue of items) {
        if (issue.pull_request) continue;
        if (new Date(issue.created_at).getTime() < cutoff) longOpen += 1;
      }
      if (items.length < PAGE_SIZE) break;
      if (page === 3) truncated = true;
      page += 1;
    } catch {
      ok = false;
      truncated = true;
      break;
    }
  }

  return { longOpen, truncated, ok };
}

async function collectPullRequests90d(
  client: JsonClient,
  repo: string,
  now: Date,
): Promise<PullRequestWindow> {
  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  let page = 1;
  let opened90d = 0;
  let merged90d = 0;
  let truncated = false;
  let shouldStop = false;

  while (page <= 5 && !shouldStop) {
    const response = await client.get<GithubPullResponse[]>(
      `https://api.github.com/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
    );
    const items = Array.isArray(response.data) ? response.data : [];
    if (items.length === 0) break;
    for (const pull of items) {
      const created = new Date(pull.created_at).getTime();
      if (created < cutoff.getTime()) {
        shouldStop = true;
        continue;
      }
      opened90d += 1;
      if (pull.merged_at) merged90d += 1;
    }
    if (items.length < PAGE_SIZE) shouldStop = true;
    if (page === 5 && items.length === PAGE_SIZE) truncated = true;
    page += 1;
  }

  return {
    opened90d,
    merged90d,
    mergeRate: opened90d > 0 ? merged90d / opened90d : null,
    lowSample: opened90d < 3,
    truncated,
    queryUrl: `https://github.com/${repo}/pulls?q=${encodeURIComponent(
      `is:pr created:>=${isoDate(cutoff)}`,
    )}`,
  };
}

async function collectCommits(
  client: JsonClient,
  repo: string,
  now: Date,
): Promise<{
  commits30d: number;
  truncated: boolean;
  lastCommitAt: string | null;
  lastCommitUrl: string | null;
}> {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  let commits30d = 0;
  let truncated = false;

  for (let page = 1; page <= 5; page += 1) {
    const response = await client.get<GithubCommitResponse[]>(
      `https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(
        since,
      )}&per_page=${PAGE_SIZE}&page=${page}`,
    );
    const items = Array.isArray(response.data) ? response.data : [];
    commits30d += items.length;
    if (items.length < PAGE_SIZE) break;
    if (page === 5) truncated = true;
  }

  const recentResponse = await client.get<GithubCommitResponse[]>(
    `https://api.github.com/repos/${repo}/commits?per_page=10`,
  );
  const recent = Array.isArray(recentResponse.data) ? recentResponse.data : [];
  const first = recent[0];
  const nonMerge = recent.find((commit) => commit.parents.length <= 1) ?? first;
  return {
    commits30d,
    truncated,
    lastCommitAt:
      nonMerge?.commit.committer?.date ?? nonMerge?.commit.author?.date ?? null,
    lastCommitUrl: nonMerge?.html_url ?? null,
  };
}

async function collectReleases(
  client: JsonClient,
  repo: string,
  now: Date,
): Promise<{ latestRelease: ReleaseInfo | null; releases90d: number }> {
  const response = await client.get<GithubReleaseResponse[]>(
    `https://api.github.com/repos/${repo}/releases?per_page=100`,
  );
  const releases = (Array.isArray(response.data) ? response.data : []).filter(
    (release) => !release.draft,
  );
  const cutoff = now.getTime() - 90 * DAY_MS;
  const releases90d = releases.filter((release) => {
    if (!release.published_at) return false;
    return new Date(release.published_at).getTime() >= cutoff;
  }).length;
  const latest = releases[0];
  return {
    latestRelease: latest
      ? {
          version: latest.name?.trim() || latest.tag_name,
          tagName: latest.tag_name,
          publishedAt: latest.published_at,
          url: latest.html_url,
        }
      : null,
    releases90d,
  };
}

export interface GithubCollection {
  repository: RepositoryInfo;
  github: GithubMetrics;
  availability: {
    repository: boolean;
    commits: boolean;
    issues: boolean;
    pullRequests: boolean;
    releases: boolean;
  };
  warnings: string[];
}

/**
 * 采集一个仓库。仓库本身不可读取时抛错；Release 属于可降级子资源。
 * 明确使用 commits 的 committed date 作为“最近一次实际代码提交时间”，
 * 不用 updated_at / pushed_at 代替。
 */
export async function collectGithub(
  repo: string,
  client: JsonClient,
  now: Date,
): Promise<GithubCollection> {
  const warnings: string[] = [];
  const repoResponse = await client.get<GithubRepoResponse>(
    `https://api.github.com/repos/${repo}`,
  );
  const meta = repoResponse.data;
  if (!meta?.full_name) {
    throw new HttpError('GitHub repository payload is incomplete', 500, repo);
  }

  const [commits, issuesWindow, openPr, releasesResult] = await Promise.all([
    collectCommits(client, meta.full_name, now),
    collectIssues90d(client, meta.full_name, now),
    countOpenPullRequests(client, meta.full_name),
    collectReleases(client, meta.full_name, now).catch(() => null),
  ]);

  const longOpenResult = await countLongOpen(client, meta.full_name, now);
  const openIssues = Math.max(0, meta.open_issues_count - openPr.count);
  const issues: IssueWindow = {
    ...issuesWindow,
    openNow: openIssues,
    longOpen: longOpenResult.longOpen,
    openTruncated: longOpenResult.truncated,
  };
  if (issuesWindow.truncated) {
    warnings.push('Issue 90 天分页达到上限，关闭率是下限样本。');
  }
  if (longOpenResult.truncated) {
    warnings.push('开放 Issue 分页达到上限，长期开放 Issue 数为下限。');
  }
  if (!openPr.ok) {
    warnings.push('开放 PR 计数失败，openIssues 可能包含 PR。');
  }

  let latestRelease: ReleaseInfo | null = null;
  let releases90d = 0;
  let releasesOk = true;
  if (releasesResult) {
    latestRelease = releasesResult.latestRelease;
    releases90d = releasesResult.releases90d;
  } else {
    releasesOk = false;
    warnings.push('Release 列表请求失败，版本数据暂缺。');
  }

  const repository: RepositoryInfo = {
    fullName: meta.full_name,
    url: meta.html_url,
    description: meta.description,
    homepageUrl: meta.homepage || null,
    topics: Array.isArray(meta.topics) ? meta.topics : [],
    language: meta.language,
    license: meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION'
      ? meta.license.spdx_id
      : null,
    createdAt: meta.created_at,
    pushedAt: meta.pushed_at,
    archived: Boolean(meta.archived),
    defaultBranch: meta.default_branch,
  };

  const github: GithubMetrics = {
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    openIssues,
    openPullRequests: openPr.count,
    commits30d: commits.commits30d,
    commits30dTruncated: commits.truncated,
    issues,
    pullRequests: {
      ...collectPullRequestsFallback,
    },
    latestRelease,
    releases90d,
    lastCommitAt: commits.lastCommitAt,
    lastCommitUrl: commits.lastCommitUrl,
    commitsUrl: `https://github.com/${meta.full_name}/commits/${meta.default_branch}`,
    issuesUrl: `https://github.com/${meta.full_name}/issues`,
    pullsUrl: `https://github.com/${meta.full_name}/pulls`,
    releasesUrl: `https://github.com/${meta.full_name}/releases`,
  };

  // Pull request window is collected after the issue/list requests so rate-limit
  // failures are attributable and can be retried independently.
  const pullRequests = await collectPullRequests90d(client, meta.full_name, now);
  github.pullRequests = pullRequests;

  return {
    repository,
    github,
    availability: {
      repository: true,
      commits: Boolean(commits.lastCommitAt) && !commits.truncated,
      issues: !issuesWindow.truncated && longOpenResult.ok && !longOpenResult.truncated,
      pullRequests: !pullRequests.truncated,
      releases: releasesOk,
    },
    warnings,
  };
}

const collectPullRequestsFallback: PullRequestWindow = {
  opened90d: 0,
  merged90d: 0,
  mergeRate: null,
  lowSample: true,
  truncated: false,
  queryUrl: '',
};
