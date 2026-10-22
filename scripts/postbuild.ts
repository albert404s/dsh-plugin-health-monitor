import { access, copyFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');

async function main(): Promise<void> {
  await access(path.join(DIST, 'index.html'));
  await access(path.join(DIST, 'data', 'latest.json'));
  await access(path.join(DIST, 'data', 'history.json'));
  await access(path.join(DIST, 'data', 'collection-control.json'));
  await copyFile(path.join(DIST, 'index.html'), path.join(DIST, '404.html'));
  await writeFile(path.join(DIST, '.nojekyll'), '', 'utf8');
  // Snapshot copies are only needed on the data branch; the site never
  // requests them. Keep the Pages artifact small.
  await rm(path.join(DIST, 'data', 'snapshots'), { recursive: true, force: true });
  console.log('[postbuild] dist/404.html and dist/.nojekyll created; unused snapshots removed');
}

main().catch((error) => {
  console.error('[postbuild] failed:', error);
  process.exitCode = 1;
});
