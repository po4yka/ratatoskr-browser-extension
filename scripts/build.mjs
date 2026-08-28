import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const supportedTargets = ['chromium', 'firefox'];

function parseArgs(args) {
  let target = 'all';
  let outDir = join(repoRoot, 'dist');
  const setters = {
    '--out-dir': (value) => { outDir = resolve(repoRoot, value); },
    '--target': (value) => { target = value; },
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${flag ?? 'argument'} requires a value`);
    const setter = setters[flag];
    if (setter === undefined) throw new Error(`unknown argument: ${flag}`);
    setter(value);
  }
  if (target !== 'all' && !supportedTargets.includes(target)) {
    throw new Error(`unsupported target: ${target}`);
  }
  return { outDir, targets: target === 'all' ? supportedTargets : [target] };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeManifest(target, outDir) {
  const manifestDir = join(repoRoot, 'src/manifests');
  const base = readJson(join(manifestDir, 'base.json'));
  const delta = readJson(join(manifestDir, `${target}.json`));
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify({ ...base, ...delta }, null, 2)}\n`);
}

function copyStaticFiles(outDir) {
  cpSync(join(repoRoot, 'src/popup/index.html'), join(outDir, 'popup/index.html'));
  cpSync(join(repoRoot, 'src/options/index.html'), join(outDir, 'options/index.html'));
  cpSync(join(repoRoot, 'assets/icons'), join(outDir, 'icons'), { recursive: true });
  cpSync(join(repoRoot, 'src/_locales'), join(outDir, '_locales'), { recursive: true });
  mkdirSync(join(outDir, 'ui'), { recursive: true });
  cpSync(join(repoRoot, 'src/ui/styles.css'), join(outDir, 'ui/styles.css'));
}

async function buildTarget(target, outRoot) {
  const outDir = join(outRoot, target);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  await build({
    entryPoints: [
      join(repoRoot, 'src/background/service-worker.ts'),
      join(repoRoot, 'src/popup/popup.ts'),
      join(repoRoot, 'src/options/options.ts'),
    ],
    outbase: join(repoRoot, 'src'),
    outdir: outDir,
    entryNames: '[dir]/[name]',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: [target === 'chromium' ? 'chrome120' : 'firefox142'],
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'warning',
  });
  writeManifest(target, outDir);
  copyStaticFiles(outDir);
  console.log(`built ${target} extension into ${outDir}`);
}

const options = parseArgs(process.argv.slice(2));
await Promise.all(options.targets.map((target) => buildTarget(target, options.outDir)));
