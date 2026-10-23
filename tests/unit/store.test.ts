import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LatestData, StatusFile } from '../../src/lib/types';
import {
  computeStats,
  scorePlugins,
} from '../../src/lib/scoring';
import {
  assertHistory,
  assertLatestData,
  copyDataFiles,
  loadExisting,
  updateHistory,
  writeLatest,
  writeSnapshot,
  writeStatus,
} from '../../scripts/lib/store';
import { HISTORY_SCHEMA_VERSION, LATEST_SCHEMA_VERSION, STATUS_SCHEMA_VERSION } from '../../src/lib/types';
import { NOW, makeSeed } from './helpers';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'dsh-phm-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function makeLatest(generatedAt = NOW.toISOString()): LatestData {
  const plugins = scorePlugins(
    [makeSeed({ id: 'plugin-a', stars: 100, downloads30d: 1000 })],
    new Date(generatedAt),
  );
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    generatedAt,
    lastAttemptAt: generatedAt,
    lastSuccessAt: generatedAt,
    runId: `run-${generatedAt}`,
    sources: {
      github: { status: 'ok', fetchedAt: generatedAt },
      npm: { status: 'ok', fetchedAt: generatedAt },
      osv: { status: 'ok', fetchedAt: generatedAt },
    },
    stats: computeStats(plugins),
    plugins,
  };
}

function makeStatus(lastSuccessAt: string | null): StatusFile {
  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    runId: 'failure-run',
    lastAttemptAt: new Date(NOW.getTime() + 1000).toISOString(),
    lastSuccessAt,
    outcome: 'failed',
    sources: {
      github: { status: 'failed', fetchedAt: new Date(NOW.getTime() + 1000).toISOString() },
      npm: { status: 'failed', fetchedAt: null },
      osv: { status: 'failed', fetchedAt: null },
    },
    errorCount: 1,
    messages: ['simulated failure'],
    nextRunHint: 'test',
  };
}

describe('data store', () => {
  it('appends history on a second successful run and keeps the previous point', async () => {
    const directory = await temporaryDirectory();
    const first = makeLatest();
    await updateHistory(directory, first, null, NOW);
    await writeLatest(directory, first);

    const secondTime = new Date(NOW.getTime() + 6 * 60 * 60 * 1000);
    const second = makeLatest(secondTime.toISOString());
    const loaded = await loadExisting(directory);
    await updateHistory(directory, second, loaded.history, secondTime);
    await writeLatest(directory, second);

    const historyRaw = JSON.parse(
      await readFile(path.join(directory, 'history.json'), 'utf8'),
    ) as unknown;
    assertHistory(historyRaw);
    expect(historyRaw.plugins['plugin-a']).toHaveLength(2);
    expect(historyRaw.plugins['plugin-a'][0].stars).toBe(100);
    expect(historyRaw.updatedAt).toBe(secondTime.toISOString());

    const loadedAgain = await loadExisting(directory);
    expect(loadedAgain.latest?.generatedAt).toBe(secondTime.toISOString());
    expect(loadedAgain.history?.plugins['plugin-a']).toHaveLength(2);
  });

  it('writes a failed status without overwriting the last successful latest snapshot', async () => {
    const directory = await temporaryDirectory();
    const latest = makeLatest();
    await writeLatest(directory, latest);
    await writeStatus(directory, makeStatus(latest.lastSuccessAt));

    const raw = JSON.parse(await readFile(path.join(directory, 'latest.json'), 'utf8')) as LatestData;
    expect(raw.generatedAt).toBe(latest.generatedAt);
    expect(raw.plugins).toHaveLength(1);
    const status = JSON.parse(await readFile(path.join(directory, 'status.json'), 'utf8')) as StatusFile;
    expect(status.outcome).toBe('failed');
    expect(status.lastSuccessAt).toBe(latest.lastSuccessAt);
  });

  it('retains only the requested number of full snapshots', async () => {
    const directory = await temporaryDirectory();
    const first = makeLatest();
    await writeSnapshot(directory, first, 1);
    const secondTime = new Date(NOW.getTime() + 1000);
    const second = makeLatest(secondTime.toISOString());
    await writeSnapshot(directory, second, 1);
    const snapshots = (await readdir(path.join(directory, 'snapshots'))).filter((file) =>
      file.endsWith('.json'),
    );
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toContain(secondTime.toISOString().replace(/[:.]/g, '-'));
  });

  it('validates schema versions and copies a complete data bundle for the build', async () => {
    const source = await temporaryDirectory();
    const destination = await temporaryDirectory();
    const latest = makeLatest();
    await writeLatest(source, latest);
    await updateHistory(source, latest, null, NOW);
    await writeStatus(source, makeStatus(latest.lastSuccessAt));

    await copyDataFiles(source, destination);
    const copied = JSON.parse(
      await readFile(path.join(destination, 'latest.json'), 'utf8'),
    ) as LatestData;
    expect(copied.plugins).toHaveLength(1);

    expect(() => assertLatestData({ ...latest, schemaVersion: 999 })).toThrow(/schemaVersion/);
    expect(() =>
      assertHistory({
        schemaVersion: HISTORY_SCHEMA_VERSION,
        updatedAt: NOW.toISOString(),
        retentionDays: 90,
        plugins: {},
      }),
    ).not.toThrow();
  });
});


