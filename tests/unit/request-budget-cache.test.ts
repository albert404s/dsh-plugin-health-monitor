import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BudgetExhaustedError, DiskHttpCache, JsonClient, RequestBudget, createGithubClient,
} from '../../scripts/lib/http';

const REPO = 'https://api.github.com/repos/owner/repo';
const PUBLIC = { full_name: 'owner/repo', private: false, visibility: 'public', stargazers_count: 12 };
const directories: string[] = [];

function json(data: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

async function directory(): Promise<string> {
  const result = await mkdtemp(path.join(tmpdir(), 'orbit-http-test-'));
  directories.push(result);
  return result;
}

async function seed(dir: string, headers: Record<string, string> = { ETag: '"first"' }, token = 'test-token'): Promise<void> {
  vi.stubGlobal('fetch', vi.fn(async () => json(PUBLIC, headers)));
  const client = createGithubClient(token, { cache: new DiskHttpCache({ directory: dir }) });
  await client.get(REPO);
  await client.flushCache();
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const dir of directories.splice(0)) {
    if (path.dirname(dir) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('orbit-http-test-')) throw new Error('Unexpected cleanup path');
    await rm(dir, { recursive: true, force: true });
  }
});

describe('shared collection request budget', () => {
  it('admits at most the shared maximum even for concurrent requests across clients and POSTs', async () => {
    const budget = new RequestBudget({ maxRequests: 3 });
    const clients = [new JsonClient({}, { budget }), new JsonClient({}, { budget })];
    const fetchMock = vi.fn(async () => { await Promise.resolve(); return json({ ok: true }); });
    vi.stubGlobal('fetch', fetchMock);
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) =>
      clients[index % 2].post(`https://api.osv.dev/query/${index}`, {})));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter((result) => result.status === 'rejected').every((result) =>
      result.status === 'rejected' && result.reason instanceof BudgetExhaustedError)).toBe(true);
    expect(budget.getSummary()).toMatchObject({ requestsMade: 3, requestsRemaining: 0, stopReason: 'request_limit' });
  });

  it('counts every retry and never retries around a depleted budget', async () => {
    vi.useFakeTimers();
    const budget = new RequestBudget({ maxRequests: 2 });
    const fetchMock = vi.fn(async () => json({ message: 'temporary' }, {}, 500));
    vi.stubGlobal('fetch', fetchMock);
    const result = new JsonClient({}, { budget }).get('https://example.test/data', { retries: 5 }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(BudgetExhaustedError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(budget.getSummary().requestsMade).toBe(2);
  });

  it('counts failed fetch attempts and stops subsequent retries after another client halts the run', async () => {
    vi.useFakeTimers();
    const budget = new RequestBudget({ maxRequests: 2 });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection lost'); }));
    const result = new JsonClient({}, { budget }).get('https://example.test/data', { retries: 5 }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(BudgetExhaustedError);
    expect(budget.getSummary().requestsMade).toBe(2);
  });

  it('memory hits spend no request and distinguish representation and authentication headers', async () => {
    const budget = new RequestBudget({ maxRequests: 8 });
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new JsonClient({}, { budget });
    await client.get('https://example.test/data');
    expect((await client.get('https://example.test/data')).cache?.source).toBe('memory');
    await client.get('https://example.test/data', { headers: { accept: 'application/vnd.github+json' } });
    await client.get('https://example.test/data', { headers: { authorization: 'Bearer another' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(budget.getSummary()).toMatchObject({ requestsMade: 3, memoryCacheHits: 1 });
  });

  it('serializes GitHub requests and stops the queue at the reserve before another plugin fetches', async () => {
    const budget = new RequestBudget({ maxRequests: 30, githubReserve: 100 });
    const fetchMock = vi.fn(async () => {
      await Promise.resolve();
      return json(PUBLIC, {
        'x-ratelimit-resource': 'core', 'x-ratelimit-remaining': '100',
        'x-ratelimit-limit': '1000', 'x-ratelimit-used': '900', 'x-ratelimit-reset': '2000000000',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createGithubClient('token', { budget });
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => client.get(`${REPO}?page=${index}`)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(budget.getSummary()).toMatchObject({
      requestsMade: 1, stopped: true, stopReason: 'github_reserve',
      githubByResource: { core: { remaining: 100, limit: 1000, used: 900, resetAt: '2033-05-18T03:33:20.000Z' } },
    });
    await expect(new JsonClient({}, { budget }).post('https://api.osv.dev/query', {})).rejects.toBeInstanceOf(BudgetExhaustedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, {}, 'slow down'],
    [403, { 'Retry-After': '5' }, 'secondary throttle'],
    [403, {}, 'You have exceeded a secondary rate limit.'],
  ])('stops all clients after a GitHub throttle (%s)', async (status, headers, message) => {
    const budget = new RequestBudget();
    const fetchMock = vi.fn(async () => json({ message }, headers as Record<string, string>, status as number));
    vi.stubGlobal('fetch', fetchMock);
    const client = createGithubClient('token', { budget });
    const results = await Promise.allSettled([client.get(REPO), client.get(`${REPO}/issues`)]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(budget.stopReason).toBe('github_rate_limit');
  });

  it('does not interpret missing, blank, negative, fractional, or malformed headers as zero', async () => {
    const budget = new RequestBudget();
    const values = [null, '', '   ', '-1', '1.5', 'broken', '9007199254740993'];
    let index = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const value = values[index++];
      return json(PUBLIC, value === null ? {} : { 'x-ratelimit-remaining': value, 'x-ratelimit-reset': value });
    }));
    const client = createGithubClient('token', { budget });
    for (let cursor = 0; cursor < values.length; cursor += 1) await client.get(`${REPO}?page=${cursor}`);
    expect(budget.isStopped).toBe(false);
    expect(budget.getSummary().githubByResource).toEqual({});
  });

  it('keeps separate GitHub resource accounting and allows an ordinary forbidden response without disabling all collection', async () => {
    const budget = new RequestBudget();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(PUBLIC, { 'x-ratelimit-resource': 'core', 'x-ratelimit-remaining': '850' }))
      .mockResolvedValueOnce(json(PUBLIC, { 'x-ratelimit-resource': 'search', 'x-ratelimit-remaining': '101' }))
      .mockResolvedValueOnce(json({ message: 'Resource not accessible by integration' }, { 'x-ratelimit-remaining': '849', 'x-ratelimit-reset': '2000000000' }, 403));
    vi.stubGlobal('fetch', fetchMock);
    const client = createGithubClient('token', { budget });
    await client.get(REPO);
    await client.get(`${REPO}?query=second`);
    await expect(client.get(`${REPO}/issues`)).rejects.toMatchObject({ name: 'HttpError', status: 403 });
    expect(budget.isStopped).toBe(false);
    expect(budget.getSummary().githubByResource).toMatchObject({
      core: { remaining: 849 }, search: { remaining: 101 },
    });
  });
});

describe('public JSON persistent HTTP cache', () => {
  it('revalidates across client instances, merges 304 headers, preserves the original timestamp and never writes credentials', async () => {
    const dir = await directory();
    const original = new Date(Date.now() - 6 * 60 * 60 * 1000);
    vi.useFakeTimers();
    vi.setSystemTime(original);
    await seed(dir, { ETag: '"first"', Link: '<https://api.github.com/repos/owner/repo?page=4>; rel="last"', 'Set-Cookie': 'credential-cookie' });
    vi.setSystemTime(new Date(original.getTime() + 6 * 60 * 60 * 1000));
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-none-match')).toBe('"first"');
      return new Response(null, { status: 304, headers: { ETag: '"second"', 'x-ratelimit-remaining': '800' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const budget = new RequestBudget();
    const client = createGithubClient('test-token', { budget, cache: new DiskHttpCache({ directory: dir }) });
    const response = await client.get<typeof PUBLIC>(REPO);
    expect(response.status).toBe(200);
    expect(response.data).toEqual(PUBLIC);
    expect(response.headers.get('etag')).toBe('"second"');
    expect(response.headers.get('link')).toContain('page=4');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('800');
    expect(response.cache).toEqual({
      source: 'revalidated', fetchedAt: original.toISOString(),
      validatedAt: new Date().toISOString(),
    });
    expect(budget.getSummary()).toMatchObject({ requestsMade: 1, revalidatedCacheHits: 1 });
    await client.flushCache();
    const file = await readFile(path.join(dir, 'public-json-v1.json'), 'utf8');
    expect(file).not.toMatch(/test-token|authorization|credential-cookie|set-cookie/i);
  });

  it('uses Last-Modified when ETag is absent', async () => {
    const dir = await directory();
    const lastModified = 'Tue, 20 Oct 2026 12:00:00 GMT';
    await seed(dir, { 'Last-Modified': lastModified });
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-modified-since')).toBe(lastModified);
      return new Response(null, { status: 304 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createGithubClient('test-token', { cache: new DiskHttpCache({ directory: dir }) });
    expect((await client.get(REPO)).data).toEqual(PUBLIC);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps default token, Accept, and API version namespaces isolated', async () => {
    const dir = await directory();
    await seed(dir);
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-none-match')).toBeNull();
      return json(PUBLIC, { ETag: '"different"' });
    });
    vi.stubGlobal('fetch', fetchMock);
    for (const [token, extra] of [
      ['other-token', {}],
      ['test-token', { Accept: 'application/vnd.github.raw+json' }],
      ['test-token', { 'X-GitHub-Api-Version': '2099-01-01' }],
    ] as const) {
      const client = createGithubClient(token, { cache: new DiskHttpCache({ directory: dir }) });
      await client.get(REPO, { headers: extra });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('supports an explicit stable public workflow scope despite token rotation', async () => {
    const dir = await directory();
    vi.stubGlobal('fetch', vi.fn(async () => json(PUBLIC, { ETag: '"stable"' })));
    const first = createGithubClient('workflow-run-one', { cache: new DiskHttpCache({ directory: dir }), cacheScope: 'owner/site' });
    await first.get(REPO);
    await first.flushCache();
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-none-match')).toBe('"stable"');
      return new Response(null, { status: 304 });
    }));
    const second = createGithubClient('workflow-run-two', { cache: new DiskHttpCache({ directory: dir }), cacheScope: 'owner/site' });
    expect((await second.get(REPO)).cache?.source).toBe('revalidated');
  });

  it.each(['{broken JSON', JSON.stringify({ version: 999, entries: [] }), JSON.stringify({ version: 1, entries: [['a'.repeat(64), { headers: { etag: '"missing"' }, fetchedAt: new Date().toISOString(), validatedAt: new Date().toISOString() }]] })])(
    'treats malformed, obsolete, or body-less files as cache misses', async (contents) => {
      const dir = await directory();
      await writeFile(path.join(dir, 'public-json-v1.json'), contents);
      const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
        expect(new Headers(init?.headers).get('if-none-match')).toBeNull();
        return json(PUBLIC);
      });
      vi.stubGlobal('fetch', fetchMock);
      expect((await createGithubClient('test-token', { cache: new DiskHttpCache({ directory: dir }) }).get(REPO)).data).toEqual(PUBLIC);
    },
  );

  it('rejects a stray 304 without a matching cached body instead of treating it as successful data', async () => {
    const dir = await directory();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 304 })));
    const client = createGithubClient('test-token', { cache: new DiskHttpCache({ directory: dir }) });
    await expect(client.get(REPO)).rejects.toMatchObject({ name: 'HttpError', status: 304 });
    expect(client.budget.getSummary().requestsMade).toBe(1);
  });

  it('persists children only after an explicit public repository proof and never persists private/unknown/user/foreign endpoints', async () => {
    const dir = await directory();
    const cache = new DiskHttpCache({ directory: dir });
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url) === REPO) return json(PUBLIC, { ETag: '"repo"' });
      if (String(url).endsWith('/owner/private')) return json({ full_name: 'owner/private', private: true }, { ETag: '"private"' });
      if (String(url).endsWith('/owner/unknown')) return json({ full_name: 'owner/unknown' }, { ETag: '"unknown"' });
      return json([{ number: 1 }], { ETag: '"child"' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createGithubClient('token', { cache });
    await client.get(`${REPO}/issues?before-proof=1`);
    await client.get(REPO);
    await client.get(`${REPO}/issues`);
    await client.get('https://api.github.com/repos/owner/private');
    await client.get('https://api.github.com/repos/owner/private/issues');
    await client.get('https://api.github.com/repos/owner/unknown');
    await client.get('https://api.github.com/user');
    await client.get('https://example.test/data');
    await client.post(`${REPO}/issues`, {});
    await client.flushCache();
    const file = JSON.parse(await readFile(path.join(dir, 'public-json-v1.json'), 'utf8'));
    expect(file.entries).toHaveLength(2);
    expect(file.entries.map(([, value]: [string, { headers: { etag: string } }]) => value.headers.etag).sort()).toEqual(['"child"', '"repo"']);
  });

  it('makes opt-in TTL hits explicit and otherwise refetches responses without validators', async () => {
    const dir = await directory();
    await seed(dir, {});
    const budget = new RequestBudget();
    const fetchMock = vi.fn(async () => json(PUBLIC));
    vi.stubGlobal('fetch', fetchMock);
    const cached = createGithubClient('test-token', { budget, cache: new DiskHttpCache({ directory: dir, ttlMs: 30_000 }) });
    expect((await cached.get(REPO)).cache?.source).toBe('ttl');
    expect(budget.getSummary()).toMatchObject({ requestsMade: 0, persistentCacheHits: 1 });
    const rechecking = createGithubClient('test-token', { cache: new DiskHttpCache({ directory: dir }) });
    expect((await rechecking.get(REPO)).cache?.source).toBe('network');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expires invalid-age cache entries and respects per-entry/disk size limits', async () => {
    const dir = await directory();
    const cache = new DiskHttpCache({ directory: dir, maxBytes: 1000, maxEntryBytes: 500, maxEntries: 2, maxAgeMs: 1000 });
    const now = new Date().toISOString();
    await cache.set('a'.repeat(64), { data: { value: 'x'.repeat(1000) }, headers: {}, fetchedAt: now, validatedAt: now });
    await cache.set('b'.repeat(64), { data: { value: 1 }, headers: {}, fetchedAt: now, validatedAt: now });
    await cache.set('c'.repeat(64), { data: { value: 2 }, headers: {}, fetchedAt: now, validatedAt: now });
    await cache.set('d'.repeat(64), { data: { value: 3 }, headers: {}, fetchedAt: now, validatedAt: now });
    expect(await cache.get('a'.repeat(64))).toBeNull();
    expect(await cache.get('b'.repeat(64))).toBeNull();
    await cache.flush();
    expect(Buffer.byteLength(await readFile(path.join(dir, 'public-json-v1.json'), 'utf8'))).toBeLessThanOrEqual(1000);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);
    expect(await new DiskHttpCache({ directory: dir, maxAgeMs: 1000 }).get('d'.repeat(64))).toBeNull();
  });
});

it('keeps search quota separate from the larger core reserve',async()=>{
 const budget=new RequestBudget({maxRequests:10,githubReserve:100});
 let remaining=29;
 vi.stubGlobal('fetch',vi.fn(async()=>json({items:[]},{'x-ratelimit-resource':'search','x-ratelimit-remaining':String(remaining),'x-ratelimit-limit':'30'})));
 const client=createGithubClient('test',{budget});
 await client.get('https://api.github.com/search/repositories?q=dsh',{cache:false});
 expect(budget.isStopped).toBe(false);
 remaining=1;
 await client.get('https://api.github.com/search/repositories?q=dsh2',{cache:false});
 expect(budget.isStopped).toBe(false);
 expect(budget.getSummary().githubByResource.search.remaining).toBe(1);
});
