import { describe, expect, it } from 'vitest';

interface QueueApi {
  createQueue(options: QueueOptions): {
    enqueue(draft: Draft, mode: 'tracked'): Promise<unknown>;
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
  readonly store: MemoryStore;
  readonly submit: () => Promise<{ readonly operationId: string; readonly type: 'accepted' }>;
}

interface Draft {
  readonly captureKind: 'page';
  readonly entryPoint: 'popup';
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
}

class MemoryStore {
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

describe('tracked queue acceptance', () => {
  it('persists a tracked Platform operation identity after acceptance', async () => {
    const { createQueue } = await loadQueueApi();
    const queue = createQueue({
      createAttemptId: () => 'attempt-tracked',
      createCaptureId: () => 'capture-tracked',
      createIdempotencyKey: () => 'idempotency-tracked',
      now: () => 1_000,
      random: () => 0.5,
      store: new MemoryStore(),
      submit: async () => ({ operationId: 'operation-tracked', type: 'accepted' }),
    });

    await queue.enqueue(draft(), 'tracked');
    await queue.processDue();

    await expect(queue.items()).resolves.toMatchObject([
      { id: 'capture-tracked', mode: 'tracked', operationId: 'operation-tracked', status: 'accepted' },
    ]);
  });
});

function draft(): Draft {
  return {
    captureKind: 'page',
    entryPoint: 'popup',
    sourcePageUrl: 'https://example.test/source',
    title: 'Example page',
    url: 'https://example.test/source',
  };
}
