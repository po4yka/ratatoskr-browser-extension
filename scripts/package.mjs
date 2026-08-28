import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pinnedMtime = new Date(1980, 0, 1, 0, 0, 0);
const targets = ['chromium', 'firefox'];

function parseArgs(args) {
  let distDir = join(repoRoot, 'dist');
  let outDir = join(repoRoot, 'release');
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${flag ?? 'argument'} requires a value`);
    if (flag === '--dist-dir') distDir = resolve(repoRoot, value);
    else if (flag === '--out-dir') outDir = resolve(repoRoot, value);
    else throw new Error(`unknown argument: ${flag}`);
  }
  return { distDir, outDir };
}

function collectFiles(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...collectFiles(child, relative));
    else if (entry.isFile()) found.push(relative);
  }
  return found.sort();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function packageTarget(target, paths) {
  const targetDir = join(paths.distDir, target);
  const entries = collectFiles(targetDir);
  if (!entries.includes('manifest.json')) throw new Error(`no manifest.json for ${target}`);
  const manifest = JSON.parse(readFileSync(join(targetDir, 'manifest.json'), 'utf8'));
  if (typeof manifest.version !== 'string') throw new Error(`invalid ${target} manifest version`);
  const zipped = {};
  for (const relative of entries) {
    zipped[relative] = [readFileSync(join(targetDir, relative)), { level: 9, mtime: pinnedMtime }];
  }
  const archive = Buffer.from(zipSync(zipped));
  const name = `ratatoskr-browser-extension-${manifest.version}-${target}.zip`;
  writeFileSync(join(paths.outDir, name), archive);
  return { digest: sha256(archive), name, version: manifest.version };
}

const { distDir, outDir } = parseArgs(process.argv.slice(2));
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const artifacts = targets.map((target) => packageTarget(target, { distDir, outDir }));
if (new Set(artifacts.map(({ version }) => version)).size !== 1) {
  throw new Error('target manifest versions differ');
}
const checksums = artifacts
  .map(({ digest, name }) => `${digest}  ${name}`)
  .sort()
  .join('\n');
writeFileSync(join(outDir, 'SHA256SUMS'), `${checksums}\n`);
console.log(`packaged ${artifacts.length} target archives into ${outDir}`);
