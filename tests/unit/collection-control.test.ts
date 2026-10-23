import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COLLECTION_CONTROL_FILENAME, defaultCollectionSettings, parseCollectionSettings,
  defaultCollectionControl,
  parseCollectionControl,
  type CollectionControl,
} from '../../src/lib/collection-control';
import {
  decideCollectionAction, readCollectionSettings, writeCollectionSettings,
  readCollectionControl,
  stageCollectionArtifact,
  writeCollectionControl,
} from '../../scripts/lib/collection-control';

const execute = promisify(execFile);
const directories: string[] = [];
const now = new Date('2026-10-22T04:00:00.000Z');
const paused: CollectionControl = {
  version: 1,
  automaticPaused: true,
  updatedAt: now.toISOString(),
  updatedBy: 'albert404s',
};

async function directory(): Promise<string> {
  const result = await mkdtemp(path.join(tmpdir(), 'orbit-control-'));
  directories.push(result);
  return result;
}

async function runGate(dataDir: string, eventName: string, action: string, output: string) {
  return execute(process.execPath, ['scripts/collection-control.ts', 'gate', '--data-dir', dataDir], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COLLECTION_EVENT: eventName,
      COLLECTION_ACTION: action,
      GITHUB_ACTOR: 'albert404s',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: '',
    },
  });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('collection control decisions', () => {
  it('keeps legacy data branches enabled without inventing an operator or change time', async () => {
    expect(await readCollectionControl(await directory())).toEqual(defaultCollectionControl());
  });

  it('runs scheduled collection when enabled and skips all collection when paused', () => {
    expect(decideCollectionAction('schedule', undefined, defaultCollectionControl(), undefined, now).shouldCollect).toBe(true);
    expect(decideCollectionAction('schedule', 'resume', paused, undefined, now)).toMatchObject({
      action: 'scheduled', shouldCollect: false, controlChanged: false, control: paused,
    });
  });

  it('allows a single manual refresh while preserving the pause switch', () => {
    const decision = decideCollectionAction('workflow_dispatch', 'refresh', paused, 'albert404s', now);
    expect(decision).toMatchObject({ action: 'refresh', shouldCollect: true, controlChanged: false, control: paused });
    expect(decideCollectionAction('workflow_dispatch', '', paused, 'albert404s', now).action).toBe('refresh');
  });

  it.each([
    ['pause', true],
    ['resume', false],
  ] as const)('%s changes only the automatic switch and audit fields without collecting', (action, automaticPaused) => {
    const decision = decideCollectionAction('workflow_dispatch', action, defaultCollectionControl(), 'albert404s', now);
    expect(decision).toMatchObject({
      action, shouldCollect: false, controlChanged: true,
      control: { version: 1, automaticPaused, updatedAt: now.toISOString(), updatedBy: 'albert404s' },
    });
  });

  it('rejects unknown actions, unsupported triggers and invalid operators', () => {
    expect(() => decideCollectionAction('workflow_dispatch', 'pause; echo bad', paused, 'actor', now)).toThrow('action');
    expect(() => decideCollectionAction('pull_request', 'refresh', paused, 'actor', now)).toThrow('触发事件');
    expect(() => decideCollectionAction('workflow_dispatch', 'pause', paused, undefined, now)).toThrow('校验失败');
    expect(() => decideCollectionAction('workflow_dispatch', 'pause', paused, 'actor\nbad', now)).toThrow('校验失败');
  });

  it.each([
    { ...paused, version: 2 },
    { ...paused, automaticPaused: 'false' },
    { ...paused, updatedAt: '2026-99-99T04:00:00Z' },
    { ...paused, updatedAt: '2026-02-30T04:00:00Z' },
    { ...paused, updatedAt: '2026-10-22T12:00:00+08:00' },
    { ...paused, updatedBy: null },
    { ...paused, updatedAt: null, updatedBy: null },
    { ...paused, unexpected: true },
  ])('rejects ambiguous or invalid stored control state %#', (value) => {
    expect(() => parseCollectionControl(value)).toThrow('校验失败');
  });

  it('accepts GitHub automation actors as audit identities', () => {
    expect(parseCollectionControl({ ...paused, updatedBy: 'github-actions[bot]' }).updatedBy).toBe('github-actions[bot]');
  });

  it.each(['{', '{"version": 1, "automaticPaused": "false"}', 'null'])(
    'does not silently re-enable automatic collection after malformed state %#',
    async (raw) => {
      const dataDir = await directory();
      await writeFile(path.join(dataDir, COLLECTION_CONTROL_FILENAME), raw);
      await expect(readCollectionControl(dataDir)).rejects.toThrow('阻止本次操作');
    },
  );
});

