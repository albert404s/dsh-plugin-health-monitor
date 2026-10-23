import type {
  GithubMetrics,
  IssueWindow,
  PullRequestWindow,
  ReleaseInfo,
  RepositoryInfo,
} from '../../src/lib/types';
import type { JsonClient } from './http';
import { HttpError } from './http';
import { isCount } from '../../src/lib/data-quality';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;
// Keep this bounded for rate-limit safety, but high enough to cover 90-day
// windows for repositories with hundreds of issues/PRs. At 20 pages a repo
// can consume 2,000 list items before it is marked truncated.
const MAX_PAGES = 20;

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

function windowTime(value: unknown, observedAt: number): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  // Events during a long run are valid, but belong to the next snapshot.
  if (!Number.isFinite(time) || time > observedAt || new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return time;
}

function invalidTime(warnings: string[], label: string): void {
  const message = `GitHub ${label}存在无效或实际未来时间，异常记录已排除；对应指标不参与评分。`;
  if (!warnings.includes(message)) warnings.push(message);
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
    // An empty array has no Link header. Never turn "zero open PRs" into 1.
    return {
      count: response.data.length === 0 ? 0 : lastPage(response.headers),
      ok: true,
    };
  } catch {
    return { count: 0, ok: false };
  }
}

async function collectIssues90d(
  client: JsonClient,
  repo: string,
  now: Date,
  warnings: string[],
): Promise<IssueWindow> {
  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  let page = 1;
  let opened90d = 0;
  let closed90d = 0;
  let truncated = false;
  let shouldStop = false;

  while (page <= MAX_PAGES && !shouldStop) {
    const response = await client.get<GithubIssueResponse[]>(
      `https://api.github.com/repos/${repo}/issues?state=all&sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
    );
    const items = Array.isArray(response.data) ? response.data : [];
    const observedAt = Date.now();
    if (items.length === 0) break;
    for (const issue of items) {
      if (issue.pull_request) continue;
      const created = windowTime(issue.created_at, observedAt);
      if (created === null) { truncated = true; invalidTime(warnings, 'Issue 创建时间'); continue; }
      if (created > now.getTime()) continue;
      if (created < cutoff.getTime()) {
        shouldStop = true;
        continue;
      }
      opened90d += 1;
      if (issue.state === 'closed') {
        const closed = windowTime(issue.closed_at, observedAt);
        if (closed === null || closed < created) { truncated = true; invalidTime(warnings, 'Issue 关闭时间'); }
        else if (closed <= now.getTime()) closed90d += 1;
      }
    }
    if (items.length < PAGE_SIZE) shouldStop = true;
    if (page === MAX_PAGES && items.length === PAGE_SIZE) truncated = true;
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
  warnings: string[],
): Promise<{ longOpen: number; truncated: boolean; ok: boolean }> {
  const cutoff = now.getTime() - 90 * DAY_MS;
  let page = 1;
  let longOpen = 0;
  let truncated = false;
  let ok = true;

  while (page <= 10) {
    try {
      const response = await client.get<GithubIssueResponse[]>(
        `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=asc&per_page=${PAGE_SIZE}&page=${page}`,
      );
      const items = Array.isArray(response.data) ? response.data : [];
      const observedAt = Date.now();
      for (const issue of items) {
        if (issue.pull_request) continue;
        const created = windowTime(issue.created_at, observedAt);
        if (created === null) { ok = false; truncated = true; invalidTime(warnings, '开放 Issue 创建时间'); continue; }
        if (created < cutoff) longOpen += 1;
      }
      if (items.length < PAGE_SIZE) break;
      if (page === 10) truncated = true;
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
  warnings: string[],
): Promise<PullRequestWindow> {
  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  const queryUrl = `https://github.com/${repo}/pulls?q=${encodeURIComponent(
    `is:pr created:>=${isoDate(cutoff)}`,
  )}`;
  let page = 1;
  let opened90d = 0;
  let merged90d = 0;
  let truncated = false;
  let shouldStop = false;

  try {
    while (page <= MAX_PAGES && !shouldStop) {
      const response = await client.get<GithubPullResponse[]>(
        `https://api.github.com/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
      );
      const items = Array.isArray(response.data) ? response.data : [];
      const observedAt = Date.now();
      if (items.length === 0) break;
      for (const pull of items) {
        const created = windowTime(pull.created_at, observedAt);
        if (created === null) { truncated = true; invalidTime(warnings, 'PR 创建时间'); continue; }
        if (created > now.getTime()) continue;
        if (created < cutoff.getTime()) {
          shouldStop = true;
          continue;
        }
        opened90d += 1;
        if (pull.merged_at) {
          const merged = windowTime(pull.merged_at, observedAt);
          if (merged === null || merged < created) { truncated = true; invalidTime(warnings, 'PR 合并时间'); }
          else if (merged <= now.getTime()) merged90d += 1;
        }
      }
      if (items.length < PAGE_SIZE) shouldStop = true;
      if (page === MAX_PAGES && items.length === PAGE_SIZE) truncated = true;
      page += 1;
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      // Repositories can disable Pull Requests. 404 here means "not available",
      // not "zero PRs", so the score must exclude this dimension.
      return {
        available: false,
        opened90d: 0,
        merged90d: 0,
        mergeRate: null,
        lowSample: true,
        truncated: false,
        queryUrl,
      };
    }
    throw error;
  }

  return {
    available: true,
    opened90d,
    merged90d,
    mergeRate: opened90d > 0 ? merged90d / opened90d : null,
    lowSample: opened90d < 3,
    truncated,
    queryUrl,
  };
}

