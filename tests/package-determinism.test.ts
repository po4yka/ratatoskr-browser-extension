import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const archives = [
  'ratatoskr-browser-extension-0.1.0-chromium.zip',
  'ratatoskr-browser-extension-0.1.0-firefox.zip',
];

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function entryTimestamps(zipPath: string): Array<{ time: number; date: number }> {
  const buf = readFileSync(zipPath);
  const stamps: Array<{ time: number; date: number }> = [];
  let offset = 0;
  while (offset + 30 <= buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
    stamps.push({ time: buf.readUInt16LE(offset + 10), date: buf.readUInt16LE(offset + 12) });
    offset +=
      30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28) + buf.readUInt32LE(offset + 18);
  }
  return stamps;
}

describe('package determinism', () => {
  it('reproduces both target archives and SHA256SUMS', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ratatoskr-package-matrix-'));
    const distDir = join(workDir, 'dist');
    const releaseA = join(workDir, 'release-a');
    const releaseB = join(workDir, 'release-b');
    try {
      await execFileAsync(
        'node',
        ['scripts/build.mjs', '--target', 'all', '--out-dir', distDir],
        { cwd: repoRoot },
      );
      for (const outDir of [releaseA, releaseB]) {
        await execFileAsync(
          'node',
          ['scripts/package.mjs', '--dist-dir', distDir, '--out-dir', outDir],
          { cwd: repoRoot },
        );
      }

      for (const name of archives) {
        const first = join(releaseA, name);
        const second = join(releaseB, name);
        expect(existsSync(first), name).toBe(true);
        expect(statSync(first).size).toBeGreaterThan(0);
        expect(sha256(first), name).toBe(sha256(second));
        for (const stamp of entryTimestamps(first)) {
          expect(stamp).toEqual({ time: 0, date: 0x0021 });
        }
      }
      expect(readFileSync(join(releaseA, 'SHA256SUMS'), 'utf8')).toBe(
        readFileSync(join(releaseB, 'SHA256SUMS'), 'utf8'),
      );
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
