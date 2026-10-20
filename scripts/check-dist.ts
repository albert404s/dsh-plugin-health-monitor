import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');
const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bnpm_[A-Za-z0-9]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN)\s*=\s*[^\s'"`]+/,
  /\bVITE_[A-Z0-9_]*(?:TOKEN|SECRET|KEY)\b/,
];

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
}

async function main(): Promise<void> {
  const files = await walk(DIST);
  const findings: string[] = [];
  for (const file of files) {
    const info = await stat(file);
    if (info.size > 16 * 1024 * 1024) {
      findings.push(`${path.relative(DIST, file)} is larger than the 16 MiB scan limit`);
      continue;
    }
    const text = await readFile(file, 'utf8');
    for (const pattern of TOKEN_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(`${path.relative(DIST, file)} matches ${pattern.source}`);
      }
    }
  }
  if (findings.length > 0) {
    console.error('[check-dist] potential secret material or unscannable file found:');
    for (const finding of findings) console.error(` - ${finding}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[check-dist] scanned all ${files.length} build files; no known token patterns found`,
  );
}

main().catch((error) => {
  console.error('[check-dist] failed:', error);
  process.exitCode = 1;
});
