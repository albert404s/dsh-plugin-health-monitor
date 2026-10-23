import { appendFile } from 'node:fs/promises';
import path from 'node:path';
const {
  decideCollectionAction,
  readCollectionControl,
  stageCollectionArtifact,
  writeCollectionControl, readCollectionSettings, writeCollectionSettings,
} = await import(decodeURI(new URL('./lib/collection-control.ts', import.meta.url).href)) as typeof import('./lib/collection-control');

function argument(name: string): string | undefined {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const dataDir = path.resolve(argument('data-dir') || 'data-store');
  if (command === 'stage') {
    const artifactDir = path.resolve(argument('artifact-dir') || 'artifact-data');
    if (artifactDir === dataDir || artifactDir.startsWith(dataDir + path.sep)) {
      throw new Error('数据 artifact 目录必须独立于源数据目录');
    }
    await stageCollectionArtifact(dataDir, artifactDir);
    console.log('[collection-control] staged snapshot and control file');
    return;
  }
  if (command !== 'gate') throw new Error('用法：collection-control.ts gate|stage --data-dir DIR');
  const current = await readCollectionControl(dataDir);
  const decision = decideCollectionAction(
    process.env.COLLECTION_EVENT || '',
    process.env.COLLECTION_ACTION,
    current,
    process.env.GITHUB_ACTOR,
  );
  const storedSettings = await readCollectionSettings(dataDir);
  if (decision.action === 'configure' || (decision.action === 'refresh' && ['COLLECTION_TARGET_PLUGINS','COLLECTION_MAX_PLUGINS','COLLECTION_MAX_REQUESTS','COLLECTION_GITHUB_RESERVE'].some(key => process.env[key]?.trim()))) {
    const parse = (value: string | undefined, fallback: number): number | string => value?.trim() ? value.trim() : fallback;
    await writeCollectionSettings(dataDir, {
      ...storedSettings,
      targetPlugins: parse(process.env.COLLECTION_TARGET_PLUGINS, storedSettings.targetPlugins) as number,
      maxPlugins: parse(process.env.COLLECTION_MAX_PLUGINS, storedSettings.maxPlugins) as number,
      maxRequests: parse(process.env.COLLECTION_MAX_REQUESTS, storedSettings.maxRequests) as number,
      githubReserve: parse(process.env.COLLECTION_GITHUB_RESERVE, storedSettings.githubReserve) as number,
      updatedAt: new Date().toISOString(), updatedBy: process.env.GITHUB_ACTOR ?? null,
    });
  } else if (decision.controlChanged) await writeCollectionControl(dataDir, decision.control);
  console.log('[collection-control] ' + decision.message);
  if (process.env.GITHUB_OUTPUT) {
    // Only closed-set enum and Boolean values are emitted; no user string interpolation.
    await appendFile(process.env.GITHUB_OUTPUT, [
      'action=' + decision.action,
      'should_collect=' + decision.shouldCollect,
      'control_changed=' + decision.controlChanged,
      '',
    ].join('\n'));
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      '### ORBIT 采集控制\n\n' + decision.message + '\n\n自动采集：**关闭，仅手动**\n',
    );
  }
}

main().catch((error) => {
  console.error('[collection-control] failed:', error);
  process.exitCode = 1;
});
