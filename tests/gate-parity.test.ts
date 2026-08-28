import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function documentedGateCommands(doc: string): string[] {
  const marker = 'The product gate runs these commands:';
  const markerAt = doc.indexOf(marker);
  if (markerAt === -1) {
    throw new Error(
      'DEVELOPMENT.md has no "The product gate runs these commands:" list; the documented gate cannot be checked',
    );
  }
  const fenceStart = doc.indexOf('```', markerAt + marker.length);
  if (fenceStart === -1) throw new Error('DEVELOPMENT.md gate list has no opening code fence');
  const fenceBodyStart = doc.indexOf('\n', fenceStart) + 1;
  const fenceEnd = doc.indexOf('```', fenceBodyStart);
  if (fenceEnd === -1) throw new Error('DEVELOPMENT.md gate list has no closing code fence');
  return doc
    .slice(fenceBodyStart, fenceEnd)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('gate parity', () => {
  it('documented gate cannot drift from package.json scripts', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    expect(scripts['gate']).toBeDefined();

    const gateOrder = (scripts['gate'] ?? '')
      .split('&&')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        expect(part, 'gate step').toMatch(/^npm run ([a-z][a-z0-9:._-]*)$/);
        return part.replace(/^npm run /, '');
      });

    let documented: string[];
    try {
      documented = documentedGateCommands(readRepoFile('DEVELOPMENT.md')).map((line) => {
        expect(line, 'documented command').toMatch(/^npm run ([a-z][a-z0-9:._-]*)$/);
        return line.replace(/^npm run /, '');
      });
    } catch (error) {
      expect.unreachable(String(error));
    }

    // Same steps, same order, every name resolvable.
    expect(documented).toEqual(gateOrder);
    expect(gateOrder).toEqual([
      'lint',
      'typecheck',
      'test',
      'build',
      'package',
      'package:smoke',
      'store-assets',
      'release:check',
    ]);
    for (const name of documented) {
      expect(scripts[name], `script ${name}`).toBeDefined();
    }
  });

  it('records plan item 10 as complete without overstating publication', () => {
    const implementationPlan = readRepoFile('docs/IMPLEMENTATION_PLAN.md');
    const readme = readRepoFile('README.md');
    expect(implementationPlan).toContain(
      '10. **Complete:** add cross-browser packaging/release/signing and workspace integration.',
    );
    expect(readme).toContain('Implementation-plan items 1–10 now have code and focused tests.');
    expect(readme).not.toMatch(/cross-browser release (?:work is still pending|packaging remains)/i);
    expect(readme).toContain('upload blocker');
    expect(readme).toContain('composed-profile evidence');
  });
});
