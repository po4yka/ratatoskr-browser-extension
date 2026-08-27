import { describe, expect, it } from 'vitest';

interface TrackerApi {
  canRetry(snapshot: Snapshot): boolean;
  createOperationTracker(options: { readonly client: { readOperation(request: { readonly operationId: string }): Promise<Snapshot> }; readonly store: MemoryStore }): OperationTracker;
  readerDeepLink(endpoint: string, snapshot: Snapshot): string | undefined;
}

interface OperationTracker {
  items(): Promise<readonly TrackedOperation[]>;
  poll(): Promise<void>;
  recover(items: readonly QueueItem[]): Promise<void>;
}

interface QueueItem {
  readonly id: string;
  readonly mode?: 'quick' | 'tracked';
  readonly operationId?: string;
  readonly status: 'accepted';
}

interface TrackedOperation {
  readonly captureId: string;
  readonly snapshot: Snapshot;
}

interface Snapshot {
  readonly operationId: string;
  readonly progressPercent?: number;
  readonly results: readonly { readonly resultKind: string; readonly target: string }[];
  readonly retryable: boolean;
  readonly stage?: string;
  readonly status: 'accepted' | 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';
  readonly statusChangedAt: string;
  readonly warnings: readonly string[];
}

class MemoryStore {
  private value: unknown;

  async load(): Promise<unknown> {
    return this.value;
  }

  async save(value: unknown): Promise<void> {
    this.value = value;
  }
}

async function loadApi(): Promise<TrackerApi> {
  return (await import(new URL('../src/capture/operation-tracker.ts', import.meta.url).href)) as TrackerApi;
}

const accepted: Snapshot = {
  operationId: 'operation-1',
  results: [],
  retryable: false,
  status: 'accepted',
  statusChangedAt: '2026-08-27T10:00:00Z',
  warnings: [],
};

describe('operation tracker', () => {
  it('restart polling recovers a terminal snapshot and ignores an older snapshot', async () => {
    const { createOperationTracker } = await loadApi();
    const store = new MemoryStore();
    const client = { readOperation: async () => ({ ...accepted, progressPercent: 100, status: 'succeeded' as const, statusChangedAt: '2026-08-27T10:02:00Z' }) };
    const firstWorker = createOperationTracker({ client, store });
    await firstWorker.recover([{ id: 'capture-1', mode: 'tracked', operationId: 'operation-1', status: 'accepted' }]);
    await firstWorker.poll();

    const secondWorker = createOperationTracker({ client: { readOperation: async () => accepted }, store });
    await secondWorker.poll();
    await expect(secondWorker.items()).resolves.toEqual([
      { captureId: 'capture-1', snapshot: { ...accepted, progressPercent: 100, status: 'succeeded', statusChangedAt: '2026-08-27T10:02:00Z' } },
    ]);
  });

  it('forms a reader deep link only for a document result and recognizes retryable failure', async () => {
    const { canRetry, readerDeepLink } = await loadApi();
    const complete: Snapshot = {
      ...accepted,
      results: [{ resultKind: 'content.document', target: 'document:article-1' }],
      status: 'succeeded',
      statusChangedAt: '2026-08-27T10:03:00Z',
    };

    expect(readerDeepLink('https://ratatoskr.example', complete)).toBe('https://ratatoskr.example/documents/article-1');
    expect(readerDeepLink('https://ratatoskr.example', { ...complete, results: [{ resultKind: 'content.document', target: 'document:../../escape' }] })).toBeUndefined();
    expect(canRetry({ ...accepted, retryable: true, status: 'failed' })).toBe(true);
  });
});
