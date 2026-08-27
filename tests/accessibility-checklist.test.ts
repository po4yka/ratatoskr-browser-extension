import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function surface(name: 'options' | 'popup'): string {
  return readFileSync(new URL(`../src/${name}/index.html`, import.meta.url), 'utf8');
}

function checklist(markup: string, expectedDialogs: number): void {
  expect(markup).toContain('<html data-i18n-lang');
  expect(markup).toMatch(/<main(?:\s|>)/);
  expect(markup).toMatch(/<h1[^>]*data-i18n/);
  expect(markup).toContain('<link href="../ui/styles.css" rel="stylesheet">');
  expect(markup).toMatch(/aria-live="(?:polite|assertive)"/);
  expect(markup).not.toContain('tabindex="-1"');
  expect((markup.match(/<dialog\b/g) ?? [])).toHaveLength(expectedDialogs);
  for (const dialog of markup.match(/<dialog\b[\s\S]*?<\/dialog>/g) ?? []) {
    expect(dialog).toMatch(/aria-labelledby="[^"]+"/);
    expect(dialog).toMatch(/<button\b/);
  }
}

describe('plan item 9 accessibility checklist', () => {
  it('popup passes the plan-item-9 accessibility checklist', () => {
    const markup = surface('popup');
    checklist(markup, 2);
    expect(markup).toContain('<fieldset data-role="capture-mode"');
    expect(markup).toMatch(/<legend[^>]*data-i18n/);
    expect(markup).toMatch(/<label[^>]*for="capture-mode-/);
  });

  it('options passes the plan-item-9 accessibility checklist', () => {
    const markup = surface('options');
    checklist(markup, 4);
    expect(markup).toMatch(/<label[^>]*for="pairing-endpoint"/);
    expect(markup).toMatch(/<label[^>]*for="pairing-code"/);
    expect(markup).toContain('aria-describedby="diagnostics-sensitive-warning"');
  });

  it('shared styles expose focus and reduced-motion behavior', () => {
    const styles = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });
});
