import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectGithub } from '../../scripts/lib/github';
import type { JsonClient } from '../../scripts/lib/http';

const START = new Date('2026-10-23T08:49:35.000Z');
const OBSERVED = new Date('2026-10-23T08:58:35.000Z');
const DURING = '2026-10-23T08:52:48Z';
const BEFORE = '2026-10-23T08:40:00Z';
const EARLIER = '2026-10-22T08:40:00Z';
const DAY = 86_400_000;
function commit(date: string, suffix = date) {
  return { html_url: `https://github.com/owner/repo/commit/${encodeURIComponent(suffix)}`, commit: { committer: { date }, author: null }, parents: [{ sha: 'parent' }] };
}
function issue(created_at: string, closed_at: string | null = null) {
  return { number: 1, state: closed_at ? 'closed' : 'open', created_at, closed_at };
}
function pull(created_at: string, merged_at: string | null = null) { return { number: 1, created_at, merged_at }; }
function release(published_at: string) {
  return { tag_name: published_at, name: published_at, draft: false, prerelease: false, published_at, html_url: 'https://github.com/owner/repo/releases/tag/test' };
}
interface Fixture {
  commits?: ReturnType<typeof commit>[];
  recent?: ReturnType<typeof commit>[];
  issues?: ReturnType<typeof issue>[];
  openIssues?: ReturnType<typeof issue>[];
  pulls?: ReturnType<typeof pull>[];
  releases?: ReturnType<typeof release>[];
}
function fixture(rows: Fixture = {}) {
  const urls: string[] = [];
  const get = vi.fn(async (url: string) => {
    urls.push(url);
    let data: unknown;
    if (url.endsWith('/repos/owner/repo')) data = {
      full_name: 'owner/repo', html_url: 'https://github.com/owner/repo', description: 'test', homepage: null,
      language: 'TypeScript', license: { spdx_id: 'MIT' }, created_at: '2026-01-01T00:00:00Z',
      pushed_at: BEFORE, archived: false, default_branch: 'main', stargazers_count: 20, forks_count: 1, open_issues_count: 2,
    };
    else if (url.includes('/commits?since=')) data = rows.commits ?? [commit(BEFORE)];
    else if (url.includes('/commits?per_page=100')) data = rows.recent ?? rows.commits ?? [commit(BEFORE)];
    else if (url.includes('/issues?state=all')) data = rows.issues ?? [];
    else if (url.includes('/issues?state=open')) data = rows.openIssues ?? [];
    else if (url.includes('/pulls?state=open')) data = [];
    else if (url.includes('/pulls?state=all')) data = rows.pulls ?? [];
    else if (url.includes('/releases?')) data = rows.releases ?? [];
    else throw new Error('Unexpected fixture URL: ' + url);
    return { data, headers: new Headers(), status: 200 };
  });
  return { client: { get } as unknown as JsonClient, urls };
}
function setObservedTime() { vi.useFakeTimers(); vi.setSystemTime(OBSERVED); }
afterEach(() => vi.useRealTimers());

