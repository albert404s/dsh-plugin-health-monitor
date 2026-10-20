const USER_AGENT = 'dsh-plugin-health-monitor/0.1 (+https://github.com/albert404s/dsh-plugin-health-monitor)';

export interface JsonResponse<T> {
  data: T;
  headers: Headers;
  status: number;
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number, url: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Only successful GET JSON responses are cached for the lifetime of this process. */
  cache?: boolean;
}

function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const reset = headers.get('x-ratelimit-reset');
  if (reset) {
    const seconds = Number(reset);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000 - Date.now());
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JsonClient {
  private readonly cache = new Map<string, JsonResponse<unknown>>();
  private readonly defaultHeaders: Record<string, string>;

  constructor(headers: Record<string, string> = {}) {
    this.defaultHeaders = { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers };
  }

  async get<T>(url: string, options: RequestOptions = {}): Promise<JsonResponse<T>> {
    const useCache = options.cache !== false;
    if (useCache && this.cache.has(url)) {
      return this.cache.get(url) as JsonResponse<T>;
    }
    const response = await this.request<T>(url, { method: 'GET' }, options);
    if (useCache && response.status === 200) {
      this.cache.set(url, response as JsonResponse<unknown>);
    }
    return response;
  }

  async post<T>(url: string, body: unknown, options: RequestOptions = {}): Promise<JsonResponse<T>> {
    return this.request<T>(
      url,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
      { ...options, cache: false },
    );
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    options: RequestOptions,
  ): Promise<JsonResponse<T>> {
    const retries = options.retries ?? 3;
    const timeoutMs = options.timeoutMs ?? 20_000;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            ...this.defaultHeaders,
            ...options.headers,
            ...(init.headers ?? {}),
          },
        });

        if (response.ok) {
          const text = await response.text();
          let data: unknown = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              throw new HttpError('Response is not valid JSON', response.status, url);
            }
          }
          return { data: data as T, headers: response.headers, status: response.status };
        }

        const retryAfterMs = parseRetryAfter(response.headers);
        const error = new HttpError(
          `HTTP ${response.status} for ${url}`,
          response.status,
          url,
          retryAfterMs,
        );

        if (response.status === 404) throw error;

        const isRateLimit =
          response.status === 429 ||
          (response.status === 403 &&
            (response.headers.get('x-ratelimit-remaining') === '0' || retryAfterMs !== null));
        const isRetryable = isRateLimit || response.status === 408 || response.status >= 500;

        if (!isRetryable || attempt === retries) throw error;

        const backoff = Math.min(30_000, 500 * 2 ** attempt);
        const jitter = Math.floor(Math.random() * 250);
        const wait = retryAfterMs !== null && retryAfterMs <= 60_000 ? retryAfterMs : backoff + jitter;
        if (wait > 65_000) {
          throw new HttpError(
            `Rate limit resets too far in the future for ${url}`,
            response.status,
            url,
            retryAfterMs,
          );
        }
        console.warn(
          `[http] ${response.status} ${url} — retry ${attempt + 1}/${retries} in ${Math.round(wait / 1000)}s`,
        );
        await sleep(wait);
        lastError = error;
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) throw error;
        if (error instanceof HttpError && error.status < 500 && error.status !== 408 && error.status !== 429) {
          throw error;
        }
        lastError = error;
        if (attempt === retries) break;
        const backoff = Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
        console.warn(
          `[http] request failed ${url} — retry ${attempt + 1}/${retries} in ${backoff}ms: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        await sleep(backoff);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
  }
}

export function createGithubClient(token: string | undefined): JsonClient {
  return new JsonClient({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
}

export function createNpmClient(): JsonClient {
  return new JsonClient({ Accept: 'application/json' });
}
