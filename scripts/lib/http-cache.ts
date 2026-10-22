import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const VERSION = 1;
const ALLOWED_HEADERS = new Set(['content-type', 'etag', 'last-modified', 'link']);

export interface HttpCacheEntry {
  data: unknown;
  headers: Record<string, string>;
  fetchedAt: string;
  validatedAt: string;
}

export interface DiskHttpCacheOptions {
  directory: string;
  maxEntries?: number;
  maxBytes?: number;
  maxEntryBytes?: number;
  maxAgeMs?: number;
  /** Opt-in only: unvalidated cache use must remain distinguishable in response metadata. */
  ttlMs?: number;
}

function boundedPositive(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid HTTP cache limit');
  return value;
}

export function safeCacheHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries([...headers].filter(([name]) => ALLOWED_HEADERS.has(name.toLowerCase())));
}

/** Stores only caller-approved public JSON. Keys are opaque hashes, credentials are never serialized. */
export class DiskHttpCache {
  readonly ttlMs: number;
  private readonly file: string;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly maxEntryBytes: number;
  private readonly maxAgeMs: number;
  private readonly entries = new Map<string, HttpCacheEntry>();
  private loaded: Promise<void> | null = null;
  private revision = 0;
  private writtenRevision = 0;
  private flushing: Promise<void> = Promise.resolve();

  constructor(options: DiskHttpCacheOptions) {
    this.file = path.join(options.directory, 'public-json-v1.json');
    this.maxEntries = boundedPositive(options.maxEntries, 2000);
    this.maxBytes = boundedPositive(options.maxBytes, 16 * 1024 * 1024);
    this.maxEntryBytes = boundedPositive(options.maxEntryBytes, 512 * 1024);
    this.maxAgeMs = boundedPositive(options.maxAgeMs, 30 * 24 * 60 * 60 * 1000);
    if (options.ttlMs !== undefined && (!Number.isSafeInteger(options.ttlMs) || options.ttlMs < 0)) {
      throw new Error('Invalid HTTP cache TTL');
    }
    this.ttlMs = Math.min(options.ttlMs ?? 0, this.maxAgeMs);
  }

  async get(key: string): Promise<HttpCacheEntry | null> {
    await this.load();
    const entry = this.entries.get(key);
    if (!entry || !this.validEntry(key, entry)) return null;
    return structuredClone(entry);
  }

  async set(key: string, entry: HttpCacheEntry): Promise<void> {
    await this.load();
    if (!this.validEntry(key, entry)) return;
    this.entries.delete(key);
    this.entries.set(key, structuredClone(entry));
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    this.revision += 1;
  }

  flush(): Promise<void> {
    const next = this.flushing.catch(() => {}).then(() => this.writeSnapshot());
    this.flushing = next;
    return next;
  }

  private async writeSnapshot(): Promise<void> {
    await this.load();
    if (this.revision === this.writtenRevision) return;
    const snapshotRevision = this.revision;
    const items = [...this.entries].filter(([key, entry]) => this.validEntry(key, entry));
    let bytes = Buffer.byteLength(JSON.stringify({ version: VERSION, entries: items }));
    while (bytes > this.maxBytes && items.length) {
      items.shift();
      bytes = Buffer.byteLength(JSON.stringify({ version: VERSION, entries: items }));
    }
    const serialized = JSON.stringify({ version: VERSION, entries: items });
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.file);
      this.writtenRevision = snapshotRevision;
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        if ((await stat(this.file)).size > this.maxBytes) return;
        const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
        if (!parsed || typeof parsed !== 'object') return;
        const cache = parsed as { version?: unknown; entries?: unknown };
        if (cache.version !== VERSION || !Array.isArray(cache.entries) || cache.entries.length > this.maxEntries) return;
        for (const item of cache.entries) {
          if (!Array.isArray(item) || item.length !== 2) continue;
          const [key, entry] = item;
          if (typeof key === 'string' && this.validEntry(key, entry)) this.entries.set(key, entry);
        }
      } catch { /* A missing, corrupt, or obsolete cache is only a cache miss. */ }
    })();
    return this.loaded;
  }

  private validEntry(key: string, value: unknown): value is HttpCacheEntry {
    if (!/^[a-f0-9]{64}$/.test(key) || !value || typeof value !== 'object') return false;
    if (Object.keys(value).some((name) => !['data', 'headers', 'fetchedAt', 'validatedAt'].includes(name))) return false;
    const entry = value as Partial<HttpCacheEntry>;
    if (!Object.hasOwn(entry, 'data') || !entry.headers || typeof entry.headers !== 'object') return false;
    if (typeof entry.fetchedAt !== 'string' || typeof entry.validatedAt !== 'string') return false;
    const fetched = Date.parse(entry.fetchedAt);
    const validated = Date.parse(entry.validatedAt);
    const now = Date.now();
    if (!Number.isFinite(fetched) || !Number.isFinite(validated) || fetched > validated ||
        validated > now + 60_000 || now - validated > this.maxAgeMs) return false;
    if (!Object.entries(entry.headers).every(([name, value]) =>
      ALLOWED_HEADERS.has(name) && typeof value === 'string' && !/[\r\n]/.test(value))) return false;
    try { return Buffer.byteLength(JSON.stringify(entry)) <= this.maxEntryBytes; } catch { return false; }
  }
}
