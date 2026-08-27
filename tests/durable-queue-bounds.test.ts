import { describe, expect, it } from 'vitest';

interface QueueItem {
  readonly status: 'queued' | 'terminal-failure';
  readonly terminalReason?: 'retry-exhausted';
}

interface DurableQueue {
  enqueue(draft: CaptureDraft): Promise<QueueItem>;
  items(): Promise<readonly QueueItem[]>;
  processDue(): Promise<void>;
}

interface QueueApi {
  createQueue(options: QueueOptions): DurableQueue;
}

interface QueueOptions {
  readonly createAttemptId: () => string;
  readonly createCaptureId: () => string;
  readonly createIdempotencyKey: () => string;
  readonly limits: { readonly maxAttempts: number; readonly maxItems: number; readonly maxPayloadBytes: number; readonly maxRetentionMs: number };
  readonly now: () => number;
  readonly random: () => number;
  readonly store: MemoryQueueStore;
  readonly submit: () => Promise<{ readonly type: 'retryable' }>;
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

const draft: CaptureDraft = {
  captureKind: 'page',
  entryPoint: 'popup',
  sourcePageUrl: 'https://example.test/source',
  title: 'Example page',
  url: 'https://example.test/source',
};

describe('durable queue retention bounds', () => {
  it('rejects an oversized capture without discarding retained items and records retry exhaustion as terminal', async () => {
    const { createQueue } = await loadQueueApi();
    const queue = createQueue({
      createAttemptId: () => 'attempt-bounded',
      createCaptureId: () => 'capture-bounded',
      createIdempotencyKey: () => 'idempotency-bounded',
      limits: { maxAttempts: 1, maxItems: 2, maxPayloadBytes: 600, maxRetentionMs: 60_000 },
      now: () => 1_000,
      random: () => 0.5,
      store: new MemoryQueueStore(),
      submit: async () => ({ type: 'retryable' }),
    });

    await queue.enqueue(draft);
    await expect(queue.enqueue({ ...draft, title: 'x'.repeat(1_000) })).rejects.toThrow('too large');
    await expect(queue.items()).resolves.toHaveLength(1);

    await queue.processDue();
    await expect(queue.items()).resolves.toMatchObject([
      { status: 'terminal-failure', terminalReason: 'retry-exhausted' },
    ]);
  });
});
