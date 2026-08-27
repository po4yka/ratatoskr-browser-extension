import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function loadManifest(): Record<string, unknown> {
  const raw = readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function loadEnglishCatalog(): Record<string, { message: string }> {
  const raw = readFileSync(new URL('../src/_locales/en/messages.json', import.meta.url), 'utf8');
  return JSON.parse(raw) as Record<string, { message: string }>;
}

describe('manifest baseline', () => {
  it('is valid Manifest V3 named for Ratatoskr', () => {
    const manifest = loadManifest();
    expect(manifest['manifest_version']).toBe(3);
    expect(manifest['name']).toBe('__MSG_extensionName__');
    expect(manifest['default_locale']).toBe('en');
    expect(loadEnglishCatalog()['extensionName']?.message).toBe('Ratatoskr');
    expect(typeof manifest['version']).toBe('string');
    expect((manifest['version'] as string).length).toBeGreaterThan(0);
  });

  it('requests only reviewed extension capabilities and optional HTTPS endpoint access', () => {
    const manifest = loadManifest();
    expect(manifest['permissions']).toEqual(['activeTab', 'alarms', 'contextMenus', 'storage']);
    expect(manifest['host_permissions'] ?? []).toEqual([]);
    expect(manifest['optional_host_permissions']).toEqual(['https://*/*']);
    expect(manifest['optional_permissions'] ?? []).toEqual([]);
  });
});
