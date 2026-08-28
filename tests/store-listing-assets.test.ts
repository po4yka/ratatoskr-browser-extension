import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function filesUnder(root: string, dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? filesUnder(root, path) : [relative(root, path)];
    })
    .sort();
}

function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('store listing assets', () => {
  it('reproduces target descriptions, PNG screenshots, and checksum index', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ratatoskr-store-assets-'));
    const first = join(workDir, 'first');
    const second = join(workDir, 'second');
    try {
      for (const outDir of [first, second]) {
        await execFileAsync('node', ['scripts/generate-store-assets.mjs', '--out-dir', outDir], {
          cwd: repoRoot,
        });
      }
      expect(filesUnder(first)).toEqual(filesUnder(second));
      for (const relativePath of filesUnder(first)) {
        expect(digest(join(first, relativePath)), relativePath).toBe(
          digest(join(second, relativePath)),
        );
      }

      for (const target of ['chromium', 'firefox']) {
        const description = readFileSync(join(first, target, 'en-US', 'description.txt'), 'utf8');
        expect(description).toContain('Explicitly save');
        expect(description).toContain('activeTab, alarms, contextMenus, storage');
        expect(description).not.toMatch(/automatically captures|native bookmark synchronization|zero permissions/i);

        const screenshotPath = join(
          first,
          target,
          'en-US',
          'screenshots',
          '01-explicit-capture.png',
        );
        const screenshot = readFileSync(screenshotPath);
        expect(screenshot.subarray(0, 8)).toEqual(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        );
        expect(screenshot.readUInt32BE(16)).toBe(1280);
        expect(screenshot.readUInt32BE(20)).toBe(800);
        expect(statSync(screenshotPath).size).toBeGreaterThan(1_000);
      }
      expect(readFileSync(join(first, 'SHA256SUMS'), 'utf8')).toMatch(
        /[a-f0-9]{64}\s{2}chromium\/en-US\/screenshots\/01-explicit-capture\.png/,
      );
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