describe('control-only artifact and workflow CLI', () => {
  it('runs the native gate from an isolated checkout without node_modules or a TypeScript loader', async () => {
    const isolated = await directory();
    const dataDir = path.join(isolated, 'data-store');
    const output = path.join(isolated, 'outputs');
    const files = ['scripts/collection-control.ts', 'scripts/lib/collection-control.ts', 'src/lib/collection-control.ts'];
    for (const file of files) {
      const destination = path.join(isolated, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, await readFile(path.resolve(file), 'utf8'));
    }
    await writeFile(path.join(isolated, 'package.json'), '{"type":"module"}');
    await writeCollectionControl(dataDir, paused);
    await execute(process.execPath, [path.join(isolated, 'scripts/collection-control.ts'), 'gate', '--data-dir', dataDir], {
      cwd: isolated,
      env: { ...process.env, COLLECTION_EVENT: 'schedule', COLLECTION_ACTION: '', GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: '' },
    });
    expect(await readFile(output, 'utf8')).toContain('should_collect=false');
    expect(await readdir(isolated)).not.toContain('node_modules');
  });

  it('stages a control change without altering or regenerating any snapshot bytes', async () => {
    const source = await directory();
    const artifact = await directory();
    const payloads: Record<string, string> = {
      'latest.json': '{ "snapshot": "old" }\n',
      'history.json': '{ "history": ["previous"] }\n',
      'status.json': '{ "lastSuccessAt": "old" }\n',
    };
    for (const [name, content] of Object.entries(payloads)) await writeFile(path.join(source, name), content);
    await mkdir(path.join(source, 'snapshots'));
    await writeFile(path.join(source, 'snapshots', 'old.json'), 'snapshot bytes');
    const before = await readdir(source);
    await writeCollectionControl(source, paused);
    await stageCollectionArtifact(source, artifact);
    for (const [name, content] of Object.entries(payloads)) {
      expect(await readFile(path.join(source, name), 'utf8')).toBe(content);
      expect(await readFile(path.join(artifact, name), 'utf8')).toBe(content);
    }
    expect(await readFile(path.join(artifact, 'snapshots', 'old.json'), 'utf8')).toBe('snapshot bytes');
    expect(await readCollectionControl(artifact)).toEqual(paused);
    expect((await readdir(source)).sort()).toEqual([...before, COLLECTION_CONTROL_FILENAME].sort());
  });

  it('publishes an explicit default control file for a legacy artifact', async () => {
    const source = await directory();
    const artifact = await directory();
    for (const name of ['latest.json', 'history.json', 'status.json']) {
      await writeFile(path.join(source, name), '{}\n');
    }
    await stageCollectionArtifact(source, artifact);
    expect(JSON.parse(await readFile(path.join(artifact, COLLECTION_CONTROL_FILENAME), 'utf8'))).toEqual(defaultCollectionControl());
    expect(await readdir(source)).not.toContain(COLLECTION_CONTROL_FILENAME);
  });

  it('emits a skipped schedule without modifying the paused state', async () => {
    const source = await directory();
    const output = path.join(await directory(), 'outputs');
    await writeCollectionControl(source, paused);
    const before = await readFile(path.join(source, COLLECTION_CONTROL_FILENAME), 'utf8');
    const result = await runGate(source, 'schedule', '', output);
    expect(result.stdout).toContain('跳过采集');
    expect(await readFile(output, 'utf8')).toContain('should_collect=false');
    expect(await readFile(output, 'utf8')).toContain('control_changed=false');
    expect(await readFile(path.join(source, COLLECTION_CONTROL_FILENAME), 'utf8')).toBe(before);
  });

  it('persists only the local control change for a manual pause and emits the control-only route', async () => {
    const source = await directory();
    const output = path.join(await directory(), 'outputs');
    await writeFile(path.join(source, 'latest.json'), 'untouched');
    await runGate(source, 'workflow_dispatch', 'pause', output);
    expect(await readCollectionControl(source)).toMatchObject({ automaticPaused: true, updatedBy: 'albert404s' });
    expect(await readFile(path.join(source, 'latest.json'), 'utf8')).toBe('untouched');
    expect(await readFile(output, 'utf8')).toBe('action=pause\nshould_collect=false\ncontrol_changed=true\n');
  });

  it('fails closed without emitting a collect decision when persisted control is corrupt', async () => {
    const source = await directory();
    const output = path.join(await directory(), 'outputs');
    await writeFile(path.join(source, COLLECTION_CONTROL_FILENAME), '{"automaticPaused":"no"}');
    await expect(runGate(source, 'schedule', '', output)).rejects.toMatchObject({ code: 1 });
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(path.join(source, COLLECTION_CONTROL_FILENAME), 'utf8')).toBe('{"automaticPaused":"no"}');
  });
});

