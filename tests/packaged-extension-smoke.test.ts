import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

describe('packaged extension smoke', () => {
  it('validates both packaged targets and reports their digests', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ratatoskr-package-smoke-'));
    const distDir = join(workDir, 'dist');
    const releaseDir = join(workDir, 'release');
    try {
      await execFileAsync(
        'node',
        ['scripts/build.mjs', '--target', 'all', '--out-dir', distDir],
        { cwd: repoRoot },
      );
      await execFileAsync(
        'node',
        ['scripts/package.mjs', '--dist-dir', distDir, '--out-dir', releaseDir],
        { cwd: repoRoot },
      );
      const { stdout } = await execFileAsync(
        'node',
        ['scripts/package-smoke.mjs', '--release-dir', releaseDir],
        { cwd: repoRoot },
      );
      const result = JSON.parse(stdout) as { artifacts: Array<{ sha256: string; target: string }> };
      expect(result.artifacts.map(({ target }) => target)).toEqual(['chromium', 'firefox']);
      expect(result.artifacts.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal entries', async () => {
    const releaseDir = mkdtempSync(join(tmpdir(), 'ratatoskr-unsafe-package-'));
    try {
      mkdirSync(releaseDir, { recursive: true });
      writeFileSync(
        join(releaseDir, 'ratatoskr-browser-extension-0.1.0-chromium.zip'),
        Buffer.from(zipSync({ '../escape.txt': new Uint8Array([1]) })),
      );
      await expect(
        execFileAsync('node', ['scripts/package-smoke.mjs', '--release-dir', releaseDir], {
          cwd: repoRoot,
        }),
      ).rejects.toMatchObject({ stderr: expect.stringContaining('unsafe archive entry') });
    } finally {
      rmSync(releaseDir, { recursive: true, force: true });
    }
  });
});
