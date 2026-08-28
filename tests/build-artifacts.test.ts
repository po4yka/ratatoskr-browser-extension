import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

type Manifest = {
  background?: { scripts?: string[]; service_worker?: string };
  action?: { default_popup?: string };
  options_ui?: { page?: string };
  icons?: Record<string, string>;
};

function referencedPaths(manifest: Manifest): string[] {
  const candidates = [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...Object.values(manifest.icons ?? {}),
  ];
  return candidates.filter((path) => typeof path === 'string');
}

describe('build artifacts', () => {
  it('produces a complete distribution directory', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ratatoskr-build-'));
    try {
      await expect(
        execFileAsync(
          'node',
          ['scripts/build.mjs', '--target', 'chromium', '--out-dir', outDir],
          { cwd: repoRoot },
        ),
      ).resolves.toBeTruthy();

      const targetRoot = join(outDir, 'chromium');
      const manifestPath = join(targetRoot, 'manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

      const missing = referencedPaths(manifest).filter((p) => !existsSync(join(targetRoot, p)));
      expect(missing, 'files referenced by the manifest').toEqual([]);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