describe('GitHub fixed snapshot windows during long collection runs', () => {
  it('keeps the repository when a valid new commit arrives after the snapshot starts', async () => {
    setObservedTime();
    const { client, urls } = fixture({ commits: [commit(DURING), commit(BEFORE)] });
    const result = await collectGithub('owner/repo', client, START);
    expect(result.repository.fullName).toBe('owner/repo');
    expect(result.github.commits30d).toBe(1);
    expect(result.github.lastCommitAt).toBe(BEFORE);
    expect(result.github.lastCommitUrl).toBe(commit(BEFORE).html_url);
    expect(result.availability.commits).toBe(true);
    expect(result.warnings).toEqual([]);
    for (const url of urls.filter(value => value.includes('/commits?'))) {
      expect(new URL(url).searchParams.get('until')).toBe(START.toISOString());
    }
  });

  it('excludes new issues and closures during collection from the fixed cohort numerator and denominator', async () => {
    setObservedTime();
    const { client } = fixture({ issues: [issue(DURING), issue(BEFORE, DURING), issue(EARLIER, BEFORE)] });
    const result = await collectGithub('owner/repo', client, START);
    expect(result.github.issues).toMatchObject({ opened90d: 2, closed90d: 1, closureRate: 0.5, truncated: false });
    expect(result.availability.issues).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('excludes new PRs and merges during collection while retaining valid earlier contributions', async () => {
    setObservedTime();
    const { client } = fixture({ pulls: [pull(DURING, DURING), pull(BEFORE, DURING), pull(EARLIER, BEFORE)] });
    const result = await collectGithub('owner/repo', client, START);
    expect(result.github.pullRequests).toMatchObject({ opened90d: 2, merged90d: 1, mergeRate: 0.5, truncated: false });
    expect(result.availability.pullRequests).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('selects the latest release published before the cutoff instead of a release arriving mid-run', async () => {
    setObservedTime();
    const { client } = fixture({ releases: [release(DURING), release(BEFORE), release(EARLIER)] });
    const result = await collectGithub('owner/repo', client, START);
    expect(result.github.latestRelease?.publishedAt).toBe(BEFORE);
    expect(result.github.releases90d).toBe(2);
    expect(result.availability.releases).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('uses inclusive start and end boundaries consistently for commits, issues, PRs and releases', async () => {
    setObservedTime();
    const start = START.toISOString(), lower30 = new Date(+START - 30 * DAY).toISOString(), lower90 = new Date(+START - 90 * DAY).toISOString();
    const before30 = new Date(+START - 30 * DAY - 1000).toISOString(), before90 = new Date(+START - 90 * DAY - 1000).toISOString();
    const { client } = fixture({
      commits: [commit(DURING), commit(start), commit(lower30), commit(before30)],
      issues: [issue(DURING), issue(start), issue(lower90), issue(before90)],
      pulls: [pull(DURING), pull(start), pull(lower90), pull(before90)],
      releases: [release(DURING), release(start), release(lower90), release(before90)],
    });
    const result = await collectGithub('owner/repo', client, START);
    expect(result.github.commits30d).toBe(2);
    expect(result.github.issues.opened90d).toBe(2);
    expect(result.github.pullRequests.opened90d).toBe(2);
    expect(result.github.releases90d).toBe(2);
    expect(result.github.lastCommitAt).toBe(start);
    expect(result.github.latestRelease?.publishedAt).toBe(start);
    expect(result.warnings).toEqual([]);
  });

  it.each(['not-a-date', '2026-02-30T00:00:00Z', '2026-10-24T00:00:00Z'])(
    'isolates malformed or truly future timestamps (%s) and degrades only affected metrics', async invalid => {
      setObservedTime();
      const { client } = fixture({
        commits: [commit(invalid), commit(BEFORE)],
        issues: [issue(invalid), issue(BEFORE)], openIssues: [issue(invalid)],
        pulls: [pull(invalid), pull(BEFORE)], releases: [release(invalid), release(BEFORE)],
      });
      const result = await collectGithub('owner/repo', client, START);
      expect(result.repository.fullName).toBe('owner/repo');
      expect(result.github.commits30d).toBe(1);
      expect(result.github.lastCommitAt).toBe(BEFORE);
      expect(result.github.issues.opened90d).toBe(1);
      expect(result.github.pullRequests.opened90d).toBe(1);
      expect(result.github.releases90d).toBe(1);
      expect(result.availability).toMatchObject({ repository: true, commits: false, issues: false, pullRequests: false, releases: false });
      expect(result.warnings.join(' ')).toContain('无效或实际未来时间');
    },
  );

  it('does not treat an invalid closure or merge date as a completed issue or PR', async () => {
    setObservedTime();
    const { client } = fixture({ issues: [issue(BEFORE, '2026-10-24T00:00:00Z')], pulls: [pull(BEFORE, 'bad')] });
    const result = await collectGithub('owner/repo', client, START);
    expect(result.github.issues).toMatchObject({ opened90d: 1, closed90d: 0, truncated: true });
    expect(result.github.pullRequests).toMatchObject({ opened90d: 1, merged90d: 0, truncated: true });
    expect(result.availability.issues).toBe(false);
    expect(result.availability.pullRequests).toBe(false);
    expect(result.availability.commits).toBe(true);
  });
});