it('validates saved collection limits without confusing a display limit with collection scope',async()=>{
  const source=await directory();
  expect(await readCollectionSettings(source)).toEqual(defaultCollectionSettings());
  const settings={...defaultCollectionSettings(),maxPlugins:100,maxRequests:600,githubReserve:100};
  await writeCollectionSettings(source,settings);
  expect(await readCollectionSettings(source)).toEqual(settings);
  for(const bad of [{...settings,maxPlugins:0},{...settings,maxRequests:'1e3'},{...settings,githubReserve:-1},{...settings,extra:true}]) {
    expect(()=>parseCollectionSettings(bad)).toThrow();
  }
});
it('configure selects a no-collection deployment without changing the automatic switch',()=>{
  const result=decideCollectionAction('workflow_dispatch','configure',paused,'albert404s',now);
  expect(result).toMatchObject({action:'configure',shouldCollect:false,controlChanged:true,control:paused});
});
it('the configure CLI saves bounded numeric settings and keeps snapshot and pause bytes',async()=>{
  const source=await directory(),output=path.join(await directory(),'output');
  await writeCollectionControl(source,paused);
  await writeFile(path.join(source,'latest.json'),'previous-snapshot');
  await execute(process.execPath,['scripts/collection-control.ts','gate','--data-dir',source],{cwd:process.cwd(),env:{
    ...process.env,COLLECTION_EVENT:'workflow_dispatch',COLLECTION_ACTION:'configure',COLLECTION_MAX_PLUGINS:'50',COLLECTION_MAX_REQUESTS:'300',COLLECTION_GITHUB_RESERVE:'80',GITHUB_ACTOR:'albert404s',GITHUB_OUTPUT:output,GITHUB_STEP_SUMMARY:'',
  }});
  expect(await readCollectionControl(source)).toEqual(paused);
  expect(await readFile(path.join(source,'latest.json'),'utf8')).toBe('previous-snapshot');
  expect(await readCollectionSettings(source)).toMatchObject({maxPlugins:50,maxRequests:300,githubReserve:80,updatedBy:'albert404s'});
  expect(await readFile(output,'utf8')).toContain('should_collect=false');
});

it('legacy settings migrate without mistaking the per-run ceiling for a catalog target',()=>{
 const defaults=defaultCollectionSettings();
 const {targetPlugins:_target,...legacy}=defaults;
 expect(parseCollectionSettings(legacy)).toMatchObject({targetPlugins:20,maxPlugins:100});
 for(const targetPlugins of [0,null,1.5,1001,'oops']) expect(()=>parseCollectionSettings({...legacy,targetPlugins})).toThrow();
 expect(parseCollectionSettings({...legacy,targetPlugins:50})).toMatchObject({targetPlugins:50,maxPlugins:100});
});
it('refresh accepts a target and budget in one run without changing the paused switch',async()=>{
 const source=await directory(),output=path.join(await directory(),'output');
 await writeCollectionControl(source,paused);
 await execute(process.execPath,['scripts/collection-control.ts','gate','--data-dir',source],{cwd:process.cwd(),env:{
 ...process.env,COLLECTION_EVENT:'workflow_dispatch',COLLECTION_ACTION:'refresh',COLLECTION_TARGET_PLUGINS:'50',COLLECTION_MAX_PLUGINS:'25',COLLECTION_MAX_REQUESTS:'800',COLLECTION_GITHUB_RESERVE:'100',GITHUB_ACTOR:'albert404s',GITHUB_OUTPUT:output,GITHUB_STEP_SUMMARY:''}});
 expect(await readCollectionControl(source)).toEqual(paused);
 expect(await readCollectionSettings(source)).toMatchObject({targetPlugins:50,maxPlugins:25,maxRequests:800});
 expect(await readFile(output,'utf8')).toContain('should_collect=true');
 expect(await readFile(output,'utf8')).toContain('control_changed=false');
});
