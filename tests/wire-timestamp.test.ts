import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDraft } from '../src/capture/draft';
import { isCaptureDraft } from '../src/protocol/validation';
import { formatWireTimestamp } from '../src/protocol/wire-timestamp';

const second = '2026-08-27T09:30:00';
const base = Date.parse(`${second}Z`);

function oracle(ms: number): string {
  return `${second}${ms === 0 ? '' : `.${String(ms).padStart(3, '0').replace(/0+$/, '')}`}Z`;
}

function socialDraft(capturedAt: string): unknown {
  const url = 'https://x.com/ratatoskr/status/1234567890123456789';
  return {
    captureKind: 'page',
    entryPoint: 'popup',
    social: { acquisition: 'browser_extension', capturedAt, provider: 'x', savedAuthority: 'explicit_user_capture' },
    sourcePageUrl: url,
    title: 'A post',
    url,
  };
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

  it('rejects non-canonical and accepts canonical draft timestamps', () => {
    expect(isCaptureDraft(socialDraft(`${second}.120Z`))).toBe(false);
    expect(isCaptureDraft(socialDraft(`${second}.100Z`))).toBe(false);
    expect(isCaptureDraft(socialDraft(`${second}.12Z`))).toBe(true);
    expect(isCaptureDraft(socialDraft(`${second}.1Z`))).toBe(true);
    expect(isCaptureDraft(socialDraft(`${second}Z`))).toBe(true);
  });
});
