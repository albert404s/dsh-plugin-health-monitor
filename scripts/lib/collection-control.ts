import { copyFile, cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CollectionControl } from '../../src/lib/collection-control';

// Explicit file URLs also work with Node 24's native TypeScript execution.
const {
  COLLECTION_CONTROL_FILENAME,
  collectionControlSchema,
  defaultCollectionControl,
  parseCollectionControl,
} = await import(decodeURI(new URL('../../src/lib/collection-control.ts', import.meta.url).href)) as typeof import('../../src/lib/collection-control');

export {
  COLLECTION_CONTROL_FILENAME,
  collectionControlSchema,
  defaultCollectionControl,
  parseCollectionControl,
};
export type { CollectionControl } from '../../src/lib/collection-control';

export type CollectionAction = 'scheduled' | 'refresh' | 'pause' | 'resume';

export interface CollectionDecision {
  action: CollectionAction;
  shouldCollect: boolean;
  controlChanged: boolean;
  control: CollectionControl;
  message: string;
}

export async function readCollectionControl(dataDir: string): Promise<CollectionControl> {
  let raw: string;
  try {
    raw = await readFile(path.join(dataDir, COLLECTION_CONTROL_FILENAME), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultCollectionControl();
    throw error;
  }
  try {
    return parseCollectionControl(JSON.parse(raw) as unknown);
  } catch (error) {
    throw new Error('采集控制文件不可用，已阻止本次操作；请检查 data 分支的 collection-control.json。', { cause: error });
  }
}

export function decideCollectionAction(
  eventName: string,
  requestedAction: string | undefined,
  current: CollectionControl,
  actor: string | undefined,
  now = new Date(),
): CollectionDecision {
  const control = parseCollectionControl(current);
  if (eventName === 'schedule') {
    return {
      action: 'scheduled',
      shouldCollect: !control.automaticPaused,
      controlChanged: false,
      control,
      message: control.automaticPaused
        ? '自动采集已暂停。本次定时任务跳过采集、构建和部署，不调用数据 API。'
        : '自动采集已开启。本次定时任务继续采集。',
    };
  }
  if (eventName !== 'workflow_dispatch') throw new Error('不支持的采集触发事件');
  const action = requestedAction || 'refresh';
  if (action === 'refresh') {
    return {
      action,
      shouldCollect: true,
      controlChanged: false,
      control,
      message: '手动采集一次；不改变自动更新开关。',
    };
  }
  if (action !== 'pause' && action !== 'resume') throw new Error('action 只支持 refresh、pause 或 resume');
  const updated = parseCollectionControl({
    ...control,
    automaticPaused: action === 'pause',
    updatedAt: now.toISOString(),
    updatedBy: actor,
  });
  return {
    action,
    shouldCollect: false,
    controlChanged: true,
    control: updated,
    message: action === 'pause'
      ? '暂停后续定时采集；保留现有快照和历史，本次不采集新数据。已经运行的任务不会被取消。'
      : '恢复后续定时采集；保留现有快照和历史，本次不采集新数据。',
  };
}

export async function writeCollectionControl(dataDir: string, value: CollectionControl): Promise<void> {
  const control = parseCollectionControl(value);
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, COLLECTION_CONTROL_FILENAME);
  const temporary = file + '.' + process.pid + '.tmp';
  await writeFile(temporary, JSON.stringify(control, null, 2) + '\n', 'utf8');
  await rename(temporary, file);
}

/** Carry the last snapshot unchanged through pause/resume deployments. */
export async function stageCollectionArtifact(dataDir: string, artifactDir: string): Promise<void> {
  const control = await readCollectionControl(dataDir);
  await mkdir(artifactDir, { recursive: true });
  for (const filename of ['latest.json', 'history.json', 'status.json']) {
    await copyFile(path.join(dataDir, filename), path.join(artifactDir, filename));
  }
  await mkdir(path.join(artifactDir, 'snapshots'), { recursive: true });
  try {
    await cp(path.join(dataDir, 'snapshots'), path.join(artifactDir, 'snapshots'), { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeCollectionControl(artifactDir, control);
}
