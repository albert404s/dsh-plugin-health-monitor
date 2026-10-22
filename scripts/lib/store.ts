import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryFile, HistoryPoint, LatestData, StatusFile } from '../../src/lib/types';
import { latestSchema, historySchema, statusSchema, parseLatest, parseHistory, parseStatus } from '../../src/lib/contracts';
import { computeStats } from '../../src/lib/scoring';
import { readCollectionControl } from './collection-control';
import {
  HISTORY_SCHEMA_VERSION,
  LATEST_SCHEMA_VERSION,
  STATUS_SCHEMA_VERSION,
} from '../../src/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_HISTORY_RETENTION_DAYS = 90;
export const DEFAULT_SNAPSHOT_RETENTION = 120;

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function isRetryableRenameError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(temporary, content, 'utf8');

  // Windows can temporarily lock a file opened by a dev server, virus scanner
  // or indexer. Retry a few times before falling back to an explicit replace.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(temporary, filePath);
      return;
    } catch (error) {
      if (!isRetryableRenameError(error) || attempt === 4) {
        if (!isRetryableRenameError(error)) {
          await rm(temporary, { force: true });
          throw error;
        }
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }

  try {
    await rm(filePath, { force: true });
    await rename(temporary, filePath);
  } catch (error) {
    // Last resort for Windows locks: overwrite in place. It is less atomic, but
    // the source data is deterministic JSON and the previous value remains on
    // disk until this write begins.
    try {
      await writeFile(filePath, content, 'utf8');
      await rm(temporary, { force: true });
    } catch {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}

export function assertLatestData(value: unknown): asserts value is LatestData {
  const result=latestSchema.safeParse(value);
  if(!result.success) throw new Error('latest.json 数据契约校验失败：' + result.error.issues.slice(0,2).map(issue=>issue.path.join('.')+': '+issue.message).join('；'));
  const expected=computeStats(result.data.plugins);
  if(Object.keys(expected).some(key=>expected[key as keyof typeof expected] !== result.data.stats[key as keyof typeof expected])) throw new Error('latest.json 汇总与插件记录不一致');
  const ids = new Set<string>(), repos = new Set<string>();
  for(const plugin of result.data.plugins) {
    if(ids.has(plugin.id.toLowerCase()) || repos.has(plugin.repo.toLowerCase()))throw new Error('latest.json 重复插件身份');
    ids.add(plugin.id.toLowerCase());repos.add(plugin.repo.toLowerCase());
  }
}
export function assertHistory(value: unknown): asserts value is HistoryFile {
  if(!historySchema.safeParse(value).success) throw new Error('history.json 数据契约校验失败');
}
export function assertStatus(value: unknown): asserts value is StatusFile {
  if(!statusSchema.safeParse(value).success) throw new Error('status.json 数据契约校验失败');
}

export async function loadExisting(dataDir: string): Promise<{
  latest: LatestData | null;
  history: HistoryFile | null;
  status: StatusFile | null;
}> {
  const rawLatest = await readJson<unknown>(path.join(dataDir, 'latest.json'));
  const rawHistory = await readJson<unknown>(path.join(dataDir, 'history.json')).catch(error=>{console.warn('[store] history unreadable:',String(error));return null;});
  const rawStatus = await readJson<unknown>(path.join(dataDir, 'status.json')).catch(error=>{console.warn('[store] status unreadable:',String(error));return null;});
  let latest: LatestData | null = null;
  let history: HistoryFile | null = null;
  let status: StatusFile | null = null;
  if (rawLatest) {
    const result=parseLatest(rawLatest); latest=result.data; result.warnings.forEach(warning=>console.warn('[store]',warning));
  }
  if (rawHistory) {
    try { const result=parseHistory(rawHistory); history=result.data; result.warnings.forEach(warning=>console.warn('[store]',warning)); } catch(error) { console.warn('[store] history unavailable:',String(error)); }
  }
  if (rawStatus) {
    try { status=parseStatus(rawStatus); } catch(error) { console.warn('[store] status unavailable:',String(error)); }
  }
  return { latest, history, status };
}

export async function updateHistory(
  dataDir: string,
  latest: LatestData,
  previous: HistoryFile | null,
  now: Date,
): Promise<HistoryFile> {
  const retentionDays = DEFAULT_HISTORY_RETENTION_DAYS;
  const cutoff = now.getTime() - retentionDays * DAY_MS;
  const plugins: Record<string, HistoryPoint[]> = { ...(previous?.plugins ?? {}) };

  for (const plugin of latest.plugins) {
    if(plugin.dataStatus === 'stale') continue;
    const points = [...(plugins[plugin.id] ?? [])];
    const point: HistoryPoint = {
      t: latest.generatedAt,
      methodVersion: plugin.scores.maintenance.methodVersion,
      stars: plugin.github.stars,
      downloads: plugin.npm.status === 'verified' ? plugin.npm.downloads30d : null,
      popularity: plugin.scores.popularity.score,
      maintenance: plugin.scores.maintenance.score,
      riskLevel: plugin.scores.risk.level,
      commits30d: plugin.github.commits30d,
      issuesOpened90d: plugin.github.issues.opened90d,
      issuesClosed90d: plugin.github.issues.closed90d,
      prsOpened90d: plugin.github.pullRequests.opened90d,
      prsMerged90d: plugin.github.pullRequests.merged90d,
      releaseAt: plugin.github.latestRelease?.publishedAt ?? null,
      archived: plugin.repository.archived,
    };
    points.push(point);
    plugins[plugin.id] = points
      .filter((item) => {
        const timestamp = new Date(item.t).getTime();
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      })
      .slice(-400);
  }

  // Retain history for plugins temporarily removed from the config, but still
  // expire old points by the common cutoff and drop empty arrays.
  for (const key of Object.keys(plugins)) {
    plugins[key] = plugins[key]
      .filter((item) => {
        const timestamp = new Date(item.t).getTime();
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      })
      .slice(-400);
    if (plugins[key].length === 0) delete plugins[key];
  }

  const history: HistoryFile = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    updatedAt: latest.generatedAt,
    retentionDays,
    plugins,
  };
  const cleaned=parseHistory(history).data;
  assertHistory(cleaned);
  await atomicWriteJson(path.join(dataDir, 'history.json'), cleaned);
  return cleaned;
}

export function snapshotFilename(iso: string): string {
  return `${iso.replace(/[:.]/g, '-')}.json`;
}

export async function writeSnapshot(
  dataDir: string,
  latest: LatestData,
  retention = DEFAULT_SNAPSHOT_RETENTION,
): Promise<string> {
  const directory = path.join(dataDir, 'snapshots');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, snapshotFilename(latest.generatedAt));
  await atomicWriteJson(file, latest);

  const files = (await readdir(directory))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const stale = files.slice(0, Math.max(0, files.length - retention));
  await Promise.all(stale.map((name) => rm(path.join(directory, name), { force: true })));
  return file;
}

