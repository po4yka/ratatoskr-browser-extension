import { describe, expect, it } from 'vitest';

interface QueueItem {
  readonly attemptCount: number;
  readonly id: string;
  readonly idempotencyKey: string;
  readonly mode?: 'quick' | 'tracked';
  readonly nextRetryAt?: number;
  readonly status: 'accepted' | 'queued' | 'retry-wait' | 'submitting' | 'terminal-failure';
  readonly terminalReason?: 'policy' | 'retry-exhausted' | 'validation';
}

interface DurableQueue {
  enqueue(draft: CaptureDraft, mode?: 'quick' | 'tracked'): Promise<QueueItem>;
  processDue(): Promise<void>;
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
  readonly limits?: { readonly maxAttempts: number; readonly maxItems: number; readonly maxPayloadBytes: number; readonly maxRetentionMs: number };
  readonly store: MemoryQueueStore;
  readonly submit: (request: { readonly idempotencyKey: string }) => Promise<SubmitOutcome>;
}

interface CaptureDraft {
  readonly captureKind: 'page';
  readonly entryPoint: 'popup';
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
}

type SubmitOutcome =
  | { readonly operationId?: string; readonly type: 'accepted' }
  | { readonly type: 'retryable' }
  | { readonly reason: 'authentication-required' | 'policy' | 'validation'; readonly type: 'terminal' };

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

describe('durable capture queue', () => {
  it('persists an idempotency key before submission and reuses it after retry', persistsIdempotencyKey);
  it('recovers a claimed submission after simulated worker suspension with one accepted fake-API effect', recoversAfterSuspension);
  it('persists bounded exponential retry backoff and does not reschedule permanent outcomes', persistsBackoff);
});

async function persistsIdempotencyKey(): Promise<void> {
    const { createQueue } = await loadQueueApi();
    const observedKeys: string[] = [];
    const store = new MemoryQueueStore();
    let now = 1_000;
    let outcome: SubmitOutcome = { type: 'retryable' };
    const queue = createQueue({
      createAttemptId: () => 'attempt-1',
      createCaptureId: () => 'capture-1',
      createIdempotencyKey: () => 'idempotency-1',
      now: () => now,
      random: () => 0.5,
      store,
      submit: async ({ idempotencyKey }) => {
        observedKeys.push(idempotencyKey);
        return outcome;
      },
    });

    await expect(queue.enqueue(draft)).resolves.toMatchObject({
      id: 'capture-1',
      idempotencyKey: 'idempotency-1',
      status: 'queued',
    });
    await queue.processDue();
    const [retry] = await queue.items();
    expect(retry).toMatchObject({ idempotencyKey: 'idempotency-1', status: 'retry-wait' });

    now = retry?.nextRetryAt ?? now;
    outcome = { type: 'accepted' };
    await queue.processDue();

    expect(observedKeys).toEqual(['idempotency-1', 'idempotency-1']);
    const [accepted] = await queue.items();
    expect(accepted).toMatchObject({ id: 'capture-1', idempotencyKey: 'idempotency-1', status: 'accepted' });
}

async function recoversAfterSuspension(): Promise<void> {
    const { createQueue } = await loadQueueApi();
    const acceptedEffects = new Set<string>();
    const observedKeys: string[] = [];
    const store = new MemoryQueueStore();
    let markFirstSubmissionStarted: () => void = () => {
      throw new Error('First submission did not start.');
    };
    const firstSubmissionStarted = new Promise<void>((resolve) => {
      markFirstSubmissionStarted = resolve;
    });
    let firstCall = true;
    const submit = async ({ idempotencyKey }: { readonly idempotencyKey: string }): Promise<SubmitOutcome> => {
      observedKeys.push(idempotencyKey);
      acceptedEffects.add(idempotencyKey);
      if (firstCall) {
        firstCall = false;
        markFirstSubmissionStarted();
        return new Promise<never>(() => undefined);
      }
      return { type: 'accepted' };
    };
    const firstWorker = createQueue({
      createAttemptId: () => 'attempt-first',
      createCaptureId: () => 'capture-1',
      createIdempotencyKey: () => 'idempotency-1',
      now: () => 1_000,
      random: () => 0.5,
      store,
      submit,
    });

    await firstWorker.enqueue(draft);
    void firstWorker.processDue();
    await firstSubmissionStarted;

    const restartedWorker = createQueue({
      createAttemptId: () => 'attempt-recovered',
      createCaptureId: () => 'unexpected-capture',
      createIdempotencyKey: () => 'unexpected-key',
      now: () => 2_000,
      random: () => 0.5,
      store,
      submit,
    });
    await restartedWorker.processDue();

    expect(observedKeys).toEqual(['idempotency-1', 'idempotency-1']);
    expect(acceptedEffects).toEqual(new Set(['idempotency-1']));
    await expect(restartedWorker.items()).resolves.toMatchObject([
      { idempotencyKey: 'idempotency-1', status: 'accepted' },
    ]);
}

async function persistsBackoff(): Promise<void> {
    const { createQueue } = await loadQueueApi();
    const store = new MemoryQueueStore();
    const submittedKeys: string[] = [];
    let now = 1_000;
    const outcomes: SubmitOutcome[] = [
      { type: 'retryable' },
      { type: 'retryable' },
      { reason: 'validation', type: 'terminal' },
    ];
    const queue = createQueue({
      createAttemptId: () => `attempt-${submittedKeys.length + 1}`,
      createCaptureId: () => 'capture-backoff',
      createIdempotencyKey: () => 'idempotency-backoff',
      now: () => now,
      random: () => 0.5,
      store,
      submit: async ({ idempotencyKey }) => {
        submittedKeys.push(idempotencyKey);
        const outcome = outcomes.shift();
        if (outcome === undefined) {
          throw new Error('Unexpected submission.');
        }
        return outcome;
      },
    });

    await queue.enqueue(draft);
    await queue.processDue();
    await expect(queue.items()).resolves.toMatchObject([{ nextRetryAt: 2_000, status: 'retry-wait' }]);

    now = 2_000;
    await queue.processDue();
    await expect(queue.items()).resolves.toMatchObject([{ nextRetryAt: 4_000, status: 'retry-wait' }]);

    now = 4_000;
    await queue.processDue();
    await expect(queue.items()).resolves.toMatchObject([
      { idempotencyKey: 'idempotency-backoff', status: 'terminal-failure', terminalReason: 'validation' },
    ]);

    now = 60_000;
    await queue.processDue();
    expect(submittedKeys).toEqual(['idempotency-backoff', 'idempotency-backoff', 'idempotency-backoff']);
}
