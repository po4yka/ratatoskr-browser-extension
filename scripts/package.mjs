// Packaging script: zips a built distribution directory deterministically.
// Entry order is sorted path order, every entry timestamp is pinned to
// 1980-01-01 00:00 local (identical fields on every host), and the compression
// level is fixed, so repackaging an unchanged tree yields byte-identical
// archives (verified by tests/package-determinism.test.ts).
import { zipSync } from 'fflate';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
// fflate derives the zip's DOS timestamp fields from local-time getters, so the
// pin is constructed with local-time arguments: every host, whatever its
// timezone, writes the same fields (1980-01-01 00:00, the zip format's floor).
const PINNED_MTIME = new Date(1980, 0, 1, 0, 0, 0);

// Defaults: dist/ as the tree to package, release/<name>-<version>.zip as the output.
const distDir = resolve(repoRoot, process.argv[2] ?? 'dist');
const outArg = process.argv[3];

function defaultOutputPath() {
  const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'));
  const version = typeof manifest.version === 'string' ? manifest.version : '0.0.0';
  return join(repoRoot, 'release', `ratatoskr-browser-extension-${version}.zip`);
}
const outZip =
  outArg === undefined || outArg.trim() === '' ? defaultOutputPath() : resolve(repoRoot, outArg);

function collectFiles(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...collectFiles(child, rel));
    } else if (entry.isFile()) {
      found.push(rel);
    }
  }
  return found.sort();
}

const entries = collectFiles(distDir);
if (!entries.includes('manifest.json')) {
  console.error(`no manifest.json in ${distDir}; run the build first`);
  process.exit(1);
}

const zipped = {};
for (const rel of entries) {
  zipped[rel] = [readFileSync(join(distDir, rel)), { level: 9, mtime: PINNED_MTIME }];
}

const archive = zipSync(zipped);

mkdirSync(resolve(outZip, '..'), { recursive: true });
writeFileSync(outZip, Buffer.from(archive));

console.log(`packaged ${entries.length} files into ${outZip}`);
