import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'ratatoskr-workspace-smoke-'));
const distDir = join(workDir, 'dist');
const releaseDir = join(workDir, 'release');
const workspaceRoot = join(workDir, 'workspace');
const profile = 'integration/compose/web-operational.yaml';
let server: Server;
let origin = '';

beforeAll(async () => {
  mkdirSync(join(workspaceRoot, 'integration/compose'), { recursive: true });
  writeFileSync(join(workspaceRoot, profile), 'name: fixture\n');
  await execFileAsync('node', ['scripts/build.mjs', '--target', 'all', '--out-dir', distDir], {
    cwd: repoRoot,
  });
  await execFileAsync(
    'node',
    ['scripts/package.mjs', '--dist-dir', distDir, '--out-dir', releaseDir],
    { cwd: repoRoot },
  );
  server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/v1/status') response.end(JSON.stringify({ state: 'operational' }));
    else if (request.url === '/v1/capabilities') response.end(JSON.stringify({ capabilities: ['platform.operations.inspect'] }));
    else { response.statusCode = 404; response.end('{}'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('fixture server has no port');
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  rmSync(workDir, { recursive: true, force: true });
});

function observeArgs(output: string): string[] {
  return [
    'scripts/workspace-smoke.mjs', 'observe', '--origin', origin,
    '--synthetic-credential', 'fixture-owner', '--release-dir', releaseDir,
    '--workspace-root', workspaceRoot, '--workspace-revision', 'fixture-revision',
    '--profile', profile, '--namespace', 'extension-fixture', '--kind', 'fixture',
    '--output', output,
  ];
}

describe('workspace smoke evidence', () => {
  it('records exact live inputs and artifact digests without relabelling fixture proof', async () => {
    const pending = join(workDir, 'new-evidence-directory', 'pending.json');
    const teardown = join(workDir, 'teardown.json');
    const output = join(workDir, 'evidence.json');
    await execFileAsync('node', observeArgs(pending), { cwd: repoRoot });
    writeFileSync(teardown, `${JSON.stringify({ namespace: 'extension-fixture', remaining_resources: 0, status: 'passed' })}\n`);
    await execFileAsync('node', [
      'scripts/workspace-smoke.mjs', 'finalize', '--pending', pending,
      '--teardown-evidence', teardown, '--output', output,
    ], { cwd: repoRoot });
    const evidence = JSON.parse(readFileSync(output, 'utf8')) as {
      artifacts: Array<{ sha256: string; target: string }>;
      kind: string;
      status: string;
      workspace: { profile: string; revision: string };
    };
    expect(evidence.kind).toBe('fixture');
    expect(evidence.status).toBe('passed');
    expect(evidence.workspace).toEqual({ profile, revision: 'fixture-revision' });
    expect(evidence.artifacts.map(({ target }) => target)).toEqual(['chromium', 'firefox']);
    expect(evidence.artifacts.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true);
  });

  it('refuses a missing profile and non-synthetic credential declaration', async () => {
    const missingProfile = observeArgs(join(workDir, 'missing.json'));
    missingProfile[missingProfile.indexOf(profile)] = 'integration/compose/missing.yaml';
    await expect(execFileAsync('node', missingProfile, { cwd: repoRoot })).rejects.toMatchObject({ code: 1 });
    const unsafe = observeArgs(join(workDir, 'unsafe.json')).map((value) => value === '--synthetic-credential' ? '--credential' : value);
    await expect(execFileAsync('node', unsafe, { cwd: repoRoot })).rejects.toMatchObject({ code: 1 });
  });

  it('keeps incomplete teardown blocked', async () => {
    const pending = join(workDir, 'blocked-pending.json');
    const teardown = join(workDir, 'blocked-teardown.json');
    const output = join(workDir, 'blocked-evidence.json');
    await execFileAsync('node', observeArgs(pending), { cwd: repoRoot });
    writeFileSync(teardown, `${JSON.stringify({ namespace: 'extension-fixture', remaining_resources: 1, status: 'failed' })}\n`);
    await expect(execFileAsync('node', [
      'scripts/workspace-smoke.mjs', 'finalize', '--pending', pending,
      '--teardown-evidence', teardown, '--output', output,
    ], { cwd: repoRoot })).rejects.toMatchObject({ code: 1 });
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({ status: 'blocked' });
  });
});
