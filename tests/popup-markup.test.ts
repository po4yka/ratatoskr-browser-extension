import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function loadPopupMarkup(): string {
  return readFileSync(new URL('../src/popup/index.html', import.meta.url), 'utf8');
}

describe('popup markup', () => {
  it('provides keyboard-operable staging with draft preview and a live state announcement', () => {
    const markup = loadPopupMarkup();

    expect(markup).toContain('<form data-role="capture-form">');
    expect(markup).toContain('<output data-role="draft-url">');
    expect(markup).toContain('<output data-role="draft-title">');
    expect(markup).toContain('<output data-role="draft-selection">');
    expect(markup).toContain('<button data-action="stage" type="submit">Stage capture</button>');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain('tabindex="-1"');
  });
});