it('a corrupt incoming count cannot overwrite the previous good snapshot',async()=>{
  const directory=await temporaryDirectory();
  const good=makeLatest();await writeLatest(directory,good);
  const bad=structuredClone(good);bad.plugins[0].github.stars=-1;
  await expect(writeLatest(directory,bad)).rejects.toThrow('数据契约');
  expect(JSON.parse(await readFile(path.join(directory,'latest.json'),'utf8')).plugins[0].github.stars).toBe(good.plugins[0].github.stars);
});

it('stale fallback records do not manufacture a fresh history point',async()=>{
  const directory=await temporaryDirectory();const first=makeLatest();
  const history=await updateHistory(directory,first,null,NOW);
  const second=makeLatest(new Date(NOW.getTime()+3600000).toISOString());second.plugins[0].dataStatus='stale';
  const updated=await updateHistory(directory,second,history,new Date(second.generatedAt));
  expect(updated.plugins['plugin-a']).toHaveLength(1);
});

it('invalid history entries are isolated while valid stored latest remains readable',async()=>{
  const directory=await temporaryDirectory();const good=makeLatest();await writeLatest(directory,good);
  await writeFile(path.join(directory,'history.json'),JSON.stringify({schemaVersion:1,updatedAt:NOW.toISOString(),retentionDays:90,plugins:{bad:'broken'}}));
  const loaded=await loadExisting(directory);expect(loaded.latest?.plugins).toHaveLength(1);expect(loaded.history?.plugins).toEqual({});
});

async function controlTestDirectory(): Promise<string> {
  const directory=await temporaryDirectory();
  const latest=makeLatest();
  await writeLatest(directory,latest);
  await updateHistory(directory,latest,null,NOW);
  await writeStatus(directory,makeStatus(latest.lastSuccessAt));
  return directory;
}

it('publishes the manual-only default for legacy data without a control file',async()=>{
  const source=await controlTestDirectory(),destination=await temporaryDirectory();
  await copyDataFiles(source,destination);
  expect(JSON.parse(await readFile(path.join(destination,'collection-control.json'),'utf8'))).toEqual({
    version:1,automaticPaused:true,updatedAt:null,updatedBy:null,
  });
});

it('keeps a paused control state during ordinary and in-place data builds',async()=>{
  const source=await controlTestDirectory(),destination=await temporaryDirectory();
  const control={version:1,automaticPaused:true,updatedAt:NOW.toISOString(),updatedBy:'project-maintainer'};
  await writeFile(path.join(source,'collection-control.json'),JSON.stringify(control));
  await copyDataFiles(source,source);
  await copyDataFiles(source,destination);
  expect(JSON.parse(await readFile(path.join(destination,'collection-control.json'),'utf8'))).toEqual(control);
});

it('invalid control data blocks publication and preserves the last valid destination',async()=>{
  const source=await controlTestDirectory(),destination=await controlTestDirectory();
  await writeFile(path.join(source,'collection-control.json'),JSON.stringify({version:1,automaticPaused:'false'}));
  const before=await readFile(path.join(destination,'latest.json'),'utf8');
  await expect(copyDataFiles(source,destination)).rejects.toThrow('采集控制文件不可用');
  expect(await readFile(path.join(destination,'latest.json'),'utf8')).toBe(before);
});
