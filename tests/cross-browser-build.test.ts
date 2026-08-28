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
  manifest_version?: number;
  name?: string;
};

function referencedPaths(manifest: Manifest): string[] {
  return [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...Object.values(manifest.icons ?? {}),
  ].filter((path): path is string => typeof path === 'string');
}

describe('cross-browser build matrix', () => {
  it('builds complete Chromium and Firefox trees', async () => {
    const outRoot = mkdtempSync(join(tmpdir(), 'ratatoskr-cross-browser-build-'));
    try {
      await execFileAsync(
        'node',
        ['scripts/build.mjs', '--target', 'all', '--out-dir', outRoot],
        { cwd: repoRoot },
      );

      for (const target of ['chromium', 'firefox']) {
        const targetRoot = join(outRoot, target);
        const manifestPath = join(targetRoot, 'manifest.json');
        expect(existsSync(manifestPath), `${target} manifest`).toBe(true);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.name).toBe('__MSG_extensionName__');
        expect(
          referencedPaths(manifest).filter((path) => !existsSync(join(targetRoot, path))),
          `${target} manifest references`,
        ).toEqual([]);
      }
    } finally {
      rmSync(outRoot, { recursive: true, force: true });
    }
  });
});
