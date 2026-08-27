import { describe, expect, it } from 'vitest';

interface QueueApi {
  createQueue(options: QueueOptions): {
    enqueue(draft: CaptureDraft): Promise<unknown>;
    items(): Promise<readonly unknown[]>;
    processDue(): Promise<void>;
  };
}

interface QueueOptions {
  readonly createAttemptId: () => string;
  readonly createCaptureId: () => string;
  readonly createIdempotencyKey: () => string;
  readonly now: () => number;
  readonly random: () => number;
  readonly store: MemoryQueueStore;
  readonly submit: (request: { readonly idempotencyKey: string }) => Promise<{ readonly reason: 'authentication-required'; readonly type: 'terminal' }>;
}

interface CaptureDraft {
  readonly captureKind: 'page';
  readonly entryPoint: 'popup';
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
}

class MemoryQueueStore {
  private snapshot: unknown;

  async load(): Promise<unknown> {
    return this.snapshot;
  }

  async save(snapshot: unknown): Promise<void> {
    this.snapshot = snapshot;
  }
}

async function loadQueueApi(): Promise<QueueApi> {
  return (await import(new URL('../src/queue/queue.ts', import.meta.url).href)) as QueueApi;
}

describe('durable queue authorization outcome', () => {
  it('does not retry an authentication-required terminal outcome', async () => {
    const { createQueue } = await loadQueueApi();
    const submittedKeys: string[] = [];
    const queue = createQueue({
      createAttemptId: () => 'attempt-authentication',
      createCaptureId: () => 'capture-authentication',
      createIdempotencyKey: () => 'idempotency-authentication',
      now: () => 1_000,
      random: () => 0.5,
      store: new MemoryQueueStore(),
      submit: async ({ idempotencyKey }) => {
        submittedKeys.push(idempotencyKey);
        return { reason: 'authentication-required', type: 'terminal' };
      },
    });

    await queue.enqueue({
      captureKind: 'page',
      entryPoint: 'popup',
      sourcePageUrl: 'https://example.test/source',
      title: 'Example page',
      url: 'https://example.test/source',
    });
    await queue.processDue();
    await queue.processDue();

    await expect(queue.items()).resolves.toMatchObject([{ status: 'terminal-failure', terminalReason: 'authentication-required' }]);
    expect(submittedKeys).toEqual(['idempotency-authentication']);
  });
});
