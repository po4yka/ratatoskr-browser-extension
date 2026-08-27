import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function loadManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8')) as Record<string, unknown>;
}

function loadRationale(): string {
  return readFileSync(new URL('../docs/PERMISSIONS.md', import.meta.url), 'utf8');
}

describe('minimal permission baseline', () => {
  it('requests only reviewed extension permissions and no persistent page access', () => {
    const manifest = loadManifest();

    expect(manifest['permissions']).toEqual(['activeTab', 'alarms', 'contextMenus', 'storage']);
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest).not.toHaveProperty('optional_host_permissions');
    expect(manifest).not.toHaveProperty('content_scripts');
  });

  it('documents every requested permission and excluded broad grant in the committed rationale table', () => {
    const rationale = loadRationale();

    expect(rationale).toContain('| Permission | Plan items | User-visible purpose | Why this is minimal |');
    for (const permission of ['activeTab', 'alarms', 'contextMenus', 'storage']) {
      expect(rationale).toContain(`| \`${permission}\` |`);
    }
    for (const excluded of ['host_permissions', 'cookies', 'history', 'tabs', 'webRequest', 'downloads', 'scripting', 'commands', 'notifications']) {
      expect(rationale).toContain(`\`${excluded}\``);
    }
  });
});
