import { describe, expect, it } from 'vitest';

interface CaptureClient {
  submit(request: {
    readonly accessToken: string;
    readonly idempotencyKey: string;
    readonly social: {
      readonly acquisition: 'browser_extension';
      readonly capturedAt: string;
      readonly provider: 'x' | 'instagram' | 'threads';
      readonly savedAuthority: 'explicit_user_capture';
    };
    readonly url: string;
  }): Promise<{ readonly operationId: string }>;
}

interface Queue {
  enqueue(draft: Draft): Promise<unknown>;
  processDue(): Promise<void>;
}

interface Draft {
  readonly captureKind: 'page';
  readonly entryPoint: 'popup';
  readonly social: {
    readonly acquisition: 'browser_extension';
    readonly capturedAt: string;
    readonly provider: 'x';
    readonly savedAuthority: 'explicit_user_capture';
  };
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
}

interface Api {
  createPlatformCaptureClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): CaptureClient;
  createQueue(options: {
    readonly createAttemptId: () => string;
    readonly createCaptureId: () => string;
    readonly createIdempotencyKey: () => string;
    readonly now: () => number;
    readonly random: () => number;
    readonly store: { load(): Promise<unknown>; save(value: unknown): Promise<void> };
    readonly submit: (request: { readonly draft: Draft; readonly idempotencyKey: string }) => Promise<{ readonly operationId?: string; readonly type: 'accepted' | 'retryable' }>;
  }): Queue;
}

async function loadApi(): Promise<Api> {
  const [client, queue] = await Promise.all([
    import(new URL('../src/capture/platform-client.ts', import.meta.url).href),
    import(new URL('../src/queue/queue.ts', import.meta.url).href),
  ]);
  return { ...client, ...queue } as Api;
}

describe('social capture submission', () => {
  it('preserves the explicit social provenance and idempotency key across a queued retry', async () => {
    const { createPlatformCaptureClient, createQueue } = await loadApi();
    const requests: Request[] = [];
    let attempts = 0;
    const client = createPlatformCaptureClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        attempts += 1;
        return attempts === 1
          ? new Response('{}', { status: 503 })
          : new Response(JSON.stringify({ operation_id: 'operation-social-1', status: 'accepted' }), { status: 202 });
      },
    });
    let now = 0;
    let stored: unknown = { items: [] };
    const queue = createQueue({
      createAttemptId: () => `attempt-${attempts + 1}`,
      createCaptureId: () => 'capture-social-1',
      createIdempotencyKey: () => 'social-idempotency-key',
      now: () => now,
      random: () => 0,
      store: { load: async () => stored, save: async (value) => { stored = value; } },
      submit: async (request) => {
        try {
          const accepted = await client.submit({
            accessToken: 'device-token-that-must-not-enter-the-body',
            idempotencyKey: request.idempotencyKey,
            social: request.draft.social,
            url: request.draft.url,
          });
          return { operationId: accepted.operationId, type: 'accepted' };
        } catch {
          return { type: 'retryable' };
        }
      },
    });
    const draft: Draft = {
      captureKind: 'page',
      entryPoint: 'popup',
      social: {
        acquisition: 'browser_extension',
        capturedAt: '2026-08-27T10:00:00Z',
        provider: 'x',
        savedAuthority: 'explicit_user_capture',
      },
      sourcePageUrl: 'https://x.com/ratatoskr/status/1234567890123456789',
      title: 'Private provider page title',
      url: 'https://x.com/ratatoskr/status/1234567890123456789',
    };

    await queue.enqueue(draft);
    await queue.processDue();
    now = 1_000;
    await queue.processDue();

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.headers.get('idempotency-key'))).toEqual([
      'social-idempotency-key',
      'social-idempotency-key',
    ]);
    for (const request of requests) {
      expect(await request.clone().json()).toEqual({
        social: {
          acquisition: 'browser_extension',
          captured_at: '2026-08-27T10:00:00Z',
          provider: 'x',
          saved_authority: 'explicit_user_capture',
        },
        url: 'https://x.com/ratatoskr/status/1234567890123456789',
      });
      const encoded = await request.text();
      expect(encoded).not.toContain('device-token');
      expect(encoded).not.toContain('Private provider page title');
    }
  });
});
