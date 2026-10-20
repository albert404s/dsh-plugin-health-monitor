import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryFile, HistoryPoint, LatestData, StatusFile } from '../../src/lib/types';
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

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

export function assertLatestData(value: unknown): asserts value is LatestData {
  if (!value || typeof value !== 'object') throw new Error('latest.json 不是有效对象');
  const data = value as Partial<LatestData>;
  if (data.schemaVersion !== LATEST_SCHEMA_VERSION) {
    throw new Error(`latest.json schemaVersion 不兼容：${String(data.schemaVersion)}`);
  }
  if (!Array.isArray(data.plugins)) throw new Error('latest.json 缺少 plugins 数组');
  if (typeof data.lastSuccessAt !== 'string') throw new Error('latest.json 缺少 lastSuccessAt');
  for (const plugin of data.plugins) {
    if (!plugin || typeof plugin !== 'object') throw new Error('插件记录不是对象');
    if (typeof plugin.id !== 'string' || typeof plugin.repo !== 'string') {
      throw new Error('插件记录缺少 id/repo');
    }
    if (!plugin.scores?.popularity || !plugin.scores?.maintenance) {
      throw new Error(`插件 ${plugin.id} 缺少评分结果`);
    }
  }
}

export function assertHistory(value: unknown): asserts value is HistoryFile {
  if (!value || typeof value !== 'object') throw new Error('history.json 不是有效对象');
  const history = value as Partial<HistoryFile>;
  if (history.schemaVersion !== HISTORY_SCHEMA_VERSION) {
    throw new Error(`history.json schemaVersion 不兼容：${String(history.schemaVersion)}`);
  }
  if (!history.plugins || typeof history.plugins !== 'object') {
    throw new Error('history.json 缺少 plugins 对象');
  }
}

export function assertStatus(value: unknown): asserts value is StatusFile {
  if (!value || typeof value !== 'object') throw new Error('status.json 不是有效对象');
  const status = value as Partial<StatusFile>;
  if (status.schemaVersion !== STATUS_SCHEMA_VERSION) {
    throw new Error(`status.json schemaVersion 不兼容：${String(status.schemaVersion)}`);
  }
  if (!['success', 'partial', 'failed'].includes(status.outcome ?? '')) {
    throw new Error('status.json outcome 非法');
  }
}

export async function loadExisting(dataDir: string): Promise<{
  latest: LatestData | null;
  history: HistoryFile | null;
  status: StatusFile | null;
}> {
  const rawLatest = await readJson<unknown>(path.join(dataDir, 'latest.json'));
  const rawHistory = await readJson<unknown>(path.join(dataDir, 'history.json'));
  const rawStatus = await readJson<unknown>(path.join(dataDir, 'status.json'));
  let latest: LatestData | null = null;
  let history: HistoryFile | null = null;
  let status: StatusFile | null = null;
  if (rawLatest) {
    assertLatestData(rawLatest);
    latest = rawLatest;
  }
  if (rawHistory) {
    assertHistory(rawHistory);
    history = rawHistory;
  }
  if (rawStatus) {
    assertStatus(rawStatus);
    status = rawStatus;
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
    const points = [...(plugins[plugin.id] ?? [])];
    const point: HistoryPoint = {
      t: latest.generatedAt,
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

  // Remove empty plugin entries but keep history for plugins temporarily removed
  // from the config, so re-adding a plugin can continue its timeline.
  for (const key of Object.keys(plugins)) {
    if (plugins[key].length === 0) delete plugins[key];
  }

  const history: HistoryFile = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    updatedAt: latest.generatedAt,
    retentionDays,
    plugins,
  };
  await atomicWriteJson(path.join(dataDir, 'history.json'), history);
  return history;
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
  await mkdir(destinationDir, { recursive: true });
  await Promise.all([
    atomicWriteJson(path.join(destinationDir, 'latest.json'), latest),
    atomicWriteJson(path.join(destinationDir, 'history.json'), history),
    atomicWriteJson(path.join(destinationDir, 'status.json'), status),
  ]);
}
