import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDraft } from '../src/capture/draft';
import { formatWireTimestamp } from '../src/protocol/wire-timestamp';

const second = '2026-08-27T09:30:00';
const base = Date.parse(`${second}Z`);

function oracle(ms: number): string {
  return `${second}${ms === 0 ? '' : `.${String(ms).padStart(3, '0').replace(/0+$/, '')}`}Z`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('canonical wire timestamps', () => {
  it('formats every millisecond value of a second canonically', () => {
    for (let ms = 0; ms < 1000; ms += 1) {
      const formatted = formatWireTimestamp(new Date(base + ms));
      expect(formatted).toBe(oracle(ms));
      expect(formatted).not.toMatch(/\.\d*0Z$/);
    }
  });

  it('stamps a social draft with a canonical captured_at', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(base + 120));

    const draft = createDraft({
      entryPoint: 'popup',
      tab: { title: 'A post', url: 'https://x.com/ratatoskr/status/1234567890123456789' },
    });

    expect(draft.social?.capturedAt).toBe(`${second}.12Z`);
  });
});
