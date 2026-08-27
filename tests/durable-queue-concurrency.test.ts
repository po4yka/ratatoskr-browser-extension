import { describe, expect, it } from 'vitest';

interface QueueItem {
  readonly id: string;
}

interface DurableQueue {
  enqueue(draft: CaptureDraft): Promise<QueueItem>;
  items(): Promise<readonly QueueItem[]>;
}

interface QueueApi {
  createQueue(options: QueueOptions): DurableQueue;
}

interface QueueOptions {
  readonly createAttemptId: () => string;
  readonly createCaptureId: () => string;
  readonly createIdempotencyKey: () => string;
  readonly now: () => number;
  readonly random: () => number;
  readonly store: MemoryQueueStore;
  readonly submit: () => Promise<{ readonly type: 'accepted' }>;
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

describe('durable queue concurrency', () => {
  it('retains concurrent explicit captures', async () => {
    const { createQueue } = await loadQueueApi();
    let sequence = 0;
    const queue = createQueue({
      createAttemptId: () => 'attempt',
      createCaptureId: () => `capture-${++sequence}`,
      createIdempotencyKey: () => `idempotency-${sequence}`,
      now: () => 1_000,
      random: () => 0.5,
      store: new MemoryQueueStore(),
      submit: async () => ({ type: 'accepted' }),
    });

    await Promise.all([queue.enqueue(draft), queue.enqueue({ ...draft, title: 'Second page' })]);

    await expect(queue.items()).resolves.toMatchObject([{ id: 'capture-1' }, { id: 'capture-2' }]);
  });
});
