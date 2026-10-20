import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonClient, HttpError } from '../../scripts/lib/http';
import { collectGithub } from '../../scripts/lib/github';
import { collectNpm, normalizeRepositoryUrl } from '../../scripts/lib/npm';
import { NOW } from './helpers';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HTTP client', () => {
  it('retries 429 responses using Retry-After and eventually succeeds', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse(
            { message: 'slow down' },
            { status: 429, headers: { 'Retry-After': '0' } },
          );
        }
        return jsonResponse({ ok: true });
      }),
    );
    const client = new JsonClient();
    const response = await client.get<{ ok: boolean }>('https://example.test/data');
    expect(response.data.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('does not retry a 404 and preserves the status/url on the error', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      }),
    );
    const client = new JsonClient();
    await expect(client.get('https://example.test/missing')).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    } satisfies Partial<HttpError>);
    expect(calls).toBe(1);
  });
});

describe('npm mapping', () => {
  it('normalizes common GitHub repository spellings', () => {
    expect(normalizeRepositoryUrl('git+https://github.com/Owner/Repo.git')).toBe(
      'github.com/owner/repo',
    );
    expect(normalizeRepositoryUrl('git@github.com:Owner/Repo.git')).toBe('github.com/owner/repo');
  });

  it('rejects a package whose registry repository points at a different GitHub repo', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('registry.npmjs.org')) {
        return jsonResponse({
          name: 'wrong-package',
          'dist-tags': { latest: '1.0.0' },
          time: { '1.0.0': NOW.toISOString() },
          repository: { url: 'git+https://github.com/different/repository.git' },
          versions: {
            '1.0.0': {
              version: '1.0.0',
              repository: { url: 'git+https://github.com/different/repository.git' },
              dsh: { bundle: {} },
            },
          },
        });
      }
      return jsonResponse({ downloads: 999 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new JsonClient();
    const metrics = await collectNpm('wrong-package', 'owner/repo', client, NOW);
    expect(metrics.status).toBe('unverified');
    expect(metrics.downloads30d).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses date-aligned 7-day windows and refuses a window with a missing day', async () => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);
      return { day: date, downloads: 10 };
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('registry.npmjs.org')) {
        return jsonResponse({
          name: 'pkg',
          'dist-tags': { latest: '1.0.0' },
          time: { '1.0.0': NOW.toISOString() },
          repository: { url: 'git+https://github.com/owner/repo.git' },
          versions: { '1.0.0': { version: '1.0.0', repository: { url: 'git+https://github.com/owner/repo.git' } } },
        });
      }
      if (url.includes('/downloads/point/')) return jsonResponse({ downloads: 140 });
      if (url.includes('/downloads/range/')) return jsonResponse({ downloads: days.filter((_, index) => index !== 10) });
      throw new Error(`Unhandled test URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new JsonClient();
    const metrics = await collectNpm('pkg', 'owner/repo', client, NOW);
    expect(metrics.status).toBe('verified');
    expect(metrics.downloads30d).toBe(140);
    expect(metrics.downloads7d).toBeNull();
    expect(metrics.weeklyChangePct).toBeNull();
  });
});

describe('GitHub collection', () => {
  it('excludes pull requests from issue counts and treats a 404 pulls endpoint as unavailable', async () => {
    const issue = {
      number: 1,
      state: 'open',
      created_at: new Date(NOW.getTime() - 86_400_000).toISOString(),
      closed_at: null,
    };
    const pullInIssues = { ...issue, number: 2, pull_request: {} };
    const recentIssue = { ...issue, number: 3, state: 'closed', closed_at: NOW.toISOString() };
    const commit = {
      html_url: 'https://github.com/owner/repo/commit/abc',
      commit: {
        committer: { date: new Date(NOW.getTime() - 2 * 86_400_000).toISOString() },
        author: null,
      },
      parents: [{ sha: 'parent' }],
    };
    const mergeCommit = {
      ...commit,
      html_url: 'https://github.com/owner/repo/commit/merge',
      commit: {
        committer: { date: new Date(NOW.getTime() - 86_400_000).toISOString() },
        author: null,
      },
      parents: [{ sha: 'parent-a' }, { sha: 'parent-b' }],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/repos/owner/repo')) {
        return jsonResponse({
          full_name: 'owner/repo',
          html_url: 'https://github.com/owner/repo',
          description: 'test',
          homepage: null,
          topics: ['dsh-plugin'],
          language: 'TypeScript',
          license: { spdx_id: 'MIT' },
          created_at: '2026-01-01T00:00:00Z',
          pushed_at: NOW.toISOString(),
          archived: false,
          default_branch: 'main',
          stargazers_count: 10,
          forks_count: 2,
          open_issues_count: 2,
        });
      }
      if (url.includes('/commits?since=')) return jsonResponse([mergeCommit, commit]);
      if (url.includes('/commits?per_page=100')) return jsonResponse([mergeCommit, commit]);
      if (url.includes('/issues?state=all')) return jsonResponse([issue, pullInIssues, recentIssue]);
      if (url.includes('/pulls?state=open&per_page=1')) return jsonResponse([]);
      if (url.includes('/releases?')) return jsonResponse([]);
      if (url.includes('/issues?state=open')) return jsonResponse([issue]);
      if (url.includes('/pulls?state=all')) {
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      }
      throw new Error(`Unhandled test URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new JsonClient();
    const result = await collectGithub('owner/repo', client, NOW);
    expect(result.github.issues.opened90d).toBe(2);
    expect(result.github.commits30d).toBe(1);
    expect(result.github.openPullRequests).toBe(0);
    expect(result.github.pullRequests.available).toBe(false);
    expect(result.availability.pullRequests).toBe(false);
    expect(result.warnings.join(' ')).toContain('Pull Requests');
    expect(result.github.lastCommitAt).toBe(commit.commit.committer.date);
    expect(result.repository.archived).toBe(false);
  });
});
