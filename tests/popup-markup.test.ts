import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function loadPopupMarkup(): string {
  return readFileSync(new URL('../src/popup/index.html', import.meta.url), 'utf8');
}

describe('popup markup', () => {
  it('provides keyboard-operable staging, explicit save modes, and a tracked operation panel', () => {
    const markup = loadPopupMarkup();

    expect(markup).toContain('<form data-role="capture-form">');
    expect(markup).toContain('<output data-role="draft-url">');
    expect(markup).toContain('<output data-role="draft-title">');
    expect(markup).toContain('<output data-role="draft-selection">');
    expect(markup).toContain('<button data-action="stage" type="submit">Stage capture</button>');
    expect(markup).toContain('<button data-action="quick-save" disabled type="button">Quick save</button>');
    expect(markup).toContain('<button data-action="tracked-save" disabled type="button">Tracked save</button>');
    expect(markup).toContain('data-role="operation-panel"');
    expect(markup).toContain('data-action="open-reader"');
    expect(markup).toContain('data-action="retry"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain('tabindex="-1"');
  });

  it('provides a capability-gated GitHub preview and separate write confirmations', () => {
    const markup = loadPopupMarkup();

    expect(markup).toContain('data-role="github-preview"');
    expect(markup).toContain('data-role="github-availability"');
    expect(markup).toContain('data-role="github-full-name"');
    expect(markup).toContain('data-action="github-metadata"');
    expect(markup).toContain('data-action="github-track"');
    expect(markup).toContain('data-action="github-star"');
    expect(markup).toContain('<dialog data-role="github-track-confirmation"');
    expect(markup).toContain('<dialog data-role="github-star-confirmation"');
    expect(markup).toContain('This writes to your connected GitHub account.');
    expect(markup).toContain('data-role="github-results"');
  });
});