export async function writeLatest(dataDir: string, latest: LatestData): Promise<void> {
  assertLatestData(latest);
  await atomicWriteJson(path.join(dataDir, 'latest.json'), latest);
}

export async function writeStatus(dataDir: string, status: StatusFile): Promise<void> {
  assertStatus(status);
  await atomicWriteJson(path.join(dataDir, 'status.json'), status);
}

/** 复制构建所需的数据文件，不修改源目录。 */
export async function copyDataFiles(sourceDir: string, destinationDir: string): Promise<void> {
  const latest = await readJson<unknown>(path.join(sourceDir, 'latest.json'));
  const history = await readJson<unknown>(path.join(sourceDir, 'history.json'));
  const status = await readJson<unknown>(path.join(sourceDir, 'status.json'));
  if (!latest) throw new Error(`数据目录 ${sourceDir} 缺少 latest.json`);
  if (!history) throw new Error(`数据目录 ${sourceDir} 缺少 history.json`);
  if (!status) throw new Error(`数据目录 ${sourceDir} 缺少 status.json`);
  assertLatestData(latest);
  assertHistory(history);
  assertStatus(status);
  const collectionControl = await readCollectionControl(sourceDir);
  await mkdir(destinationDir, { recursive: true });
  await Promise.all([
    atomicWriteJson(path.join(destinationDir, 'latest.json'), latest),
    atomicWriteJson(path.join(destinationDir, 'history.json'), history),
    atomicWriteJson(path.join(destinationDir, 'status.json'), status),
    atomicWriteJson(path.join(destinationDir, 'collection-control.json'), collectionControl),
  ]);
}
