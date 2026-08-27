// Build script: bundles the extension entry points into a distribution
// directory. Output names are fixed (no hashes) and nothing time-dependent is
// emitted, so repeated builds over an unchanged tree are byte-identical.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
// Default output is dist/; tests and callers may target another directory.
const outDir = resolve(repoRoot, process.argv[2] ?? 'dist');

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
  target: ['chrome120'],
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});

cpSync(join(repoRoot, 'src/manifest.json'), join(outDir, 'manifest.json'));
cpSync(join(repoRoot, 'src/popup/index.html'), join(outDir, 'popup/index.html'));
cpSync(join(repoRoot, 'src/options/index.html'), join(outDir, 'options/index.html'));
cpSync(join(repoRoot, 'assets/icons'), join(outDir, 'icons'), { recursive: true });
cpSync(join(repoRoot, 'src/_locales'), join(outDir, '_locales'), { recursive: true });
mkdirSync(join(outDir, 'ui'), { recursive: true });
cpSync(join(repoRoot, 'src/ui/styles.css'), join(outDir, 'ui/styles.css'));

console.log(`built extension into ${outDir}`);
