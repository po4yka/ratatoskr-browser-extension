import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'ratatoskr-release-upload-'));
const distDir = join(workDir, 'dist');
const releaseDir = join(workDir, 'release');
const listingDir = join(workDir, 'listing');
const commonArgs = [
  'scripts/release-upload.mjs',
  '--store',
  'all',
  '--dist-dir',
  distDir,
  '--release-dir',
  releaseDir,
  '--listing-dir',
  listingDir,
];

beforeAll(async () => {
  await execFileAsync('node', ['scripts/build.mjs', '--target', 'all', '--out-dir', distDir], {
    cwd: repoRoot,
  });
  await execFileAsync(
    'node',
    ['scripts/package.mjs', '--dist-dir', distDir, '--out-dir', releaseDir],
    { cwd: repoRoot },
  );
  await execFileAsync('node', ['scripts/generate-store-assets.mjs', '--out-dir', listingDir], {
    cwd: repoRoot,
  });
});

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe('release upload boundary', () => {
  it('missing credentials lists exact names without a request', async () => {
    const execution = execFileAsync('node', [...commonArgs, '--execute'], {
      cwd: repoRoot,
      env: { PATH: process.env['PATH'] ?? '' },
    });
    await expect(execution).rejects.toMatchObject({ code: 2 });
    try {
      await execution;
    } catch (error) {
      const stderr = (error as { stderr: string }).stderr;
      const blocker = JSON.parse(stderr) as {
        stores: Array<{ missing_credentials: string[]; store: string }>;
      };
      expect(blocker.stores).toEqual([
        {
          store: 'chromium',
          missing_credentials: [
            'CWS_CLIENT_ID',
            'CWS_CLIENT_SECRET',
            'CWS_REFRESH_TOKEN',
            'CWS_PUBLISHER_ID',
            'CWS_EXTENSION_ID',
          ],
        },
        {
          store: 'firefox',
          missing_credentials: ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET'],
        },
      ]);
      expect(stderr).not.toMatch(/ya29|user:[0-9]|client_secret=/);
    }
  });

  it('dry-run never mutates a store and exposes reviewed request shapes', async () => {
    const { stdout, stderr } = await execFileAsync('node', commonArgs, { cwd: repoRoot });
    expect(stderr).toBe('');
    const plan = JSON.parse(stdout) as {
      mode: string;
      stores: Array<{ request: { command?: string; upload_path?: string }; store: string }>;
    };
    expect(plan.mode).toBe('dry-run');
    expect(plan.stores).toEqual([
      {
        store: 'chromium',
        request: {
          upload_path: '/upload/v2/publishers/{CWS_PUBLISHER_ID}/items/{CWS_EXTENSION_ID}:upload',
          publish_path: '/v2/publishers/{CWS_PUBLISHER_ID}/items/{CWS_EXTENSION_ID}:publish',
        },
      },
      {
        store: 'firefox',
        request: {
          command: 'web-ext sign --channel listed --no-input --no-config-discovery',
        },
      },
    ]);
  });
});
