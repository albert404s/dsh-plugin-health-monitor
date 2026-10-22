import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJson, assertHistory, assertLatestData, assertStatus } from './lib/store';

import { parseCollectionControl, defaultCollectionControl, parseCollectionSettings, defaultCollectionSettings } from '../src/lib/collection-control';

import { parseCollectionReport } from '../src/lib/collection-report';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = process.env.DATA_REPO_SLUG || 'albert404s/dsh-plugin-health-monitor';
const BRANCH = process.env.DATA_BRANCH || 'data';

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPO)) {
  throw new Error('DATA_REPO_SLUG 必须是 owner/repo 形式');
}
if (!/^[A-Za-z0-9._/-]+$/.test(BRANCH) || BRANCH.includes('..')) {
  throw new Error('DATA_BRANCH 含有不安全字符');
}

async function fetchJson(file: string, missingValue?: unknown): Promise<unknown> {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${file}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'dsh-plugin-health-monitor-data-pull' },
    signal: AbortSignal.timeout(30_000),
  });
  if (missingValue !== undefined && response.status === 404) return missingValue;
  if (!response.ok) {
    throw new Error(`无法下载 ${url}：HTTP ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function main(): Promise<void> {
  console.log(`[data:pull] ${REPO}@${BRANCH} → public/data`);
  const [latest, history, status, rawControl, rawSettings, rawReport] = await Promise.all([
    fetchJson('latest.json'),
    fetchJson('history.json'),
    fetchJson('status.json'),
    fetchJson('collection-control.json', defaultCollectionControl()),
    fetchJson('collection-settings.json', defaultCollectionSettings()),
    fetchJson('collection-report.json', null).catch(() => null),
  ]);
  assertLatestData(latest);
  assertHistory(history);
  assertStatus(status);
  const control = parseCollectionControl(rawControl);
  const settings = parseCollectionSettings(rawSettings);
  const destination = path.join(ROOT, 'public', 'data');
  await Promise.all([
    atomicWriteJson(path.join(destination, 'latest.json'), latest),
    atomicWriteJson(path.join(destination, 'history.json'), history),
    atomicWriteJson(path.join(destination, 'status.json'), status),
    atomicWriteJson(path.join(destination, 'collection-control.json'), control),
    atomicWriteJson(path.join(destination, 'collection-settings.json'), settings),
    atomicWriteJson(path.join(destination, 'collection-report.json'), parseCollectionReport(rawReport)),
  ]);
  console.log(`[data:pull] saved ${latest.plugins.length} plugins (snapshot ${latest.lastSuccessAt})`);
}

main().catch((error) => {
  console.error('[data:pull] failed:', error);
  console.error(
    '[data:pull] 如果远端尚未创建 data 分支，请先运行 npm run collect（需要 GitHub Token）。',
  );
  process.exitCode = 1;
});
