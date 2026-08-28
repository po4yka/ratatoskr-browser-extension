import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function loadCsp(): string {
  const raw = readFileSync(new URL('../src/manifests/base.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(raw) as {
    content_security_policy?: { extension_pages?: string };
  };
  return manifest.content_security_policy?.extension_pages ?? '';
}

function directives(policy: string): Map<string, string[]> {
  const pairs = policy
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .flatMap((part) => {
      const [name, ...sources] = part.split(/\s+/);
      return name === undefined ? [] : ([[name.toLowerCase(), sources]] as const);
    });
  return new Map(pairs);
}

describe('manifest CSP', () => {
  it('declares an extension-pages policy', () => {
    expect(loadCsp().length).toBeGreaterThan(0);
  });

  it('allows scripts and objects only from self', () => {
    const policy = directives(loadCsp());
    expect(policy.get('script-src')).toEqual(["'self'"]);
    expect(policy.get('object-src')).toEqual(["'self'"]);
  });

  it('forbids unsafe-eval, unsafe-inline and remote origins', () => {
    const policy = directives(loadCsp());
    for (const [name, sources] of policy) {
      for (const source of sources) {
        const lowered = source.toLowerCase();
        expect(lowered, `${name} ${source}`).not.toContain('unsafe-eval');
        expect(lowered, `${name} ${source}`).not.toContain('unsafe-inline');
        expect(lowered, `${name} ${source}`).not.toMatch(/^https?:/);
        expect(lowered, `${name} ${source}`).not.toMatch(/^\*/);
      }
    }
  });
});
