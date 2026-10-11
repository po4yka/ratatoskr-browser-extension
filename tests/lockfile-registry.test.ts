import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = 'https://registry.npmjs.org/';

interface LockPackage {
  readonly integrity?: string;
  readonly link?: boolean;
  readonly resolved?: string;
}

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('lockfile registry', () => {
  it('every_resolved_url_is_on_the_public_npm_registry', () => {
    const lock = JSON.parse(readRepoFile('package-lock.json')) as { readonly packages: Record<string, LockPackage> };
    const entries = Object.entries(lock.packages).filter(([key]) => key !== '');
    const resolved = entries.filter(([, pkg]) => pkg.resolved !== undefined);

    // A lockfile that resolves nothing would pass the checks below vacuously.
    expect(resolved.length).toBeGreaterThan(0);

    const offRegistry = resolved.filter(([, pkg]) => !(pkg.resolved ?? '').startsWith(registry)).map(([key, pkg]) => `${key} -> ${pkg.resolved}`);
    expect(offRegistry).toEqual([]);

    const withoutIntegrity = resolved.filter(([, pkg]) => typeof pkg.integrity !== 'string' || pkg.integrity === '').map(([key]) => key);
    expect(withoutIntegrity).toEqual([]);
  });

  it('the_repository_pins_the_registry', () => {
    const lines = readRepoFile('.npmrc').split('\n').map((line) => line.trim());
    expect(lines).toContain(`registry=${registry}`);
  });
});
