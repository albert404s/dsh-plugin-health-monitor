export type BudgetStopReason = 'request_limit' | 'github_reserve' | 'github_rate_limit' | 'manual';

export interface RequestBudgetOptions {
  maxRequests?: number;
  githubReserve?: number;
  /** A single GitHub request at a time also prevents queued work from crossing a response reserve. */
  githubConcurrency?: number;
}

export interface GithubRateLimit {
  remaining: number | null;
  limit: number | null;
  used: number | null;
  resetAt: string | null;
}

export interface RequestBudgetSummary {
  maxRequests: number;
  githubReserve: number;
  requestsMade: number;
  requestsRemaining: number;
  requestsByHost: Record<string, number>;
  memoryCacheHits: number;
  persistentCacheHits: number;
  revalidatedCacheHits: number;
  githubByResource: Record<string, GithubRateLimit>;
  stopped: boolean;
  stopReason: BudgetStopReason | null;
}

export class BudgetExhaustedError extends Error {
  constructor(readonly reason: BudgetStopReason) {
    super(`Collection request budget stopped: ${reason}`);
    this.name = 'BudgetExhaustedError';
  }
}

/** Empty, fractional, negative, and malformed headers are unknown, never a synthetic zero. */
function headerCount(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function positiveInteger(value: number | undefined, fallback: number, minimum = 1): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error('Invalid request budget setting');
  return value;
}

export class RequestBudget {
  readonly maxRequests: number;
  readonly githubReserve: number;
  private readonly githubConcurrency: number;
  private githubActive = 0;
  private readonly githubWaiters: Array<() => void> = [];
  private made = 0;
  private reason: BudgetStopReason | null = null;
  private readonly hosts: Record<string, number> = Object.create(null);
  private readonly resources: Record<string, GithubRateLimit> = Object.create(null);
  private readonly hits = { memory: 0, persistent: 0, revalidated: 0 };

  constructor(options: RequestBudgetOptions = {}) {
    this.maxRequests = positiveInteger(options.maxRequests, 600);
    this.githubReserve = positiveInteger(options.githubReserve, 100, 0);
    this.githubConcurrency = positiveInteger(options.githubConcurrency, 1);
  }

  get isStopped(): boolean { return this.reason !== null; }
  get stopReason(): BudgetStopReason | null { return this.reason; }

  stop(reason: BudgetStopReason = 'manual'): void {
    this.reason ??= reason;
  }

  cacheHit(kind: 'memory' | 'persistent' | 'revalidated'): void {
    this.hits[kind] += 1;
  }

  assertAvailable(): void {
    if (this.reason) throw new BudgetExhaustedError(this.reason);
    if (this.made >= this.maxRequests) {
      this.stop('request_limit');
      throw new BudgetExhaustedError('request_limit');
    }
  }

  /** This wrapper must surround every actual fetch, including retries and POSTs. */
  async fetch(url: string, perform: () => Promise<Response>): Promise<Response> {
    const host = new URL(url).hostname;
    const github = host === 'api.github.com';
    if (github) await this.acquireGithub();
    try {
      this.assertAvailable();
      // No await between admission and increment: parallel callers cannot overspend.
      this.made += 1;
      this.hosts[host] = (this.hosts[host] ?? 0) + 1;
      const response = await perform();
      if (github) await this.observeGithub(response);
      return response;
    } finally {
      if (github) this.releaseGithub();
    }
  }

  getSummary(): RequestBudgetSummary {
    return {
      maxRequests: this.maxRequests,
      githubReserve: this.githubReserve,
      requestsMade: this.made,
      requestsRemaining: Math.max(0, this.maxRequests - this.made),
      requestsByHost: { ...this.hosts },
      memoryCacheHits: this.hits.memory,
      persistentCacheHits: this.hits.persistent,
      revalidatedCacheHits: this.hits.revalidated,
      githubByResource: structuredClone(this.resources),
      stopped: this.isStopped,
      stopReason: this.reason,
    };
  }

  private async acquireGithub(): Promise<void> {
    this.assertAvailable();
    if (this.githubActive >= this.githubConcurrency) {
      await new Promise<void>((resolve) => this.githubWaiters.push(resolve));
    } else {
      this.githubActive += 1;
    }
  }

  private releaseGithub(): void {
    const next = this.githubWaiters.shift();
    if (next) next(); // The occupied slot passes directly to this waiter.
    else this.githubActive -= 1;
  }

  private async observeGithub(response: Response): Promise<void> {
    const remaining = headerCount(response.headers, 'x-ratelimit-remaining');
    const limit = headerCount(response.headers, 'x-ratelimit-limit');
    const used = headerCount(response.headers, 'x-ratelimit-used');
    const reset = headerCount(response.headers, 'x-ratelimit-reset');
    const reportedResource = response.headers.get('x-ratelimit-resource')?.trim();
    const resource = reportedResource && /^[a-z][a-z0-9_]{0,63}$/.test(reportedResource) ? reportedResource : 'core';
    if (remaining !== null || limit !== null || used !== null || reset !== null) {
      const previous = this.resources[resource];
      const milliseconds = reset === null ? NaN : reset * 1000;
      this.resources[resource] = {
        remaining: remaining ?? previous?.remaining ?? null,
        limit: limit ?? previous?.limit ?? null,
        used: used ?? previous?.used ?? null,
        resetAt: Number.isFinite(milliseconds) && milliseconds <= 8.64e15
          ? new Date(milliseconds).toISOString() : previous?.resetAt ?? null,
      };
    }
    let rateLimited = response.status === 429;
    if (response.status === 403) {
      const retryAfter = response.headers.get('retry-after');
      rateLimited = remaining === 0 || Boolean(retryAfter?.trim());
      if (!rateLimited) {
        try {
          const message: unknown = (await response.clone().json() as { message?: unknown }).message;
          rateLimited = typeof message === 'string' && /rate.?limit|abuse detection/i.test(message);
        } catch { /* Not every forbidden response contains a JSON error body. */ }
      }
    }
    if (rateLimited) this.stop('github_rate_limit');
    else if (resource === 'core' && remaining !== null && remaining <= this.githubReserve) this.stop('github_reserve');
  }
}
