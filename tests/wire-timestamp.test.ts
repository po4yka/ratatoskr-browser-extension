import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDraft, type SocialCaptureProvenance } from '../src/capture/draft';
import { createPlatformCaptureClient, PlatformCaptureError } from '../src/capture/platform-client';
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

function submitWith(capturedAt: string): { readonly requests: Request[]; readonly result: Promise<unknown> } {
  const requests: Request[] = [];
  const client = createPlatformCaptureClient({
    endpoint: 'https://ratatoskr.example',
    fetch: async (input, init) => {
      requests.push(new Request(input, init));
      return new Response(JSON.stringify({ operation_id: 'operation-1', status: 'accepted' }), { status: 202 });
    },
  });
  const social: SocialCaptureProvenance = { acquisition: 'browser_extension', capturedAt, provider: 'x', savedAuthority: 'explicit_user_capture' };
  const result = client.submit({
    accessToken: 'device-token',
    idempotencyKey: 'key-1',
    social,
    url: 'https://x.com/ratatoskr/status/1234567890123456789',
  });
  return { requests, result };
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

  it('repairs a queued non-canonical captured_at when submitting', async () => {
    const { requests, result } = submitWith(`${second}.120Z`);

    await expect(result).resolves.toEqual({ operationId: 'operation-1' });
    expect(requests).toHaveLength(1);
    const body = await requests[0]?.json() as { readonly social: { readonly captured_at: string } };
    expect(body.social.captured_at).toBe(`${second}.12Z`);
  });

  it('fails permanently when captured_at is not a UTC instant', async () => {
    for (const capturedAt of ['not a timestamp', '2026-08-27T13:30:00+04:00', '2026-13-45T99:00:00Z', '2026-02-31T00:00:00Z']) {
      const { requests, result } = submitWith(capturedAt);

      await expect(result).rejects.toMatchObject({ kind: 'permanent' });
      await expect(result).rejects.toBeInstanceOf(PlatformCaptureError);
      expect(requests).toHaveLength(0);
    }
  });
});
