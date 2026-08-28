import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ciUrl = new URL('../.github/workflows/ci.yml', import.meta.url);
const releaseUrl = new URL('../.github/workflows/release.yml', import.meta.url);

describe('release workflow policy', () => {
  it('separates read-only CI from owner-authorized store jobs', () => {
    const ci = readFileSync(ciUrl, 'utf8');
    expect(ci).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(ci).not.toMatch(/secrets\.(?:CWS_|WEB_EXT_)/);
    expect(existsSync(releaseUrl), 'manual release workflow').toBe(true);

    const release = readFileSync(releaseUrl, 'utf8');
    expect(release).toMatch(/on:\s*\n\s+workflow_dispatch:/);
    expect(release).not.toMatch(/pull_request:|push:/);
    expect(release).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(release.match(/environment: extension-stores/g)).toHaveLength(2);
    expect(release).toContain('npm run release:check');

    const chromium = release.slice(release.indexOf('  chromium:'), release.indexOf('  firefox:'));
    const firefox = release.slice(release.indexOf('  firefox:'));
    expect(chromium).toMatch(/secrets\.CWS_CLIENT_ID/);
    expect(chromium).not.toMatch(/secrets\.WEB_EXT_/);
    expect(chromium).toContain('npm run release:upload -- --store chromium --execute');
    expect(firefox).toMatch(/secrets\.WEB_EXT_API_KEY/);
    expect(firefox).not.toMatch(/secrets\.CWS_/);
    expect(firefox).toContain('npm run release:upload -- --store firefox --execute');
  });
});
