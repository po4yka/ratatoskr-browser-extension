import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function catalog(path = join(repoRoot, 'src/_locales/en/messages.json')): Record<string, { message: string }> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, { message: string }>;
}

function messageKeys(source: string): string[] {
  return [...source.matchAll(/(?:data-i18n(?:-[\w-]+)?|__MSG_)=["']?([A-Za-z][\w]*)|__MSG_([A-Za-z][\w]*)__/g)]
    .flatMap((match) => match[1] ?? match[2] ?? []);
}

describe('localization readiness', () => {
  it('every manifest and surface message key resolves', () => {
    const messages = catalog();
    const sources = ['src/manifests/base.json', 'src/popup/index.html', 'src/options/index.html']
      .map((path) => readFileSync(join(repoRoot, path), 'utf8'));
    const keys = sources.flatMap(messageKeys);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((key) => messages[key]?.message === undefined)).toEqual([]);
  });

  it('behavior entry points contain no user-visible English or Russian sentence', () => {
    const source = ['src/popup/popup.ts', 'src/options/options.ts', 'src/options/queue-view.ts']
      .map((path) => readFileSync(join(repoRoot, path), 'utf8')).join('\n');
    expect(source).not.toMatch(/Capture delivery is unavailable|Pairing request sent|No captures are queued|[А-Яа-яЁё]/);
  });

  it('packaged catalog is complete', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ratatoskr-i18n-'));
    try {
      await execFileAsync(
        'node',
        ['scripts/build.mjs', '--target', 'all', '--out-dir', outDir],
        { cwd: repoRoot },
      );
      for (const target of ['chromium', 'firefox']) {
        expect(catalog(join(outDir, target, '_locales/en/messages.json'))).toEqual(catalog());
      }
    } finally {
      rmSync(outDir, { force: true, recursive: true });
    }
  });
});
