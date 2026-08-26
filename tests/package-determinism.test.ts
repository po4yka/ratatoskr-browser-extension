import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

async function packageDist(distDir: string, outZip: string): Promise<void> {
  await expect(
    execFileAsync('node', ['scripts/package.mjs', distDir, outZip], { cwd: repoRoot }),
  ).resolves.toBeTruthy();
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Walks the chain of local file headers (signature 0x04034b50) and collects
// each entry's raw DOS modification time and date fields.
function entryTimestamps(zipPath: string): Array<{ time: number; date: number }> {
  const buf = readFileSync(zipPath);
  const stamps: Array<{ time: number; date: number }> = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    stamps.push({ time: buf.readUInt16LE(offset + 10), date: buf.readUInt16LE(offset + 12) });
    const compressedSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    offset += 30 + nameLen + extraLen + compressedSize;
  }
  return stamps;
}

describe('package determinism', () => {
  it('golden determinism check', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ratatoskr-package-'));
    const distDir = join(workDir, 'dist');
    const zipA = join(workDir, 'a.zip');
    const zipB = join(workDir, 'b.zip');
    try {
      await execFileAsync('node', ['scripts/build.mjs', distDir], { cwd: repoRoot });

      await packageDist(distDir, zipA);
      await packageDist(distDir, zipB);

      for (const zip of [zipA, zipB]) {
        expect(existsSync(zip)).toBe(true);
        expect(statSync(zip).size).toBeGreaterThan(0);
      }

      // Golden property: separate processes over the same tree produce
      // byte-identical archives.
      expect(sha256(zipA)).toBe(sha256(zipB));

      // Timestamps are pinned, not taken from the wall clock or filesystem.
      // DOS date 0x0021 decodes to 1980-01-01.
      const stamps = entryTimestamps(zipA);
      expect(stamps.length).toBeGreaterThan(0);
      for (const stamp of stamps) {
        expect(stamp.time).toBe(0);
        expect(stamp.date).toBe(0x0021);
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
