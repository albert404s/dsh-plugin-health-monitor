import { createHash } from 'node:crypto';
import { DiskHttpCache, safeCacheHeaders, type HttpCacheEntry } from './http-cache';
import { BudgetExhaustedError, RequestBudget } from './request-budget';

export { BudgetExhaustedError, RequestBudget } from './request-budget';
export { DiskHttpCache } from './http-cache';
const USER_AGENT = 'dsh-plugin-health-monitor/0.1 (+https://github.com/albert404s/dsh-plugin-health-monitor)';

export interface JsonResponse<T> {
  data: T;
  headers: Headers;
  status: number;
  cache?: {
    source: 'network' | 'memory' | 'revalidated' | 'ttl';
    /** Time the body was originally obtained; revalidation does not rewrite its provenance. */
    fetchedAt: string;
    validatedAt: string;
  };
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** false disables both memory caching and conditional persistent-cache requests. */
  cache?: boolean;
}

export interface JsonClientOptions {
  budget?: RequestBudget;
  cache?: DiskHttpCache;
  /** Stable scope for rotating workflow tokens. Only confirmed public repository responses are persisted. */
  cacheScope?: string;
}

function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get('retry-after')?.trim();
  if (retryAfter) {
    if (/^\d+(?:\.\d+)?$/.test(retryAfter)) return Number(retryAfter) * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const reset = headers.get('x-ratelimit-reset')?.trim();
  if (reset && /^\d+$/.test(reset) && Number.isSafeInteger(Number(reset))) {
    return Math.max(0, Number(reset) * 1000 - Date.now());
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function identity(url: string, headers: Headers, scope?: string): string {
  const representation = [...headers]
    .filter(([name]) => !['authorization', 'if-none-match', 'if-modified-since', 'user-agent'].includes(name))
    .sort(([a], [b]) => a.localeCompare(b));
  return digest(JSON.stringify({
    url, representation,
    principal: scope ? `public-workflow:${scope}` : digest(headers.get('authorization') ?? 'anonymous'),
  }));
}

/** Deliberately allow only public repo endpoints used by this collector. Never /user, /orgs, or arbitrary hosts. */
function githubRepository(url: string): { repository: string; root: boolean } | null {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.host !== 'api.github.com' || parsed.username || parsed.password) return null;
  for (const key of parsed.searchParams.keys()) {
    if (/token|key|password|secret|authorization/i.test(key)) return null;
  }
  const match = parsed.pathname.match(/^\/repos\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/(commits|issues|pulls|releases))?\/?$/);
  if (!match) return null;
  return { repository: `${match[1]}/${match[2]}`.toLowerCase(), root: !match[3] };
}

function isPublicRepository(data: unknown, expected: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const repo = data as { private?: unknown; full_name?: unknown; visibility?: unknown };
  return repo.private === false && repo.visibility !== 'private' &&
    typeof repo.full_name === 'string' && repo.full_name.toLowerCase() === expected;
}

export class JsonClient {
  readonly budget: RequestBudget;
  private readonly memory = new Map<string, JsonResponse<unknown>>();
  private readonly defaultHeaders: Headers;
  private readonly publicRepositories = new Set<string>();
  private readonly persistent?: DiskHttpCache;
  private readonly cacheScope?: string;

  constructor(headers: Record<string, string> = {}, options: JsonClientOptions = {}) {
    this.defaultHeaders = new Headers({ 'User-Agent': USER_AGENT, Accept: 'application/json' });
    for (const [name, value] of Object.entries(headers)) this.defaultHeaders.set(name, value);
    this.budget = options.budget ?? new RequestBudget();
    this.persistent = options.cache;
    this.cacheScope = options.cacheScope;
  }

  async flushCache(): Promise<void> { await this.persistent?.flush(); }

