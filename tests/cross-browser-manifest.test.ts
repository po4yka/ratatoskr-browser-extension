import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Manifest = Record<string, unknown>;

const manifestRoot = new URL('../src/manifests/', import.meta.url);

function readJson(name: string): Manifest {
  return JSON.parse(readFileSync(new URL(name, manifestRoot), 'utf8')) as Manifest;
}

describe('cross-browser manifest matrix', () => {
  it('keeps Firefox deltas compatibility-only', () => {
    const expectedSources = ['base.json', 'chromium.json', 'firefox.json'];
    expect(
      expectedSources.filter((name) => !existsSync(new URL(name, manifestRoot))),
      'shared and target manifest sources',
    ).toEqual([]);

    const base = readJson('base.json');
    const chromium = readJson('chromium.json');
    const firefox = readJson('firefox.json');

    for (const field of [
      'permissions',
      'host_permissions',
      'optional_host_permissions',
      'content_security_policy',
      'action',
      'options_ui',
      'icons',
    ]) {
      expect(chromium[field], `chromium delta must not override ${field}`).toBeUndefined();
      expect(firefox[field], `firefox delta must not override ${field}`).toBeUndefined();
      expect(base[field], `shared ${field}`).toBeDefined();
    }

    expect(chromium).toEqual({
      background: { service_worker: 'background/service-worker.js' },
    });
    expect(firefox).toMatchObject({
      background: { scripts: ['background/service-worker.js'] },
      browser_specific_settings: {
        gecko: {
          data_collection_permissions: { required: ['websiteActivity', 'websiteContent'] },
        },
      },
    });
  });
});
