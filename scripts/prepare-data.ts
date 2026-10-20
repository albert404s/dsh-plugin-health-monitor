import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyDataFiles } from './lib/store';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function argument(name: string): string | null {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

async function main(): Promise<void> {
  const destination = path.resolve(
    argument('dest') ?? path.join(ROOT, 'public', 'data'),
  );
  const explicitSource = argument('source') ?? process.env.DATA_SOURCE;
  let source: string;

  if (explicitSource) {
    source = path.resolve(explicitSource);
  } else if (existsSync(path.join(ROOT, 'data-store', 'latest.json'))) {
    source = path.join(ROOT, 'data-store');
  } else {
    source = destination;
  }

  if (source !== destination) {
    await copyDataFiles(source, destination);
    console.log(`[prepare-data] ${source} → ${destination}`);
  } else {
    // Re-read and validate so a broken or half-written local snapshot cannot
    // silently reach the build.
    await copyDataFiles(source, destination);
    console.log(`[prepare-data] validated in place: ${destination}`);
  }
}

main().catch((error) => {
  console.error('[prepare-data] failed:', error);
  process.exitCode = 1;
});