  async get<T>(url: string, options: RequestOptions = {}): Promise<JsonResponse<T>> {
    const headers = this.headers(options);
    const memoryKey = identity(url, headers);
    const useCache = options.cache !== false;
    const memory = useCache ? this.memory.get(memoryKey) : undefined;
    if (memory) {
      this.budget.cacheHit('memory');
      return {
        ...memory, headers: new Headers(memory.headers),
        cache: memory.cache ? { ...memory.cache, source: 'memory' } : undefined,
      } as JsonResponse<T>;
    }
    const repository = githubRepository(url);
    const publicKey = repository ? identity(repository.repository, headers) : '';
    const eligible = Boolean(this.persistent && useCache && repository &&
      (repository.root || this.publicRepositories.has(publicKey)));
    const diskKey = identity(url, headers, this.cacheScope);
    let cached = eligible ? await this.persistent!.get(diskKey) : null;
    // A malformed/public-proof-less root is not a body suitable for a 304 response.
    if (cached && repository?.root && !isPublicRepository(cached.data, repository.repository)) cached = null;
    const etag = cached?.headers.etag;
    const lastModified = cached?.headers['last-modified'];
    const suppliedEtag = headers.get('if-none-match');
    const suppliedDate = headers.get('if-modified-since');
    if ((suppliedEtag && suppliedEtag !== etag) || (suppliedDate && suppliedDate !== lastModified)) cached = null;
    if (cached && !etag && !lastModified && this.persistent!.ttlMs > 0 &&
        Date.now() - Date.parse(cached.validatedAt) <= this.persistent!.ttlMs) {
      this.budget.cacheHit('persistent');
      const response: JsonResponse<T> = {
        data: cached.data as T, headers: new Headers(cached.headers), status: 200,
        cache: { source: 'ttl', fetchedAt: cached.fetchedAt, validatedAt: cached.validatedAt },
      };
      if (repository?.root) this.publicRepositories.add(publicKey);
      this.memory.set(memoryKey, response);
      return response;
    }
    if (cached && !suppliedEtag && !suppliedDate) {
      if (etag) headers.set('If-None-Match', etag);
      else if (lastModified) headers.set('If-Modified-Since', lastModified);
    }
    const response = await this.request<T>(url, { method: 'GET', headers }, options, cached);
    if (repository?.root) {
      if (isPublicRepository(response.data, repository.repository)) this.publicRepositories.add(publicKey);
      else this.publicRepositories.delete(publicKey);
    }
    if (useCache && response.status === 200) {
      this.memory.set(memoryKey, response);
      if (eligible && this.publicRepositories.has(publicKey) && response.cache) {
        await this.persistent!.set(diskKey, {
          data: response.data,
          headers: safeCacheHeaders(response.headers),
          fetchedAt: response.cache.fetchedAt,
          validatedAt: response.cache.validatedAt,
        });
      }
    }
    return response;
  }

  async post<T>(url: string, body: unknown, options: RequestOptions = {}): Promise<JsonResponse<T>> {
    const headers = this.headers(options);
    headers.set('Content-Type', 'application/json');
    return this.request<T>(url, { method: 'POST', body: JSON.stringify(body), headers }, options);
  }

  private headers(options: RequestOptions): Headers {
    const headers = new Headers(this.defaultHeaders);
    for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
    return headers;
  }

  private async request<T>(
    url: string, init: RequestInit, options: RequestOptions, cached: HttpCacheEntry | null = null,
  ): Promise<JsonResponse<T>> {
    const retries = options.retries ?? 3;
    const timeoutMs = options.timeoutMs ?? 20_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2 ** 32 - 1 ||
        !Number.isSafeInteger(retries) || retries < 0) throw new Error('Invalid HTTP retry or timeout setting');
    for (let attempt = 0; ; attempt += 1) {
      let error: unknown;
      let wait: number | null = null;
      try {
        const response = await this.budget.fetch(url, () => fetch(url, {
          ...init, signal: AbortSignal.timeout(timeoutMs),
        }));
        const now = new Date().toISOString();
        if (response.status === 304) {
          if (response.redirected || !cached || (!cached.headers.etag && !cached.headers['last-modified'])) {
            throw new HttpError('304 response has no matching valid cached JSON body', 304, url);
          }
          const headers = new Headers(cached.headers);
          response.headers.forEach((value, name) => headers.set(name, value));
          this.budget.cacheHit('revalidated');
          return {
            data: structuredClone(cached.data) as T, headers, status: 200,
            cache: { source: 'revalidated', fetchedAt: cached.fetchedAt, validatedAt: now },
          };
        }
        if (response.ok) {
          const text = await response.text();
          let data: unknown = null;
          if (text) {
            try { data = JSON.parse(text); }
            catch { throw new HttpError('Response is not valid JSON', response.status, url); }
          }
          return { data: data as T, headers: response.headers, status: response.status,
            cache: text && !response.redirected ? { source: 'network', fetchedAt: now, validatedAt: now } : undefined };
        }
        if (this.budget.isStopped) throw new BudgetExhaustedError(this.budget.stopReason!);
        const retryAfterMs = parseRetryAfter(response.headers);
        const failure = new HttpError(`HTTP ${response.status} for ${url}`, response.status, url, retryAfterMs);
        const rateLimit = response.status === 429 || (response.status === 403 &&
          (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')));
        const retryable = rateLimit || response.status === 408 || response.status >= 500;
        if (!retryable || attempt >= retries || (retryAfterMs !== null && retryAfterMs > 60_000)) throw failure;
        error = failure;
        wait = retryAfterMs !== null ? Math.max(1000, retryAfterMs) : null;
      } catch (caught) {
        if (caught instanceof BudgetExhaustedError) throw caught;
        if (caught instanceof HttpError && (caught.status < 500 && caught.status !== 408 && caught.status !== 429)) throw caught;
        error = caught;
        if (attempt >= retries) throw caught;
      }
      this.budget.assertAvailable(); // Do not back off/retry after another client has stopped the shared run.
      const delay = wait ?? Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
      console.warn(`[http] retry ${attempt + 1}/${retries} in ${Math.round(delay)}ms: ${error instanceof Error ? error.message : 'request failed'}`);
      await sleep(delay);
    }
  }
}

export function createGithubClient(token: string | undefined, options: JsonClientOptions = {}): JsonClient {
  return new JsonClient({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, options);
}

export function createNpmClient(options: JsonClientOptions = {}): JsonClient {
  return new JsonClient({ Accept: 'application/json' }, options);
}