async function collectCommits(
  client: JsonClient,
  repo: string,
  now: Date,
  warnings: string[],
): Promise<{
  commits30d: number;
  truncated: boolean;
  lastCommitAt: string | null;
  lastCommitUrl: string | null;
}> {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  let commits30d = 0;
  let truncated = false;
  const eligible: Array<{ commit: GithubCommitResponse; time: number; date: string }> = [];
  function inspect(commit: GithubCommitResponse, observedAt: number): { commit: GithubCommitResponse; time: number; date: string } | null {
    const date = commit.commit.committer?.date ?? commit.commit.author?.date;
    const time = windowTime(date, observedAt);
    if (time === null) { truncated = true; invalidTime(warnings, '提交时间'); return null; }
    return time <= now.getTime() ? { commit, time, date: date! } : null;
  }

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await client.get<GithubCommitResponse[]>(
      `https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(
        since,
      )}&until=${encodeURIComponent(now.toISOString())}&per_page=${PAGE_SIZE}&page=${page}`,
    );
    const items = Array.isArray(response.data) ? response.data : [];
    const observedAt = Date.now();
    for (const commit of items) {
      const item = inspect(commit, observedAt);
      if (!item) continue;
      eligible.push(item);
      if (commit.parents.length <= 1 && item.time >= Date.parse(since)) commits30d += 1;
    }
    if (items.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) truncated = true;
  }

  const recentResponse = await client.get<GithubCommitResponse[]>(
    `https://api.github.com/repos/${repo}/commits?per_page=100&until=${encodeURIComponent(now.toISOString())}`,
  );
  const recent = Array.isArray(recentResponse.data) ? recentResponse.data : [];
  const observedAt = Date.now();
  for (const commit of recent) {
    const item = inspect(commit, observedAt);
    if (item) eligible.push(item);
  }
  eligible.sort((a, b) => b.time - a.time);
  const latest = eligible.find(item => item.commit.parents.length <= 1) ?? eligible[0];
  return {
    commits30d,
    truncated,
    lastCommitAt: latest?.date ?? null,
    lastCommitUrl: latest?.commit.html_url ?? null,
  };
}

async function collectReleases(
  client: JsonClient,
  repo: string,
  now: Date,
  warnings: string[],
): Promise<{ latestRelease: ReleaseInfo | null; releases90d: number; complete: boolean }> {
  const response = await client.get<GithubReleaseResponse[]>(
    `https://api.github.com/repos/${repo}/releases?per_page=100`,
  );
  let complete = true;
  const observedAt = Date.now();
  const releases = (Array.isArray(response.data) ? response.data : []).filter(release => {
    if (release.draft || release.prerelease) return false;
    const published = windowTime(release.published_at, observedAt);
    if (published === null) { complete = false; invalidTime(warnings, 'Release 发布时间'); return false; }
    return published <= now.getTime();
  });
  const cutoff = now.getTime() - 90 * DAY_MS;
  const releases90d = releases.filter((release) => {
    if (!release.published_at) return false;
    return Date.parse(release.published_at) >= cutoff;
  }).length;
  releases.sort((a,b)=>Date.parse(b.published_at ?? '')-Date.parse(a.published_at ?? ''));
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
    complete,
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
  if (!meta?.full_name || !isCount(meta.stargazers_count) || !isCount(meta.forks_count) || !isCount(meta.open_issues_count) || typeof meta.archived !== 'boolean') {
    throw new HttpError('GitHub repository payload is incomplete', 500, repo);
  }

  const [commits, issuesWindow, openPr, releasesResult] = await Promise.all([
    collectCommits(client, meta.full_name, now, warnings),
    collectIssues90d(client, meta.full_name, now, warnings),
    countOpenPullRequests(client, meta.full_name),
    collectReleases(client, meta.full_name, now, warnings).catch(() => null),
  ]);

  const longOpenResult = await countLongOpen(client, meta.full_name, now, warnings);
  if(openPr.ok && openPr.count > meta.open_issues_count) throw new Error('GitHub 开放 PR 数超过开放条目总数');
  const openIssues = meta.open_issues_count - (openPr.ok ? openPr.count : 0);
  const issues: IssueWindow = {
    ...issuesWindow,
    openNow: openIssues,
    longOpen: longOpenResult.longOpen,
    openTruncated: longOpenResult.truncated,
  };
  if (commits.truncated) {
    warnings.push('近 30 天提交记录不完整，提交频率为下限。');
  }
  if (issuesWindow.truncated) {
    warnings.push('Issue 90 天记录不完整，关闭率不参与评分。');
  }
  if (longOpenResult.truncated) {
    warnings.push('开放 Issue 记录不完整，长期开放 Issue 数为下限。');
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
    releasesOk = releasesResult.complete;
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
      available: true,
      opened90d: 0,
      merged90d: 0,
      mergeRate: null,
      lowSample: true,
      truncated: false,
      queryUrl: '',
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
  const pullRequests = await collectPullRequests90d(client, meta.full_name, now, warnings);
  github.pullRequests = pullRequests;
  if (!pullRequests.available) {
    warnings.push('仓库未启用 Pull Requests（API 返回 404）；PR 指标不参与评分，也不记为 0。');
  } else if (pullRequests.truncated) {
    warnings.push('近 90 天 PR 记录不完整，合并率不参与评分。');
  }

  return {
    repository,
    github,
    availability: {
      repository: true,
      commits: Boolean(commits.lastCommitAt) && !commits.truncated,
      issues: !issuesWindow.truncated && longOpenResult.ok && !longOpenResult.truncated,
      pullRequests: pullRequests.available && !pullRequests.truncated,
      releases: releasesOk,
    },
    warnings,
  };
}
